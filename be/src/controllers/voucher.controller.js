import Voucher from '../models/voucher.model.js';

const voucherController = {
  createVoucher: async (req, res) => {
    try {
      // Nhận 'expiration' trực tiếp từ frontend (dạng ISO String hoặc Date String)
      const { code, discount, expiration, quantity } = req.body;

      if (!code || !discount || !expiration) {
        return res.status(400).json({ message: 'Vui lòng nhập đầy đủ Mã Voucher, Giảm giá và Ngày hết hạn.' });
      }

      // Kiểm tra xem mã voucher đã tồn tại chưa
      const existingVoucher = await Voucher.findOne({ code });
      if (existingVoucher) {
        return res.status(400).json({ message: 'Mã voucher này đã tồn tại. Vui lòng chọn mã khác.' });
      }

      // Đảm bảo discount hợp lệ
      if (discount < 1 || discount > 100) {
        return res.status(400).json({ message: 'Mức giảm giá phải từ 1 đến 100.' });
      }

      // Tạo đối tượng Date từ chuỗi 'expiration' nhận được
      const expirationDate = new Date(expiration);

      // Kiểm tra nếu ngày hết hạn không hợp lệ hoặc đã ở quá khứ
      if (isNaN(expirationDate.getTime()) || expirationDate < new Date()) {
        return res.status(400).json({ message: 'Ngày hết hạn không hợp lệ hoặc đã qua.' });
      }


      const newVoucher = new Voucher({
        code,
        discount,
        expiration: expirationDate, // Gán trực tiếp đối tượng Date
        quantity: quantity !== undefined && quantity !== '' ? quantity : null, // null = vô hạn, chấp nhận cả ''
      });

      await newVoucher.save();
      res.status(201).json({ message: 'Tạo mã giảm giá thành công', voucher: newVoucher });
    } catch (err) {
      // Xử lý lỗi trùng code từ unique: true trong schema
      if (err.code === 11000) { // MongoDB duplicate key error code
        return res.status(400).json({ message: 'Mã voucher này đã tồn tại. Vui lòng chọn mã khác.' });
      }
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
