import * as orderService from "../services/order.service.js";

export const checkout = async (req, res) => {
  try {
    const { cartItems } = req.body;
    const userId = req.user._id;

    const order = await orderService.createOrder({ userId, cartItems });

    res.status(201).json({ message: "Đặt hàng thành công", order });
  } catch (err) {
    res.status(500).json({ message: "Lỗi khi tạo đơn hàng", error: err.message });
  }
};

export const getUserOrders = async (req, res) => {
  try {
    const userId = req.user._id;
    const orders = await orderService.getUserOrders(userId);
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: "Lỗi khi lấy đơn hàng", error: err.message });
  }
};

export const getAllOrders = async (req, res) => {
  try {
    const orders = await orderService.getAllOrders();
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: "Lỗi khi lấy tất cả đơn hàng", error: err.message });
  }
};

export const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const updated = await orderService.updateOrderStatus(id, status);
    res.json({ message: "Cập nhật trạng thái thành công", order: updated });
  } catch (err) {
    res.status(500).json({ message: "Lỗi cập nhật trạng thái", error: err.message });
  }
};

export const deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;

    // Optional: kiểm tra quyền nếu cần (chỉ admin hoặc chính user mới được xóa đơn của mình)
    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    // Optional: chỉ cho phép xóa nếu đơn chưa xác nhận
    if (order.status !== 'Pending') {
      return res.status(400).json({ message: 'Chỉ được huỷ đơn khi đang chờ xác nhận' });
    }

    await Order.findByIdAndDelete(id);

    res.json({ message: 'Đã huỷ đơn hàng thành công' });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server', detail: err.message });
  }
};