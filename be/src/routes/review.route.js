import express from 'express';
import { 
  addReview, 
  getProductReviews, 
  getAllReviews, 
  deleteReview,
  getUserPurchasedProducts,  // ✅ THÊM MỚI
  checkCanReviewProduct      // ✅ THÊM MỚI
} from '../controllers/review.controller.js';
import { verifyToken, isAdmin } from '../middlewares/auth.middleware.js';

const router = express.Router();

// USER
router.post('/add', verifyToken, addReview);                           // viết đánh giá
router.get('/products/:productId', getProductReviews);                 // xem đánh giá theo sản phẩm

// ✅ THÊM MỚI: Routes cho ProfilePage và kiểm tra quyền
router.get('/my-purchased-products', verifyToken, getUserPurchasedProducts);  // lấy sản phẩm đã mua
router.get('/can-review/:productId', verifyToken, checkCanReviewProduct);     // kiểm tra có thể đánh giá không

// ADMIN
router.get('/admin/all', verifyToken, isAdmin, getAllReviews);         // admin xem tất cả đánh giá
router.delete('/:id', verifyToken, isAdmin, deleteReview);             // admin xoá đánh giá

export default router;