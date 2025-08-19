import momoService from '../services/momo.service.js';
import Order from '../models/order.model.js';

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

      // Tạo đơn hàng (TRỪ STOCK NGAY)
      const order = await momoService.createOrderTemp({
        userId,
        cartItems,
        voucher,
        shippingAddress: address
      });

      console.log("✅ Đơn hàng tạo thành công (đã trừ stock):", order._id);

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
        // ✅ THANH TOÁN THÀNH CÔNG
        await momoService.confirmMomoOrder(orderId);
        return res.status(200).json({ message: "Xác nhận thanh toán thành công" });
      } else {
        // ❌ THANH TOÁN THẤT BẠI - HOÀN STOCK
        console.warn("⚠️ Giao dịch thất bại, đang hoàn stock...");
        await momoService.cancelMomoOrder(orderId);
        return res.status(200).json({ message: "Giao dịch thất bại, đã hoàn stock" });
      }
    } catch (err) {
      console.error("❌ Lỗi xử lý IPN:", err);
      return res.status(500).json({ message: "Lỗi xử lý IPN", error: err.message });
    }
  },

  // 🆕 API manual cancel order (nếu cần)
  cancelOrder: async (req, res) => {
    try {
      const { orderId } = req.params;
      const userId = req.user._id;

      // Validate ownership
      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
      }
      
      if (order.user.toString() !== userId.toString()) {
        return res.status(403).json({ message: "Không có quyền hủy đơn này" });
      }

      if (order.paymentStatus === 'paid') {
        return res.status(400).json({ message: "Không thể hủy đơn đã thanh toán" });
      }

      await momoService.cancelMomoOrder(orderId);
      res.json({ message: "Hủy đơn hàng thành công, đã hoàn stock" });
    } catch (err) {
      console.error("❌ Lỗi hủy đơn:", err);
      res.status(500).json({ message: "Lỗi hủy đơn hàng", error: err.message });
    }
  }
};

export default momoController;