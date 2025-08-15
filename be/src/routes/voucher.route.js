import express from "express";
import voucherController from "../controllers/voucher.controller.js";
import { verifyToken, isAdmin } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Lấy voucher của user hiện tại
router.get("/my-vouchers", verifyToken, voucherController.getUserVouchers);

// Validate voucher
router.get("/validate/:code", verifyToken, voucherController.validate);
router.get("/:id", verifyToken, isAdmin, voucherController.getById);

// Lấy danh sách user đã được gán voucher (admin)
router.get("/:id/users", verifyToken, isAdmin, voucherController.getAssignedUsers);

// Gán voucher cho user (admin) — yêu cầu gửi [{ userId, quantity }]
router.post("/:id/assign", verifyToken, isAdmin, voucherController.assign);

//  CRUD voucher (admin)
router.post("/", verifyToken, isAdmin, voucherController.create);
router.get("/", verifyToken, isAdmin, voucherController.getAll);
router.delete("/:id", verifyToken, isAdmin, voucherController.remove);
router.put("/:id", verifyToken, isAdmin, voucherController.update);

export default router;
