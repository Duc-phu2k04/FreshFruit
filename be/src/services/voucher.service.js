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
    return await Voucher.find().populate("assignedUsers.user", "username email fullName");
  };
 const getById = async (id) => {
  return await Voucher.findById(id);
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

    const userData = voucher.assignedUsers?.find(u => u.user.toString() === userId.toString());
    if (voucher.assignedUsers?.length > 0 && (!userData || userData.quantity <= 0)) {
      throw new Error("Bạn không đủ điều kiện sử dụng mã này");
    }

    if (voucher.expiration && voucher.expiration < new Date()) {
      throw new Error("Mã đã hết hạn");
    }

    if (voucher.quantity !== null && voucher.quantity <= 0) {
      throw new Error("Mã đã hết lượt sử dụng");
    }

    return voucher;
  };

  const useVoucher = async (code, userId) => {
    const normalized = code?.toUpperCase().trim();
    if (!normalized) throw new Error("Code không hợp lệ");

    const voucher = await Voucher.findOne({ code: normalized });
    if (!voucher) throw new Error("Mã giảm giá không tồn tại");

    const userData = voucher.assignedUsers.find(u => u.user.toString() === userId.toString());
    if (!userData) throw new Error("User chưa được gán voucher này");
    if (userData.quantity <= 0) throw new Error("Bạn đã hết lượt sử dụng voucher này");

    userData.quantity -= 1;
    if (voucher.quantity !== null && voucher.quantity > 0) {
      voucher.quantity -= 1;
    }

    await voucher.save();
    return {
      code: voucher.code,
      remainingUserQuantity: userData.quantity,
      remainingGlobalQuantity: voucher.quantity
    };
  };

  // ======================= Sửa gán voucher dựa trên chi tiêu =======================
  const assignVoucherBasedOnSpending = async (userId) => {
    if (!mongoose.Types.ObjectId.isValid(userId)) return null;

    // Chỉ tính các đơn đã thanh toán
    const orders = await Order.find({
      user: userId,
      paymentStatus: "paid",
      status: { $ne: "cancelled" }
    });

    const totalSpent = orders.reduce((sum, o) => sum + o.total, 0);

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

      const already = voucher.assignedUsers.some(x => x.user.toString() === userId.toString());
      if (!already) {
        voucher.assignedUsers.push({ user: userId, quantity: 1 });
        await voucher.save();
        results.push({ code: voucher.code, discount: voucher.discount });
      }
    }

    return { totalSpent, assigned: results };
  };

  const getAssignedUsers = async (voucherId) => {
    if (!mongoose.Types.ObjectId.isValid(voucherId)) throw new Error("voucherId không hợp lệ");
    const voucher = await Voucher.findById(voucherId).populate("assignedUsers.user", "username email fullName");
    if (!voucher) throw new Error("Không tìm thấy voucher");
    return voucher.assignedUsers;
  };

 const assignUsersToVoucher = async (voucherId, userList) => {
  if (!mongoose.Types.ObjectId.isValid(voucherId)) throw new Error("voucherId không hợp lệ");

  const voucher = await Voucher.findById(voucherId);
  if (!voucher) throw new Error("Không tìm thấy voucher");

  // Chuẩn hoá dữ liệu cũ: phần tử có thể là ObjectId/string -> đổi sang { user, quantity }
  voucher.assignedUsers = (voucher.assignedUsers || [])
    .filter(Boolean)
    .map((u) => {
      if (u && u.user) return u; // đã đúng dạng
      // legacy: u là ObjectId hoặc string
      return { user: new mongoose.Types.ObjectId(u), quantity: 1 };
    });

  for (const item of userList) {
    const uidStr = item?.userId?.toString?.();
    const qty = Number(item?.quantity ?? 1);
    if (!uidStr || !mongoose.Types.ObjectId.isValid(uidStr)) continue;

    const existed = voucher.assignedUsers.find(x => x?.user?.toString?.() === uidStr);
    if (existed) {
      existed.quantity = (existed.quantity ?? 0) + qty;
    } else {
      voucher.assignedUsers.push({ user: new mongoose.Types.ObjectId(uidStr), quantity: qty });
    }
  }

  await voucher.save();
  return voucher.populate("assignedUsers.user", "username email fullName");
};


  const getUserVouchers = async (userId) => {
    if (!mongoose.Types.ObjectId.isValid(userId)) throw new Error("userId không hợp lệ");

    const vouchers = await Voucher.find({ "assignedUsers.user": userId })
      .select("code discount expiration quantity assignedUsers createdAt");

    const now = new Date();
    const validVouchers = [];
    const expiredVouchers = [];
    const usedUpVouchers = [];

    vouchers.forEach(voucher => {
     const userData = voucher.assignedUsers?.find(u => u?.user?.toString?.() === userId.toString());

      const userQuantity = userData?.quantity || 0;

      const voucherData = {
        code: voucher.code,
        discount: voucher.discount,
        expiration: voucher.expiration,
        quantity: userQuantity,
        createdAt: voucher.createdAt
      };

      if (voucher.expiration && voucher.expiration < now) {
        expiredVouchers.push(voucherData);
      } else if (userQuantity <= 0) {
        usedUpVouchers.push(voucherData);
      } else {
        validVouchers.push(voucherData);
      }
    });

    return { total: vouchers.length, validVouchers, expiredVouchers, usedUpVouchers };
  };
  const update = async (id, { code, discount, quantity, expiration }) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error("ID voucher không hợp lệ");
  }

  const existingVoucher = await Voucher.findById(id);
  if (!existingVoucher) {
    throw new Error("Không tìm thấy voucher để cập nhật");
  }

  const updateFields = {};

  if (code && code !== existingVoucher.code) {
    const normalizedCode = code.toUpperCase().trim();
    const duplicateVoucher = await Voucher.findOne({ 
      code: normalizedCode, _id: { $ne: id } 
    });
    if (duplicateVoucher) throw new Error("Mã giảm giá đã tồn tại");
    updateFields.code = normalizedCode;
  }

  if (discount !== undefined) {
    const discountNum = Number(discount);
    if (isNaN(discountNum) || discountNum < 1 || discountNum > 100) {
      throw new Error("Discount phải từ 1 đến 100");
    }
    updateFields.discount = discountNum;
  }

  if (quantity !== undefined) {
    updateFields.quantity = quantity === null || quantity === '' ? null : Number(quantity);
  }

  if (expiration !== undefined) {
    updateFields.expiration = expiration === null || expiration === '' ? null : new Date(expiration);
  }

  return await Voucher.findByIdAndUpdate(id, { $set: updateFields }, { new: true });
};


  return {
    create,
    getAll,
    getById,
    remove,
    update,
    validate,
    useVoucher,
    assignVoucherBasedOnSpending,
    getAssignedUsers,
    assignUsersToVoucher,
    getUserVouchers
  };
};

export default voucherService();
