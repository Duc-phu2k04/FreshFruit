import Order from "../models/order.model.js";
import Voucher from "../models/voucher.model.js";
import Product from "../models/product.model.js";


export const createOrder = async ({ userId, cartItems, voucher }) => {
  let items = [];

  for (const item of cartItems) {
    const product = await Product.findById(item.productId);
    if (!product) throw new Error(`Sản phẩm không tồn tại: ${item.productId}`);

    items.push({
      product: product._id,
      quantity: item.quantity,
      price: product.price,
    });
  }

  let total = items.reduce((sum, item) => sum + item.quantity * item.price, 0);

  let appliedVoucher = null;

  if (voucher) {
    const foundVoucher = await Voucher.findOne({ code: voucher.toUpperCase() });
    if (!foundVoucher) throw new Error("Mã giảm giá không hợp lệ");

    // Trừ tiền
    total = total - (total * foundVoucher.discount) / 100;
    appliedVoucher = foundVoucher._id;

    // Giảm số lượng còn lại nếu có giới hạn
    if (foundVoucher.quantity !== null) {
      foundVoucher.quantity -= 1;
      await foundVoucher.save();
    }
  }

  const order = new Order({
    user: userId,
    items,
    total,
    voucher: appliedVoucher || null,
  });

  await order.save();
  return order;
};

export const getUserOrders = async (userId) => {
  return await Order.find({ user: userId }).populate("items.product").populate("voucher");
};

export const getAllOrders = async () => {
  return await Order.find().populate("items.product").populate("user").populate("voucher");
};

export const updateOrderStatus = async (orderId, status) => {
  return await Order.findByIdAndUpdate(orderId, { status }, { new: true });
};
