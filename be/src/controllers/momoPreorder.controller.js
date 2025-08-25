// server/controllers/momoPreorder.controller.js
import Preorder from "../models/preorder.model.js";
import {
  createMomoPaymentForPreorder,
  verifyMomoIpnSignature,
} from "../services/momoPreorder.service.js";

/* ------------ helpers ------------- */
function sumSucceeded(payments, kind) {
  return (payments || [])
    .filter(p => p.status === "succeeded" && (!kind || p.kind === kind))
    .reduce((s, p) => s + Number(p.amount || 0), 0);
}

function recalcPreorderFields(p) {
  // Nếu model có sẵn method thì dùng; nếu không, fallback thủ công
  if (typeof p.recalcTotals === "function") {
    p.recalcTotals();
    return;
  }

  const depositPaid = sumSucceeded(p.payments, "deposit");
  const remainingPaid = sumSucceeded(p.payments, "remaining");

  // totalDue: ưu tiên các field tổng, fallback subtotal
  const totalDue =
    Number(p.totalDue ?? p.total ?? p.subtotal ?? 0);

  // depositDue: nếu có trong model thì dùng, không thì 20% subtotal (tuỳ business)
  const depositDue = Number(
    p.depositDue ?? Math.round((Number(p.subtotal || 0) * 20) / 100)
  );

  p.depositPaid = depositPaid;
  p.depositDue = depositDue;
  p.remainingDue = Math.max(0, totalDue - (depositPaid + remainingPaid));
}

/* ------------ create payment (deposit) ------------- */
/**
 * POST /api/momo-preorder/create-payment-deposit/:preorderId
 * → { ok, payUrl, amount }
 */
export const createDepositPayment = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { preorderId } = req.params;

    const p = await Preorder.findById(preorderId);
    if (!p) return res.status(404).json({ ok: false, message: "Không tìm thấy preorder" });

    if (String(p.user) !== String(userId)) {
      return res.status(403).json({ ok: false, message: "Bạn không có quyền với đơn đặt trước này" });
    }

    // Cho phép tạo cọc khi vẫn còn nghĩa vụ cọc
    const allow = ["pending_payment","reserved","awaiting_stock","payment_due","ready_to_fulfill"];
    if (!allow.includes(p.status)) {
      return res.status(400).json({ ok: false, message: "Trạng thái hiện tại không cho phép thanh toán cọc" });
    }

    const { payUrl, amount } = await createMomoPaymentForPreorder(p, "deposit");
    if (!payUrl) return res.status(500).json({ ok: false, message: "Không tạo được link thanh toán" });

    return res.json({ ok: true, payUrl, amount });
  } catch (err) {
    console.error(" createDepositPayment error:", err);
    return res.status(500).json({ ok: false, message: err?.message || "Lỗi tạo thanh toán cọc" });
  }
};

/* ------------ create payment (remaining) ------------- */
/**
 * POST /api/momo-preorder/create-payment-remaining/:preorderId
 * → { ok, payUrl, amount }
 */
export const createRemainingPayment = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { preorderId } = req.params;

    const p = await Preorder.findById(preorderId);
    if (!p) return res.status(404).json({ ok: false, message: "Không tìm thấy preorder" });

    if (String(p.user) !== String(userId)) {
      return res.status(403).json({ ok: false, message: "Bạn không có quyền với đơn đặt trước này" });
    }

    const allow = ["ready_to_fulfill", "payment_due"];
    if (!allow.includes(p.status)) {
      return res.status(400).json({ ok: false, message: "Chưa đến thời điểm thanh toán phần còn lại" });
    }

    const { payUrl, amount } = await createMomoPaymentForPreorder(p, "remaining");
    if (!payUrl) return res.status(500).json({ ok: false, message: "Không tạo được link thanh toán" });

    return res.json({ ok: true, payUrl, amount });
  } catch (err) {
    console.error(" createRemainingPayment error:", err);
    return res.status(500).json({ ok: false, message: err?.message || "Lỗi tạo thanh toán phần còn lại" });
  }
};

/* ------------ IPN ------------- */
/**
 * POST /api/momo-preorder/ipn
 * extraData (base64): { preorderId, kind: "deposit" | "remaining" }
 */
export const handlePreorderIPN = async (req, res) => {
  try {
    const body = req.body || {};
    console.log(" MoMo IPN (preorder):", body);

    // 1) Verify chữ ký
    if (!verifyMomoIpnSignature(body)) {
      console.warn(" Sai chữ ký IPN (preorder)");
      return res.status(400).json({ message: "Invalid signature" });
    }

    // 2) Parse extraData
    let preorderId = null;
    let kind = "deposit";
    if (body?.extraData) {
      try {
        const decoded = JSON.parse(Buffer.from(body.extraData, "base64").toString("utf8"));
        if (decoded?.preorderId) preorderId = decoded.preorderId;
        if (decoded?.kind) kind = decoded.kind;
      } catch {}
    }
    if (!preorderId) return res.status(400).json({ message: "Missing preorderId" });

    const resultCode = Number(body.resultCode);
    const amount = Number(body.amount || 0);
    const intentId = String(body.orderId || body.transId || "");

    // 3) Tìm preorder
    const p = await Preorder.findById(preorderId);
    if (!p) return res.status(404).json({ message: "Preorder not found" });

    // 3.1) Idempotency: nếu đã ghi nhận thành công intent này thì bỏ qua
    const existed = (p.payments || []).find(
      pay => pay.intentId === intentId && pay.status === "succeeded"
    );
    if (existed) {
      console.log("IPN duplicate ignored:", { preorderId, intentId });
      return res.status(200).json({ message: "OK (duplicate)" });
    }

    // 4) Ghi nhận kết quả
    if (resultCode === 0) {
      p.payments.push({
        kind,               // "deposit" | "remaining"
        provider: "momo",
        intentId,
        amount,
        status: "succeeded",
        meta: { ipn: body },
      });

      // Tính lại các trường tiền
      recalcPreorderFields(p);

      // Cập nhật trạng thái
      // 4.1) Đủ cọc → chuyển 'reserved' (trừ khi đã hủy/expired/converted)
      const lockedStatuses = ["cancelled","expired","converted","refunded"];
      if (
        kind === "deposit" &&
        p.depositPaid >= Number(p.depositDue || 0) &&
        !lockedStatuses.includes(p.status)
      ) {
        // Nếu đang ở các trạng thái trước fulfill, cho về 'reserved'
        const canReserveFrom = [
          "pending_payment",
          "awaiting_stock",
          "payment_due",
          "ready_to_fulfill",
          "reserved",
        ];
        if (canReserveFrom.includes(p.status)) {
          p.status = "reserved";
          p.timeline = p.timeline || {};
          p.timeline.depositPaidAt = p.timeline.depositPaidAt || new Date();
        }
      }

      // 4.2) Trả đủ toàn bộ → converted
      if (p.remainingDue === 0 && !lockedStatuses.includes(p.status)) {
        p.status = "converted";
        p.timeline = p.timeline || {};
        p.timeline.convertedAt = new Date();
        // (tuỳ flow, có thể gọi service tạo Order thật ở đây)
      }

      await p.save();
      console.log("✅ IPN preorder thành công:", { preorderId: p._id, kind, amount, status: p.status });
      return res.status(200).json({ message: "OK" });
    }

    // 5) Thất bại → log
    p.payments.push({
      kind,
      provider: "momo",
      intentId,
      amount,
      status: "failed",
      meta: { ipn: body },
    });
    await p.save();

    console.warn(" Giao dịch preorder thất bại:", { preorderId, kind, amount });
    return res.status(200).json({ message: "Fail acknowledged" });
  } catch (err) {
    console.error(" Lỗi handlePreorderIPN:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export default {
  createDepositPayment,
  createRemainingPayment,
  handlePreorderIPN,
};
