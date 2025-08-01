import mongoose from "mongoose";

const variantSchema = new mongoose.Schema({
  attributes: {
    weight: { type: String, required: true },
    ripeness: { type: String, required: true },
  },
  price: { type: Number, required: true },
  stock: { type: Number, default: 0 },
});

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: String,
    price: { type: Number, required: false }, // ✅ Thêm dòng này để hiển thị giá sản phẩm ở FE
    image: String,
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    location: { type: mongoose.Schema.Types.ObjectId, ref: "Location" },
    weightOptions: [String],
    ripenessOptions: [String],
    baseVariant: {
      attributes: {
        weight: String,
        ripeness: String,
      },
      price: Number,
      stock: Number,
    },
    variants: [variantSchema],
    displayVariant: {
      type: Object, // lưu biến thể hiển thị ngoài FE
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Product", productSchema);
