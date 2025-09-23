// server/models/product.model.js
import mongoose from "mongoose";

/* ============================================================================
 * Variant – HỖ TRỢ 2 DẠNG:
 *  - kind="loose": bán theo cân/weight + ripeness
 *  - kind="box"  : bán theo THÙNG (admin định nghĩa thùng bao nhiêu kg, số quả, v.v.)
 *    -> Khi mua 2 thùng chính là quantity=2 của biến thể kind="box"
 * ============================================================================ */
const VariantSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["loose", "box"], default: "loose" },

    // Thuộc tính biến thể
    attributes: {
      // Dành cho kind="loose"
      weight: { type: String }, // "0.5kg" | "1kg" | ...
      ripeness: { type: String }, // "Xanh" | "Chín vừa" | "Chín" ...

      // Dành cho kind="box" (bán theo thùng)
      boxLabel: { type: String }, // "Thùng 10kg" | "Thùng 24 quả"...
      boxWeightKg: { type: Number }, // 10 (kg) – optional
      boxPieces: { type: Number }, // 24 (quả) – optional
    },

    price: { type: Number, required: true },
    stock: { type: Number, default: 0 },

    // ✅ NEW: bật/tắt hiển thị biến thể (đặc biệt cho THÙNG)
    isPublished: { type: Boolean, default: true },
  },
  { _id: true }
);

/* ============================================================================
 * Preorder per-variant (giữ nguyên)
 * ============================================================================ */
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

/* ============================================================================
 * Expiry
 * ============================================================================ */
const DiscountNearExpirySchema = new mongoose.Schema(
  {
    active: { type: Boolean, default: false },
    thresholdDays: { type: Number, default: 0, min: 0 },
    percent: { type: Number, default: 0, min: 0, max: 100 },
  },
  { _id: false }
);

const ExpirySchema = new mongoose.Schema(
  {
    // Chuẩn mới
    expireDate: { type: Date, default: null },
    mfgDate: { type: Date, default: null },
    shelfLifeDays: { type: Number, default: null, min: 0 },
    discountNearExpiry: { type: DiscountNearExpirySchema, default: () => ({}) },

    // Legacy (tương thích ngược)
    enabled: { type: Boolean, default: undefined },
    expiryDate: { type: Date, default: undefined },
    nearExpiryDays: { type: Number, default: undefined },
    discountPercent: { type: Number, default: undefined },
  },
  { _id: false }
);

/* ============================================================================
 * Alternatives – gợi ý thay thế
 * ============================================================================ */
const AlternativeSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    reason: { type: String, default: "" },
  },
  { _id: false }
);

/* ============================================================================
 * Storage tips / Origin mở rộng
 * ============================================================================ */
const StorageTipSchema = new mongoose.Schema(
  {
    title: { type: String, default: "" },
    tempC: { type: String, default: "" },
    humidity: { type: String, default: "" },
    shelfLifeDays: { type: Number, default: undefined },
    afterCutDays: { type: Number, default: undefined },
    instructions: { type: [String], default: [] },
    avoid: { type: [String], default: [] },
    icon: {
      type: String,
      enum: ["room", "fridge", "freezer", "box", "leaf"],
      default: "leaf",
    },
  },
  { _id: false }
);

const OriginInfoSchema = new mongoose.Schema(
  {
    country: { type: String, default: "" },
    province: { type: String, default: "" },
    farmName: { type: String, default: "" },
    certificateNo: { type: String, default: "" },
  },
  { _id: false }
);

/* ============================================================================
 * COMBO & MIX schemas (mới, tương thích ngược)
 * ============================================================================ */

// Thành phần combo
const ComboItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    qty: { type: Number, default: 1, min: 1 },
    // Bổ sung để khớp payload FE (trừ tồn theo đúng biến thể)
    ripeness: { type: String, default: null },
    weight: { type: String, default: null },
  },
  { _id: false }
);

// Cấu hình giá combo: giá cố định hoặc % giảm tổng
const ComboPricingSchema = new mongoose.Schema(
  {
    mode: { type: String, enum: ["fixed", "discount"], default: "discount" },
    fixedPrice: { type: Number, default: 0 }, // dùng khi mode="fixed"
    discountPercent: { type: Number, default: 0 }, // dùng khi mode="discount"
  },
  { _id: false }
);

// Auto-deduct pool item
const ComboAutoDeductPoolItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    ripeness: { type: String, default: null },
    // Bổ sung để không bị drop khi lưu
    weight: { type: String, default: null },
    qty: { type: Number, default: 1, min: 1 },
  },
  { _id: false }
);

// Auto-deduct aggregated breakdown
const ComboAggregatedBreakdownSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    ripeness: { type: String, default: null },
    weight: { type: String, default: null }, // ✅ thêm weight để khớp FE
    need: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

// INVENTORY cho Combo (QUAN TRỌNG để FE đọc tồn kho combo)
const ComboInventorySchema = new mongoose.Schema(
  {
    stock: { type: Number, default: 0, min: 0 },
    autoDeduct: {
      strategy: { type: String, enum: ["random", "fixed"], default: "random" },
      perComboPickCount: { type: Number, default: 0, min: 0 },
      pool: { type: [ComboAutoDeductPoolItemSchema], default: [] },
      aggregatedBreakdown: {
        type: [ComboAggregatedBreakdownSchema],
        default: [],
      },
    },
  },
  { _id: false }
);

// Mix rules – để linh hoạt, để Mixed; có thể mở rộng dần
const MixRulesSchema = new mongoose.Schema(
  {
    minItems: { type: Number, default: 0 },
    maxItems: { type: Number, default: 0 },
    perItemMaxQty: { type: Number, default: 0 },
    categoriesAllowed: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    ],
    excludeProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    // có thể thêm price caps, weight caps, v.v...
    extra: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

/* ============================================================================
 * Product – CHÍNH
 *  - BỔ SUNG combo + mix nhưng giữ nguyên field cũ để không vỡ luồng
 * ============================================================================ */
const ProductSchema = new mongoose.Schema(
  {
    // Loại sản phẩm: single | combo | mix (mới)
    type: { type: String, enum: ["single", "combo", "mix"], default: "single" },

    // Legacy flags (giữ để không vỡ dữ liệu cũ)
    isCombo: { type: Boolean, default: undefined },
    isMixBuilder: { type: Boolean, default: undefined },

    name: { type: String, required: true },
    description: String,

    // Hình ảnh
    image: String,
    images: [mongoose.Schema.Types.Mixed],

    // Liên kết
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    location: { type: mongoose.Schema.Types.ObjectId, ref: "Location" },

    // Tuỳ chọn hiển thị (áp dụng chủ yếu cho kind="loose")
    weightOptions: [String],
    ripenessOptions: [String],

    // Biến thể cơ bản (legacy/fallback – thường dùng cho "loose")
    baseVariant: {
      attributes: { weight: String, ripeness: String },
      price: Number,
      stock: Number,
    },

    // BIẾN THỂ HỢP NHẤT: gồm cả "loose" (cân) và "box" (THÙNG)
    variants: { type: [VariantSchema], default: [] },

    // Biến thể ưu tiên hiển thị (tuỳ FE)
    displayVariant: { type: Object, default: null },

    /* ===== COMBO (mới + legacy) ===== */
    comboItems: { type: [ComboItemSchema], default: [] }, // thành phần combo (đã thêm ripeness/weight)
    comboPricing: { type: ComboPricingSchema, default: undefined }, // config giá mới
    comboPrice: { type: Number, default: undefined }, // legacy fixed price
    comboDiscountPercent: { type: Number, default: undefined }, // legacy % giảm
    // INVENTORY CHO COMBO (thêm để FE không bị "hết hàng")
    comboInventory: { type: ComboInventorySchema, default: () => ({ stock: 0 }) },

    /* ===== MIX BUILDER (mới + legacy) ===== */
    mixRules: { type: MixRulesSchema, default: undefined }, // luật mix

    /* ===== ĐẶT TRƯỚC ===== */
    preorder: {
      enabled: { type: Boolean, default: false },
      windowStart: { type: Date, default: null },
      windowEnd: { type: Date, default: null },
      expectedHarvestStart: { type: Date, default: null },
      expectedHarvestEnd: { type: Date, default: null },
      quota: { type: Number, default: 0, min: 0 },
      soldPreorder: { type: Number, default: 0, min: 0 },
      depositPercent: { type: Number, default: 20, min: 0, max: 100 },
      cancelPolicy: {
        untilDate: { type: Date, default: null },
        feePercent: { type: Number, default: 0, min: 0, max: 100 },
      },
      priceLock: { type: Boolean, default: true },
      perVariantAllocations: {
        type: [PreorderVariantAllocationSchema],
        default: [],
      },
    },

    /* ===== HẠN DÙNG ===== */
    expiry: { type: ExpirySchema, default: () => ({}) },

    /* ===== Alternatives ===== */
    alternatives: { type: [AlternativeSchema], default: [] },

    /* ===== Search tags / chứng nhận ===== */
    tags: { type: [String], default: [] },
    certifications: { type: [String], default: [] },

    /* ===== Origin & Storage ===== */
    origin: { type: String, default: "" }, // (legacy)
    storage: { type: String, default: "" }, // (legacy)
    originInfo: { type: OriginInfoSchema, default: () => ({}) },
    storageTips: { type: [StorageTipSchema], default: [] },

    /* ===== (DEPRECATED) packagingOptions – dữ liệu cũ
     *  - Khuyến nghị chuyển sang variants.kind="box".
     */
    packagingOptions: {
      type: [
        new mongoose.Schema(
          {
            type: { type: String, enum: ["box", "crate", "bag"], default: "box" },
            unitLabel: { type: String, default: "" },
            unitSize: { type: Number, default: 0 }, // kg
            price: { type: Number, default: 0 },
            stock: { type: Number, default: 0 },
          },
          { _id: false }
        ),
      ],
      default: [],
    },

    /* ===== Root stock (tùy chọn) — chỉ làm Fallback cho COMBO
     *  - Dùng khi sanitizer/service bỏ comboInventory.
     *  - Không sử dụng cho normal/mix.
     */
    stock: { type: Number, default: undefined },
  },
  { timestamps: true }
);

/* ============================================================================
 * Indexes hữu ích (bổ sung Coming Soon)
 * ============================================================================ */
ProductSchema.index({ name: "text", description: "text", tags: "text" });
ProductSchema.index({ type: 1, isCombo: 1, isMixBuilder: 1 });
ProductSchema.index({ "expiry.expireDate": 1 });
ProductSchema.index({ "expiry.expiryDate": 1 }); // legacy
ProductSchema.index({ category: 1 });
ProductSchema.index({ "variants.stock": 1 });
ProductSchema.index({ "variants.attributes.boxWeightKg": 1 });
ProductSchema.index({ "packagingOptions.stock": 1 }); // legacy
ProductSchema.index({ "comboInventory.stock": 1 }); // tra cứu nhanh tồn kho combo

// 🔎 Coming Soon (Preorder) indexes
ProductSchema.index({ "preorder.enabled": 1, createdAt: -1 });
ProductSchema.index({ "preorder.windowStart": 1, "preorder.windowEnd": 1 });
ProductSchema.index({ "preorder.quota": 1, "preorder.soldPreorder": 1 });

/* ============================================================================
 * Virtuals
 * ============================================================================ */
ProductSchema.virtual("hasAnyStock").get(function () {
  // Ưu tiên: nếu là combo thì xem comboInventory trước
  const isCombo = this.type === "combo" || this.isCombo === true;
  if (isCombo) {
    const comboStock = Number(this?.comboInventory?.stock ?? 0);
    const rootFallback = Number(this?.stock ?? 0); // ✅ fallback
    if (comboStock > 0 || rootFallback > 0) return true;
  }

  const base = Number(this?.baseVariant?.stock || 0);
  const varSum = Array.isArray(this?.variants)
    ? this.variants.reduce((s, v) => s + Number(v?.stock || 0), 0)
    : 0;
  const packSum = Array.isArray(this?.packagingOptions)
    ? this.packagingOptions.reduce((s, p) => s + Number(p?.stock || 0), 0)
    : 0;
  return base + varSum + packSum > 0;
});

/* ============================================================================
 * Hook chuẩn hoá legacy -> chuẩn mới (expiry + type flags)
 *  + BỔ SUNG: chuẩn hoá preorder (đảm bảo luôn có object & số hợp lệ)
 * ============================================================================ */
ProductSchema.pre("validate", function normalizeLegacy(next) {
  try {
    // Map expiry legacy -> mới
    const e = this.expiry || {};
    if (e.expiryDate && !e.expireDate) {
      this.set("expiry.expireDate", e.expiryDate);
    }
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

      this.set("expiry.discountNearExpiry", { active, thresholdDays, percent });
    }

    // Chuẩn hoá type theo legacy flags nếu chưa đặt
    if (!this.type) {
      if (this.isCombo === true) this.type = "combo";
      else if (this.isMixBuilder === true) this.type = "mix";
      else this.type = "single";
    }

    // 🔧 Bổ sung: đảm bảo preorder luôn là object an toàn cho Coming Soon
    const p = this.preorder || {};
    const safePreorder = {
      enabled: !!p.enabled,
      windowStart: p.windowStart || null,
      windowEnd: p.windowEnd || null,
      expectedHarvestStart: p.expectedHarvestStart || null,
      expectedHarvestEnd: p.expectedHarvestEnd || null,
      quota: Math.max(0, Number(p.quota ?? 0) || 0),
      soldPreorder: Math.max(0, Number(p.soldPreorder ?? 0) || 0),
      depositPercent: (() => {
        const v = Number(p.depositPercent ?? 20);
        if (!Number.isFinite(v)) return 20;
        return Math.min(100, Math.max(0, v));
      })(),
      cancelPolicy: {
        untilDate: p?.cancelPolicy?.untilDate || null,
        feePercent: (() => {
          const v = Number(p?.cancelPolicy?.feePercent ?? 0);
          if (!Number.isFinite(v)) return 0;
          return Math.min(100, Math.max(0, v));
        })(),
      },
      priceLock: typeof p.priceLock === "boolean" ? p.priceLock : true,
      perVariantAllocations: Array.isArray(p.perVariantAllocations)
        ? p.perVariantAllocations
        : [],
    };
    this.set("preorder", { ...(p || {}), ...safePreorder });

    next();
  } catch (err) {
    next(err);
  }
});

/* ============================================================================
 * Helpers cho “liên thông tồn kho”: suy ra stock THÙNG từ stock 1kg
 * ============================================================================ */

// Parse số kg từ text
function kgFromWeightText(txt) {
  if (!txt) return null;
  const s = String(txt).toLowerCase();

  const mk = s.match(/(\d+(?:[.,]\d+)?)\s*kg/);
  if (mk) {
    const v = parseFloat(mk[1].replace(",", "."));
    return Number.isFinite(v) ? v : null;
  }

  const mg = s.match(/(\d+(?:[.,]\d+)?)\s*g/);
  if (mg) {
    const v = parseFloat(mg[1].replace(",", "."));
    return Number.isFinite(v) ? v / 1000 : null;
  }

  return null;
}

function getVariantKg(v) {
  const attr = v?.attributes || {};
  const boxKg = Number(attr.boxWeightKg || 0);
  if (Number.isFinite(boxKg) && boxKg > 0) return boxKg;
  const fromText = kgFromWeightText(attr.weight);
  return Number.isFinite(fromText) && fromText > 0 ? fromText : null;
}

function isBoxish(v) {
  if (!v) return false;
  if (v.kind === "box") return true;
  const w = String(v?.attributes?.weight || "");
  const lbl = String(v?.attributes?.boxLabel || "");
  return /thùng/i.test(w) || /thùng/i.test(lbl);
}

// Tìm biến thể 1kg
function findOneKgVariantFromRet(ret) {
  if (!Array.isArray(ret?.variants)) return null;
  // boxWeightKg = 1
  const v1 = ret.variants.find(
    (v) => Number(v?.attributes?.boxWeightKg || 0) === 1
  );
  if (v1) return v1;

  // weight text = 1kg
  const v2 = ret.variants.find(
    (v) => getVariantKg(v) === 1 && (v.kind === "loose" || !v.kind)
  );
  return v2 || null;
}

/**
 * Áp dụng “liên thông tồn kho” lên object plain (ret):
 * - Nếu có biến thể 1kg → stock(thùng) = floor(stock_1kg / kg_thùng)
 * - KHÔNG ghi DB, chỉ sửa ret.variants / ret.packagingOptions khi serialize
 * - Idempotent: nếu đã có _stockLinked thì bỏ qua
 * - KHÔNG đụng vào comboInventory (tránh ảnh hưởng luồng combo)
 */
function applyLinkedStockOnRet(ret) {
  try {
    if (!ret || ret._stockLinked) return ret;

    // Nếu là combo, bỏ qua cơ chế liên thông (để không ảnh hưởng tồn kho combo)
    const isCombo = ret?.type === "combo" || ret?.isCombo === true;
    if (isCombo) return ret;

    const variants = Array.isArray(ret.variants) ? ret.variants : [];
    if (variants.length === 0) return ret;

    const oneKg = findOneKgVariantFromRet(ret);
    if (!oneKg) return ret;

    const stock1kg = Math.max(0, Number(oneKg?.stock || 0));

    // Patch variants: chỉ patch biến thể "thùng"
    const patchedVariants = variants.map((v) => {
      const kg = getVariantKg(v);
      if (!kg || kg <= 0) return v;

      // Chỉ áp cho thùng; loose khác 1kg giữ nguyên
      if (isBoxish(v)) {
        const newStock = kg === 1 ? stock1kg : Math.floor(stock1kg / kg);
        return { ...v, stock: newStock };
      }
      // v.kind === 'loose'
      // ✅ FIX: Không đồng bộ stock giữa các variants 1kg khác nhau
      // if (kg === 1) {
      //   return { ...v, stock: stock1kg };
      // }
      return v;
    });

    // Patch packagingOptions legacy (nếu còn dùng)
    const pack = Array.isArray(ret.packagingOptions) ? ret.packagingOptions : [];
    const patchedPackaging = pack.map((p) => {
      if (!p || String(p.type || "").toLowerCase() !== "box") return p;
      const kg = Number(p.unitSize || 0);
      if (!Number.isFinite(kg) || kg <= 0) return p;
      const newStock = Math.floor(stock1kg / kg);
      return { ...p, stock: newStock };
    });

    return {
      ...ret,
      variants: patchedVariants,
      packagingOptions: patchedPackaging,
      _stockLinked: {
        baseKgStock: stock1kg,
        baseKgVariantId: String(oneKg?._id || ""),
        mode: "derived-from-1kg",
      },
    };
  } catch {
    return ret;
  }
}

/* ============================================================================
 * toJSON / toObject transform:
 *  - Áp dụng liên thông tồn kho
 *  - CHỈ expose biến thể THÙNG đã publish (theo yêu cầu)
 *  - Giữ nguyên comboInventory/legacy compatibility
 * ============================================================================ */
function transformRet(_doc, ret) {
  // 1) Áp dụng liên thông tồn kho (đừng đụng combo)
  let patched = applyLinkedStockOnRet(ret) || ret;

  // 2) ✅ Filter biến thể THÙNG: chỉ expose những biến thể admin đã bật (isPublished=true)
  const list = Array.isArray(patched?.variants) ? patched.variants : [];
  if (list.length) {
    const visible = list.filter((v) => {
      if (v?.kind === "box") {
        if (v?.isPublished === false) return false; // ẩn thùng không publish
        // OPTIONAL: hide out-of-stock box variants
        // if (!Number.isFinite(Number(v.stock)) || Number(v.stock) <= 0) return false;
        return true;
      }
      return true; // các biến thể loose giữ nguyên
    });

    // Tạo nhanh danh sách tình trạng chín của THÙNG đang bán (để FE dùng)
    const boxMaturity = new Set(
      visible
        .filter((v) => v?.kind === "box")
        .map((v) => (v?.attributes?.ripeness || "").toString().trim())
        .filter(Boolean)
    );

    patched = {
      ...patched,
      variants: visible,
      boxMaturityOptions: Array.from(boxMaturity), // ✅ NEW: FE đọc đúng danh sách thùng đã add
    };
  } else {
    patched = { ...patched, boxMaturityOptions: [] };
  }

  // 3) Nếu là combo: đảm bảo luôn có comboInventory và displayVariant.stock
  const isCombo = patched?.type === "combo" || patched?.isCombo === true;
  if (isCombo) {
    const ci = patched.comboInventory || {};
    const legacyTopLevel = Number(patched?.comboStock ?? patched?.stock ?? 0);
    const safeStock = Math.max(
      0,
      Number.isFinite(Number(ci.stock)) ? Number(ci.stock) : 0,
      legacyTopLevel
    );

    patched = {
      ...patched,
      comboInventory: {
        stock: safeStock,
        ...(ci.autoDeduct ? { autoDeduct: ci.autoDeduct } : {}),
      },
    };

    const fixedPrice =
      Number(patched?.comboPricing?.fixedPrice ?? patched?.comboPrice ?? 0) || 0;

    if (!patched.displayVariant) {
      patched.displayVariant = { price: fixedPrice, stock: safeStock };
    } else {
      if (
        typeof patched.displayVariant.stock !== "number" ||
        !Number.isFinite(patched.displayVariant.stock)
      ) {
        patched.displayVariant.stock = safeStock;
      }
    }
  }

  return patched;
}

ProductSchema.set("toJSON", {
  virtuals: true,
  transform: transformRet,
});
ProductSchema.set("toObject", {
  virtuals: true,
  transform: transformRet,
});

/* ============================================================================
 * Helper: giá ưu tiên để hiển thị
 * ============================================================================ */
ProductSchema.methods.getPreferredPrice = function () {
  // Ưu tiên displayVariant
  const dvPrice = Number(this?.displayVariant?.price || 0);
  if (dvPrice > 0) return dvPrice;

  // Nếu là combo: ưu tiên comboPricing.fixedPrice hoặc comboPrice (legacy)
  const isCombo = this.type === "combo" || this.isCombo === true;
  if (isCombo) {
    const cp =
      Number(this?.comboPricing?.fixedPrice ?? this?.comboPrice ?? 0) || 0;
    if (cp > 0) return cp;
  }

  // Ưu tiên min của variants (bao gồm cả box & loose)
  if (Array.isArray(this.variants) && this.variants.length) {
    const min = this.variants.reduce((m, v) => {
      const p = Number(v?.price || 0);
      return m === null ? p : Math.min(m, p);
    }, null);
    if (Number.isFinite(min) && min > 0) return min;
  }

  // Fallback: baseVariant
  return Number(this?.baseVariant?.price || 0);
};

export default mongoose.model("Product", ProductSchema);
