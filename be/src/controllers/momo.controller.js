// controllers/momo.controller.js
import momoService from "../services/momo.service.js";
import Order from "../models/order.model.js";
import Address from "../models/address.model.js";
import Product from "../models/product.model.js";
import { quoteShipping } from "../services/shipping.service.js";
import { computeExpiryInfo } from "../utils/expiryHelpers.js";

/* ---------------------------------------------
 * Utils: chuẩn hoá mã khu vực (giữ số 0 đầu)
 * -------------------------------------------*/
const padDistrict = (v) => {
  const s = String(v ?? "").trim();
  return /^\d+$/.test(s) ? s.padStart(3, "0") : s;
};
const padWard = (v) => {
  const s = String(v ?? "").trim();
  return /^\d+$/.test(s) ? s.padStart(5, "0") : s;
};

/* ---------------------------------------------
 * Helpers nội bộ — giống với order.controller (đã rút gọn)
 * -------------------------------------------*/
async function resolveVariant(productDoc, cartItem) {
  const p = productDoc?.toObject ? productDoc.toObject() : productDoc;
  if (!p) return { product: null, variant: null };

  let variant = null;

  if (cartItem?.variantId) {
    variant = p.variants?.find((v) => String(v._id) === String(cartItem.variantId)) || null;
  }
  if (!variant && cartItem?.variant) {
    const w = String(cartItem.variant.weight ?? "");
    const r = String(cartItem.variant.ripeness ?? "");
    variant =
      p.variants?.find(
        (v) =>
          String(v?.attributes?.weight ?? "") === w &&
          String(v?.attributes?.ripeness ?? "") === r
      ) || null;
  }
  if (!variant && p.baseVariant?.price != null) {
    variant = { ...p.baseVariant, _id: p.baseVariant?._id || "base" };
  }
  return { product: p, variant };
}

/* ---------- Snapshot VARIANT ---------- */
function buildVariantSnapshot(product, variant, cartItem) {
  const vPrice = Number(variant?.price ?? product?.baseVariant?.price ?? 0);
  const info = computeExpiryInfo(product, vPrice);

  // Chặn hàng hết hạn
  if (info.expireAt && info.expireAt < new Date()) {
    const name = product?.name || "Sản phẩm";
    const err = new Error(`"${name}" đã hết hạn sử dụng`);
    err.code = "EXPIRED_PRODUCT";
    throw err;
  }

  const qty = Math.max(1, Number(cartItem?.quantity || 0)) || 1;
  const unitFinal = Number.isFinite(info.finalPrice) ? Number(info.finalPrice) : Number(vPrice);
  const unitBase = Number.isFinite(info.basePrice) ? Number(info.basePrice) : Number(vPrice);
  const line = Math.round(unitFinal * qty);

  return {
    type: "variant",
    product: product._id,
    productName: product.name,
    isCombo: false,
    isMix: false,
    variantId: variant?._id || null,
    variant: {
      weight: variant?.attributes?.weight || "",
      ripeness: variant?.attributes?.ripeness || "",
      grade: variant?.grade || "",
    },
    quantity: qty,
    unitPrice: Math.round(unitBase),
    unitPriceFinal: Math.round(unitFinal),
    price: Math.round(unitFinal),
    lineTotal: line,
    nearExpiryDiscountPercent: Number(info.discountPercent || 0),
    _expiry: {
      expireAt: info.expireAt || null,
      daysLeft: info.daysLeft ?? null,
    },
  };
}

/* ---------- Combo ---------- */
function isComboCartItem(ci) {
  const type = String(ci?.type || "").toLowerCase();
  const snap = ci?.snapshot || {};
  return type === "combo" || snap?.isCombo === true || Array.isArray(snap?.items);
}

function buildComboSnapshotForOrder(ci) {
  const qty = Math.max(1, Number(ci?.quantity || 0)) || 1;

  const snap = ci?.snapshot || {};
  const rawUnit = snap.unitPrice ?? ci?.unitPrice ?? 0;
  const unitPrice = Math.max(0, Number(rawUnit) || 0);
  const items =
    Array.isArray(snap.items) && snap.items.length
      ? snap.items.map((x) => ({
          productId: x.productId || x.id || null,
          qty: Math.max(1, Number(x.qty || x.quantity || 1)) || 1,
        }))
      : [];

  const line = Math.round(unitPrice * qty);

  return {
    type: "combo",
    product: ci?.productId || null,
    productName: snap.title || ci?.title || "Combo",
    isCombo: true,
    isMix: false,
    variantId: null,
    variant: null,
    combo: {
      title: snap.title || ci?.title || "Combo",
      image: snap.image || ci?.image || null,
      discountPercent: Number(snap.discountPercent || 0),
      items,
    },
    quantity: qty,
    unitPrice: Math.round(unitPrice),
    unitPriceFinal: Math.round(unitPrice),
    price: Math.round(unitPrice),
    lineTotal: line,
    nearExpiryDiscountPercent: 0,
    _expiry: null,
  };
}

/* ---------- Mix ---------- */
function isMixCartItem(ci) {
  return String(ci?.type || "").toLowerCase() === "mix" || Array.isArray(ci?.items);
}

/**
 * Xây snapshot cho dòng MIX từ payload FE:
 * ci = {
 *   type:"mix",
 *   quantity,            // số hộp
 *   totalPrice,          // giá 1 hộp (nếu không gửi, sẽ cộng từ linePrice các entry)
 *   note,
 *   items: [{ productId, qty, unitPrice?, pricePerKg?, weightGram?, linePrice }]
 * }
 */
async function buildMixSnapshotForOrder(ci) {
  const boxQty = Math.max(1, Number(ci?.quantity || 1));
  const rawEntries = Array.isArray(ci?.items) ? ci.items : [];

  // Chuẩn hoá entries + tính linePrice nếu thiếu
  const entries = rawEntries.map((x) => {
    const qty = Math.max(0, Number(x?.qty || 0));
    const unitPrice = Number(x?.unitPrice || 0);
    const pricePerKg = Number(x?.pricePerKg || 0);
    const weightGram = Math.max(0, Number(x?.weightGram || 0));

    let linePrice = Number(x?.linePrice || 0);
    if (!linePrice || linePrice < 0) {
      if (weightGram > 0 && pricePerKg > 0) {
        linePrice = Math.round(pricePerKg * (weightGram / 1000) * qty);
      } else if (unitPrice > 0 && qty > 0) {
        linePrice = Math.round(unitPrice * qty);
      } else {
        linePrice = 0;
      }
    }

    return {
      product: x?.productId || null,
      productId: x?.productId || null,
      productName: "", // fill dưới (optional)
      qty,
      unitPrice,
      pricePerKg,
      weightGram,
      linePrice,
    };
  });

  // Fill productName (optional, phục vụ hiển thị)
  const ids = [...new Set(entries.map((e) => String(e.productId || "")).filter(Boolean))];
  if (ids.length) {
    const nameDocs = await Product.find({ _id: { $in: ids } }, { name: 1 }).lean();
    const nameMap = new Map(nameDocs.map((d) => [String(d._id), d.name]));
    entries.forEach((e) => {
      const id = String(e.productId || "");
      if (id && !e.productName) e.productName = nameMap.get(id) || "";
    });
  }

  // Giá 1 hộp
  let totalPrice = Number(ci?.totalPrice || 0);
  if (!totalPrice || totalPrice < 0) {
    totalPrice = entries.reduce((s, e) => s + Number(e.linePrice || 0), 0);
  }
  totalPrice = Math.max(0, Math.round(totalPrice));

  const lineTotal = totalPrice * boxQty;

  return {
    type: "mix",
    product: null,
    productName: "Giỏ Mix",
    isCombo: false,
    isMix: true,
    variantId: null,
    variant: null,
    mix: {
      items: entries,
      totalPrice,
      note: ci?.note || "",
    },
    quantity: boxQty,
    unitPrice: totalPrice,        // đơn giá 1 hộp
    unitPriceFinal: totalPrice,
    price: totalPrice,
    lineTotal,
    nearExpiryDiscountPercent: 0,
    _expiry: null,
  };
}

/* ---------- Shipping helper ---------- */
function normalizeShippingFromDocOrPayload(payload, addrDoc) {
  const src = payload || {};
  const doc = addrDoc || {};
  const districtCode = src.districtCode ?? doc.districtCode ?? "";
  const wardCode = src.wardCode ?? doc.wardCode ?? "";
  return {
    fullName: src.fullName || doc.fullName || "",
    phone: src.phone || doc.phone || "",
    addressLine: src.addressLine || doc.detail || doc.addressLine || doc.address || "",
    wardName: src.wardName || doc.wardName || doc.ward || "",
    districtName: src.districtName || doc.districtName || doc.district || "",
    provinceName: src.provinceName || doc.provinceName || doc.province || "",
    wardCode: wardCode ? padWard(wardCode) : "",
    districtCode: districtCode ? padDistrict(districtCode) : "",
    provinceCode: src.provinceCode || doc.provinceCode || 1, // HN mặc định = 1
  };
}

/* ---------------------------------------------
 * Controller MoMo
 * -------------------------------------------*/
const momoController = {
  /* Tạo yêu cầu thanh toán MoMo */
  createPayment: async (req, res) => {
    try {
      const { cartItems = [], voucher, address, shippingAddress } = req.body;
      const userId = req.user._id;

      if (!Array.isArray(cartItems) || cartItems.length === 0) {
        return res.status(400).json({ message: "Giỏ hàng trống" });
      }
      if (!address && !shippingAddress) {
        return res.status(400).json({ message: "Thiếu địa chỉ giao hàng" });
      }

      // ---- Chuẩn hoá địa chỉ giao hàng ----
      let normalizedShipping = null;

      // Ưu tiên payload `shippingAddress` nếu đủ dữ liệu
      if (shippingAddress?.addressLine && shippingAddress?.phone) {
        normalizedShipping = normalizeShippingFromDocOrPayload(shippingAddress, null);
      }

      // Nếu chưa đủ, thử lấy từ DB theo address._id
      if (!normalizedShipping) {
        const addrId = address?._id || address?.id;
        if (addrId) {
          const addrDoc = await Address.findById(addrId).lean().catch(() => null);
          if (addrDoc) {
            normalizedShipping = normalizeShippingFromDocOrPayload(shippingAddress, addrDoc);
          }
        }
      }

      if (
        !normalizedShipping ||
        !normalizedShipping.addressLine ||
        !normalizedShipping.phone
      ) {
        return res.status(400).json({
          message: "Lỗi tạo thanh toán MoMo",
          error: "Thiếu thông tin địa chỉ giao hàng",
        });
      }

      // ---- Build snapshot items & subtotal (SERVER-TRUSTED) ----
      const itemsSnapshot = [];
      let subtotal = 0;

      for (const ci of cartItems) {
        // ===== COMBO =====
        if (isComboCartItem(ci)) {
          const snap = buildComboSnapshotForOrder(ci);
          itemsSnapshot.push(snap);
          subtotal += snap.lineTotal;
          continue;
        }

        // ===== MIX =====
        if (isMixCartItem(ci)) {
          const mixSnap = await buildMixSnapshotForOrder(ci);
          itemsSnapshot.push(mixSnap);
          subtotal += mixSnap.lineTotal;
          continue;
        }

        // ===== VARIANT (mặc định) =====
        const productDoc = await Product.findById(ci.productId).lean();
        if (!productDoc) {
          return res.status(400).json({ message: `Sản phẩm không tồn tại: ${ci.productId}` });
        }
        const { product, variant } = await resolveVariant(productDoc, ci);
        if (!variant) {
          return res
            .status(400)
            .json({ message: `Biến thể không tồn tại cho sản phẩm ${product?.name || ci.productId}` });
        }
        const snap = buildVariantSnapshot(product, variant, ci);
        itemsSnapshot.push(snap);
        subtotal += snap.lineTotal;
      }

      // ---- Tính phí ship theo seed:zones (luôn quote ở BE) ----
      let shippingFee = 0;
      let shippingRuleName = undefined;
      try {
        const quote = await quoteShipping({
          provinceCode: normalizedShipping.provinceCode || 1,
          districtCode: normalizedShipping.districtCode || "",
          wardCode: normalizedShipping.wardCode || "",
          cartSubtotal: subtotal,
        });
        shippingFee = Math.max(0, Math.round(Number(quote?.amount || 0)));
        shippingRuleName = quote?.ruleName;
      } catch (e) {
        // Không chặn luồng nếu quote lỗi; ship = 0 và ghi log để kiểm tra
        console.error("[momo.createPayment] Quote shipping error:", e?.message || e);
        shippingFee = 0;
        shippingRuleName = "ErrorFallback";
      }

      // ---- Tạo “đơn tạm” qua service (service sẽ trả order có total đã tính) ----
      const order = await momoService.createOrderTemp({
        userId,
        cartItems,                 // raw từ FE (nếu service cần)
        itemsSnapshot,             // snapshot tin cậy từ BE (đÃ gồm MIX/COMBO/VARIANT)
        voucher,                   // để service tự validate và tính discount
        shippingAddress: normalizedShipping,
        subtotal,
        shippingFee,
        shippingRuleName,
      });

      if (!order || !Number.isFinite(Number(order.total))) {
        return res.status(500).json({ message: "Không tạo được đơn tạm hợp lệ để thanh toán" });
      }

      // ---- Gọi MoMo với đúng số tiền từ order.total (KHÔNG tự tính lại ở controller) ----
      const amount = Math.max(0, Math.round(Number(order.total)));
      const paymentUrl = await momoService.createMomoPayment(order, amount);
      return res.status(200).json({ paymentUrl, orderId: order._id, amount });
    } catch (err) {
      if (err?.code === "EXPIRED_PRODUCT") {
        return res.status(400).json({ message: err.message });
      }
      console.error("Lỗi khi tạo thanh toán MoMo:", err);
      return res.status(500).json({
        message: "Lỗi tạo thanh toán MoMo",
        error: err.message || "Unknown error",
      });
    }
  },

  /* IPN từ MoMo */
  handleIPN: async (req, res) => {
    try {
      // Tuỳ cấu trúc IPN MoMo của bạn, các field dưới có thể khác tên;
      // dùng rộng tay để tương thích
      const body = req.body || {};
      const resultCode = Number(body.resultCode);
      const orderId = body.orderId || body.orderIdPartner || body.orderid || body.orderID || null;
      const paidAmount = Number(body.amount || body.totalAmount || body.payAmount || 0);

      if (!orderId) {
        return res.status(400).json({ message: "Thiếu orderId trong IPN" });
      }

      const order = await Order.findById(orderId).lean();
      if (!order) {
        return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
      }

      const shouldBe = Math.max(0, Math.round(Number(order.total || 0)));

      // Chỉ xác nhận "paid" khi:
      // - resultCode === 0 (thành công)
      // - paidAmount khớp chính xác order.total
      if (resultCode === 0 && paidAmount === shouldBe) {
        await momoService.confirmMomoOrder(orderId);
        return res.status(200).json({ message: "Xác nhận thanh toán thành công" });
      }

      // Nếu MoMo báo fail, hoặc số tiền không khớp -> huỷ đơn & hoàn stock
      await momoService.cancelMomoOrder(orderId, {
        reason:
          resultCode === 0
            ? `Paid amount mismatch: paid=${paidAmount}, expect=${shouldBe}`
            : `MoMo failed, resultCode=${resultCode}`,
      });
      return res
        .status(200)
        .json({ message: "Giao dịch không hợp lệ/không thành công, đã hoàn stock" });
    } catch (err) {
      console.error("Lỗi xử lý IPN:", err);
      return res.status(500).json({ message: "Lỗi xử lý IPN", error: err.message });
    }
  },

  /* API hủy tay (khi chưa thanh toán) */
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

      await momoService.cancelMomoOrder(orderId, { reason: "User cancel" });
      res.json({ message: "Hủy đơn hàng thành công, đã hoàn stock" });
    } catch (err) {
      console.error("Lỗi hủy đơn:", err);
      res.status(500).json({ message: "Lỗi hủy đơn hàng", error: err.message });
    }
  },
};

export default momoController;
