// server/models/ShippingZone.model.js
import mongoose from "mongoose";

const surchargeSchema = new mongoose.Schema(
  {
    minSubtotal: Number, // ngưỡng tối thiểu áp surcharge (tuỳ chọn)
    maxSubtotal: Number, // ngưỡng tối đa áp surcharge (tuỳ chọn)
    amount: { type: Number, required: true }, // số tiền cộng thêm
  },
  { _id: false }
);

const shippingZoneSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    // ===== CẤU TRÚC MỚI (service đọc trực tiếp) =====
    districtCodes: {
      type: [String],
      default: [], // <- mặc định mảng rỗng để service kiểm tra ổn định
    },
    wardCodes: {
      type: [String],
      default: [], // <- mặc định mảng rỗng
    },
    baseFee: { type: Number, default: 0 },
    freeThreshold: { type: Number, default: null },
    surcharges: { type: [surchargeSchema], default: [] },
    isDefault: { type: Boolean, default: false, index: true },
    priority: { type: Number, default: 0 },

    // ===== CẤU TRÚC CŨ (tương thích ngược) =====
    match: {
      province_code: { type: Number, default: undefined }, // ví dụ 1 (Hà Nội)
      district_codes: { type: [String], default: [] },
      ward_codes: { type: [String], default: [] },
    },
    fee: {
      type: {
        type: String,
        enum: ["flat"], // có thể mở rộng "distance"
        default: "flat",
      },
      amount: { type: Number, default: undefined },          // tương đương baseFee
      free_threshold: { type: Number, default: undefined },  // tương đương freeThreshold
    },
  },
  { timestamps: true, versionKey: false }
);

// ===== Index hữu ích =====
shippingZoneSchema.index({ name: 1 });
shippingZoneSchema.index({ districtCodes: 1 });
shippingZoneSchema.index({ wardCodes: 1 });
shippingZoneSchema.index({ priority: -1 });

// Helpers pad code (giữ số 0 đầu)
const padDistrict = (v) => {
  const s = String(v ?? "").trim();
  return /^\d+$/.test(s) ? s.padStart(3, "0") : s;
};
const padWard = (v) => {
  const s = String(v ?? "").trim();
  return /^\d+$/.test(s) ? s.padStart(5, "0") : s;
};

// ===== Chuẩn hoá/đồng bộ dữ liệu trước khi validate/save =====
shippingZoneSchema.pre("validate", function (next) {
  // Bảo đảm mảng luôn tồn tại
  if (!Array.isArray(this.districtCodes)) this.districtCodes = [];
  if (!Array.isArray(this.wardCodes)) this.wardCodes = [];
  if (!this.match) this.match = {};
  if (!Array.isArray(this.match.district_codes)) this.match.district_codes = [];
  if (!Array.isArray(this.match.ward_codes)) this.match.ward_codes = [];

  next();
});

shippingZoneSchema.pre("save", function (next) {
  // 1) Normalize + dedup districtCodes/wardCodes (mới)
  if (Array.isArray(this.districtCodes) && this.districtCodes.length) {
    this.districtCodes = [...new Set(this.districtCodes.map(padDistrict))];
  }
  if (Array.isArray(this.wardCodes) && this.wardCodes.length) {
    this.wardCodes = [...new Set(this.wardCodes.map(padWard))];
  }

  // 2) Nếu trống → đồng bộ từ match.district_codes / match.ward_codes (cũ)
  if ((!this.districtCodes || this.districtCodes.length === 0) && this.match?.district_codes?.length) {
    this.districtCodes = [...new Set(this.match.district_codes.map(padDistrict))];
  }
  if ((!this.wardCodes || this.wardCodes.length === 0) && this.match?.ward_codes?.length) {
    this.wardCodes = [...new Set(this.match.ward_codes.map(padWard))];
  }

  // 3) Đồng bộ ngược (để tương thích query cũ nếu có)
  if (Array.isArray(this.districtCodes)) {
    this.match.district_codes = [...new Set(this.districtCodes.map(padDistrict))];
  }
  if (Array.isArray(this.wardCodes)) {
    this.match.ward_codes = [...new Set(this.wardCodes.map(padWard))];
  }

  // 4) Đồng bộ baseFee / freeThreshold từ fee nếu chưa set (tương thích cũ)
  if (this.baseFee == null && this.fee?.amount != null) {
    this.baseFee = this.fee.amount;
  }
  if (this.freeThreshold == null && this.fee?.free_threshold != null) {
    this.freeThreshold = this.fee.free_threshold;
  }

  next();
});

// Tránh OverwriteModelError khi reload
const ShippingZone =
  mongoose.models.ShippingZone || mongoose.model("ShippingZone", shippingZoneSchema);

export default ShippingZone;
