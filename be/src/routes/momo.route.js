// src/routes/momo.route.js
import express from 'express';
import momoController from '../controllers/momo.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js'; // Đảm bảo đường dẫn đúng

const router = express.Router();

/**
 * @route POST /api/momo/create-payment
 * @desc Tạo thanh toán MoMo
 * @access Private (cần đăng nhập)
 */
router.post('/create-payment', verifyToken, momoController.createPayment);

/**
 * @route POST /api/momo/ipn
 * @desc IPN callback từ MoMo (MoMo gọi trực tiếp)
 * @access Public
 */
router.post('/ipn', momoController.handleIPN);

/**
 * @route DELETE /api/momo/cancel/:orderId
 * @desc Người dùng hủy đơn hàng MoMo
 * @access Private (cần đăng nhập)
 */
router.delete('/cancel/:orderId', verifyToken, momoController.cancelOrder);

export default router;
