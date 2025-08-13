import Review from '../models/review.model.js';
import * as reviewService from '../services/review.service.js';

// ✅ User gửi đánh giá sản phẩm (với validation mua hàng)
export const addReview = async (req, res) => {
  try {
    const userId = req.user._id; // Lấy từ token
    const { productId, rating, comment } = req.body;

    console.log("Thêm đánh giá:", { userId, productId, rating, comment }); // LOG kiểm tra

    const review = await reviewService.createReview(userId, productId, rating, comment);
    res.status(201).json({ message: 'Đánh giá thành công', review });
  } catch (err) {
    console.error("Lỗi khi thêm đánh giá:", err);
    res.status(400).json({ message: err.message });
  }
};

// ✅ User xem đánh giá theo sản phẩm
export const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const reviews = await reviewService.getReviewsByProduct(productId);
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi khi lấy đánh giá', error: err.message });
  }
};

// ✅ Admin xem tất cả đánh giá
export const getAllReviews = async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate('user', 'username')
      .populate('product', 'name')
      .sort({ createdAt: -1 });

    res.json(reviews);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi khi lấy danh sách đánh giá', error: err.message });
  }
};

// ✅ Admin xoá đánh giá
export const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Review.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: 'Không tìm thấy đánh giá để xoá' });
    }
    res.json({ message: 'Xoá đánh giá thành công' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi khi xoá đánh giá', error: err.message });
  }
};

// ✅ THÊM MỚI: Lấy sản phẩm đã mua của user (cho ProfilePage)
export const getUserPurchasedProducts = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const purchasedProducts = await reviewService.getUserPurchasedProducts(userId);
    
    res.json({
      message: 'Lấy danh sách sản phẩm đã mua thành công',
      data: purchasedProducts
    });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi khi lấy sản phẩm đã mua', error: err.message });
  }
};

// ✅ THÊM MỚI: Kiểm tra user có thể đánh giá sản phẩm không
export const checkCanReviewProduct = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId } = req.params;
    
    const result = await reviewService.canUserReviewProduct(userId, productId);
    
    res.json({
      message: 'Kiểm tra quyền đánh giá thành công',
      data: result
    });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi khi kiểm tra quyền đánh giá', error: err.message });
  }
};