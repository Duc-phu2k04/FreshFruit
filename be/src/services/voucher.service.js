import Voucher from '../models/voucher.model.js';

const voucherService = () => {
  const create = async ({ code, discount, expiryDate, quantity }) => {
    // Kiểm tra trùng mã
    const existing = await Voucher.findOne({ code });
    if (existing) throw new Error("Mã giảm giá đã tồn tại");

    const newVoucher = new Voucher({ code, discount, expiryDate, quantity });
    return await newVoucher.save();
  };

  const getAll = async () => {
    return await Voucher.find();
  };

  const remove = async (id) => {
    const deleted = await Voucher.findByIdAndDelete(id);
    if (!deleted) throw new Error("Không tìm thấy voucher để xóa");
  };

  const validate = async (code) => {
    const voucher = await Voucher.findOne({ code });
    if (!voucher) throw new Error("Mã giảm giá không tồn tại");
    if (voucher.quantity <= 0) throw new Error("Mã đã hết lượt sử dụng");
    if (new Date(voucher.expiryDate) < new Date()) throw new Error("Mã đã hết hạn");

    return voucher;
  };

  return {
    create,
    getAll,
    remove,
    validate
  };
};

export default voucherService();
