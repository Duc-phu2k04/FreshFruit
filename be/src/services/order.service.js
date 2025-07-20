import Order from "../models/order.model.js";
import Voucher from "../models/voucher.model.js";
import Product from "../models/product.model.js";
import Cart from "../models/cart.model.js";

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

  const BASE_SHIPPING_FEE = 30000;

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.price, 0);

  let discountAmount = 0;
  let appliedVoucher = null;

  if (voucher) {
    const foundVoucher = await Voucher.findOne({ code: voucher.toUpperCase() });
    if (!foundVoucher) throw new Error("Mã giảm giá không hợp lệ");

    discountAmount = (subtotal * foundVoucher.discount) / 100;
    appliedVoucher = foundVoucher._id;

    if (foundVoucher.quantity !== null && foundVoucher.quantity > 0) {
      foundVoucher.quantity -= 1;
      await foundVoucher.save();
    }
  }

  const total = Math.max(0, subtotal + BASE_SHIPPING_FEE - discountAmount);

  const customId = "ORD" + Date.now();

  const order = new Order({
    customId,
    user: userId,
    items,
    total,
    voucher: appliedVoucher || null,
  });

  await order.save();

  // Xoá các sản phẩm đã đặt khỏi giỏ
  await Cart.findOneAndUpdate(
    { user: userId },
    {
      $pull: {
        items: {
          product: { $in: items.map(i => i.product) }
        }
      }
    }
  );

  return order;
};

