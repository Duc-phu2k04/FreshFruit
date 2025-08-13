import Review from '../models/review.model.js';
import Order from '../models/order.model.js';

// ✅ Kiểm tra user đã mua sản phẩm thành công chưa
export const hasUserPurchasedProduct = async (userId, productId) => {
  const purchasedOrder = await Order.findOne({
    user: userId,
    'items.product': productId,
    status: 'delivered',  // Đơn hàng đã giao thành công
    paymentStatus: 'paid'  // Đã thanh toán
  });
  
  return !!purchasedOrder; // Trả về true/false
};

// ✅ Kiểm tra user đã đánh giá sản phẩm chưa
export const hasUserReviewedProduct = async (userId, productId) => {
  const existingReview = await Review.findOne({
    user: userId,
    product: productId
  });
  
  return !!existingReview; // Trả về true/false
};

// ✅ Tạo đánh giá mới (với validation)
export const createReview = async (userId, productId, rating, comment) => {
  // Kiểm tra đã mua hàng thành công chưa
  const hasPurchased = await hasUserPurchasedProduct(userId, productId);
  if (!hasPurchased) {
    throw new Error('Bạn chỉ có thể đánh giá sản phẩm đã mua và nhận hàng thành công');
  }

  // Kiểm tra đã đánh giá chưa
  const hasReviewed = await hasUserReviewedProduct(userId, productId);
  if (hasReviewed) {
    throw new Error('Bạn đã đánh giá sản phẩm này rồi');
  }

  // Tạo đánh giá mới
  return await Review.create({ 
    user: userId, 
    product: productId, 
    rating, 
    comment 
  });
};

// ✅ Lấy tất cả đánh giá theo sản phẩm
export const getReviewsByProduct = async (productId) => {
  return await Review.find({ product: productId })
    .populate('user', 'username fullName')
    .sort({ createdAt: -1 });
};

// ✅ Lấy sản phẩm đã mua của user (cho ProfilePage)
export const getUserPurchasedProducts = async (userId) => {
  // Lấy tất cả đơn hàng đã giao thành công
  const deliveredOrders = await Order.find({
    user: userId,
    status: 'delivered',
    paymentStatus: 'paid'
  }).populate('items.product', 'name image price').sort({ createdAt: -1 });

  // Extract unique products với thông tin đánh giá
  const productMap = new Map();
  
  for (const order of deliveredOrders) {
    for (const item of order.items) {
      const productId = item.product._id.toString();
      
      if (!productMap.has(productId)) {
        // Kiểm tra đã đánh giá chưa
        const hasReviewed = await hasUserReviewedProduct(userId, productId);
        const existingReview = hasReviewed ? 
          await Review.findOne({ user: userId, product: productId }) : null;

        productMap.set(productId, {
          productId: item.product._id,
          productName: item.product.name,
          productImage: item.product.image,
          productPrice: item.product.price,
          lastOrderDate: order.createdAt,
          hasReviewed,
          reviewData: existingReview ? {
            reviewId: existingReview._id,
            rating: existingReview.rating,
            comment: existingReview.comment,
            reviewDate: existingReview.createdAt
          } : null
        });
      }
    }
  }

  return Array.from(productMap.values());
};

// ✅ Kiểm tra user có thể đánh giá sản phẩm không
export const canUserReviewProduct = async (userId, productId) => {
  const hasPurchased = await hasUserPurchasedProduct(userId, productId);
  const hasReviewed = await hasUserReviewedProduct(userId, productId);
  
  return {
    canReview: hasPurchased && !hasReviewed,
    hasPurchased,
    hasReviewed
  };
};