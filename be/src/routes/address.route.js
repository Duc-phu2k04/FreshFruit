import express from 'express';
import {
  createAddress,
  getUserAddresses,
  updateAddress,
  deleteAddress,
} from '../controllers/address.controller.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Phải đăng nhập để thao tác
router.post('/', verifyToken, createAddress);         // Tạo địa chỉ mới
router.get('/', verifyToken, getUserAddresses);       // Lấy danh sách địa chỉ của người dùng
router.put('/:id', verifyToken, updateAddress);       // Cập nhật địa chỉ theo ID
router.delete('/:id', verifyToken, deleteAddress);    // Xoá địa chỉ theo ID

export default router;
