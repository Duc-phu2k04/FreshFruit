// index.js
import express from 'express';
import mongoose from 'mongoose';
import authRoutes from './src/routes/auth.route.js';

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/', (req, res) => {
  res.send('API is working');
});

app.use('/auth', authRoutes);

mongoose.connect('mongodb://localhost:27017/freshfruit', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(3000, () => console.log('Server is running at http://localhost:3000'));
  })
  .catch((err) => console.error('MongoDB connection error:', err));
