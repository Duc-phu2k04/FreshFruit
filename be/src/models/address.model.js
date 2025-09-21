// be/src/models/Address.js
import mongoose from 'mongoose';

/* ---------- Helpers: chuẩn hoá mã khu vực ---------- */
const padDistrict = (v) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  // districts 3 ký tự, giữ 0 đầu nếu là số
  return /^\d+$/.test(s) ? s.padStart(3, '0') : s;
};

const padWard = (v) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  // wards 5 ký tự, giữ 0 đầu nếu là số
  return /^\d+$/.test(s) ? s.padStart(5, '0') : s;
};

const addressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    fullName: { type: String, required: true, trim: true },
    phone:    { type: String, required: true, trim: true },

    province: { type: String, required: true, trim: true },
    district: { type: String, required: true, trim: true },
    ward:     { type: String, required: true, trim: true },
    detail:   { type: String, required: true, trim: true },

    // QUAN TRỌNG: String để không mất số 0 đầu. Có setter để auto-pad.
    // Ví dụ: districtCode "019", wardCode "00623"
    districtCode: {
      type: String,
      trim: true,
      default: null,
      set: padDistrict,
      maxlength: 10,
    },
    wardCode: {
      type: String,
      trim: true,
      default: null,
      set: padWard,
      maxlength: 10,
    },

    // (tuỳ chọn) toạ độ, nếu bạn dùng khoảng cách
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },

    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false }
);

/* ---------- Indexes hữu ích ---------- */
// Lấy nhanh địa chỉ mặc định
addressSchema.index({ user: 1, isDefault: -1, createdAt: -1 });
// Tra cứu theo mã khu vực
addressSchema.index({ user: 1, districtCode: 1 });
addressSchema.index({ user: 1, wardCode: 1 });

/* ---------- Middleware: đảm bảo dữ liệu luôn được pad ---------- */
addressSchema.pre('save', function(next) {
  // re-apply setter để chắc chắn
  if (this.isModified('districtCode')) this.districtCode = padDistrict(this.districtCode);
  if (this.isModified('wardCode')) this.wardCode = padWard(this.wardCode);
  next();
});

export default mongoose.model('Address', addressSchema);
