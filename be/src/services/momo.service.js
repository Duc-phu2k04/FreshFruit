import crypto from 'crypto';
import https from 'https';
import Order from '../models/order.model.js';
import Product from '../models/product.model.js';
import Voucher from '../models/voucher.model.js';
import Cart from '../models/cart.model.js';

const isSameVariant = (a, b) => a.weight === b.weight && a.ripeness === b.ripeness;

export const createOrderTemp = async ({ userId, cartItems, voucher, shippingAddress }) => {
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
    paymentMethod: 'momo'
  });

  await order.save();
  return order;
};

export const confirmMomoOrder = async (orderId) => {
  const order = await Order.findOne({ _id: orderId });
  if (!order) throw new Error('Không tìm thấy đơn hàng');

  // Tránh xác nhận lại nếu đã xác nhận
  if (order.paymentStatus === 'paid') return;

  // Trừ tồn kho
  for (const item of order.items) {
    await Product.updateOne(
      { _id: item.product, "variants._id": item.variantId },
      { $inc: { "variants.$.stock": -item.quantity } }
    );
  }

  // Giảm số lượng voucher nếu có
  if (order.voucher) {
    await Voucher.updateOne({ _id: order.voucher }, { $inc: { quantity: -1 } });
  }

  // Xoá sản phẩm khỏi giỏ hàng
  await Cart.updateOne(
    { user: order.user },
    {
      $pull: {
        items: order.items.map(i => ({
          product: i.product,
          variantId: i.variantId,
        }))
      }
    }
  );

  // ✅ Cập nhật trạng thái thanh toán và đơn hàng
  order.paymentStatus = 'paid';
  order.status = 'confirmed';

  await order.save();
};


export const createMomoPayment = async (order) => {
  return new Promise(async (resolve, reject) => {
    try {
      const amount = Math.round(order.total).toString();

      const partnerCode = 'MOMO';
      const accessKey = 'F8BBA842ECF85';
      const secretKey = 'K951B6PE1waDMi640xX08PD3vg6EkVlz';
      const orderInfo = 'Thanh toán đơn hàng FreshFruit';
      const redirectUrl = 'http://localhost:5173/order-success';
      const ipnUrl = 'http://localhost:3000/api/momo/ipn';
      const requestType = 'payWithMethod';
      const extraData = '';

      const requestId = partnerCode + new Date().getTime();
      const orderIdMomo = order._id.toString(); // dùng order._id thật

      const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}` +
        `&ipnUrl=${ipnUrl}&orderId=${orderIdMomo}&orderInfo=${orderInfo}&partnerCode=${partnerCode}` +
        `&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;

      const signature = crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex');

      const requestBody = JSON.stringify({
        partnerCode,
        accessKey,
        requestId,
        amount,
        orderId: orderIdMomo,
        orderInfo,
        redirectUrl,
        ipnUrl,
        extraData,
        requestType,
        autoCapture: true,
        signature,
        lang: 'vi'
      });

      const options = {
        hostname: 'test-payment.momo.vn',
        port: 443,
        path: '/v2/gateway/api/create',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody),
        }
      };

      const req = https.request(options, (res) => {
        res.setEncoding('utf8');
        let body = '';

        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          try {
            const response = JSON.parse(body);
            if (response?.payUrl) {
              resolve(response.payUrl);
            } else {
              reject(new Error(response.message || 'Không tạo được thanh toán MoMo'));
            }
          } catch (err) {
            reject(new Error('Lỗi phân tích phản hồi từ MoMo'));
          }
        });
      });

      req.on('error', (e) => {
        reject(new Error('Lỗi kết nối tới MoMo: ' + e.message));
      });

      req.write(requestBody);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
};
