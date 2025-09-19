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
// Dashboard
import statisticsRoutes from './src/routes/statistics.route.js';

dotenv.config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Test route
app.get('/', (req, res) => {
  res.send('API is working');
});

// Routes
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
app.use("/api/momo-preorder", momoPreorderRoutes);  // đơn đặt trước

// Dashboard

app.use('/api/statistics', statisticsRoutes);

// Mount shipping routes (bao gồm /api/shipping/quote, v.v.)
app.use('/api', shippingRoutes);

// Mount chatbot routes (rule-based + có thể fallback AI nếu bạn thêm ở route)
app.use('/api/fruitbot', fruitbotRouter);

//  NEW: Mount Preorder routes
//    → cung cấp các endpoint: /api/preorders (create, cancel, pay-remaining, admin, ...)
app.use('/api/preorders', preorderRouter);

// Static file route
app.use('/images', express.static('public/images'));

// Connect MongoDB and start server
mongoose.connect('mongodb://localhost:27017/freshfruit')
  .then(() => {
    console.log(' Connected to MongoDB');
    app.listen(3000, () => console.log(' Server is running at http://localhost:3000'));
  })
  .catch((err) => console.error(' MongoDB connection error:', err));
