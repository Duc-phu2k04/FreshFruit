import express from 'express';
import  momoController from '../controllers/momo.controller.js';

const router = express.Router();

router.post('/create-payment', momoController.createPayment);
// IPN Handler nếu có
// router.post('/ipn', momoController.handleIPN);

export default router;
