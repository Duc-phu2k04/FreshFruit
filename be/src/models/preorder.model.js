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
    provider: { type: String, default: null }, // momo | vnpay | tiền mặt...
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
 * Status (bộ chính, tiếng Việt hoá ở FE)
 * ========================= */
export const PREORDER_STATUS = [
  "pending_payment", // Chờ thanh toán (cọc)
  "confirmed",       // Đã xác nhận đơn hàng (đủ cọc)
  "shipping",        // Đang giao hàng
  "delivered",       // Đã giao hàng
  "cancelled",       // Đã hủy
];

const LOCKED_STATUSES = ["delivered", "cancelled"];
const STATUS_FLOW = ["pending_payment", "confirmed", "shipping", "delivered"];
const RANK = STATUS_FLOW.reduce((m, s, i) => ((m[s] = i), m), {});
function canSetStatusForwardOnly(prev, next) {
  if (next === "cancelled") return prev !== "delivered";
  if (!(prev in RANK) || !(next in RANK)) return false;
  return RANK[next] > RANK[prev];
}

/* =========================
 * Shipping flow chi tiết (giống sàn)
 * ========================= */
export const SHIPPING_STATUS = [
  "awaiting_pickup",     // Chờ lấy hàng
  "picked_up",           // Đã lấy hàng
  "in_transit",          // Đang trung chuyển
  "out_for_delivery",    // Đang giao
  "delivered_success",   // Hãng VC xác nhận giao thành công
  "delivery_failed",     // Giao thất bại
  "returned_to_seller",  // Hoàn về
];

const shippingFlowSchema = new Schema(
  {
    status: { type: String, enum: SHIPPING_STATUS, default: null },
    timeline: {
      awaitingPickupAt: { type: Date, default: null },
      pickedUpAt: { type: Date, default: null },
      inTransitAt: { type: Date, default: null },
      outForDeliveryAt: { type: Date, default: null },
      deliveredSuccessAt: { type: Date, default: null },
      deliveryFailedAt: { type: Date, default: null },
      returnedToSellerAt: { type: Date, default: null },
    },
    raw: { type: Schema.Types.Mixed, default: {} }, // payload gốc từ hãng VC (nếu có)
  },
  { _id: false }
);

/* =========================
 * Tranh chấp
 * ========================= */
const disputeSchema = new Schema(
  {
    isOpen: { type: Boolean, default: false },
    openedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
  },
  { _id: false }
);

/* =========================
 * Luồng trả hàng / hoàn tiền sau khi giao
 * ========================= */
export const RETURN_STATUS = [
  "return_requested",        // KH gửi yêu cầu trả
  "return_approved",         // Admin duyệt
  "return_rejected",         // Admin từ chối (đóng luồng)
  "return_awaiting_pickup",  // Chờ hãng lấy hàng về
  "return_picked_up",        // Hãng đã lấy
  "return_in_transit",       // Đang chuyển về
  "return_received",         // Người bán đã nhận lại hàng
  "refund_issued",           // Đã hoàn tiền (đóng luồng)
];

const returnFlowSchema = new Schema(
  {
    isOpen: { type: Boolean, default: false },
    status: { type: String, enum: RETURN_STATUS, default: null },

    // Dữ liệu yêu cầu của KH
    reason: { type: String, default: null },          // lý do từ KH
    customerNote: { type: String, default: null },
    preferredResolution: { type: String, enum: ["refund", "exchange", null], default: "refund" },
    customerPhone: { type: String, default: null },
    requestedQty: { type: Number, default: 1, min: 1 },

    // Dữ liệu quản trị
    adminNote: { type: String, default: null },
    evidenceImages: { type: [String], default: [] },  // ảnh chứng cứ
    feeDeduction: { type: Number, default: 0, min: 0 }, // phí khấu trừ khi hoàn
    refundAmount: { type: Number, default: 0, min: 0 },

    // Vận chuyển chiều ngược
    carrier: { type: String, default: null },
    trackingCode: { type: String, default: null },
    raw: { type: Schema.Types.Mixed, default: {} },

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

    /** Lịch sử thanh toán (đủ dùng cho tính toán; FE không cần form nhập tay) */
    payments: { type: [paymentRecordSchema], default: [] },

    /** Trạng thái (1 chiều) */
    status: { type: String, enum: PREORDER_STATUS, default: "pending_payment" },

    /** Mốc thời gian cho bộ trạng thái chính */
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

    /** Shipping flow chi tiết */
    shippingFlow: { type: shippingFlowSchema, default: () => ({}) },

    /** Tranh chấp */
    dispute: { type: disputeSchema, default: () => ({}) },

    /** Luồng trả hàng / hoàn tiền */
    returnFlow: { type: returnFlowSchema, default: () => ({}) },

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
      autoCompleted: { type: Boolean, default: false }, // flag auto-complete sau 3 ngày
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
// Tối ưu theo flow mới
preorderSchema.index({ "shippingFlow.status": 1, createdAt: -1 });
preorderSchema.index({ "returnFlow.isOpen": 1, "returnFlow.status": 1, createdAt: -1 });
preorderSchema.index({ "dispute.isOpen": 1 });

/* =========================
 * Virtuals (tiện cho Admin UI)
 * ========================= */
preorderSchema.virtual("totalPaid").get(function () {
  // Tổng đã trả thành công (cọc + còn lại + điều chỉnh dương)
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

preorderSchema.virtual("isDepositSatisfied").get(function () {
  return Number(this.depositPaid || 0) >= Number(this.depositDue || 0);
});

preorderSchema.virtual("isPaidInFull").get(function () {
  return Number(this.amountDue || 0) === 0;
});

preorderSchema.virtual("nextStatus").get(function () {
  const cur = this.status;
  if (!(cur in RANK)) return null;
  const idx = RANK[cur];
  return idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null;
});

/** Ngày đủ điều kiện auto-complete (3 ngày sau deliveredAt) */
preorderSchema.virtual("autoCompleteAt").get(function () {
  const t = this?.timeline?.deliveredAt;
  if (!t) return null;
  const d = new Date(t);
  d.setDate(d.getDate() + 3);
  return d;
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

/**
 * Tự đồng bộ trạng thái chính theo shippingFlow:
 * - Nếu hãng VC báo 'delivered_success' → CHỈ set 'delivered' khi remainingDue == 0 (đã thanh toán toàn bộ).
 * - Nếu có bất kỳ mốc shipping nào và đang 'confirmed' → đẩy sang 'shipping'.
 */
preorderSchema.methods.applyStatusByShipping = function applyStatusByShipping() {
  if (LOCKED_STATUSES.includes(this.status)) return;

  const s = this?.shippingFlow?.status;

  if (s === "delivered_success") {
    // Chỉ auto chuyển sang delivered khi đã thanh toán đủ
    if (Number(this.remainingDue || 0) === 0) {
      this.status = "delivered";
      this.timeline = this.timeline || {};
      if (!this.timeline.deliveredAt) this.timeline.deliveredAt = new Date();
    }
  } else if (s && this.status === "confirmed") {
    // Có mốc VC khác → sang 'shipping'
    this.status = "shipping";
    this.timeline = this.timeline || {};
    if (!this.timeline.shippingAt) this.timeline.shippingAt = new Date();
  }
};

/** Kiểm tra khả năng chuyển trạng thái 1 chiều (cho BE/FE dùng chung, chỉ kiểm tra thứ tự) */
preorderSchema.methods.canSetStatusForward = function canSetStatusForward(to) {
  if (!to) return false;
  if (LOCKED_STATUSES.includes(this.status)) return false;
  return canSetStatusForwardOnly(this.status, String(to));
};

/** Helpers theo business rule mới (để FE/BE tham khảo) */
preorderSchema.methods.canAdvanceToConfirmed = function () {
  return this.status === "pending_payment" && Number(this.depositPaid || 0) >= Number(this.depositDue || 0);
};
preorderSchema.methods.canAdvanceToDelivered = function () {
  return Number(this.remainingDue || 0) === 0;
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

  // Set mốc tạo cho pending_payment nếu chưa có
  this.timeline = this.timeline || {};
  if (!this.timeline.pendingPaymentAt) this.timeline.pendingPaymentAt = new Date();

  // đảm bảo tồn tại object flow mới
  this.shippingFlow = this.shippingFlow || { timeline: {} };
  this.returnFlow = this.returnFlow || { timeline: {} };
  this.dispute = this.dispute || {};

  // luôn đảm bảo nhất quán trước validate
  this.recalcTotals();
  this.applyStatusByAmounts();
  this.applyStatusByShipping();

  next();
});

preorderSchema.pre("save", function (next) {
  // trước khi save, đồng bộ số liệu & trạng thái
  this.recalcTotals();
  this.applyStatusByAmounts();
  this.applyStatusByShipping();
  next();
});

const Preorder = mongoose.model("Preorder", preorderSchema);
export default Preorder;
