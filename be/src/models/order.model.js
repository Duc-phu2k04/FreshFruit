// ✅ Updated: models/order.model.js
import mongoose from "mongoose";

function generateCustomId() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const time = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${date}-${time}-${random}`;
}

const orderSchema = new mongoose.Schema({
  customId: {
    type: String,
    unique: true,
    default: generateCustomId,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  items: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
      },
      productName: String,
      variant: {
        grade: String,
        weight: String,
        ripeness: String,
      },
      quantity: { type: Number, required: true },
      price: { type: Number, required: true },
    },
  ],
  total: { type: Number, required: true },
  status: {
    type: String,
    enum: ["pending", "confirmed", "shipping", "delivered", "cancelled"],
    default: "pending",
  },
   // Trạng thái thanh toán
  paymentStatus: {
    type: String,
    enum: ["unpaid", "paid", "failed"],
    default: "unpaid",
  },
  paymentMethod: {
  type: String,
  enum: ["momo", "cod"],
  default: "cod",
},

  voucher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Voucher",
    default: null,
  },
  shippingAddress: {
    fullName: String,
    phone: String,
    province: String,
    district: String,
    ward: String,
    detail: String,
  },
}, { timestamps: true });

export default mongoose.model("Order", orderSchema);
