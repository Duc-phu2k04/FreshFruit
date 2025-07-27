// src/routes/auth.route.js
import express from 'express';
import * as authController from '../controllers/auth.controller.js';
import { verifyToken, isAdmin } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Auth
router.post('/register', authController.register);
router.post('/login', authController.login);

// Lấy toàn bộ user (chỉ admin)
router.get('/users', verifyToken, isAdmin, authController.getAllUsers);

// Lấy thông tin 1 user (ProfilePage dùng)
router.get('/users/:id', verifyToken, authController.getUserById);

// Cập nhật thông tin user
router.put('/users/:id', verifyToken, authController.updateUser);

// Xoá user (chỉ admin hoặc tự xoá)
router.delete('/users/:id', verifyToken, authController.deleteUser);

// Quên mật khẩu
router.post('/forgot-password', authController.forgotPassword);

export default router;
