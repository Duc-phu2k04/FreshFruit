import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  price: { type: Number, required: true },
  stock: { type: Number, required: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true },

  // Biến thể
  grade: {
    type: String,
    enum: ['A', 'B', 'C'],
    required: true,
  },
  ripeness: {
    type: String,
    enum: ['Chín', 'Xanh'],
    required: true,
  },
  weight: {
    type: String,
    enum: ['0.5kg', '1kg', '1.5kg', '2kg'],
    required: true,
  },

  image: String,
}, { timestamps: true });

export default mongoose.model('Product', productSchema);
