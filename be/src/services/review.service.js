import Review from '../models/review.model.js';
import Order from '../models/order.model.js';

//  Kiểm tra user đã mua sản phẩm trong đơn hàng cụ thể chưa
export const hasUserPurchasedProduct = async (userId, orderId, productId) => {
  if (!orderId || !productId) return false;

  const purchasedOrder = await Order.findOne({
    user: userId,
    customId: orderId,       // Dùng customId của đơn hàng
    'items.product': productId,
    status: 'delivered',
    paymentStatus: 'paid'
  }).lean();

  return Boolean(purchasedOrder);
};

//  Kiểm tra user đã đánh giá sản phẩm trong đơn hàng đó chưa
export const hasUserReviewedProduct = async (userId, orderId, productId) => {
  if (!orderId || !productId) return false;

  const existingReview = await Review.findOne({
    user: userId,
    orderId: orderId,        // Kiểm tra theo orderId + productId
    product: productId
  }).lean();

  return Boolean(existingReview);
};

//  Tạo đánh giá mới (có orderId)
export const createReview = async (userId, orderId, productId, rating, comment) => {
  const hasPurchased = await hasUserPurchasedProduct(userId, orderId, productId);
  if (!hasPurchased) throw new Error('Bạn chỉ có thể đánh giá sản phẩm đã mua và nhận hàng thành công');

  const hasReviewed = await hasUserReviewedProduct(userId, orderId, productId);
  if (hasReviewed) throw new Error('Bạn đã đánh giá sản phẩm này rồi');

  return Review.create({
    user: userId,
    orderId: orderId,
    product: productId,
    rating,
    comment
  });
};

// Lấy tất cả đánh giá theo sản phẩm
export const getReviewsByProduct = async (productId) => {
  return Review.find({ product: productId })
    .populate('user', 'username fullName')
    .sort({ createdAt: -1 })
    .lean();
};

// Lấy sản phẩm đã mua của user (ProfilePage)
export const getUserPurchasedProducts = async (userId) => {
  const deliveredOrders = await Order.find({
    user: userId,
    status: 'delivered',
    paymentStatus: 'paid'
  })
    .populate('items.product', 'name image price')
    .sort({ createdAt: -1 })
    .lean();

  const productMap = new Map();

  for (const order of deliveredOrders) {
    for (const item of order.items) {
      const prod = item.product;
      if (!prod) continue;

      const key = `${order.customId}_${prod._id.toString()}`; // key = orderId + productId
      if (productMap.has(key)) continue;

      const existingReview = await Review.findOne({
        user: userId,
        orderId: order.customId,
        product: prod._id
      }).lean();

      productMap.set(key, {
        orderId: order.customId,
        productId: prod._id,
        productName: prod.name,
        productImage: prod.image,
        productPrice: prod.price,
        lastOrderDate: order.createdAt,
        hasReviewed: Boolean(existingReview),
        reviewData: existingReview ? {
          reviewId: existingReview._id,
          rating: existingReview.rating,
          comment: existingReview.comment,
          reviewDate: existingReview.createdAt
        } : null
      });
    }
  }

  return Array.from(productMap.values());
};

// Kiểm tra user có thể đánh giá sản phẩm trong đơn hàng hay không
export const canUserReviewProduct = async (userId, orderId, productId) => {
  const [hasPurchased, hasReviewed] = await Promise.all([
    hasUserPurchasedProduct(userId, orderId, productId),
    hasUserReviewedProduct(userId, orderId, productId)
  ]);

  return {
    canReview: hasPurchased && !hasReviewed,
    hasPurchased,
    hasReviewed
  };
};
