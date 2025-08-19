// be/src/services/order.service.js
import mongoose from "mongoose";
import Order from "../models/order.model.js";
import Voucher from "../models/voucher.model.js";
import Product from "../models/product.model.js";
import Cart from "../models/cart.model.js";
import Address from "../models/address.model.js";
import { quoteShipping } from "./shipping.service.js";
import voucherService from "./voucher.service.js"; // <-- để auto-assign voucher sau khi thanh toán

// So sánh biến thể
const isSameVariant = (a = {}, b = {}) =>
  String(a.weight || "") === String(b.weight || "") &&
  String(a.ripeness || "") === String(b.ripeness || "");

// Chuẩn hoá số tiền
const toMoney = (v) => Math.max(0, Math.round(Number(v || 0)));

/**
 * Tạo đơn hàng
 */
export const createOrder = async ({
  userId,
  cartItems = [],
  voucher,             // code (string) hoặc ObjectId
  address,             // {_id} hoặc object đầy đủ
  paymentMethod = "cod",
}) => {
  // 1) Địa chỉ
  let addr = null;
  if (address?._id) {
    addr = await Address.findById(address._id).lean();
    if (!addr) throw new Error("Địa chỉ giao hàng không hợp lệ");
  } else if (address && address.fullName && address.phone && address.province) {
    addr = address;
  } else {
    throw new Error("Thiếu thông tin địa chỉ giao hàng");
  }

  // 2) Sản phẩm/biến thể
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    throw new Error("Giỏ hàng trống");
  }

  const items = [];
  for (const item of cartItems) {
    const product = await Product.findById(item.productId);
    if (!product) throw new Error(`Sản phẩm không tồn tại: ${item.productId}`);

    const variantInfo = item.variant || {};
    if (!variantInfo.weight || !variantInfo.ripeness) {
      throw new Error(`Thiếu thông tin biến thể cho sản phẩm ${product.name}`);
    }

    const matchedVariant = (product.variants || []).find((v) =>
      isSameVariant(v.attributes, variantInfo)
    );
    if (!matchedVariant) {
      throw new Error(`Không tìm thấy biến thể phù hợp cho sản phẩm ${product.name}`);
    }
    if (Number(matchedVariant.stock) < Number(item.quantity)) {
      throw new Error(`Không đủ tồn kho cho sản phẩm ${product.name}`);
    }

    items.push({
      product: product._id,
      productName: product.name,
      quantity: Number(item.quantity || 0),
      price: Number(matchedVariant.price || 0),
      variant: variantInfo,
      variantId: matchedVariant._id,
    });
  }

  const subtotal = items.reduce((s, it) => s + it.quantity * it.price, 0);

  // 3) Phí ship theo khu vực
  const { amount: shippingFee, ruleName, matchedBy } = await quoteShipping({
    provinceCode: 1, // Hà Nội
    districtCode: String(addr.districtCode || addr.district_code || ""),
    wardCode: String(addr.wardCode || addr.ward_code || ""),
    cartSubtotal: subtotal,
  });

  // 4) Áp voucher
  let appliedVoucher = null;
  let discountAmount = 0;

  if (voucher) {
    let vDoc = null;
    if (typeof voucher === "string") {
      vDoc = await Voucher.findOne({ code: voucher.trim().toUpperCase() });
    } else if (mongoose.isValidObjectId(voucher)) {
      vDoc = await Voucher.findById(voucher);
    }
    if (!vDoc) throw new Error("Mã giảm giá không hợp lệ");

    if (Array.isArray(vDoc.assignedUsers) && vDoc.assignedUsers.length > 0) {
      const assigned = vDoc.assignedUsers.map((x) => String(x));
      if (!assigned.includes(String(userId))) {
        throw new Error("Mã giảm giá không thuộc về bạn");
      }
    }

    if (vDoc.discount > 0 && vDoc.discount <= 100) {
      discountAmount = (subtotal * vDoc.discount) / 100;
    } else {
      discountAmount = Number(vDoc.discount || 0);
    }

    if (vDoc.maxDiscount) {
      discountAmount = Math.min(discountAmount, Number(vDoc.maxDiscount || 0));
    }

    discountAmount = toMoney(discountAmount);
    appliedVoucher = vDoc._id;

    if (vDoc.quantity !== null && vDoc.quantity > 0) {
      vDoc.quantity -= 1;
      await vDoc.save();
    }
  }

  // 5) Tổng tiền
  const total = toMoney(subtotal + shippingFee - discountAmount);

  // 6) Lưu Order
  const order = new Order({
    user: userId,
    items,
    total,
    voucher: appliedVoucher || null,
    shippingAddress: {
      fullName: addr.fullName,
      phone: addr.phone,
      province: addr.province,
      district: addr.district,
      ward: addr.ward,
      detail: addr.detail,
    },
    // Thêm 3 field này nếu Order schema đã khai báo
    shippingFee: toMoney(shippingFee),
    shippingRuleName: ruleName || null,
    shippingMatchedBy: matchedBy || null,

    status: "pending",
    paymentStatus: "unpaid",
    paymentMethod,
  });

  await order.save();

  // 7) Trừ tồn
  for (const it of items) {
    await Product.updateOne(
      { _id: it.product, "variants._id": it.variantId },
      { $inc: { "variants.$.stock": -it.quantity } }
    );
  }

  // 8) Xoá khỏi giỏ
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

/**
 * Lấy tất cả đơn hàng (admin)
 */
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
 * - Giữ logic: nếu delivered & COD => paymentStatus = 'paid'
 * - Nếu paymentStatus = 'paid' => auto gán voucher theo ngưỡng chi tiêu
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

  // Nếu giao thành công & COD -> coi như đã thanh toán
  if (status === "delivered" && order.paymentMethod === "cod") {
    if (order.paymentStatus !== "paid") {
      order.paymentStatus = "paid";
      changed = true;
    }
  }

  if (changed) {
    await order.save();

    // Nếu đã paid -> xét cấp voucher tự động
    if (order.paymentStatus === "paid") {
      try {
        const result = await voucherService.assignVoucherBasedOnSpending(order.user);
        if (result?.assigned?.length) {
          console.log(" Auto-assigned vouchers:", result.assigned);
        } else {
          console.log("ℹ User chưa đủ điều kiện nhận voucher mới.");
        }
      } catch (err) {
        console.error(" Auto-assign voucher error:", err.message);
      }
    }
  }

  return order;
};
