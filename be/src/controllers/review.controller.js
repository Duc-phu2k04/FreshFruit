import Review from '../models/review.model.js';
import * as reviewService from '../services/review.service.js';

// ✅ User gửi đánh giá sản phẩm
export const addReview = async (req, res) => {
  try {
    const userId = req.user._id; // Lấy từ token
    const { productId, rating, comment } = req.body;

    console.log("Thêm đánh giá:", { userId, productId, rating, comment }); // LOG kiểm tra

    const review = await reviewService.createReview(userId, productId, rating, comment);
    res.status(201).json({ message: 'Đánh giá thành công', review });
  } catch (err) {
    console.error("Lỗi khi thêm đánh giá:", err);
    res.status(500).json({ message: 'Lỗi khi đánh giá', error: err.message });
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
