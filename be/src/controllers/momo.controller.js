// controllers/momo.controller.js
import momoService from "../services/momo.service.js";
import Order from "../models/order.model.js";
import Address from "../models/address.model.js";
import Product from "../models/product.model.js";               //  NEW: tra sản phẩm/biến thể
import { quoteShipping } from "../services/shipping.service.js";
import { computeExpiryInfo } from "../utils/expiryHelpers.js";  //  NEW: helper BE

/* ---------------------------------------------
 * Helpers nội bộ
 * -------------------------------------------*/
async function resolveVariant(productDoc, cartItem) {
  const p = productDoc?.toObject ? productDoc.toObject() : productDoc;
  if (!p) return { product: null, variant: null };

  let variant = null;

  if (cartItem?.variantId) {
    variant = p.variants?.find(v => String(v._id) === String(cartItem.variantId)) || null;
  }
  if (!variant && cartItem?.variant) {
    const w = String(cartItem.variant.weight ?? "");
    const r = String(cartItem.variant.ripeness ?? "");
    variant = p.variants?.find(v =>
      String(v?.attributes?.weight ?? "") === w &&
      String(v?.attributes?.ripeness ?? "") === r
    ) || null;
  }

  if (!variant && p.baseVariant?.price != null) {
    variant = { ...p.baseVariant, _id: p.baseVariant?._id || "base" };
  }
  return { product: p, variant };
}

function buildItemSnapshot(product, variant, cartItem) {
  const vPrice = Number(variant?.price ?? product?.baseVariant?.price ?? 0);
  const info = computeExpiryInfo(product, vPrice); // { expireAt, daysLeft, discountPercent, basePrice, finalPrice }

  if (info.expireAt && info.expireAt < new Date()) {
    const name = product?.name || "Sản phẩm";
    const err = new Error(`"${name}" đã hết hạn sử dụng`);
    err.code = "EXPIRED_PRODUCT";
    throw err;
  }

  const qty = Number(cartItem?.quantity || 0);
  const line = info.finalPrice * qty;

  return {
    product: product._id,
    variantId: variant?._id || null,
    quantity: qty,
    basePrice: info.basePrice,
    finalPrice: info.finalPrice,
    discountPercent: info.discountPercent,
    expireAt: info.expireAt,
    daysLeft: info.daysLeft,
    lineTotal: line,
  };
}

function normalizeShippingFromDocOrPayload(payload, addrDoc) {
  const src = payload || {};
  const doc = addrDoc || {};
  return {
    fullName: src.fullName || doc.fullName,
    phone: src.phone || doc.phone,
    addressLine: src.addressLine || doc.detail || doc.addressLine || doc.address,
    wardName: src.wardName || doc.wardName || doc.ward,
    districtName: src.districtName || doc.districtName || doc.district,
    provinceName: src.provinceName || doc.provinceName || doc.province,
    wardCode: src.wardCode || doc.wardCode,
    districtCode: src.districtCode || doc.districtCode,
    provinceCode: src.provinceCode || doc.provinceCode,
  };
}

/* ---------------------------------------------
 * Tạo thanh toán MoMo
 * -------------------------------------------*/
const momoController = {
  createPayment: async (req, res) => {
    try {
      const { cartItems = [], voucher, address, shippingAddress, shippingFee: feeFromFE } = req.body;
      const userId = req.user._id;

      if (!Array.isArray(cartItems) || cartItems.length === 0) {
        return res.status(400).json({ message: "Giỏ hàng trống" });
      }
      if (!address) {
        return res.status(400).json({ message: "Thiếu địa chỉ giao hàng" });
      }

      // --- Chuẩn hoá địa chỉ giao hàng ---
      let normalizedShipping = shippingAddress || null;
      if (!normalizedShipping?.addressLine || !normalizedShipping?.phone) {
        const addrId = address?._id || address?.id;
        if (addrId) {
          const addrDoc = await Address.findById(addrId).lean().catch(() => null);
          if (addrDoc) {
            normalizedShipping = normalizeShippingFromDocOrPayload(shippingAddress, addrDoc);
          }
        }
      }
      if (!normalizedShipping?.addressLine || !normalizedShipping?.phone) {
        return res.status(400).json({
          message: "Lỗi tạo thanh toán MoMo",
          error: "Thiếu thông tin địa chỉ giao hàng",
        });
      }

      // --- Build snapshot items & subtotal (SERVER-TRUSTED) ---
      let itemsSnapshot = [];
      let subtotal = 0;

      for (const ci of cartItems) {
        const productDoc = await Product.findById(ci.productId).lean();
        if (!productDoc) {
          return res.status(400).json({ message: `Sản phẩm không tồn tại: ${ci.productId}` });
        }
        const { product, variant } = await resolveVariant(productDoc, ci);
        if (!variant) {
          return res.status(400).json({ message: `Biến thể không tồn tại cho sản phẩm ${product?.name || ci.productId}` });
        }
        const snap = buildItemSnapshot(product, variant, ci);
        itemsSnapshot.push(snap);
        subtotal += snap.lineTotal;
      }

      // --- Tính phí ship (nếu có code khu vực) ---
      let shippingFee = Number(feeFromFE || 0); // ưu tiên giữ fee FE đã quote (nếu bạn muốn)
      let shippingRuleName = undefined;

      try {
        const districtCode =
          String(normalizedShipping?.districtCode || "").trim();
        const wardCode =
          String(normalizedShipping?.wardCode || "").trim();

        if (districtCode || wardCode) {
          const quote = await quoteShipping({
            provinceCode: 1, // mặc định Hà Nội nếu bạn đang hardcode
            districtCode,
            wardCode,
            cartSubtotal: subtotal,
          });
          // Nếu muốn tin server hơn fee FE: dùng fee từ quote
          shippingFee = Number(quote?.amount ?? shippingFee ?? 0);
          shippingRuleName = quote?.ruleName;
        }
      } catch (e) {
        console.error("[momo.createPayment] Quote shipping error:", e?.message || e);
        // không chặn luồng nếu lỗi
      }

      // --- Tạo "đơn tạm" (trừ stock) rồi tạo payment ---
      const order = await momoService.createOrderTemp({
        userId,
        cartItems,                 // raw từ FE nếu service cần
        itemsSnapshot,             // ⬅️ NEW: snapshot tin cậy ở server
        voucher,
        shippingAddress: normalizedShipping,
        subtotal,
        shippingFee,
        shippingRuleName,
      });

      const paymentUrl = await momoService.createMomoPayment(order);
      return res.status(200).json({ paymentUrl });
    } catch (err) {
      if (err?.code === "EXPIRED_PRODUCT") {
        return res.status(400).json({ message: err.message });
      }
      console.error(" Lỗi khi tạo thanh toán MoMo:", err);
      return res.status(500).json({
        message: "Lỗi tạo thanh toán MoMo",
        error: err.message || "Unknown error",
      });
    }
  },

  // Xử lý IPN từ MoMo (xác nhận thanh toán)
  handleIPN: async (req, res) => {
    try {
      const { resultCode, orderId } = req.body;
      if (resultCode === 0) {
        await momoService.confirmMomoOrder(orderId);
        return res.status(200).json({ message: "Xác nhận thanh toán thành công" });
      } else {
        await momoService.cancelMomoOrder(orderId);
        return res.status(200).json({ message: "Giao dịch thất bại, đã hoàn stock" });
      }
    } catch (err) {
      console.error(" Lỗi xử lý IPN:", err);
      return res.status(500).json({ message: "Lỗi xử lý IPN", error: err.message });
    }
  },

  // API hủy tay
  cancelOrder: async (req, res) => {
    try {
      const { orderId } = req.params;
      const userId = req.user._id;

      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
      }
      if (order.user.toString() !== userId.toString()) {
        return res.status(403).json({ message: "Không có quyền hủy đơn này" });
      }
      if (order.paymentStatus === "paid") {
        return res.status(400).json({ message: "Không thể hủy đơn đã thanh toán" });
      }

      await momoService.cancelMomoOrder(orderId);
      res.json({ message: "Hủy đơn hàng thành công, đã hoàn stock" });
    } catch (err) {
      console.error(" Lỗi hủy đơn:", err);
      res.status(500).json({ message: "Lỗi hủy đơn hàng", error: err.message });
    }
  },
};

export default momoController;
