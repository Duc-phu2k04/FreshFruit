import Review from '../models/review.model.js';
import * as reviewService from '../services/review.service.js';

// User gửi đánh giá sản phẩm (có orderId để phân biệt đơn hàng)
export const addReview = async (req, res) => {
  try {
    const userId = req.user._id; // Lấy từ token
    const { orderId, productId, rating, comment } = req.body;

    if (!orderId || !productId) {
      return res.status(400).json({ message: 'Thiếu orderId hoặc productId' });
    }

    console.log(" Thêm đánh giá:", { userId, orderId, productId, rating, comment });

    const review = await reviewService.createReview(userId, orderId, productId, rating, comment);

    return res.status(201).json({ message: 'Đánh giá thành công', review });
  } catch (err) {
    console.error(" Lỗi khi thêm đánh giá:", err);
    return res.status(400).json({ message: err.message });
  }
};

// User xem đánh giá theo sản phẩm
export const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!productId) return res.status(400).json({ message: 'Thiếu productId' });

    const reviews = await reviewService.getReviewsByProduct(productId);
    return res.json(reviews);
  } catch (err) {
    console.error(" Lỗi khi lấy đánh giá:", err);
    return res.status(500).json({ message: 'Lỗi khi lấy đánh giá', error: err.message });
  }
};

//  Admin xem tất cả đánh giá
export const getAllReviews = async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate('user', 'username')
      .populate('product', 'name')
      .sort({ createdAt: -1 })
      .lean();

    return res.json(reviews);
  } catch (err) {
    console.error(" Lỗi khi lấy danh sách đánh giá:", err);
    return res.status(500).json({ message: 'Lỗi khi lấy danh sách đánh giá', error: err.message });
  }
};

//  Admin xoá đánh giá
export const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Review.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: 'Không tìm thấy đánh giá để xoá' });

    return res.json({ message: 'Xoá đánh giá thành công' });
  } catch (err) {
    console.error(" Lỗi khi xoá đánh giá:", err);
    return res.status(500).json({ message: 'Lỗi khi xoá đánh giá', error: err.message });
  }
};

//  Lấy sản phẩm đã mua của user (cho ProfilePage)
export const getUserPurchasedProducts = async (req, res) => {
  try {
    const userId = req.user._id;
    const purchasedProducts = await reviewService.getUserPurchasedProducts(userId);

    return res.json({
      message: 'Lấy danh sách sản phẩm đã mua thành công',
      data: purchasedProducts
    });
  } catch (err) {
    console.error(" Lỗi khi lấy sản phẩm đã mua:", err);
    return res.status(500).json({ message: 'Lỗi khi lấy sản phẩm đã mua', error: err.message });
  }
};

//  Kiểm tra user có thể đánh giá sản phẩm trong đơn hàng hay không
export const checkCanReviewProduct = async (req, res) => {
  try {
    const userId = req.user._id;
    const { orderId, productId } = req.params;

    if (!orderId || !productId) {
      return res.status(400).json({ message: 'Thiếu orderId hoặc productId' });
    }

    console.log(" Kiểm tra review:", { userId, orderId, productId });

    const result = await reviewService.canUserReviewProduct(userId, orderId, productId);

    return res.json({
      message: 'Kiểm tra quyền đánh giá thành công',
      data: result
    });
  } catch (err) {
    console.error(" Lỗi khi kiểm tra quyền đánh giá:", err);
    return res.status(500).json({ message: 'Lỗi khi kiểm tra quyền đánh giá', error: err.message });
  }
};
