// server/routes/momoPreorder.route.js
import { Router } from "express";
import {
  createDepositPayment,
  createRemainingPayment,
  handlePreorderIPN,
} from "../controllers/momoPreorder.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";

const router = Router();

/**
 * Khuyến nghị mount trong index.js:
 *   app.use("/api/momo-preorder", router);
 *
 * => Các endpoint đầy đủ:
 *   POST /api/momo-preorder/create-payment-deposit/:preorderId
 *   POST /api/momo-preorder/create-payment-remaining/:preorderId
 *   POST /api/momo-preorder/ipn
 */

// Tạo thanh toán CỌC cho preorder
router.post("/create-payment-deposit/:preorderId", verifyToken, createDepositPayment);

// Tạo thanh toán PHẦN CÒN LẠI cho preorder
router.post("/create-payment-remaining/:preorderId", verifyToken, createRemainingPayment);

// IPN callback từ MoMo (server-to-server) — KHÔNG auth
router.post("/ipn", handlePreorderIPN);

export default router;
