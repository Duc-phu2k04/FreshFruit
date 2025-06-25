// src/services/review.service.js
import Review from '../models/review.model.js';

export const createReview = async (userId, productId, rating, comment) => {
  return await Review.create({ user: userId, product: productId, rating, comment });
};

export const getReviewsByProduct = async (productId) => {
  return await Review.find({ product: productId })
    .populate('user', 'username') // lấy tên người đánh giá
    .sort({ createdAt: -1 }); // mới nhất trước
};
