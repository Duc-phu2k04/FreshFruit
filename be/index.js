// index.js
import express from 'express';
import mongoose from 'mongoose';
import authRoutes from './src/routes/auth.route.js';
import productRoutes from './src/routes/product.route.js';
import categoryRoutes from './src/routes/category.route.js';
import locationRoute from "./src/routes/location.route.js";
import cartRoute from './src/routes/cart.route.js';
import orderRoute from './src/routes/order.route.js';
import reviewRoute from './src/routes/review.route.js';
import cors from 'cors';
import dotenv from 'dotenv';
import cors from 'cors';
dotenv.config();

const app = express();
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/', (req, res) => {
  res.send('API is working');
});

app.use('/auth', authRoutes);

app.use("/api/product", productRoutes);

app.use("/api/category", categoryRoutes);

app.use("/api/locations", locationRoute);

app.use("/api/cart", cartRoute);

app.use("/api/order", orderRoute);

app.use('/api/review', reviewRoute);

mongoose.connect('mongodb://localhost:27017/freshfruit')

  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(3000, () => console.log('Server is running at http://localhost:3000'));
  })
  .catch((err) => console.error('MongoDB connection error:', err));
