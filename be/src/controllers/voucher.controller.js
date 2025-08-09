import voucherService from "../services/voucher.service.js";

const voucherController = {
  create: async (req, res) => {
  try {
    const { code, discount, quantity, expiresInDays, assignedUsers } = req.body;

    // ✅ Tính expiration từ expiresInDays
    let expiration = null;
    if (expiresInDays) {
      expiration = new Date();
      expiration.setDate(expiration.getDate() + Number(expiresInDays));
    }

    // ✅ Ép kiểu số cho discount và quantity
    const voucher = await voucherService.create({
      code,
      discount: Number(discount),
      quantity: quantity === '' || quantity === null ? null : Number(quantity),
      expiration,
      assignedUsers
    });

    res.status(201).json(voucher);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
},


  getAll: async (req, res) => {
    try {
      const vouchers = await voucherService.getAll();
      res.json(vouchers);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  remove: async (req, res) => {
    try {
      const deleted = await voucherService.remove(req.params.id);
      res.json(deleted);
    } catch (err) {
      res.status(404).json({ message: err.message });
    }
  },

  validate: async (req, res) => {
    try {
      const { code } = req.body;
      const userId = req.user?._id;
      const voucher = await voucherService.validate(code, userId);
      res.json(voucher);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },

  assignVoucherBasedOnSpending: async (req, res) => {
    try {
      const userId = req.params.userId || req.user?._id;
      const result = await voucherService.assignVoucherBasedOnSpending(userId);
      res.json(result);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },

  getAssignedUsers: async (req, res) => {
    try {
      const { id } = req.params;
      const users = await voucherService.getAssignedUsers(id);
      res.json(users);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  // THÊM MỚI: Gán voucher cho user
  assign: async (req, res) => {
    try {
      const { id } = req.params;        // voucher id
      const { userIds } = req.body;     // danh sách user id

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ message: "Danh sách userIds không hợp lệ" });
      }

      const updatedVoucher = await voucherService.assignUsersToVoucher(id, userIds);
      res.json({ message: "Gán voucher thành công", voucher: updatedVoucher });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
};

export default voucherController;