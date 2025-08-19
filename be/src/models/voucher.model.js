import mongoose from "mongoose";

const voucherSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true, // ✅ unique index tự động tạo, không cần schema.index() nữa
      uppercase: true,
      trim: true,
    },
    discount: {
      type: Number,
      required: true,
      min: 1,
      max: 100, // giảm giá tối đa 100%
    },
    expiration: {
      type: Date,
      required: false,
    },
    quantity: {
      type: Number,
      default: null, // null = không giới hạn lượt dùng cho toàn hệ thống
      min: 0,
    },
    assignedUsers: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        quantity: {
          type: Number,
          default: 1, // số lượt voucher user này có
          min: 0,
        },
      },
    ],
  },
  { timestamps: true }
);


// voucherSchema.index({ code: 1 });

const Voucher = mongoose.model("Voucher", voucherSchema);
export default Voucher;
