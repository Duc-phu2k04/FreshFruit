// src/routes/auth.route.js
import express from 'express';
import * as authController from '../controllers/auth.controller.js';

const router = express.Router();

router.post('/register', authController.register);
router.post('/login', authController.login);

router.get('/users', authController.getAllUsers);
router.delete('/users/:id', authController.deleteUser);

router.post('/forgot-password', authController.forgotPassword);

export default router;
