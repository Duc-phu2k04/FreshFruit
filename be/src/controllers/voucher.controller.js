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

      // ✅ Ép kiểu số cho discount và quantity (null = vô hạn)
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
  getById: async (req, res) => {
  try {
    const { id } = req.params;
    const voucher = await voucherService.getById(id);
    if (!voucher) {
      return res.status(404).json({ message: "Voucher không tồn tại" });
    }
    res.json(voucher);
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
  update: async (req, res) => {
  try {
    const { id } = req.params;
    const { code, discount, quantity, expiresInDays } = req.body;

    let expiration = undefined;
    if (expiresInDays !== undefined) {
      if (expiresInDays === null || expiresInDays === '') {
        expiration = null;
      } else {
        expiration = new Date();
        expiration.setDate(expiration.getDate() + Number(expiresInDays));
      }
    }

    const updatedVoucher = await voucherService.update(id, {
      code,
      discount,
      quantity: quantity === '' || quantity === null ? null : quantity,
      expiration
    });

    res.json({ message: "Cập nhật voucher thành công", voucher: updatedVoucher });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
},

  validate: async (req, res) => {
    try {
      const { code } = req.params;
      const userId = req.user?._id;
      const voucher = await voucherService.validate(code, userId);
      res.json(voucher);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },

  // ✅ Dùng voucher và tự động trừ userQuantity
  useVoucher: async (req, res) => {
    try {
      const { code } = req.body;
      const userId = req.user?._id;
      if (!userId) return res.status(400).json({ message: "Không tìm thấy thông tin user" });

      const voucher = await voucherService.useVoucher(code, userId); // service sẽ validate và trừ lượt
      res.json({ message: "Sử dụng voucher thành công", voucher });
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

  assign: async (req, res) => {
    try {
      const { id } = req.params;        // voucher id
      const { assignments } = req.body; // [{ userId, quantity }]

      if (!Array.isArray(assignments) || assignments.length === 0) {
        return res.status(400).json({ message: "Danh sách gán voucher không hợp lệ" });
      }

      const updatedVoucher = await voucherService.assignUsersToVoucher(id, assignments);
      res.json({ message: "Gán voucher thành công", voucher: updatedVoucher });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  getUserVouchers: async (req, res) => {
    try {
      const userId = req.user?._id;
      if (!userId) {
        return res.status(400).json({ message: "Không tìm thấy thông tin user" });
      }

      const result = await voucherService.getUserVouchers(userId);
      res.json({
        message: "Lấy voucher thành công",
        data: result
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
};

export default voucherController;
