import * as orderService from "../services/order.service.js";
import voucherService from "../services/voucher.service.js";
import Order from "../models/order.model.js";

// ======================= Tạo đơn hàng =======================
export const checkout = async (req, res) => {
  try {
    const { cartItems, voucher, address, paymentMethod } = req.body;
    const userId = req.user._id;

    let validVoucher = null;
    // ✅ Validate voucher nếu có
    if (voucher) {
      try {
        validVoucher = await voucherService.validate(voucher, userId);
      } catch (err) {
        return res.status(400).json({ message: "Voucher không hợp lệ", error: err.message });
      }
    }

    // ✅ Tạo order mới
    const orderData = {
      userId,
      cartItems,
      voucher: validVoucher ? validVoucher._id : null,
      address,
      paymentMethod,
      paymentStatus: paymentMethod === "momo" ? "paid" : "unpaid", // COD vẫn unpaid
    };
    const order = await orderService.createOrder(orderData);

    // ✅ Mark voucher đã dùng nếu đã thanh toán online
    if (validVoucher && order.paymentStatus === "paid") {
      await voucherService.useVoucher(voucher, userId);
    }

    // ✅ Gán voucher tự động dựa trên tổng chi tiêu / đơn > 2 triệu
    let assignedVouchers = null;
    if (order.paymentStatus === "paid") {
      assignedVouchers = await voucherService.assignVoucherBasedOnSpending(userId);
    }

    res.status(201).json({
      message: "Đặt hàng thành công",
      order: {
        _id: order._id,
        customId: order.customId,
        items: order.items,
        total: order.total,
        status: order.status,
        paymentStatus: order.paymentStatus,
        voucher: order.voucher,
        shippingAddress: order.shippingAddress,
        createdAt: order.createdAt,
      },
      assignedVouchers, // voucher tự động gán nếu có
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
      $or: [{ deletedByUser: { $exists: false } }, { deletedByUser: false }]
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

    order.deletedByUser = true; // ✅ đánh dấu đã ẩn
    await order.save();

    res.json({ message: "Đã ẩn đơn hàng khỏi lịch sử" });
  } catch (err) {
    res.status(500).json({
      message: "Lỗi server khi ẩn đơn hàng",
      error: err.message,
    });
  }
};
