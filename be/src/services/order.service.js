import Order from "../models/order.model.js";
import Voucher from "../models/voucher.model.js";
import Product from "../models/product.model.js";
import Cart from "../models/cart.model.js";

// So sánh biến thể
const isSameVariant = (a, b) => {
  return a.weight === b.weight && a.ripeness === b.ripeness;
};

// Tạo đơn hàng
export const createOrder = async ({ userId, cartItems, voucher }) => {
  let items = [];

  for (const item of cartItems) {
    const product = await Product.findById(item.productId);
    if (!product) throw new Error(`Sản phẩm không tồn tại: ${item.productId}`);

    const variantInfo = item.variant;
    if (!variantInfo || !variantInfo.weight || !variantInfo.ripeness) {
      throw new Error(`Thiếu thông tin biến thể cho sản phẩm ${product.name}`);
    }

    const matchedVariant = product.variants.find((v) =>
      isSameVariant(v.attributes, variantInfo)
    );

    if (!matchedVariant) {
      throw new Error(
        `Không tìm thấy biến thể phù hợp cho sản phẩm ${product.name}`
      );
    }

    if (matchedVariant.stock < item.quantity) {
      throw new Error(
        `Không đủ tồn kho cho sản phẩm ${product.name} (${variantInfo.weight}, ${variantInfo.ripeness})`
      );
    }

    // Thêm vào danh sách item cho đơn hàng
    items.push({
      product: product._id,
      productName: product.name,
      quantity: item.quantity,
      price: matchedVariant.price,
      variant: variantInfo,
      variantId: matchedVariant._id, // Dùng để cập nhật chính xác tồn kho
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

  // ✅ Trừ tồn kho
  for (const item of items) {
    await Product.updateOne(
      {
        _id: item.product,
        "variants._id": item.variantId,
      },
      {
        $inc: { "variants.$.stock": -item.quantity },
      }
    );
  }

  // ✅ Xoá sản phẩm khỏi giỏ hàng
  await Cart.findOneAndUpdate(
    { user: userId },
    {
      $pull: {
        items: {
          $or: items.map((i) => ({
            product: i.product,
            variantId: i.variantId,
          })),
        },
      },
    }
  );

  return order;
};

// Lấy tất cả đơn hàng (dành cho admin)
export const getAllOrders = async () => {
  const orders = await Order.find()
    .populate("user", "username email")
    .populate("items.product", "name image")
    .populate("voucher", "code discount")
    .sort({ createdAt: -1 });

  return orders;
};

// Cập nhật trạng thái đơn hàng
export const updateOrderStatus = async (orderId, status) => {
  const updated = await Order.findByIdAndUpdate(
    orderId,
    { status },
    { new: true }
  );
  return updated;
};
