import express from 'express';
import { 
  addReview, 
  getProductReviews, 
  getAllReviews, 
  deleteReview,
  getUserPurchasedProducts,
  checkCanReviewProduct
} from '../controllers/review.controller.js';
import { verifyToken, isAdmin } from '../middlewares/auth.middleware.js';

const router = express.Router();

// ================= USER ==================

// Viết đánh giá (có orderId để phân biệt đơn hàng)
router.post('/add', verifyToken, addReview);

// Xem đánh giá theo sản phẩm
router.get('/products/:productId', getProductReviews);

// Lấy danh sách sản phẩm đã mua
router.get('/my-purchased-products', verifyToken, getUserPurchasedProducts);

// Kiểm tra quyền đánh giá sản phẩm trong đơn hàng
router.get('/can-review/:orderId/:productId', verifyToken, checkCanReviewProduct);

// ================= ADMIN ==================

// Xem tất cả đánh giá
router.get('/admin/all', verifyToken, isAdmin, getAllReviews);

// Xoá đánh giá
router.delete('/:id', verifyToken, isAdmin, deleteReview);

export default router;
