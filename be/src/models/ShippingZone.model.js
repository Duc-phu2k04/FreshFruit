// server/models/ShippingZone.model.js
import mongoose from "mongoose";

/* ---------- Surcharges (tuỳ chọn) ---------- */
const surchargeSchema = new mongoose.Schema(
  {
    minSubtotal: { type: Number, default: null }, // ngưỡng tối thiểu áp surcharge
    maxSubtotal: { type: Number, default: null }, // ngưỡng tối đa áp surcharge
    amount:      { type: Number, required: true }, // số tiền cộng thêm
  },
  { _id: false }
);

/* ---------- Helpers: chuẩn hoá mã khu vực (giữ số 0 đầu) ---------- */
const padDistrict = (v) => {
  const s = String(v ?? "").trim();
  return s && /^\d+$/.test(s) ? s.padStart(3, "0") : s;
};
const padWard = (v) => {
  const s = String(v ?? "").trim();
  return s && /^\d+$/.test(s) ? s.padStart(5, "0") : s;
};

/* ---------- ShippingZone schema ---------- */
const shippingZoneSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    // ===== CẤU TRÚC MỚI (service đọc trực tiếp) =====
    districtCodes: { type: [String], default: [] }, // ví dụ: ["004","019",...]
    wardCodes:     { type: [String], default: [] }, // ví dụ: ["00623",...]
    baseFee:       { type: Number, default: 0 },
    freeThreshold: { type: Number, default: null },
    surcharges:    { type: [surchargeSchema], default: [] },
    isDefault:     { type: Boolean, default: false, index: true },
    priority:      { type: Number, default: 0 },

    // ===== CẤU TRÚC CŨ (tương thích ngược, seed vẫn set) =====
    match: {
      province_code:  { type: Number, default: undefined }, // ví dụ 1 (HN)
      district_codes: { type: [String], default: [] },
      ward_codes:     { type: [String], default: [] },
    },
    fee: {
      type: {
        type: String,
        enum: ["flat"],
        default: "flat",
      },
      amount:         { type: Number, default: undefined },  // tương đương baseFee
      free_threshold: { type: Number, default: undefined },  // tương đương freeThreshold
    },

    // (tuỳ chọn) flags mở rộng (shipping.service có thể dùng)
    isSameWard: { type: Boolean, default: false },
    sameWard:   { type: Boolean, default: false },
    flags: {
      sameWard: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "shippingzones", // cố định collection để seed & runtime cùng chỗ
  }
);

/* ---------- Indexes hữu ích ---------- */
shippingZoneSchema.index({ name: 1 });
shippingZoneSchema.index({ districtCodes: 1 });
shippingZoneSchema.index({ wardCodes: 1 });
shippingZoneSchema.index({ isDefault: 1, priority: -1 });
shippingZoneSchema.index({ priority: -1 });

/* ---------- Chuẩn hoá dữ liệu trước validate ---------- */
shippingZoneSchema.pre("validate", function (next) {
  if (!Array.isArray(this.districtCodes)) this.districtCodes = [];
  if (!Array.isArray(this.wardCodes)) this.wardCodes = [];
  if (!this.match) this.match = {};
  if (!Array.isArray(this.match.district_codes)) this.match.district_codes = [];
  if (!Array.isArray(this.match.ward_codes)) this.match.ward_codes = [];
  if (!Array.isArray(this.surcharges)) this.surcharges = [];
  next();
});

/* ---------- Đồng bộ & pad trước khi lưu ---------- */
shippingZoneSchema.pre("save", function (next) {
  // 1) Chuẩn hoá + dedup theo cấu trúc mới
  if (Array.isArray(this.districtCodes) && this.districtCodes.length) {
    this.districtCodes = [...new Set(this.districtCodes.map(padDistrict).filter(Boolean))];
  }
  if (Array.isArray(this.wardCodes) && this.wardCodes.length) {
    this.wardCodes = [...new Set(this.wardCodes.map(padWard).filter(Boolean))];
  }

  // 2) Nếu mảng mới trống → lấy từ cấu trúc cũ (seed-legacy)
  if ((!this.districtCodes || this.districtCodes.length === 0) && this.match?.district_codes?.length) {
    this.districtCodes = [...new Set(this.match.district_codes.map(padDistrict).filter(Boolean))];
  }
  if ((!this.wardCodes || this.wardCodes.length === 0) && this.match?.ward_codes?.length) {
    this.wardCodes = [...new Set(this.match.ward_codes.map(padWard).filter(Boolean))];
  }

  // 3) Đồng bộ ngược sang match.* để các query legacy vẫn chạy
  this.match.district_codes = Array.isArray(this.districtCodes)
    ? [...new Set(this.districtCodes.map(padDistrict))]
    : [];
  this.match.ward_codes = Array.isArray(this.wardCodes)
    ? [...new Set(this.wardCodes.map(padWard))]
    : [];

  // 4) Đồng bộ baseFee / freeThreshold từ fee nếu chưa set
  if ((this.baseFee === undefined || this.baseFee === null) && this.fee?.amount != null) {
    this.baseFee = Number(this.fee.amount) || 0;
  }
  if (
    (this.freeThreshold === undefined || this.freeThreshold === null) &&
    this.fee?.free_threshold != null
  ) {
    const ft = Number(this.fee.free_threshold);
    this.freeThreshold = Number.isFinite(ft) ? ft : null;
  }

  // 5) Làm sạch surcharges
  if (Array.isArray(this.surcharges) && this.surcharges.length) {
    this.surcharges = this.surcharges
      .map((s) => ({
        minSubtotal: s?.minSubtotal == null ? null : Number(s.minSubtotal),
        maxSubtotal: s?.maxSubtotal == null ? null : Number(s.maxSubtotal),
        amount: Number(s?.amount || 0) || 0,
      }))
      .filter((s) => Number.isFinite(s.amount));
  }

  next();
});

/* ---------- Tránh OverwriteModelError ---------- */
const ShippingZone =
  mongoose.models.ShippingZone || mongoose.model("ShippingZone", shippingZoneSchema);

export default ShippingZone;
