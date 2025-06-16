// index.js
import express from 'express';
import mongoose from 'mongoose';
import authRoutes from './src/routes/auth.route.js';
import productRoutes from './src/routes/product.route.js';
import categoryRoutes from './src/routes/category.route.js';

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/', (req, res) => {
  res.send('API is working');
});

app.use('/auth', authRoutes);

app.use("/api/product", productRoutes);

app.use("/api/category", categoryRoutes);

mongoose.connect('mongodb://localhost:27017/freshfruit')

  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(3000, () => console.log('Server is running at http://localhost:3000'));
  })
  .catch((err) => console.error('MongoDB connection error:', err));
