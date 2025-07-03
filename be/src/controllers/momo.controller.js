import * as momoService from '../services/momo.service.js';

const momoController = {
  createPayment: async (req, res) => {
    try {
      const { orderId } = req.body;

      if (!orderId) {
        return res.status(400).json({ message: 'Thiếu orderId trong request' });
      }

      const paymentUrl = await momoService.createMomoPayment(orderId);

      res.status(200).json({ paymentUrl });
    } catch (err) {
      console.error('Lỗi MoMo:', err);
      res.status(500).json({ message: 'Lỗi tạo thanh toán MoMo', error: err.message });
    }
  },

  handleIPN: async (req, res) => {
    res.status(200).json({ message: 'Chưa xử lý IPN' });
  }
};

export default momoController;
