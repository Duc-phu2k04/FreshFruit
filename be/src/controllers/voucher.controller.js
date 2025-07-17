import Voucher from '../models/voucher.model.js';

const voucherController = {
  createVoucher: async (req, res) => {
    try {
      const { code, discount, expiresInDays, quantity } = req.body;

      if (!code || !discount || !expiresInDays) {
        return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin.' });
      }

      const expiration = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

      const newVoucher = new Voucher({
        code,
        discount,
        expiration,
        quantity: quantity !== undefined ? quantity : null, // null = vô hạn
      });

      await newVoucher.save();
      res.status(201).json({ message: 'Tạo mã giảm giá thành công', voucher: newVoucher });
    } catch (err) {
      res.status(500).json({ message: 'Lỗi server', error: err.message });
    }
  },



  getAllVouchers: async (req, res) => {
    try {
      const vouchers = await Voucher.find();
      res.json(vouchers);
    } catch (err) {
      res.status(500).json({ message: 'Lỗi khi lấy danh sách voucher', error: err.message });
    }
  },

  deleteVoucher: async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await Voucher.findByIdAndDelete(id);

      if (!deleted) return res.status(404).json({ message: 'Không tìm thấy voucher' });

      res.json({ message: 'Xóa voucher thành công', voucher: deleted });
    } catch (err) {
      res.status(500).json({ message: 'Lỗi khi xóa voucher', error: err.message });
    }
  },
};

export default voucherController;
