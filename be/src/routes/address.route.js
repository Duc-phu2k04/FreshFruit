// src/routes/address.route.js
import express from 'express';
import {
  createAddress,
  getUserAddresses,
  getAddressById,   // lấy địa chỉ theo ID
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from '../controllers/address.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Áp dụng verifyToken cho toàn bộ route phía dưới
router.use(verifyToken);

// Tạo địa chỉ mới
router.post('/', createAddress);

// Lấy tất cả địa chỉ của user hiện tại
router.get('/', getUserAddresses);

// Lấy địa chỉ theo ID (phục vụ lấy defaultAddressId ở Checkout)
router.get('/:id', getAddressById);

// Đặt địa chỉ mặc định (đặt trước PUT /:id cho an toàn)
router.put('/:id/default', setDefaultAddress);

// Cập nhật địa chỉ
router.put('/:id', updateAddress);

// Xóa địa chỉ
router.delete('/:id', deleteAddress);

export default router;
