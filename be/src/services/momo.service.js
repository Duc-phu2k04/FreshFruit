import crypto from 'crypto';
import https from 'https';
import Order from '../models/order.model.js';
import Product from '../models/product.model.js';
import Voucher from '../models/voucher.model.js';
import Cart from '../models/cart.model.js';

// ⚙️ Thay bằng thông tin tài khoản MoMo của bạn
const partnerCode = "MOMO";
const accessKey = "F8BBA842ECF85";
const secretKey = "K951B6PE1waDMi640xX08PD3vg6EkVlz";

// Link callback và redirect
const redirectUrl = "http://localhost:5173/order-success";
const ipnUrl = "https://a847eb666ff9.ngrok-free.app/api/momo/ipn";

const isSameVariant = (a, b) => a.weight === b.weight && a.ripeness === b.ripeness;

const createOrderTemp = async ({ userId, cartItems, voucher, shippingAddress }) => {
  if (!shippingAddress || !shippingAddress.fullName || !shippingAddress.phone || !shippingAddress.province) {
    throw new Error("Thiếu thông tin địa chỉ giao hàng");
  }

  let items = [];

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

  if (voucher) {
    const foundVoucher = await Voucher.findOne({ code: voucher.toUpperCase() });
    if (!foundVoucher) throw new Error("Mã giảm giá không hợp lệ");
    discountAmount = (subtotal * foundVoucher.discount) / 100;
    appliedVoucher = foundVoucher._id;
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

  setTimeout(async () => {
    const latestOrder = await Order.findById(order._id);
    if (latestOrder && latestOrder.paymentStatus === 'unpaid') {
      latestOrder.paymentStatus = 'failed';
      latestOrder.status = 'cancelled';
      await latestOrder.save();
    }
  }, 100 * 60 * 1000); // 100 phút

  return order;
};

const createMomoPayment = async (order) => {
  const requestId = `${partnerCode}${Date.now()}`; // unique
  const orderId = order._id.toString(); // giữ nguyên
  const orderInfo = "Thanh toán đơn hàng FreshFruit";
  const amount = order.total.toString();
  const requestType = "payWithMethod";
  const extraData = "";

  const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;
  const signature = crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex');

  const body = JSON.stringify({
    partnerCode,
    partnerName: "MoMo Payment", // ✅ thêm
    storeId: "FreshFruitStore",   // ✅ thêm
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


const confirmMomoOrder = async (orderId) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Không tìm thấy đơn hàng");
  if (order.paymentStatus === 'paid') return;

  // Trừ tồn kho
  for (const item of order.items) {
    await Product.updateOne(
      { _id: item.product, "variants._id": item.variantId },
      { $inc: { "variants.$.stock": -item.quantity } }
    );
  }

  // Trừ số lượng voucher
  if (order.voucher) {
    await Voucher.updateOne({ _id: order.voucher }, { $inc: { quantity: -1 } });
  }

  // Xóa sản phẩm khỏi giỏ hàng
  for (const item of order.items) {
    await Cart.updateOne(
      { user: order.user },
      {
        $pull: {
          items: {
            product: item.product,
            variantId: item.variantId
          }
        }
      }
    );
  }

  // Cập nhật trạng thái đơn hàng
  order.paymentStatus = 'paid';
  order.status = 'confirmed';
  await order.save();
};


export default {
  createOrderTemp,
  createMomoPayment,
  confirmMomoOrder
};
