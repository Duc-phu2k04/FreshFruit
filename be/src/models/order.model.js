// src/models/Order.js
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

    /**
     * ====== PHÍ SHIP (bổ sung) ======
     * subtotal: tạm tính trước ship/giảm (không bắt buộc – giữ để tham chiếu)
     * shippingFee: phí vận chuyển đã tính theo khu vực
     * shippingRuleName: tên rule áp dụng (để hiển thị/trace)
     * total: GIỮ NGUYÊN – tổng tiền đơn (bạn đang dùng ở FE), có thể = subtotal + shippingFee - discount...
     */
    subtotal: { type: Number, default: 0 },             // (optional) tạm tính
    shippingFee: { type: Number, default: 0 },          // ✅ phí ship
    shippingRuleName: { type: String },                 // ✅ tên rule áp dụng
    total: { type: Number, required: true },            // GIỮ NGUYÊN

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

    /**
     * Mở rộng shippingAddress (không bắt buộc):
     * thêm districtCode/wardCode để backend có thể quote lại phí ship khi cần.
     * Nếu không dùng, vẫn hoạt động bình thường.
     */
    shippingAddress: {
      fullName: String,
      phone: String,
      province: String,
      district: String,
      ward: String,
      detail: String,
      districtCode: { type: String }, // optional
      wardCode: { type: String },     // optional
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

// Hook post save để gán voucher tự động (GIỮ NGUYÊN)
orderSchema.post("save", async function (doc, next) {
  try {
    if (doc.paymentStatus === "paid") {
      if (doc.total >= 2000000) {
        if (voucherService.assignVoucherPerOrder) {
          await voucherService.assignVoucherPerOrder(doc._id);
        }
      }
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
