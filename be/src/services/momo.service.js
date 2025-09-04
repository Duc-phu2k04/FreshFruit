import crypto from 'crypto';
import https from 'https';
import Order from '../models/order.model.js';
import Product from '../models/product.model.js';
import Voucher from '../models/voucher.model.js';
import Cart from '../models/cart.model.js';
import voucherService from './voucher.service.js'; //  IMPORT VOUCHER SERVICE

//  Thay bằng thông tin tài khoản MoMo của bạn
const partnerCode = "MOMO";
const accessKey = "F8BBA842ECF85";
const secretKey = "K951B6PE1waDMi640xX08PD3vg6EkVlz";

// Link callback và redirect
const redirectUrl = "http://localhost:5173/order-success";
const ipnUrl = "https://e864bfe7d05b.ngrok-free.app/api/momo/ipn";

const isSameVariant = (a, b) => a.weight === b.weight && a.ripeness === b.ripeness;

const createOrderTemp = async ({ userId, cartItems, voucher, shippingAddress }) => {
  if (!shippingAddress || !shippingAddress.fullName || !shippingAddress.phone || !shippingAddress.province) {
    throw new Error("Thiếu thông tin địa chỉ giao hàng");
  }

  let items = [];

  //  Validate và prepare items
  for (const item of cartItems) {
    const product = await Product.findById(item.productId);
    if (!product) throw new Error(`Sản phẩm không tồn tại: ${item.productId}`);

    const matchedVariant = product.variants.find(v => isSameVariant(v.attributes, item.variant));
    if (!matchedVariant) throw new Error(`Không tìm thấy biến thể phù hợp cho sản phẩm ${product.name}`);
    if (matchedVariant.stock < item.quantity) throw new Error(`Không đủ tồn kho cho sản phẩm ${product.name}`);

    items.push({
      product: product._id,
      productName: product.name,
      quantity: item.quantity,
      price: matchedVariant.price,
      variant: item.variant,
      variantId: matchedVariant._id,
    });
  }

  const BASE_SHIPPING_FEE = 30000;
  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.price, 0);
  let discountAmount = 0;
  let appliedVoucher = null;

  //  Handle voucher
  if (voucher) {
    const foundVoucher = await Voucher.findOne({ code: voucher.toUpperCase() });
    if (!foundVoucher) throw new Error("Mã giảm giá không hợp lệ");
    
    // Validate voucher ownership
    if (foundVoucher.assignedUsers && foundVoucher.assignedUsers.length > 0) {
      const assigned = foundVoucher.assignedUsers.map(x => x.toString());
      if (!assigned.includes(userId.toString())) {
        throw new Error("Mã giảm giá không thuộc về bạn");
      }
    }
    
    discountAmount = (subtotal * foundVoucher.discount) / 100;
    appliedVoucher = foundVoucher._id;
    
    //  TRỪ VOUCHER NGAY
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
    shippingAddress,
    status: 'pending',
    paymentStatus: 'unpaid',
    paymentMethod: 'momo'
  });

  await order.save();

  //  TRỪ TỒN KHO NGAY (Option 2)
  for (const item of items) {
    await Product.updateOne(
      { _id: item.product, "variants._id": item.variantId },
      { $inc: { "variants.$.stock": -item.quantity } }
    );
  }

  //  XÓA KHỎI GIỎ HÀNG NGAY
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

  //  Auto-cancel sau 10 phút nếu chưa thanh toán
  setTimeout(async () => {
    try {
      const latestOrder = await Order.findById(order._id);
      if (latestOrder && latestOrder.paymentStatus === 'unpaid') {
        await cancelMomoOrder(order._id);
      }
    } catch (err) {
      console.error("❌ Lỗi auto-cancel order:", err);
    }
  }, 10 * 60 * 1000); // 10 phút

  return order;
};

//  HOÀN STOCK KHI THANH TOÁN THẤT BẠI
const cancelMomoOrder = async (orderId) => {
  const order = await Order.findById(orderId);
  if (!order || order.paymentStatus !== 'unpaid') return;

  //  HOÀN TỒN KHO
  for (const item of order.items) {
    await Product.updateOne(
      { _id: item.product, "variants._id": item.variantId },
      { $inc: { "variants.$.stock": item.quantity } }
    );
  }

  //  HOÀN VOUCHER (nếu có)
  if (order.voucher) {
    await Voucher.updateOne(
      { _id: order.voucher }, 
      { $inc: { quantity: 1 } }
    );
  }

  //  CẬP NHẬT TRẠNG THÁI
  order.paymentStatus = 'failed';
  order.status = 'cancelled';
  await order.save();

  console.log(` Đã hoàn stock và cancel order: ${orderId}`);
};

const createMomoPayment = async (order) => {
  const requestId = `${partnerCode}${Date.now()}`;
  const orderId = order._id.toString();
  const orderInfo = "Thanh toán đơn hàng FreshFruit";
  const amount = order.total.toString();
  const requestType = "payWithMethod";
  const extraData = "";

  const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;
  const signature = crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex');

  const body = JSON.stringify({
    partnerCode,
    partnerName: "MoMo Payment",
    storeId: "FreshFruitStore",
    requestId,
    amount,
    orderId,
    orderInfo,
    redirectUrl,
    ipnUrl,
    lang: 'vi',
    requestType,
    signature,
    extraData
  });

  console.log("📤 Gửi request tới MoMo với body:", body);

  const options = {
    hostname: 'test-payment.momo.vn',
    path: '/v2/gateway/api/create',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      res.setEncoding('utf8');
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(responseBody);
          console.log("🎯 Phản hồi từ MoMo:", data);

          if (data && data.payUrl) resolve(data.payUrl);
          else {
            console.error("❌ MoMo không trả về payUrl. Phản hồi:", data);
            reject(new Error("Không lấy được payUrl từ MoMo"));
          }
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', err => reject(err));
    req.write(body);
    req.end();
  });
};

//  CẬP NHẬT: THÊM AUTO-ASSIGN VOUCHER
const confirmMomoOrder = async (orderId) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Không tìm thấy đơn hàng");
  if (order.paymentStatus === 'paid') return;

  //  CẬP NHẬT TRẠNG THÁI
  order.paymentStatus = 'paid';
  order.status = 'confirmed';
  await order.save();

  //  AUTO-ASSIGN VOUCHER BASED ON SPENDING
  try {
    console.log(` Đang kiểm tra voucher tự động cho user: ${order.user}`);
    const result = await voucherService.assignVoucherBasedOnSpending(order.user);
    
    if (result && result.assigned && result.assigned.length > 0) {
      console.log(` Đã gán voucher tự động:`, result.assigned);
    } else {
      console.log(` User chưa đủ điều kiện nhận voucher mới (Total spent: ${result?.totalSpent || 0})`);
    }
  } catch (err) {
    // Không throw lỗi để không làm gián đoạn flow thanh toán
    console.error(" Lỗi khi gán voucher tự động:", err.message);
  }

  console.log(` Xác nhận thanh toán thành công: ${orderId}`);
};

export default {
  createOrderTemp,
  createMomoPayment,
  confirmMomoOrder,
  cancelMomoOrder
};