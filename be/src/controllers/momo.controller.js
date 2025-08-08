import momoService from '../services/momo.service.js';

const momoController = {
  // Tạo thanh toán MoMo
  createPayment: async (req, res) => {
    try {
      const { cartItems, voucher, address } = req.body;
      const userId = req.user._id;

      console.log("📦 Dữ liệu từ FE gửi lên MoMo:", {
        cartItems,
        voucher,
        address
      });

      // Tạo đơn hàng tạm
      const order = await momoService.createOrderTemp({
        userId,
        cartItems,
        voucher,
        shippingAddress: address
      });

      console.log("✅ Đơn hàng tạm tạo thành công:", order._id);

      // Tạo link thanh toán MoMo
      const paymentUrl = await momoService.createMomoPayment(order);

      console.log("🔗 URL thanh toán MoMo:", paymentUrl);

      res.status(200).json({ paymentUrl });
    } catch (err) {
      console.error('❌ Lỗi khi tạo thanh toán MoMo:', err);
      res.status(500).json({
        message: 'Lỗi tạo thanh toán MoMo',
        error: err.message || 'Unknown error'
      });
    }
  },

  // Xử lý IPN từ MoMo (xác nhận thanh toán)
  handleIPN: async (req, res) => {
  try {
    const { resultCode, orderId } = req.body;
    console.log("📥 MoMo IPN received:", req.body);

    if (resultCode === 0) {
      await momoService.confirmMomoOrder(orderId);
      return res.status(200).json({ message: "Xác nhận thanh toán thành công" });
    } else {
      // 🔴 Nếu thất bại, cập nhật paymentStatus = "failed", status = "cancelled"
      await Order.findByIdAndUpdate(orderId, {
        paymentStatus: 'failed',
        status: 'cancelled'
      });

      console.warn("⚠️ Giao dịch thất bại hoặc bị hủy bởi người dùng.");
      return res.status(200).json({ message: "Giao dịch thất bại hoặc bị hủy" });
    }
  } catch (err) {
    console.error("❌ Lỗi xử lý IPN:", err);
    return res.status(500).json({ message: "Lỗi xử lý IPN", error: err.message });
  }
}

};

export default momoController;
