import express from 'express';
import { addReview, getProductReviews, getAllReviews, deleteReview } from '../controllers/review.controller.js';
import { verifyToken, isAdmin } from '../middlewares/auth.middleware.js';

const router = express.Router();

// USER
router.post('/add', verifyToken, addReview);                  // viết đánh giá
router.get('/:productId', getProductReviews);                 // xem đánh giá theo sản phẩm

// ADMIN
router.get('/admin/all', verifyToken, isAdmin, getAllReviews);     // admin xem tất cả đánh giá
router.delete('/:id', verifyToken, isAdmin, deleteReview);         // admin xoá đánh giá

export default router;
