// server/models/preorder.model.js
import mongoose from "mongoose";

const { Schema } = mongoose;

/* =========================
 * Sub-schemas
 * ========================= */

/** Lịch sử thanh toán (cọc / phần còn lại / hoàn tiền / điều chỉnh) */
const paymentRecordSchema = new Schema(
  {
    kind: {
      type: String,
      enum: ["deposit", "remaining", "refund", "adjustment"],
      required: true,
    },
    provider: { type: String, default: null }, // momo | vnpay | ...
    intentId: { type: String, default: null }, // id giao dịch từ cổng thanh toán
    amount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["pending", "succeeded", "failed", "canceled"],
      default: "succeeded",
    },
    meta: { type: Schema.Types.Mixed, default: {} }, // raw IPN, extra fields...
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

/** Snapshot biến thể lúc đặt */
const variantSnapshotSchema = new Schema(
  {
    attributes: {
      weight: { type: String, default: null },
      ripeness: { type: String, default: null },
    },
    label: { type: String, default: null }, // "500g · Ăn liền", ...
  },
  { _id: false }
);

/** Địa chỉ giao (snapshot) */
const shippingSnapshotSchema = new Schema(
  {
    fullName: { type: String, default: null },
    phone: { type: String, default: null },
    addressLine1: { type: String, default: null },
    addressLine2: { type: String, default: null },
    ward: { type: String, default: null },
    district: { type: String, default: null },
    province: { type: String, default: null },
    note: { type: String, default: null },
  },
  { _id: false }
);

/** Lịch sử sự kiện preorder (độc lập với status) */
const historyEntrySchema = new Schema(
  {
    type: { type: String, required: true }, // ví dụ: 'ready_flag', 'converted', ...
    at: { type: Date, default: Date.now },
    by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    note: { type: String, default: null },
    orderRef: { type: String, default: null }, // nếu có liên kết Order ngoài
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

/* =========================
 * Status (bộ mới, tiếng Việt hoá ở FE)
 * ========================= */
export const PREORDER_STATUS = [
  "pending_payment", // Chờ thanh toán (cọc)
  "confirmed",       // Đã xác nhận đơn hàng (đã đủ cọc)
  "shipping",        // Đang giao hàng
  "delivered",       // Đã giao hàng
  "cancelled",       // Đã hủy
];

const LOCKED_STATUSES = ["delivered", "cancelled"];

/* =========================
 * Main schema
 * ========================= */
const preorderSchema = new Schema(
  {
    customId: { type: String, unique: true }, // Ví dụ: PO-20240810-1234

    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },

    variant: { type: variantSnapshotSchema, default: () => ({}) },
    qty: { type: Number, required: true, min: 1 },

    currency: { type: String, default: "VND" },
    unitPrice: { type: Number, required: true, min: 0 },
    priceLocked: { type: Boolean, default: true },

    /** Tổng trước phí điều chỉnh */
    subtotal: { type: Number, required: true, min: 0 },

    /** Tỷ lệ cọc & nghĩa vụ thanh toán */
    depositPercent: { type: Number, required: true, min: 0, max: 100 },
    depositDue: { type: Number, required: true, min: 0 }, // recalc
    depositPaid: { type: Number, default: 0, min: 0 }, // recalc từ payments
    remainingDue: { type: Number, required: true, min: 0 }, // recalc

    /** Fees & hoàn tiền (tổng thể) */
    fees: {
      cancelFee: { type: Number, default: 0, min: 0 },
      adjust: { type: Number, default: 0 }, // + tăng nghĩa vụ, - giảm nghĩa vụ
    },
    refundAmount: { type: Number, default: 0, min: 0 }, // dùng khi hủy nếu có

    /** Lịch sử thanh toán */
    payments: { type: [paymentRecordSchema], default: [] },

    /** Trạng thái */
    status: { type: String, enum: PREORDER_STATUS, default: "pending_payment" },

    /** Mốc thời gian cho bộ trạng thái mới */
    timeline: {
      pendingPaymentAt: { type: Date, default: null }, // khi tạo
      confirmedAt: { type: Date, default: null },      // đủ cọc
      shippingAt: { type: Date, default: null },       // bắt đầu giao
      deliveredAt: { type: Date, default: null },      // giao xong
      cancelledAt: { type: Date, default: null },      // hủy

      /** mốc cũ/tuỳ chọn còn dùng ở nơi khác */
      depositPaidAt: { type: Date, default: null },
      windowEnd: { type: Date, default: null },
      cancelUntil: { type: Date, default: null },
    },

    /** Shipping snapshot */
    shipping: { type: shippingSnapshotSchema, default: () => ({}) },

    /** Flags gửi thông báo */
    notifications: {
      sentDepositConfirm: { type: Boolean, default: false },
      sentShippingNotice: { type: Boolean, default: false },
      sentDeliveredNotice: { type: Boolean, default: false },
      sentCancelledNotice: { type: Boolean, default: false },
    },

    /** Ghi chú */
    customerNote: { type: String, default: null },
    internalNote: { type: String, default: null },

    /** Meta */
    meta: {
      source: { type: String, default: null }, // “coming-soon” | “product-detail”...
      utm: { type: Schema.Types.Mixed, default: {} },
      ip: { type: String, default: null },
      extra: { type: Schema.Types.Mixed, default: {} },
    },

    /** Hint cho FE (không bắt buộc) */
    payMethod: { type: String, enum: ["deposit", "full"], default: "deposit" },
    payNow: { type: Number, default: 0, min: 0 },
    depositAmount: { type: Number, default: 0, min: 0 },

    /** Lịch sử sự kiện độc lập */
    history: { type: [historyEntrySchema], default: [] },

    /** Soft delete (ẩn khỏi hệ thống) */
    isDeleted: { type: Boolean, default: false },

    /** Ẩn khỏi danh sách phía user (admin vẫn thấy) */
    userHidden: { type: Boolean, default: false },
  },
  { timestamps: true }
);

/* =========================
 * Index
 * ========================= */
preorderSchema.index({ user: 1, createdAt: -1 });
preorderSchema.index({ product: 1, status: 1 });
preorderSchema.index({ status: 1, createdAt: -1 });
preorderSchema.index({ user: 1, userHidden: 1, isDeleted: 1, createdAt: -1 }); // user-side
preorderSchema.index({ isDeleted: 1, status: 1, createdAt: -1 });              // admin list
preorderSchema.index({ customId: "text" }); // search nhanh theo mã PO

/* =========================
 * Virtuals
 * ========================= */
preorderSchema.virtual("totalPaid").get(function () {
  // tổng các khoản đã trả thành công (cọc + còn lại + điều chỉnh dương)
  return (this.payments || []).reduce((sum, p) => {
    if (p.status === "succeeded" && ["deposit", "remaining", "adjustment"].includes(p.kind)) {
      return sum + Number(p.amount || 0);
    }
    return sum;
  }, 0);
});

preorderSchema.virtual("amountDue").get(function () {
  const gross = Number(this.subtotal || 0) + Number(this.fees?.adjust || 0);
  const due = gross - Number(this.totalPaid || 0);
  return Math.max(0, Math.round(due));
});

/* =========================
 * Helpers
 * ========================= */
preorderSchema.methods.recalcTotals = function recalcTotals() {
  const subtotal = Number(this.subtotal || 0);
  const adjust = Number(this.fees?.adjust || 0);
  const depositDue = Math.max(
    0,
    Math.round(subtotal * (Number(this.depositPercent || 0) / 100))
  );

  const depositPaidSucceeded = (this.payments || [])
    .filter((p) => p.kind === "deposit" && p.status === "succeeded")
    .reduce((s, p) => s + Number(p.amount || 0), 0);

  const paidOthers = (this.payments || [])
    .filter((p) => p.status === "succeeded" && ["remaining", "adjustment"].includes(p.kind))
    .reduce((s, p) => s + Number(p.amount || 0), 0);

  const totalPaid = depositPaidSucceeded + paidOthers;
  const gross = subtotal + adjust;
  const remaining = Math.max(0, gross - totalPaid);

  this.depositDue = depositDue;
  this.depositPaid = depositPaidSucceeded;
  this.remainingDue = remaining;

  // Đồng bộ hint nếu chưa set
  if (!this.isModified("depositAmount")) {
    this.depositAmount = this.depositAmount ?? depositDue;
  }
  if (!this.isModified("payNow")) {
    this.payNow = this.payMethod === "full" ? gross : (this.depositAmount ?? depositDue);
  }

  return {
    subtotal,
    adjust,
    depositDue,
    depositPaid: depositPaidSucceeded,
    remainingDue: remaining,
    totalPaid,
  };
};

/** Tự động đổi trạng thái theo số tiền đã trả (chỉ pending_payment -> confirmed) */
preorderSchema.methods.applyStatusByAmounts = function applyStatusByAmounts() {
  if (LOCKED_STATUSES.includes(this.status)) return;

  const depositPaid = Number(this.depositPaid || 0);
  const depositDue = Number(this.depositDue || 0);

  // Đủ cọc → confirmed (chỉ khi đang pending_payment)
  if (this.status === "pending_payment" && depositPaid >= depositDue) {
    this.status = "confirmed";
    this.timeline = this.timeline || {};
    if (!this.timeline.depositPaidAt) this.timeline.depositPaidAt = new Date();
    if (!this.timeline.confirmedAt) this.timeline.confirmedAt = new Date();
  }
};

/** Tạo mã Preorder ngắn gọn */
export function genPreorderId() {
  const t = new Date();
  return `PO-${t.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${Math.floor(
    Math.random() * 9000 + 1000
  )}`;
}

/* =========================
 * Hooks
 * ========================= */
preorderSchema.pre("validate", function (next) {
  if (!this.customId) this.customId = genPreorderId();
  if (this.subtotal == null) {
    this.subtotal = Math.max(
      0,
      Math.round(Number(this.unitPrice || 0) * Number(this.qty || 0))
    );
  }

  // luôn đảm bảo nhất quán trước validate
  this.recalcTotals();
  this.applyStatusByAmounts();

  next();
});

preorderSchema.pre("save", function (next) {
  // trước khi save, đồng bộ số liệu & trạng thái
  this.recalcTotals();
  this.applyStatusByAmounts();
  next();
});

const Preorder = mongoose.model("Preorder", preorderSchema);
export default Preorder;
