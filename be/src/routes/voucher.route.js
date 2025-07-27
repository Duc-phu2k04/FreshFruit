import express from "express";
import voucherController from "../controllers/voucher.controller.js";
import { verifyToken, isAdmin } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/", verifyToken, isAdmin, voucherController.createVoucher);
router.get("/", verifyToken, isAdmin, voucherController.getAllVouchers);
router.delete("/:id", verifyToken, isAdmin, voucherController.deleteVoucher);

// ✅ Route kiểm tra mã giảm giá
router.get('/validate/:code', voucherController.validateVoucher);


export default router;
