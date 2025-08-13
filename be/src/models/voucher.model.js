import mongoose from "mongoose";

const voucherSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    discount: {
      type: Number,
      required: true,
      min: 1,
      max: 100,
    },
    expiration: {
      type: Date,
      required: false,
    },
    quantity: {
      type: Number,
      default: null, // null = vô hạn cho toàn hệ thống
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
          default: 1, // số lượng voucher user này có
          min: 0,
        },
      },
    ],
  },
  { timestamps: true }
);

const Voucher = mongoose.model("Voucher", voucherSchema);
export default Voucher;
