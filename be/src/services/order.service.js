// services/order.service.js
import Order from "../models/order.model.js";
import Voucher from "../models/voucher.model.js";
import Product from "../models/product.model.js";
import Cart from "../models/cart.model.js";
import mongoose from "mongoose";
import voucherService from "./voucher.service.js"; // import service vừa sửa

// So sánh biến thể
const isSameVariant = (a, b) => {
  return a.weight === b.weight && a.ripeness === b.ripeness;
};

// Tạo đơn hàng
export const createOrder = async ({ userId, cartItems, voucher, address, paymentMethod = "cod" }) => {
  if (!address || !address.fullName || !address.phone || !address.province) {
    throw new Error("Thiếu thông tin địa chỉ giao hàng");
  }

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
      throw new Error(`Không tìm thấy biến thể phù hợp cho sản phẩm ${product.name}`);
    }

    if (matchedVariant.stock < item.quantity) {
      throw new Error(`Không đủ tồn kho cho sản phẩm ${product.name}`);
    }

    items.push({
      product: product._id,
      productName: product.name,
      quantity: item.quantity,
      price: matchedVariant.price,
      variant: variantInfo,
      variantId: matchedVariant._id,
    });
  }

  const BASE_SHIPPING_FEE = 30000;
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.price, 0);

  let discountAmount = 0;
  let appliedVoucher = null;

  if (voucher) {
    // Voucher phải thuộc về user nếu voucher.assignedUsers không rỗng
    const foundVoucher = await Voucher.findOne({ code: voucher.toUpperCase() });
    if (!foundVoucher) throw new Error("Mã giảm giá không hợp lệ");

    if (foundVoucher.assignedUsers && foundVoucher.assignedUsers.length > 0) {
      const assigned = foundVoucher.assignedUsers.map(x => x.toString());
      if (!assigned.includes(userId.toString())) {
        throw new Error("Mã giảm giá không thuộc về bạn hoặc bạn chưa được phân phát mã này");
      }
    }

    // áp dụng giảm
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
    shippingAddress: address,
    status: "pending",
    paymentStatus: "unpaid",
    paymentMethod,
  });

  await order.save();

  // Trừ tồn kho
  for (const item of items) {
    await Product.updateOne(
      { _id: item.product, "variants._id": item.variantId },
      { $inc: { "variants.$.stock": -item.quantity } }
    );
  }

  // Xoá khỏi giỏ hàng
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

  // IMPORTANT:
  // Không gán voucher ở đây — vì:
  // - Với momo: cần đợi paymentStatus = 'paid' (momo callback/FE cập nhật)
  // - Với cod: sẽ gán khi admin/shipper cập nhật status => 'delivered' (xem updateOrderStatus)
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

/**
 * Cập nhật trạng thái đơn hàng
 * - Nếu admin cập nhật status -> nếu chuyển sang 'delivered' và paymentMethod === 'cod',
 *   auto set paymentStatus = 'paid' (gồm trường hợp shipper xác nhận thu tiền).
 * - Nếu paymentStatus được set = 'paid' (ví dụ callback Momo), thì cũng trigger assign voucher.
 *
 * @param {String} orderId
 * @param {Object} updates - { status, paymentStatus }
 * @returns updated order
 */
export const updateOrderStatus = async (orderId, updates = {}) => {
  const { status, paymentStatus } = updates;

  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");

  let changed = false;

  if (status && status !== order.status) {
    order.status = status;
    changed = true;
  }

  if (paymentStatus && paymentStatus !== order.paymentStatus) {
    order.paymentStatus = paymentStatus;
    changed = true;
  }

  // Special: nếu status chuyển thành delivered và phương thức là COD, set paymentStatus = 'paid'
  if (status === "delivered" && order.paymentMethod === "cod") {
    if (order.paymentStatus !== "paid") {
      order.paymentStatus = "paid";
      changed = true;
    }
  }

  if (changed) {
    await order.save();

    // Nếu đơn hiện đã được trả (paymentStatus === 'paid') -> trigger assign voucher
    if (order.paymentStatus === "paid") {
      try {
        await voucherService.assignVoucherBasedOnSpending(order.user);
      } catch (err) {
        // Không throw lỗi lên client nếu fail assign voucher; log để debug.
        console.error("Lỗi khi gán voucher tự động:", err.message);
      }
    }
  }

  return order;
};
