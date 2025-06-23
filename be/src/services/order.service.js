import Order from "../models/order.model.js";

export const createOrder = async ({ userId, cartItems }) => {
  const items = cartItems.map(item => ({
    product: item.product,
    quantity: item.quantity,
    price: item.price
  }));

  const total = items.reduce((sum, item) => sum + item.quantity * item.price, 0);

  const order = new Order({
    user: userId,
    items,
    total
  });

  await order.save();
  return order;
};

export const getUserOrders = async (userId) => {
  return await Order.find({ user: userId }).populate("items.product");
};

export const getAllOrders = async () => {
  return await Order.find().populate("items.product user");
};

export const updateOrderStatus = async (orderId, status) => {
  return await Order.findByIdAndUpdate(orderId, { status }, { new: true });
};
