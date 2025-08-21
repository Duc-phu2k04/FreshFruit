// src/controllers/order.controller.js
import * as orderService from "../services/order.service.js";
import voucherService from "../services/voucher.service.js";
import Order from "../models/order.model.js";

//  thêm import để tính phí ship
import { quoteShipping } from "../services/shipping.service.js";
// cố gắng theo đúng pattern đặt tên model của bạn
import Address from "../models/address.model.js";

// ======================= Tạo đơn hàng =======================
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

    // --- Tạm tính (subtotal) an toàn từ cartItems ---
    const subtotal = cartItems.reduce(
      (s, it) => s + Number(it.price || 0) * Number(it.quantity || 1),
      0
    );

    // --- Lấy mã khu vực để tính phí ship ---
    let districtCode = String(address?.districtCode || address?.district_code || "" ).trim();
    let wardCode     = String(address?.wardCode     || address?.ward_code     || "" ).trim();

    // Nếu FE chỉ gửi _id của address mà thiếu code → lấy từ DB
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
          cartSubtotal: subtotal,
        });
        shippingFee = Number(quote?.amount || 0);
        shippingRuleName = quote?.ruleName;
      }
    } catch (e) {
      // Không chặn checkout nếu quote lỗi, chỉ log và để fee = 0
      console.error("[checkout] Quote shipping error:", e?.message || e);
    }

    // --- Tạo order (GIỮ NGUYÊN luồng cũ) + bổ sung field ship ---
    const orderData = {
      userId,
      cartItems,
      voucher: validVoucher ? validVoucher._id : null,
      address,
      paymentMethod,
      paymentStatus: paymentMethod === "momo" ? "paid" : "unpaid", // COD vẫn unpaid

      // BỔ SUNG CHO PHÍ SHIP
      subtotal,
      shippingFee,
      shippingRuleName,
    };

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

    // --- Phản hồi (giữ structure cũ) + expose thêm fee/subtotal/rule ---
    res.status(201).json({
      message: "Đặt hàng thành công",
      order: {
        _id: order._id,
        customId: order.customId,
        items: order.items,
        total: order.total, // total đã được service lưu; nếu service chưa cộng ship, hãy cập nhật service để +shippingFee
        subtotal: order.subtotal ?? subtotal,
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
    console.error("Lỗi checkout:", err);
    res.status(500).json({
      message: "Lỗi khi tạo đơn hàng",
      error: err.message,
    });
  }
};

// ======================= Lấy đơn hàng của người dùng =======================
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

// ======================= Lấy tất cả đơn hàng (admin) =======================
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

// ======================= Cập nhật trạng thái đơn (admin) =======================
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

// ======================= Huỷ đơn hàng (thật sự xóa DB) =======================
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

// ======================= Ẩn đơn hàng khỏi lịch sử (soft delete) =======================
export const hideOrderFromHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const order = await Order.findOne({ _id: id, user: userId });
    if (!order) return res.status(404).json({ message: "Không tìm thấy đơn hàng" });

    order.deletedByUser = true; //  đánh dấu đã ẩn
    await order.save();

    res.json({ message: "Đã ẩn đơn hàng khỏi lịch sử" });
  } catch (err) {
    res.status(500).json({
      message: "Lỗi server khi ẩn đơn hàng",
      error: err.message,
    });
  }
};
