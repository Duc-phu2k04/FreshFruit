// src/routes/auth.route.js
import express from 'express';
import { register, login,getAllUsers,deleteUser } from '../controllers/auth.controller.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);

router.get('/users', getAllUsers);
router.delete('/users/:id', deleteUser);

export default router;
