import express from 'express';
import momoController from '../controllers/momo.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js'; // Đường dẫn tùy bạn

const router = express.Router();

router.post('/create-payment', verifyToken, momoController.createPayment); // Cần middleware ở đây
router.post('/ipn', momoController.handleIPN); // IPN từ MoMo thì không cần verifyToken

export default router;
