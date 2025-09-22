// server/models/cart.model.js
import mongoose from "mongoose";

/* =========================================================
 * SNAPSHOTS
 *  - Lưu giá/thuộc tính TẠI THỜI ĐIỂM thêm vào giỏ để "price lock"
 * ======================================================= */

// Snapshot cho biến thể thường
const CartVariantSnapshotSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },          // tên sản phẩm lúc thêm
    image: { type: String, default: "" },         // ảnh lúc thêm
    attributes: {
      type: mongoose.Schema.Types.Mixed,          // { weight, ripeness, ... }
      default: {},
    },
    unitPrice: { type: Number, default: 0 },      // đơn giá đã chốt (đã áp HSD nếu có)
  },
  { _id: false }
);

// Snapshot cho combo (client-build hoặc product combo)
const CartComboSnapshotSchema = new mongoose.Schema(
  {
    title: { type: String, default: "" },         // tên combo
    image: { type: String, default: "" },         // ảnh combo (nếu có)
    unitPrice: { type: Number, default: 0 },      // giá combo sau discount
    discountPercent: { type: Number, default: 0 },
    items: {
      type: [
        new mongoose.Schema(
          {
            productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
            qty: { type: Number, default: 1, min: 1 },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { _id: false }
);

/* =========================================================
 * CART ITEM
 *  - type="variant": có product + variantId (String) + snapshot(variant)
 *  - type="combo":   product có thể null; variantId=null; snapshot(combo)
 *
 *  LƯU Ý: dùng String cho variantId để:
 *   - tránh lỗi cast khi FE gửi chuỗi ObjectId
 *   - tương thích legacy (nếu từng dùng "combo" như 1 variantId đặc biệt)
 * ======================================================= */
const CartItemSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["variant", "combo"], required: true },

    // Cho variant (kể cả “thùng” vì coi là 1 biến thể)
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
    variantId: { type: String, default: null }, // dùng String để tránh CastError

    // Snapshot: Mixed để lưu cả 2 schema ở trên (variant/combo)
    snapshot: { type: mongoose.Schema.Types.Mixed, default: {} },

    quantity: { type: Number, required: true, min: 1, default: 1 },

    addedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

/* RÀNG BUỘC/CHUẨN HOÁ THEO type (tránh 500 do dữ liệu thiếu) */
CartItemSchema.pre("validate", function normalizeByType(next) {
  try {
    if (this.type === "variant") {
      if (!this.product) return next(new Error("Thiếu product cho item biến thể"));
      if (!this.variantId) return next(new Error("Thiếu variantId cho item biến thể"));
      // ép variantId thành chuỗi (tránh cast lỗi nếu là ObjectId)
      this.variantId = String(this.variantId);

      // Chuẩn snapshot variant về khung tối thiểu (giữ key lạ nếu có)
      const s = this.snapshot || {};
      this.snapshot = {
        name: s.name || "",
        image: s.image || "",
        attributes:
          typeof s.attributes === "object" && s.attributes ? s.attributes : {},
        unitPrice: Number.isFinite(Number(s.unitPrice)) ? Number(s.unitPrice) : 0,
        ...((typeof s === "object" && s) || {}), // giữ các key khác (không ghi đè key chuẩn)
      };
    } else if (this.type === "combo") {
      // combo: product có thể null; không có variantId
      this.variantId = null;

      const s = this.snapshot || {};
      const items = Array.isArray(s.items)
        ? s.items
            .map((x) => ({
              productId: x?.productId || x?.product || null,
              qty: Math.max(1, Number(x?.qty || 1)),
            }))
            .filter((x) => !!x.productId)
        : [];

      this.snapshot = {
        title: s.title || s.name || "",
        image: s.image || "",
        unitPrice: Number.isFinite(Number(s.unitPrice)) ? Number(s.unitPrice) : 0,
        discountPercent: Number.isFinite(Number(s.discountPercent))
          ? Number(s.discountPercent)
          : 0,
        items,
        ...((typeof s === "object" && s) || {}), // giữ các key khác nếu có
      };
    }
    next();
  } catch (e) {
    next(e);
  }
});

/* =========================================================
 * CART
 * ======================================================= */
const CartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    items: { type: [CartItemSchema], default: [] },
  },
  { timestamps: true }
);

/* Index phụ trợ tra cứu nhanh theo product/variant trong mảng items (không unique) */
CartSchema.index({ "items.product": 1, "items.variantId": 1 });

/* Helper tính tạm subtotal dựa trên snapshot (price lock) */
CartSchema.methods.computeTotals = function () {
  const items = Array.isArray(this.items) ? this.items : [];
  let subtotal = 0;

  for (const it of items) {
    const qty = Number(it.quantity) || 0;
    const unit = Number(it?.snapshot?.unitPrice || 0);
    subtotal += unit * qty;
  }
  return { subtotal };
};

/* toJSON: giấu __v, giữ _id */
CartSchema.set("toJSON", {
  versionKey: false,
  transform: (_, ret) => ret,
});

export default mongoose.model("Cart", CartSchema);
