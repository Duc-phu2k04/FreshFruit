import * as orderService from "../services/order.service.js";
import Order from "../models/order.model.js";

// Tạo đơn hàng
export const checkout = async (req, res) => {
  try {
    const { cartItems, voucher, address } = req.body; // ✅ nhận thêm address
    const userId = req.user._id;

    const order = await orderService.createOrder({ userId, cartItems, voucher, address }); // ✅ truyền address

    res.status(201).json({
      message: "Đặt hàng thành công",
      order: {
        _id: order._id,
        customId: order.customId,
        items: order.items,
        total: order.total,
        status: order.status,
        paymentStatus: order.paymentStatus, // ✅ thêm trạng thái thanh toán
        voucher: order.voucher,
        shippingAddress: order.shippingAddress, // ✅ phản hồi cả địa chỉ
        createdAt: order.createdAt,
      },
    });
  } catch (err) {
    res.status(500).json({
      message: "Lỗi khi tạo đơn hàng",
      error: err.message,
    });
  }
};

// Lấy đơn hàng của người dùng (lịch sử)
export const getUserOrders = async (req, res) => {
  try {
    const userId = req.user._id;
    const orders = await Order.find({ user: userId })
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

// Lấy tất cả đơn hàng (admin)
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

// Cập nhật trạng thái đơn (admin)
export const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    // Cho phép admin/shipper truyền status, paymentStatus hoặc cả hai
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

// Huỷ đơn hàng (chỉ khi status === "pending" hoặc paymentStatus === 'failed')
export const deleteOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const isAdmin = req.user.role === "admin"; // phải chứa "role" trong token
    const { id } = req.params;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }

    // Nếu không phải admin và không phải chủ đơn -> cấm huỷ
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
