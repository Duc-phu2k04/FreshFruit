// index.js
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './src/routes/auth.route.js';
import productRoutes from './src/routes/product.route.js';
import categoryRoutes from './src/routes/category.route.js';
import locationRoute from "./src/routes/location.route.js";
import cartRoute from './src/routes/cart.route.js';
import orderRoute from './src/routes/order.route.js';
import reviewRoute from './src/routes/review.route.js';
import voucherRoutes from "./src/routes/voucher.route.js";
import momoRoutes from "./src/routes/momo.route.js";
import uploadRoute from './src/routes/upload.route.js';
import addressRoute from './src/routes/address.route.js';

//  shipping routes
import shippingRoutes from './src/routes/shipping.routes.js';

//  chatbot (HYBRID)
import { fruitbotRouter } from './src/routes/fruitbot.route.js';

//  Preorder routes
import preorderRouter from './src/routes/preorder.route.js';
import momoPreorderRoutes from './src/routes/momoPreorder.route.js';

dotenv.config();

const app = express();

/* ===================== Middlewares ===================== */
app.use(cors());

// NỚI GIỚI HẠN BODY để tránh 413 khi gửi ảnh base64 (đổi qua ENV nếu muốn)
const BODY_LIMIT = process.env.BODY_LIMIT || '25mb';
app.use(express.json({ limit: BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: BODY_LIMIT, parameterLimit: 100000 }));

// (Tuỳ chọn) handler gọn cho lỗi entity too large
app.use((err, req, res, next) => {
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({
      ok: false,
      message: `Payload quá lớn. Vui lòng giảm dung lượng ảnh hoặc tăng BODY_LIMIT (hiện tại ${BODY_LIMIT}).`,
    });
  }
  next(err);
});

/* ===================== Test route ===================== */
app.get('/', (req, res) => {
  res.send('API is working');
});

/* ===================== Routes ===================== */
app.use('/auth', authRoutes);

//  Giữ mount cũ (singular) để backward compatible
app.use('/api/product', productRoutes);

//  Thêm alias plural để FE gọi /api/products ...
app.use('/api/products', productRoutes);

app.use('/api/category', categoryRoutes);
app.use('/api/locations', locationRoute);
app.use('/api/cart', cartRoute);
app.use('/api/orders', orderRoute);
app.use('/api/review', reviewRoute);
app.use('/api/voucher', voucherRoutes);
app.use('/api/momo', momoRoutes);
app.use('/api/upload', uploadRoute);
app.use('/api/address', addressRoute);
app.use("/api/momo-preorder", momoPreorderRoutes);

// Mount shipping routes
app.use('/api', shippingRoutes);

// Mount chatbot routes
app.use('/api/fruitbot', fruitbotRouter);

// Preorder routes
app.use('/api/preorders', preorderRouter);

// Static file route
app.use('/images', express.static('public/images'));

/* ===================== Mongo & Server ===================== */
mongoose.connect('mongodb://localhost:27017/freshfruit')
  .then(() => {
    console.log(' Connected to MongoDB');
    app.listen(3000, () => console.log(' Server is running at http://localhost:3000'));
  })
  .catch((err) => console.error(' MongoDB connection error:', err));
