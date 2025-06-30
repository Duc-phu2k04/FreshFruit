import express from "express";
import voucherController from "../controllers/voucher.controller.js";
import { verifyToken, isAdmin } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/", verifyToken, isAdmin, voucherController.createVoucher);
router.get("/", verifyToken, isAdmin, voucherController.getAllVouchers);
router.delete("/:id", verifyToken, isAdmin, voucherController.deleteVoucher);


export default router;
