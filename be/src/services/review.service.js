import Review from '../models/review.model.js';

// Tạo đánh giá mới
export const createReview = async (userId, productId, rating, comment) => {
  return await Review.create({ user: userId, product: productId, rating, comment });
};

// Lấy tất cả đánh giá theo sản phẩm
export const getReviewsByProduct = async (productId) => {
  return await Review.find({ product: productId })
    .populate('user', 'username')
    .sort({ createdAt: -1 });
};
