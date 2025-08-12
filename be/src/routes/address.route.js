import express from 'express';
import {
  createAddress,
  getUserAddresses,
  getAddressById,    // thêm để lấy địa chỉ theo ID
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from '../controllers/address.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Tạo địa chỉ mới
router.post('/', verifyToken, createAddress);

// Lấy tất cả địa chỉ của user hiện tại
router.get('/', verifyToken, getUserAddresses);

// Lấy địa chỉ theo ID (phục vụ lấy defaultAddressId ở Checkout)
router.get('/:id', verifyToken, getAddressById);

// Cập nhật địa chỉ
router.put('/:id', verifyToken, updateAddress);

// Xóa địa chỉ
router.delete('/:id', verifyToken, deleteAddress);

//  Đặt địa chỉ mặc định
router.put('/:id/default', verifyToken, setDefaultAddress);

export default router;
