// server/models/product.model.js
import mongoose from "mongoose";

/* =========================
 * Variant 
 * ========================= */
const VariantSchema = new mongoose.Schema(
  {
    attributes: {
      weight: { type: String, required: true },
      ripeness: { type: String, required: true },
    },
    price: { type: Number, required: true },
    stock: { type: Number, default: 0 },
  },
  { _id: true }
);

/* =========================
 * Preorder per-variant (optional)
 * ========================= */
const PreorderVariantAllocationSchema = new mongoose.Schema(
  {
    attributes: {
      weight: { type: String, required: true },
      ripeness: { type: String, required: true },
    },
    quota: { type: Number, default: 0, min: 0 },
    soldPreorder: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

/* =========================
 * Expiry (mới - khớp helper FE/BE)
 * =========================
 * - expireDate: ngày hết hạn (ưu tiên)
 * - mfgDate + shelfLifeDays: HSD tính từ ngày sản xuất
 * - discountNearExpiry: cấu hình giảm giá cận hạn
 */
const DiscountNearExpirySchema = new mongoose.Schema(
  {
    active: { type: Boolean, default: false },
    thresholdDays: { type: Number, default: 0, min: 0 }, // cận hạn trong N ngày cuối
    percent: { type: Number, default: 0, min: 0, max: 100 }, // % giảm
  },
  { _id: false }
);

const ExpirySchema = new mongoose.Schema(
  {
    // --- Chuẩn mới (khớp utils/expiryHelpers.js) ---
    expireDate: { type: Date, default: null },
    mfgDate: { type: Date, default: null },
    shelfLifeDays: { type: Number, default: null, min: 0 },
    discountNearExpiry: {
      type: DiscountNearExpirySchema,
      default: () => ({}),
    },

    // --- Trường legacy (tương thích ngược) ---
    // Các trường này sẽ được normalize sang trường chuẩn ở hook bên dưới.
    enabled: { type: Boolean, default: undefined },      // legacy
    expiryDate: { type: Date, default: undefined },      // legacy (same as expireDate)
    nearExpiryDays: { type: Number, default: undefined },// legacy -> thresholdDays
    discountPercent: { type: Number, default: undefined }// legacy -> percent
  },
  { _id: false }
);

/* =========================
 * Product
 * ========================= */
const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: String,

    // Hình ảnh
    image: String,                         // main (cũ)
    images: [mongoose.Schema.Types.Mixed], // có thể là string hoặc {url}

    // Liên kết
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    location: { type: mongoose.Schema.Types.ObjectId, ref: "Location" },

    // Tuỳ chọn hiển thị
    weightOptions: [String],
    ripenessOptions: [String],

    baseVariant: {
      attributes: {
        weight: String,
        ripeness: String,
      },
      price: Number,
      stock: Number,
    },

    variants: [VariantSchema],

    displayVariant: {
      type: Object, // biến thể dùng hiển thị ngoài FE (tuỳ bạn)
      default: null,
    },

    /* ===== ĐẶT TRƯỚC (optional) ===== */
    preorder: {
      enabled: { type: Boolean, default: false },

      // Cửa sổ mở đặt trước
      windowStart: { type: Date, default: null },
      windowEnd: { type: Date, default: null },

      // Thời gian dự kiến có hàng/giao
      expectedHarvestStart: { type: Date, default: null },
      expectedHarvestEnd: { type: Date, default: null },

      // Hạn mức tổng
      quota: { type: Number, default: 0, min: 0 },
      soldPreorder: { type: Number, default: 0, min: 0 },

      // Cọc mặc định
      depositPercent: { type: Number, default: 20, min: 0, max: 100 },

      // Chính sách huỷ
      cancelPolicy: {
        untilDate: { type: Date, default: null }, // hủy trước ngày này: hoàn 100%
        feePercent: { type: Number, default: 0, min: 0, max: 100 }, // sau hạn: thu phí %
      },

      // Khóa giá cho khách đã cọc
      priceLock: { type: Boolean, default: true },

      // Phân bổ theo biến thể (optional)
      perVariantAllocations: {
        type: [PreorderVariantAllocationSchema],
        default: [],
      },
    },

    /* ===== HẠN DÙNG & GIẢM GIÁ CẬN HẠN (mới) ===== */
    expiry: { type: ExpirySchema, default: () => ({}) },
  },
  { timestamps: true }
);

/* =========================
 * Indexes hữu ích
 * ========================= */
ProductSchema.index({ "expiry.expireDate": 1 });
// nếu DB cũ từng lưu "expiry.expiryDate", có thể giữ thêm index này để hỗ trợ dữ liệu cũ
ProductSchema.index({ "expiry.expiryDate": 1 });
ProductSchema.index({ name: "text", description: "text" });

/* =========================
 * Hook chuẩn hoá legacy -> chuẩn mới
 * =========================
 * Cho phép tiếp tục gửi payload cũ:
 *   expiry: {
 *     enabled: true,
 *     expiryDate: "...",
 *     nearExpiryDays: 3,
 *     discountPercent: 20
 *   }
 * và tự động map sang:
 *   expireDate, discountNearExpiry.thresholdDays/percent/active
 */
ProductSchema.pre("validate", function normalizeExpiry(next) {
  try {
    const e = this.expiry || {};
    // Map legacy expiryDate -> expireDate
    if (e.expiryDate && !e.expireDate) {
      this.set("expiry.expireDate", e.expiryDate);
    }
    // Map legacy nearExpiryDays/discountPercent/enabled -> discountNearExpiry
    const hasLegacyCfg =
      typeof e.nearExpiryDays !== "undefined" ||
      typeof e.discountPercent !== "undefined" ||
      typeof e.enabled !== "undefined";

    if (hasLegacyCfg) {
      const current = e.discountNearExpiry || {};
      const active =
        typeof e.enabled === "boolean" ? e.enabled : !!current.active;
      const thresholdDays =
        typeof e.nearExpiryDays === "number"
          ? e.nearExpiryDays
          : Number.isFinite(current.thresholdDays)
          ? current.thresholdDays
          : 0;
      const percent =
        typeof e.discountPercent === "number"
          ? e.discountPercent
          : Number.isFinite(current.percent)
          ? current.percent
          : 0;

      this.set("expiry.discountNearExpiry", {
        active,
        thresholdDays,
        percent,
      });
    }

    next();
  } catch (err) {
    next(err);
  }
});

export default mongoose.model("Product", ProductSchema);
