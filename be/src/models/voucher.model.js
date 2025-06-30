import mongoose from "mongoose";

const voucherSchema = new mongoose.Schema({
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
    required: true,
  },
  quantity: {
    type: Number,
    default: null,
  },
}, { timestamps: true });

const Voucher = mongoose.model("Voucher", voucherSchema);
export default Voucher;
