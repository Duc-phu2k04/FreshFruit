import mongoose from "mongoose";

// Tạo customId dạng: ORD-20250714-153020-xxxx
function generateCustomId() {
  const now = new Date();
  const date = now.toISOString().slice(0,10).replace(/-/g, ''); // yyyyMMdd
  const time = now.toTimeString().slice(0,8).replace(/:/g, ''); // HHmmss
  const random = Math.floor(1000 + Math.random() * 9000); // 4 số ngẫu nhiên
  return `ORD-${date}-${time}-${random}`;
}

const orderSchema = new mongoose.Schema({
  customId: {
    type: String,
    unique: true,
    default: generateCustomId
  },

  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },

  items: [
    {
      product: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Product", 
        required: true 
      },
      quantity: { type: Number, required: true },
      price: { type: Number, required: true }
    }
  ],

  total: { type: Number, required: true },

  status: { 
    type: String, 
    enum: ["pending", "confirmed", "shipping", "delivered", "cancelled"], 
    default: "pending" 
  },

  voucher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Voucher",
    default: null,
  }

}, { timestamps: true });

export default mongoose.model("Order", orderSchema);
