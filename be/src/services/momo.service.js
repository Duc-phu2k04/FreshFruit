import crypto from 'crypto';
import Order from '../models/order.model.js';

export const createMomoPayment = async (orderId) => {
  return new Promise(async (resolve, reject) => {
    try {
      const order = await Order.findById(orderId);
      if (!order || typeof order.total !== 'number') {
        return reject(new Error('Đơn hàng không hợp lệ hoặc thiếu trường total'));
      }

     const amount = Math.round(order.total).toString(); // hoặc parseInt(order.total).toString()


      // Cấu hình MoMo
      const partnerCode = 'MOMO';
      const accessKey = 'F8BBA842ECF85';
      const secretKey = 'K951B6PE1waDMi640xX08PD3vg6EkVlz';
      const orderInfo = 'Thanh toán đơn hàng FreshFruit';
      const redirectUrl = 'https://webhook.site/b3088a6a-2d17-4f8d-a383-71389a6c600b';
      const ipnUrl = 'https://webhook.site/b3088a6a-2d17-4f8d-a383-71389a6c600b';
      const requestType = 'captureWallet';
      const extraData = '';

      const requestId = partnerCode + new Date().getTime();
      const orderIdMomo = requestId;

      // Tạo raw signature
      const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}` +
        `&ipnUrl=${ipnUrl}&orderId=${orderIdMomo}&orderInfo=${orderInfo}&partnerCode=${partnerCode}` +
        `&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;

      // Tạo chữ ký HMAC SHA256
      const signature = crypto.createHmac('sha256', secretKey)
        .update(rawSignature)
        .digest('hex');

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
  autoCapture: true, // 🔧 Bắt buộc phải có nếu dùng captureWallet
  signature,
  lang: 'vi'
});


      console.log('📤 Sending payload to MoMo:', requestBody);

      const https = await import('https');
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

        res.on('data', (chunk) => {
          body += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(body);
            console.log('📦 MoMo RESPONSE:', response);
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
