import Voucher from "../models/voucher.model.js";
import Order from "../models/order.model.js";
import mongoose from "mongoose";

const voucherService = () => {
  const create = async ({ code, discount, quantity = null, expiration = null, assignedUsers = [] }) => {
    const normalized = code?.toUpperCase().trim();
    if (!normalized) throw new Error("Code không hợp lệ");
    const existing = await Voucher.findOne({ code: normalized });
    if (existing) throw new Error("Mã giảm giá đã tồn tại");

    const newVoucher = new Voucher({
      code: normalized,
      discount,
      quantity,
      expiration,
      assignedUsers
    });
    return await newVoucher.save();
  };

  const getAll = async () => {
    return await Voucher.find().populate("assignedUsers", "username email fullName");
  };

  const remove = async (id) => {
    const deleted = await Voucher.findByIdAndDelete(id);
    if (!deleted) throw new Error("Không tìm thấy voucher để xóa");
    return deleted;
  };

  const validate = async (code, userId) => {
    const normalized = code?.toUpperCase().trim();
    if (!normalized) throw new Error("Code không hợp lệ");
    const voucher = await Voucher.findOne({ code: normalized });
    if (!voucher) throw new Error("Mã giảm giá không tồn tại");

    if (voucher.assignedUsers && voucher.assignedUsers.length > 0) {
      const assigned = voucher.assignedUsers.map(x => x.toString());
      if (!userId || !assigned.includes(userId.toString())) {
        throw new Error("Bạn không đủ điều kiện sử dụng mã này");
      }
    }

    if (voucher.expiration && voucher.expiration < new Date()) throw new Error("Mã đã hết hạn");
    if (voucher.quantity !== null && voucher.quantity <= 0) throw new Error("Mã đã hết lượt sử dụng");

    return voucher;
  };

  const assignVoucherBasedOnSpending = async (userId) => {
    if (!mongoose.Types.ObjectId.isValid(userId)) return null;

    const agg = await Order.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId), paymentStatus: "paid", status: { $ne: "cancelled" } } },
      { $group: { _id: null, totalSpent: { $sum: "$total" } } }
    ]);

    const totalSpent = (agg[0] && agg[0].totalSpent) ? agg[0].totalSpent : 0;

    const toAssign = [];
    if (totalSpent >= 2000000) toAssign.push({ code: "LEVEL5", discount: 5 });
    if (totalSpent >= 10000000) toAssign.push({ code: "LEVEL10", discount: 10 });
    if (totalSpent >= 20000000) toAssign.push({ code: "LEVEL15", discount: 15 });

    const results = [];
    for (const tier of toAssign) {
      let voucher = await Voucher.findOne({ code: tier.code });
      if (!voucher) {
        voucher = await Voucher.create({
          code: tier.code,
          discount: tier.discount,
          quantity: null,
          expiration: null,
          assignedUsers: []
        });
      }

      const already = voucher.assignedUsers.map(x => x.toString()).includes(userId.toString());
      if (!already) {
        voucher.assignedUsers.push(userId);
        await voucher.save();
        results.push({ code: voucher.code, discount: voucher.discount });
      }
    }

    return { totalSpent, assigned: results };
  };

  const getAssignedUsers = async (voucherId) => {
    if (!mongoose.Types.ObjectId.isValid(voucherId)) throw new Error("voucherId không hợp lệ");
    const voucher = await Voucher.findById(voucherId).populate("assignedUsers", "username email fullName");
    if (!voucher) throw new Error("Không tìm thấy voucher");
    return voucher.assignedUsers;
  };
  const assignUsersToVoucher = async (voucherId, userIds) => {
  if (!mongoose.Types.ObjectId.isValid(voucherId)) {
    throw new Error("voucherId không hợp lệ");
  }

  const voucher = await Voucher.findById(voucherId);
  if (!voucher) {
    throw new Error("Không tìm thấy voucher");
  }

  const existingIds = voucher.assignedUsers.map(uid => uid.toString());
  const newIds = userIds.filter(uid => !existingIds.includes(uid));

  voucher.assignedUsers.push(...newIds);
  await voucher.save();

  return voucher.populate("assignedUsers", "username email fullName");
};

  return {
    create,
    getAll,
    remove,
    validate,
    assignVoucherBasedOnSpending,
    getAssignedUsers,
    assignUsersToVoucher
  };
};

export default voucherService();