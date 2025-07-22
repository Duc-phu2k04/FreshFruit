import mongoose from "mongoose";

const variantSchema = new mongoose.Schema({
  attributes: {
    grade: { type: String, required: true },
    weight: { type: String, required: true },
    ripeness: { type: String, required: true }
  },
  price: { type: Number, required: true },
  stock: { type: Number, default: 0 }
});

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
  location: { type: mongoose.Schema.Types.ObjectId, ref: "Location" },

  // Các option để sinh biến thể
  gradeOptions: [String],
  weightOptions: [String],
  ripenessOptions: [String],

  // Gốc để sinh biến thể
  baseVariant: {
    attributes: {
      grade: String,
      weight: String,
      ripeness: String
    },
    price: Number,
    stock: Number
  },

  variants: [variantSchema]
}, { timestamps: true });

export default mongoose.model("Product", productSchema);
