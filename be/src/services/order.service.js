import Order from "../models/order.model.js";
import Voucher from "../models/voucher.model.js";
import Product from "../models/product.model.js";
import Cart from "../models/cart.model.js";

// So sánh biến thể
const isSameVariant = (a, b) => {
  return (
    a.grade === b.grade &&
    a.weight === b.weight &&
    a.ripeness === b.ripeness
  );
};

export const createOrder = async ({ userId, cartItems, voucher }) => {
  let items = [];

  for (const item of cartItems) {
    const product = await Product.findById(item.productId);
    if (!product) throw new Error(`Sản phẩm không tồn tại: ${item.productId}`);

    const variantInfo = item.variant; // { grade, weight, ripeness }
    if (!variantInfo) throw new Error(`Thiếu thông tin biến thể cho sản phẩm ${product.name}`);

    const matchedVariant = product.variants.find(v =>
      isSameVariant(v.attributes, variantInfo)
    );

    if (!matchedVariant) {
      throw new Error(`Không tìm thấy biến thể phù hợp cho sản phẩm ${product.name}`);
    }

    items.push({
      product: product._id,
      quantity: item.quantity,
      price: matchedVariant.price,
      variant: variantInfo // lưu luôn biến thể đã chọn
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

  const order = new Order({
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
