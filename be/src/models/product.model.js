// be/src/models/product.model.js
import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  price: { type: Number, required: true },
  image: String,
  stock: { type: Number, default: 0 },

  // Category: liên kết tới bảng category
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },

  // Location: thêm trường nơi sản xuất (province hoặc country)
  location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' }, // optional
}, { timestamps: true });

const Product = mongoose.model("Product", productSchema);
export default Product;
