// src/controllers/order.controller.js
import * as orderService from "../services/order.service.js";
import voucherService from "../services/voucher.service.js";
import Order from "../models/order.model.js";
import Address from "../models/address.model.js";            // giữ như cũ
import Product from "../models/product.model.js";            //  NEW: để tra sản phẩm/biến thể
import { quoteShipping } from "../services/shipping.service.js";
import { computeExpiryInfo } from "../utils/expiryHelpers.js"; //  NEW: helper BE

/* -----------------------------------------------------------
 * Helpers nội bộ
 * ---------------------------------------------------------*/

// Tìm variant từ cartItem: ưu tiên variantId; fallback theo attributes (weight/ripeness)
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

  // cuối cùng fallback baseVariant (ít gặp)
  if (!variant && p.baseVariant?.price != null) {
    variant = { ...p.baseVariant, _id: p.baseVariant?._id || "base" };
  }

  return { product: p, variant };
}

// Tạo snapshot cho 1 cartItem: tính _expiry theo giá variant và kiểm tra hạn
function buildItemSnapshot(product, variant, cartItem) {
  const vPrice = Number(variant?.price ?? product?.baseVariant?.price ?? 0);
  const info = computeExpiryInfo(product, vPrice); // { expireAt, daysLeft, discountPercent, basePrice, finalPrice }

  // Chặn hàng hết hạn
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

/* -----------------------------------------------------------
 * Tạo đơn hàng
 * ---------------------------------------------------------*/
export const checkout = async (req, res) => {
  try {
    const { cartItems = [], voucher, address, paymentMethod } = req.body;
    const userId = req.user._id;

    // --- Validate dữ liệu cơ bản ---
    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({ message: "Giỏ hàng trống" });
    }
    if (!address) {
      return res.status(400).json({ message: "Thiếu địa chỉ giao hàng" });
    }

    // --- Validate voucher (nếu có) ---
    let validVoucher = null;
    if (voucher) {
      try {
        validVoucher = await voucherService.validate(voucher, userId);
      } catch (err) {
        return res.status(400).json({ message: "Voucher không hợp lệ", error: err.message });
      }
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

    // --- Lấy mã khu vực để tính phí ship ---
    let districtCode = String(address?.districtCode || address?.district_code || "" ).trim();
    let wardCode     = String(address?.wardCode     || address?.ward_code     || "" ).trim();

    // Nếu FE chỉ gửi _id của address → tra DB để lấy code
    if ((!districtCode || !wardCode) && address?._id) {
      const addrDoc = await Address.findById(address._id).lean().catch(() => null);
      if (addrDoc) {
        districtCode = String(addrDoc.districtCode || addrDoc.district_code || districtCode || "").trim();
        wardCode     = String(addrDoc.wardCode     || addrDoc.ward_code     || wardCode     || "").trim();
      }
    }

    // --- Quote phí ship (mặc định Hà Nội: provinceCode = 1) ---
    let shippingFee = 0;
    let shippingRuleName = undefined;
    try {
      if (districtCode || wardCode) {
        const quote = await quoteShipping({
          provinceCode: 1,
          districtCode,
          wardCode,
          cartSubtotal: subtotal, // dùng subtotal SERVER-TRUSTED
        });
        shippingFee = Number(quote?.amount || 0);
        shippingRuleName = quote?.ruleName;
      }
    } catch (e) {
      // Không chặn checkout nếu quote lỗi
      console.error("[checkout] Quote shipping error:", e?.message || e);
    }

    // --- Chuẩn bị payload tạo Order ---
    const orderData = {
      userId,
      // Gửi cartItems nguyên bản (nếu service cần) kèm snapshot để service không phải tính lại
      cartItems,
      itemsSnapshot,                 //  NEW: snapshot đã tính finalPrice theo helper
      voucher: validVoucher ? validVoucher._id : null,
      address,
      paymentMethod,
      paymentStatus: paymentMethod === "momo" ? "paid" : "unpaid",

      // Giá trị tài chính server-calculated
      subtotal,                      //  NEW: tạm tính theo finalPrice
      shippingFee,
      shippingRuleName,
    };

    // Service sẽ lưu order, tính total (subtotal - voucher + ship), v.v.
    const order = await orderService.createOrder(orderData);

    // --- Đánh dấu voucher đã dùng nếu đã thanh toán online ---
    if (validVoucher && order.paymentStatus === "paid") {
      await voucherService.useVoucher(voucher, userId);
    }

    // --- Gán voucher tự động theo tổng chi tiêu nếu đã thanh toán ---
    let assignedVouchers = null;
    if (order.paymentStatus === "paid") {
      assignedVouchers = await voucherService.assignVoucherBasedOnSpending(userId);
    }

    // --- Response ---
    res.status(201).json({
      message: "Đặt hàng thành công",
      order: {
        _id: order._id,
        customId: order.customId,
        items: order.items,                   // service nên map từ itemsSnapshot vào đây
        total: order.total,                   // total đã tính ở service
        subtotal: order.subtotal ?? subtotal, // fallback nếu service chưa gán
        shippingFee: order.shippingFee ?? shippingFee,
        shippingRuleName: order.shippingRuleName ?? shippingRuleName,
        status: order.status,
        paymentStatus: order.paymentStatus,
        voucher: order.voucher,
        shippingAddress: order.shippingAddress,
        createdAt: order.createdAt,
      },
      assignedVouchers,
    });
  } catch (err) {
    // Bắt riêng lỗi hết hạn để trả message đẹp
    if (err?.code === "EXPIRED_PRODUCT") {
      return res.status(400).json({ message: err.message });
    }
    console.error("Lỗi checkout:", err);
    res.status(500).json({
      message: "Lỗi khi tạo đơn hàng",
      error: err.message,
    });
  }
};

/* -----------------------------------------------------------
 * Lấy đơn hàng của người dùng
 * ---------------------------------------------------------*/
export const getUserOrders = async (req, res) => {
  try {
    const userId = req.user._id;
    const orders = await Order.find({
      user: userId,
      $or: [{ deletedByUser: { $exists: false } }, { deletedByUser: false }],
    })
      .populate("items.product", "name image price")
      .populate("voucher")
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (err) {
    res.status(500).json({
      message: "Lỗi khi lấy đơn hàng",
      error: err.message,
    });
  }
};

/* -----------------------------------------------------------
 * Lấy tất cả đơn hàng (admin)
 * ---------------------------------------------------------*/
export const getAllOrders = async (req, res) => {
  try {
    const orders = await orderService.getAllOrders();
    res.json(orders);
  } catch (err) {
    res.status(500).json({
      message: "Lỗi khi lấy tất cả đơn hàng",
      error: err.message,
    });
  }
};

/* -----------------------------------------------------------
 * Cập nhật trạng thái đơn (admin)
 * ---------------------------------------------------------*/
export const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, paymentStatus } = req.body;

    const updated = await orderService.updateOrderStatus(id, { status, paymentStatus });
    res.json({
      message: "Cập nhật trạng thái thành công",
      order: updated,
    });
  } catch (err) {
    res.status(500).json({
      message: "Lỗi cập nhật trạng thái",
      error: err.message,
    });
  }
};

/* -----------------------------------------------------------
 * Huỷ đơn hàng (hard delete)
 * ---------------------------------------------------------*/
export const deleteOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const isAdmin = req.user.role === "admin";
    const { id } = req.params;

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ message: "Không tìm thấy đơn hàng" });

    if (!isAdmin && order.user.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Bạn không có quyền huỷ đơn này" });
    }

    if (order.status !== "pending" && order.paymentStatus !== "failed") {
      return res.status(400).json({ message: "Chỉ được huỷ đơn khi đang chờ xác nhận hoặc đã thất bại" });
    }

    await Order.findByIdAndDelete(id);
    res.json({ message: "Đã huỷ đơn hàng thành công" });
  } catch (err) {
    res.status(500).json({
      message: "Lỗi server khi huỷ đơn hàng",
      error: err.message,
    });
  }
};

/* -----------------------------------------------------------
 * Ẩn đơn hàng khỏi lịch sử (soft delete)
 * ---------------------------------------------------------*/
export const hideOrderFromHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const order = await Order.findOne({ _id: id, user: userId });
    if (!order) return res.status(404).json({ message: "Không tìm thấy đơn hàng" });

    order.deletedByUser = true;
    await order.save();

    res.json({ message: "Đã ẩn đơn hàng khỏi lịch sử" });
  } catch (err) {
    res.status(500).json({
      message: "Lỗi server khi ẩn đơn hàng",
      error: err.message,
    });
  }
};
