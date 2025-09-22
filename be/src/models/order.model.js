// src/models/order.model.js
import mongoose from "mongoose";
import voucherService from "../services/voucher.service.js";

function generateCustomId() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const time = now.toTimeString().slice(0, 8).replace(/:/g, "");
  const random = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${date}-${time}-${random}`;
}

/* =========================
 * RETURN / REFUND flow cho ORDER
 * ========================= */
const RETURN_STATUS = [
  "return_requested",
  "return_approved",
  "return_rejected",
  "return_awaiting_pickup",
  "return_picked_up",
  "return_in_transit",
  "return_received",
  "refund_issued",
  "return_refunded",
];

const TIMELINE_FIELD_BY_STATUS = {
  return_requested: "requestedAt",
  return_approved: "approvedAt",
  return_rejected: "rejectedAt",
  return_awaiting_pickup: "awaitingPickupAt",
  return_picked_up: "pickedUpAt",
  return_in_transit: "inTransitAt", // ✅ đúng key
  return_received: "receivedAt",
  refund_issued: "refundIssuedAt",
  return_refunded: "refundIssuedAt",
};

function normalizeEvidenceImage(img) {
  if (!img) return null;
  if (typeof img === "string") {
    return { url: img, mime: undefined };
  }
  if (typeof img === "object") {
    const url =
      img.secure_url ||
      img.url ||
      img.src ||
      img.Location ||
      img.location ||
      img.path ||
      img.filepath ||
      img.filePath ||
      img.key ||
      img.filename ||
      null;
    const mime = img.mimetype || img.mime || img.type || undefined;
    if (!url) return null;
    return { url, mime };
  }
  return null;
}

const returnFlowSchema = new mongoose.Schema(
  {
    isOpen: { type: Boolean, default: false },
    status: { type: String, enum: RETURN_STATUS, default: null },

    reason: { type: String, default: null },
    customerNote: { type: String, default: null },
    adminNote: { type: String, default: null },

    evidenceImages: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },

    feeDeduction: { type: Number, default: 0, min: 0 },
    refundAmount: { type: Number, default: 0, min: 0 },

    carrier: { type: String, default: null },
    trackingCode: { type: String, default: null },

    raw: { type: mongoose.Schema.Types.Mixed, default: {} },

    timeline: {
      requestedAt: { type: Date, default: null },
      approvedAt: { type: Date, default: null },
      rejectedAt: { type: Date, default: null },
      awaitingPickupAt: { type: Date, default: null },
      pickedUpAt: { type: Date, default: null },
      inTransitAt: { type: Date, default: null },
      receivedAt: { type: Date, default: null },
      refundIssuedAt: { type: Date, default: null },
      closedAt: { type: Date, default: null },
    },
  },
  { _id: false }
);

/* =========================
 * SNAPSHOTS & ITEM SCHEMAS
 * ========================= */

/** Snapshot biến thể (không phá trường cũ) */
const orderItemVariantSnapshotSchema = new mongoose.Schema(
  {
    // Giữ cũ để tương thích
    weight: { type: String, default: "" }, // "1kg" | "Thùng 10kg"
    ripeness: { type: String, default: "" }, // "Xanh" | "Chín vừa" | "Chín"
    grade: { type: String, default: "" },

    // Mở rộng
    attributes: {
      type: mongoose.Schema.Types.Mixed, // { weight, ripeness, ... }
      default: undefined,
    },
    // Giá niêm yết theo biến thể tại thời điểm đặt
    price: { type: Number, default: 0 },
  },
  { _id: false }
);

/** Snapshot thùng/đơn vị đóng gói (tùy chọn) */
const orderItemPackagingSnapshotSchema = new mongoose.Schema(
  {
    type: { type: String, default: "box" }, // "box" | "crate" | ...
    unitLabel: { type: String, default: "" }, // "Thùng 10kg"
    unitSize: { type: Number, default: 0 }, // 10 (kg) / 24 (quả) ...
    price: { type: Number, default: 0 }, // giá theo thùng tại thời điểm đặt
  },
  { _id: false }
);

/** Ref item trong combo (mở rộng) */
const orderItemComboRefSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
    variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
    qty: { type: Number, default: 1, min: 1 },
    weight: { type: String, default: null },
    ripeness: { type: String, default: null },
  },
  { _id: false }
);

/** Snapshot COMBO */
const orderItemComboSnapshotSchema = new mongoose.Schema(
  {
    title: { type: String, default: "Combo" },
    image: { type: String, default: null },
    discountPercent: { type: Number, default: 0 },
    items: { type: [orderItemComboRefSchema], default: [] },
  },
  { _id: false }
);

/** Snapshot thành phần COMBO cũ (back-compat) */
const orderItemComboEntrySchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    productName: { type: String, default: "" },
    qty: { type: Number, default: 1, min: 1 },
    unitPrice: { type: Number, default: 0 },
  },
  { _id: false }
);

/** _expiry tối giản */
const orderItemExpirySchema = new mongoose.Schema(
  {
    expireAt: { type: Date, default: null },
    daysLeft: { type: Number, default: null },
  },
  { _id: false }
);

/* =========================
 * ✅ MIX SCHEMAS (MỚI)
 * ========================= */

/** Từng thành phần trong giỏ mix */
const orderItemMixEntrySchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
    productId: { type: mongoose.Schema.Types.ObjectId, default: null },
    productName: { type: String, default: "" },

    qty: { type: Number, default: 1, min: 0 }, // số đơn vị (quả/gói)
    unitPrice: { type: Number, default: 0 }, // nếu bán theo cái
    pricePerKg: { type: Number, default: 0 }, // nếu bán theo kg
    weightGram: { type: Number, default: 0 }, // gram (nếu bán theo kg)
    linePrice: { type: Number, default: 0 }, // tổng tiền entry (snapshot)
  },
  { _id: false }
);

/** Snapshot giỏ mix */
const orderItemMixSchema = new mongoose.Schema(
  {
    items: { type: [orderItemMixEntrySchema], default: [] },
    totalPrice: { type: Number, default: 0 }, // giá 1 hộp mix
    note: { type: String, default: "" },
  },
  { _id: false }
);

/* =========================
 * Item trong đơn – mở rộng nhưng giữ trường cũ
 * ========================= */
const orderItemSchema = new mongoose.Schema(
  {
    // (tuỳ chọn) preserve "type" từ controller: "variant" | "combo" | "mix"
    type: { type: String, enum: ["variant", "combo", "mix"], default: "variant" },

    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: false, // để không vỡ dữ liệu cũ
    },

    productName: { type: String, required: true },

    isCombo: { type: Boolean, default: false },

    // ✅ Mix flag
    isMix: { type: Boolean, default: false },

    variantId: { type: mongoose.Schema.Types.ObjectId, default: null },

    // GIỮ NGUYÊN (back-compat)
    variant: { type: orderItemVariantSnapshotSchema, default: () => ({}) },

    // Mở rộng snapshots
    variantSnapshot: { type: orderItemVariantSnapshotSchema, default: undefined },
    packagingSnapshot: { type: orderItemPackagingSnapshotSchema, default: undefined },

    // ✅ Combo snapshot mới
    combo: { type: orderItemComboSnapshotSchema, default: undefined },

    // ✅ Back-compat: danh sách item combo cũ
    comboItemsSnapshot: { type: [orderItemComboEntrySchema], default: [] },

    // ✅ Mix snapshot (mới)
    mix: { type: orderItemMixSchema, default: undefined },

    // Số lượng
    quantity: { type: Number, required: true, min: 1, default: 1 },

    /**
     * Giá:
     *  - price: GIỮ NGUYÊN (đơn giá áp dụng sau giảm HSD nếu có)
     *  - unitPrice: trước giảm
     *  - unitPriceFinal: sau giảm (áp dụng vào checkout)
     *  - lineTotal: unitPriceFinal * quantity
     */
    price: { type: Number, required: true }, // backward-compatible
    unitPrice: { type: Number, default: 0 },
    unitPriceFinal: { type: Number, default: 0 },
    lineTotal: { type: Number, default: 0 },

    nearExpiryDiscountPercent: { type: Number, default: 0, min: 0, max: 100 },
    comboDiscountPercent: { type: Number, default: 0, min: 0, max: 100 },

    // Optional: snapshot hạn dùng
    _expiry: { type: orderItemExpirySchema, default: undefined },

    note: { type: String, default: "" },
  },
  { _id: true, timestamps: false }
);

/* =========================
 * ORDER SCHEMA
 * ========================= */
const orderSchema = new mongoose.Schema(
  {
    customId: { type: String, unique: true, default: generateCustomId },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Items hiển thị & tính tiền
    items: [orderItemSchema],

    // BẢN CHỤP tại thời điểm đặt (controller đang set itemsSnapshot)
    itemsSnapshot: { type: [orderItemSchema], default: [] },

    // Phí ship / giảm giá / tổng
    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 }, // ✅ đảm bảo có discount
    shippingFee: { type: Number, default: 0 }, // ✅ đảm bảo có ship
    shippingRuleName: { type: String },
    total: { type: Number, required: true },

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

    // Địa chỉ giao hàng
    shippingAddress: {
      fullName: String,
      phone: String,
      province: String,
      district: String,
      ward: String,
      detail: String,
      districtCode: { type: String },
      wardCode: { type: String },
    },

    // Flow đổi trả
    returnFlow: { type: returnFlowSchema, default: () => ({}) },

    deletedByUser: { type: Boolean, default: false },
  },
  { timestamps: true }
);

/* =========================
 * Indexes
 * ========================= */
orderSchema.index({ customId: 1, user: 1 });
orderSchema.index({ "returnFlow.isOpen": 1, "returnFlow.status": 1, createdAt: -1 });

/* =========================
 * Hooks – chuẩn hoá + fallback tiền + đồng bộ snapshot
 * ========================= */
orderSchema.pre("validate", function normalizeAndCalcBeforeValidate(next) {
  try {
    // Chuẩn hoá returnFlow
    const rf = this.returnFlow || {};
    if (Array.isArray(rf.evidenceImages)) {
      rf.evidenceImages = rf.evidenceImages.map(normalizeEvidenceImage).filter(Boolean);
    }
    if (rf.status && rf.isOpen !== true) rf.isOpen = true;
    if (rf.status === "return_requested" && !rf.timeline?.requestedAt) {
      rf.timeline = rf.timeline || {};
      rf.timeline.requestedAt = rf.timeline.requestedAt || new Date();
    }
    this.returnFlow = rf;

    // Đồng bộ dữ liệu item (combo/mix) + back-compat giá
    if (Array.isArray(this.items)) {
      this.items = this.items.map((it) => {
        const item = it?.toObject ? it.toObject() : it;

        // ===== MIX: tính giá/lineTotal nếu thiếu
        if (item.isMix || (item.mix && Array.isArray(item.mix.items))) {
          const mx = item.mix || {};
          if ((!mx.totalPrice || mx.totalPrice <= 0) && Array.isArray(mx.items) && mx.items.length) {
            mx.totalPrice = mx.items.reduce((s, x) => s + (Number(x.linePrice || 0) || 0), 0);
          }
          item.mix = mx;

          if (!item.productName) item.productName = "Giỏ Mix";
          const perBox = Number(item.unitPriceFinal || item.price || mx.totalPrice || 0);
          if (!item.unitPriceFinal || item.unitPriceFinal <= 0) item.unitPriceFinal = perBox;
          if (!item.price || item.price <= 0) item.price = perBox;
        }

        // ===== COMBO: lấp comboItemsSnapshot cũ nếu cần
        if (item.isCombo && item.combo && Array.isArray(item.combo.items) && item.combo.items.length) {
          if (!Array.isArray(item.comboItemsSnapshot) || item.comboItemsSnapshot.length === 0) {
            item.comboItemsSnapshot = item.combo.items.map((x) => ({
              product: x.productId || null,
              productName: "",
              qty: Math.max(1, Number(x.qty || 1)),
              unitPrice: 0,
            }));
          }
        }

        // ===== Back-compat giá & lineTotal
        if (typeof item.price !== "number" || Number.isNaN(item.price)) {
          const upf = Number(item.unitPriceFinal || 0);
          const up = Number(item.unitPrice || 0);
          item.price = upf > 0 ? upf : up;
        }
        const qty = Number(item.quantity || 0);
        if (!item.lineTotal || item.lineTotal <= 0) {
          const unit = Number(item.unitPriceFinal || item.price || 0);
          item.lineTotal = qty > 0 ? unit * qty : 0;
        }

        return item;
      });
    }

    // Fallback subtotal trước khi validate
    const st = Number(this.subtotal || 0);
    if (st <= 0 && Array.isArray(this.items) && this.items.length > 0) {
      this.subtotal = this.items.reduce((s, it) => s + (Number(it.lineTotal) || 0), 0);
    }

    // Fallback total = subtotal + shippingFee - discount
    const sf = Number(this.shippingFee || 0);
    const dc = Number(this.discount || 0);
    if (!this.total || this.total <= 0) {
      this.total = Math.max(0, Math.round(Number(this.subtotal || 0) + sf - dc));
    }

    next();
  } catch (err) {
    next(err);
  }
});

orderSchema.pre("save", function stampBeforeSave(next) {
  try {
    const rf = this.returnFlow || null;
    if (rf && rf.status) {
      const key = TIMELINE_FIELD_BY_STATUS[rf.status];
      if (key) {
        rf.timeline = rf.timeline || {};
        if (!rf.timeline[key]) rf.timeline[key] = new Date();

        if (
          rf.status === "refund_issued" ||
          rf.status === "return_refunded" ||
          rf.status === "return_rejected"
        ) {
          rf.timeline.closedAt = rf.timeline.closedAt || new Date();
          rf.isOpen = false;
        }
      }
      this.returnFlow = rf;
    }

    // Bảo toàn tính tiền lần nữa ở save (nếu controller không set)
    if ((this.subtotal ?? 0) <= 0 && Array.isArray(this.items)) {
      this.subtotal = this.items.reduce((s, it) => s + (Number(it.lineTotal) || 0), 0);
    }
    const sf = Number(this.shippingFee || 0);
    const dc = Number(this.discount || 0);
    if (!this.total || this.total <= 0) {
      this.total = Math.max(0, Math.round(Number(this.subtotal || 0) + sf - dc));
    }

    next();
  } catch (err) {
    next(err);
  }
});

/* =========================
 * Post-save: chỉ còn voucher (KHÔNG trừ kho để tránh trừ đôi với controller)
 * ========================= */
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
