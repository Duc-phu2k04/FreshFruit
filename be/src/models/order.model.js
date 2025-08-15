import mongoose from "mongoose";
import voucherService from "../services/voucher.service.js";

function generateCustomId() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const time = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${date}-${time}-${random}`;
}

const orderSchema = new mongoose.Schema(
  {
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
          required: false,
        },
        productName: { type: String, required: true },
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
    deletedByUser: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Index để tối ưu tìm kiếm theo user và customId
orderSchema.index({ customId: 1, user: 1 });

// Hook post save để gán voucher tự động
orderSchema.post("save", async function (doc, next) {
  try {
    // ✅ Chỉ gán voucher khi đơn đã thanh toán
    if (doc.paymentStatus === "paid") {
      // Gán voucher theo đơn > 2 triệu
      if (doc.total >= 2000000) {
        if (voucherService.assignVoucherPerOrder) {
          await voucherService.assignVoucherPerOrder(doc._id);
        }
      }
      // Gán voucher dựa trên tổng chi tiêu user
      if (voucherService.assignVoucherBasedOnSpending) {
        await voucherService.assignVoucherBasedOnSpending(doc.user);
      }
    }
  } catch (err) {
    console.error("Lỗi khi gán voucher tự động:", err);
  }
  next();
});

export default mongoose.model("Order", orderSchema);
