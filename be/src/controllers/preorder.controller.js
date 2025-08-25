// server/controllers/preorder.controller.js
import Product from "../models/product.model.js";
import Preorder from "../models/preorder.model.js";

const WHERE = "[preorder.controller]";

/* =================================
 * Chuẩn hoá & tiện ích nhỏ
 * ================================= */
function normalizeStatus(s) {
  if (!s) return "pending_payment";
  const v = String(s || "").trim();
  if (!v) return "pending_payment";
  if (v === "pending-payment") return "pending_payment";
  return v;
}

function matchAttr(a = {}, b = {}) {
  return (
    String(a?.weight ?? "") === String(b?.weight ?? "") &&
    String(a?.ripeness ?? "") === String(b?.ripeness ?? "")
  );
}

/* =================================
 * HELPERS
 * ================================= */
async function recomputeAndAutoTransition(preorderDoc) {
  if (typeof preorderDoc.recalcTotals === "function") preorderDoc.recalcTotals();
  if (typeof preorderDoc.applyStatusByAmounts === "function") preorderDoc.applyStatusByAmounts();
  await preorderDoc.save();
  return preorderDoc;
}

/** Điều chỉnh quota khi status chuyển sang/vượt khỏi "cancelled" */
async function adjustQuotaOnStatusChange(preorder, prevStatus, nextStatus) {
  const becameCancelled = nextStatus === "cancelled" && prevStatus !== "cancelled";
  const leftCancelled = prevStatus === "cancelled" && nextStatus !== "cancelled";
  if (!becameCancelled && !leftCancelled) return;

  try {
    const prod = await Product.findById(preorder.product);
    if (!prod?.preorder) return;

    const delta = becameCancelled ? -Number(preorder.qty || 0) : Number(preorder.qty || 0);

    // Tổng sold
    prod.preorder.soldPreorder = Math.max(
      0,
      Number(prod.preorder.soldPreorder || 0) + delta
    );

    // Theo biến thể
    if (Array.isArray(prod.preorder.perVariantAllocations)) {
      const idx = prod.preorder.perVariantAllocations.findIndex((row) =>
        matchAttr(row?.attributes, {
          weight: preorder?.variant?.attributes?.weight,
          ripeness: preorder?.variant?.attributes?.ripeness,
        })
      );
      if (idx >= 0) {
        const current =
          Number(prod.preorder.perVariantAllocations[idx].soldPreorder || 0) + delta;
        prod.preorder.perVariantAllocations[idx].soldPreorder = Math.max(0, current);
      }
    }

    await prod.save();
  } catch (e) {
    console.warn(WHERE, "Không thể điều chỉnh quota (non-fatal):", e?.message || e);
  }
}

/** Ghi mốc timeline theo status (bộ trạng thái mới) */
function stampTimelineByStatus(p, status) {
  p.timeline = p.timeline || {};
  const now = new Date();
  switch (status) {
    case "pending_payment":
      p.timeline.pendingPaymentAt = now;
      break;
    case "confirmed":
      p.timeline.confirmedAt = now;
      break;
    case "shipping":
      p.timeline.shippingAt = now;
      break;
    case "delivered":
      p.timeline.deliveredAt = now;
      break;
    case "cancelled":
      p.timeline.cancelledAt = now;
      break;
    default:
      break;
  }
}

/** Lịch sử đơn độc lập (không thay đổi status) */
function appendHistory(p, type, payload = {}) {
  p.history = Array.isArray(p.history) ? p.history : [];
  p.history.push({
    type, // ví dụ: 'ready_flag', 'converted'
    at: new Date(),
    ...payload, // { by, note, orderRef, ... }
  });
}

/* =================================
 * CREATE (User)
 * ================================= */
export const createPreorder = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const origin = req.headers["x-preorder-origin"] || "unknown";
    const { productId, variant, qty, payMethod = "deposit" } = req.body || {};

    if (!userId) return res.status(401).json({ ok: false, message: "Unauthorized" });
    if (!productId || !qty || Number(qty) <= 0) {
      return res
        .status(400)
        .json({ ok: false, message: "Thiếu dữ liệu sản phẩm hoặc số lượng" });
    }

    const prod = await Product.findById(productId);
    if (!prod) return res.status(404).json({ ok: false, message: "Không tìm thấy sản phẩm" });
    if (!prod?.preorder?.enabled) {
      return res.status(400).json({ ok: false, message: "Sản phẩm chưa mở đặt trước" });
    }

    const now = new Date();
    const ws = prod.preorder.windowStart ? new Date(prod.preorder.windowStart) : null;
    const we = prod.preorder.windowEnd ? new Date(prod.preorder.windowEnd) : null;
    if (ws && now < ws) return res.status(400).json({ ok: false, message: "Chưa tới thời gian đặt trước" });
    if (we && now > we) return res.status(400).json({ ok: false, message: "Đã hết thời gian đặt trước" });

    // resolve variant
    let variantDoc = null;
    if (variant?.variantId) variantDoc = prod.variants?.id(variant.variantId) || null;
    if (!variantDoc && (variant?.weight || variant?.ripeness)) {
      variantDoc = (prod.variants || []).find(
        (v) =>
          String(v?.attributes?.weight ?? "") === String(variant?.weight ?? "") &&
          String(v?.attributes?.ripeness ?? "") === String(variant?.ripeness ?? "")
      );
    }
    if (!variantDoc) variantDoc = prod.baseVariant || null;
    if (!variantDoc)
      return res.status(400).json({ ok: false, message: "Không tìm thấy biến thể phù hợp" });

    const unitPrice = Number(variantDoc.price ?? prod?.baseVariant?.price ?? 0);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      return res.status(400).json({ ok: false, message: "Giá sản phẩm không hợp lệ" });
    }

    // quota
    let remaining =
      (Number(prod?.preorder?.quota ?? 0) - Number(prod?.preorder?.soldPreorder ?? 0)) || 0;
    let usedPerVariantAlloc = null;
    if (
      Array.isArray(prod?.preorder?.perVariantAllocations) &&
      (variant?.weight || variant?.ripeness)
    ) {
      const row = prod.preorder.perVariantAllocations.find((r) =>
        matchAttr(r?.attributes, { weight: variant?.weight, ripeness: variant?.ripeness })
      );
      if (row) {
        usedPerVariantAlloc = row;
        remaining = Math.max(0, Number(row.quota ?? 0) - Number(row.soldPreorder ?? 0));
      }
    }
    if (remaining <= 0 || Number(qty) > remaining) {
      return res.status(400).json({ ok: false, message: "Vượt hạn mức đặt trước" });
    }

    const depositPercent = Number(prod?.preorder?.depositPercent ?? 20);
    if (!Number.isFinite(depositPercent) || depositPercent < 0 || depositPercent > 100) {
      return res.status(400).json({ ok: false, message: "Tỷ lệ đặt cọc không hợp lệ" });
    }

    const subtotal = Math.round(unitPrice * Number(qty));
    const depositAmount = Math.round(subtotal * (depositPercent / 100));
    const payNow = payMethod === "full" ? subtotal : depositAmount;

    const status = normalizeStatus("pending-payment");

    const preorderDoc = new Preorder({
      user: userId,
      product: prod._id,
      variant: {
        attributes: {
          weight: variant?.weight ?? variantDoc?.attributes?.weight ?? null,
          ripeness: variant?.ripeness ?? variantDoc?.attributes?.ripeness ?? null,
        },
        label:
          (variant?.weight || variant?.ripeness)
            ? `${variant?.weight || ""}${
                variant?.weight && variant?.ripeness ? " · " : ""
              }${variant?.ripeness || ""}`
            : null,
      },
      qty: Number(qty),
      unitPrice,
      subtotal,
      depositPercent,
      depositDue: depositAmount,
      payMethod,
      payNow,
      depositAmount,
      status,
      meta: { source: origin },
    });

    await preorderDoc.save();

    // tăng counters
    try {
      prod.preorder.soldPreorder = Number(prod.preorder.soldPreorder || 0) + Number(qty);
      if (usedPerVariantAlloc) {
        const idx = prod.preorder.perVariantAllocations.findIndex((r) =>
          matchAttr(r?.attributes, usedPerVariantAlloc?.attributes)
        );
        if (idx >= 0) {
          prod.preorder.perVariantAllocations[idx].soldPreorder =
            Number(prod.preorder.perVariantAllocations[idx].soldPreorder || 0) +
            Number(qty);
        }
      }
      await prod.save();
    } catch (e) {
      console.warn(WHERE, "Không thể tăng soldPreorder (non-fatal):", e?.message || e);
    }

    return res
      .status(201)
      .json({ ok: true, message: "Tạo đơn đặt trước thành công", preorder: preorderDoc });
  } catch (err) {
    console.error(WHERE, "CREATE ERROR:", err);
    return res
      .status(400)
      .json({ ok: false, message: err?.message || "Tạo đơn đặt trước thất bại" });
  }
};

/* =================================
 * LIST USER
 * ================================= */
export const listUserPreorders = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ ok: false, message: "Unauthorized" });

    const { status, page = 1, limit = 20 } = req.query;
    const q = { user: userId, isDeleted: { $ne: true }, userHidden: { $ne: true } };
    if (status) q.status = status;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Math.min(100, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      Preorder.find(q)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate({ path: "product", select: "name images baseVariant" })
        .lean(),
      Preorder.countDocuments(q),
    ]);

    return res.json({
      ok: true,
      items,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    console.error("[listUserPreorders] ERROR:", err);
    return res
      .status(400)
      .json({ ok: false, message: err?.message || "Lỗi tải đơn đặt trước" });
  }
};

/* =================================
 * DETAIL (User)
 * ================================= */
export const getPreorderDetail = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { id } = req.params;

    const doc = await Preorder.findOne({
      _id: id,
      user: userId,
      isDeleted: { $ne: true },
      userHidden: { $ne: true },
    }).populate({ path: "product", select: "name images baseVariant" });

    if (!doc) return res.status(404).json({ ok: false, message: "Không tìm thấy đơn đặt trước" });
    return res.json({ ok: true, preorder: doc });
  } catch (err) {
    console.error("[getPreorderDetail] ERROR:", err);
    return res
      .status(400)
      .json({ ok: false, message: err?.message || "Lỗi lấy chi tiết đơn đặt trước" });
  }
};

/* =================================
 * RECALC (Admin/User)
 * ================================= */
export const recalcPreorder = async (req, res) => {
  try {
    const { id } = req.params;
    const p = await Preorder.findById(id);
    if (!p) return res.status(404).json({ ok: false, message: "Không tìm thấy đơn đặt trước" });

    await recomputeAndAutoTransition(p);
    return res.json({ ok: true, message: "Đã tính lại & đồng bộ trạng thái", data: p });
  } catch (err) {
    console.error("[recalcPreorder] ERROR:", err);
    return res
      .status(400)
      .json({ ok: false, message: err?.message || "Lỗi đồng bộ trạng thái" });
  }
};

/* =================================
 * ADMIN LIST
 * ================================= */
export const listAdminPreorders = async (req, res) => {
  try {
    const { status, q = "", page = 1, limit = 20 } = req.query;

    const findCond = { isDeleted: { $ne: true } };
    if (status && status !== "all") findCond.status = status;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Math.min(100, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    if (q) {
      // tìm nhanh theo customId; các tiêu chí khác filter sau
      findCond.$or = [{ customId: { $regex: q, $options: "i" } }];
    }

    let items = await Preorder.find(findCond)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate({ path: "product", select: "name" })
      .populate({ path: "user", select: "email username name" })
      .lean();

    let total;
    if (q) {
      const t = String(q).toLowerCase();
      items = items.filter((it) => {
        return (
          (it?.customId || "").toLowerCase().includes(t) ||
          (it?.product?.name || "").toLowerCase().includes(t) ||
          (it?.user?.email || it?.user?.username || it?.user?.name || "").toLowerCase().includes(t)
        );
      });
      total = items.length;
    } else {
      total = await Preorder.countDocuments(findCond);
    }

    return res.json({
      ok: true,
      items,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    console.error("[listAdminPreorders] ERROR:", err);
    return res
      .status(400)
      .json({ ok: false, message: err?.message || "Lỗi tải danh sách admin" });
  }
};

/* =================================
 * MARK READY (Admin) -> CHỈ GHI HISTORY
 * ================================= */
export const markReady = async (req, res) => {
  try {
    const { id } = req.params;
    const p = await Preorder.findById(id);
    if (!p) return res.status(404).json({ ok: false, message: "Không tìm thấy đơn đặt trước" });

    const by = req.user?.id || req.user?._id || null;
    const note = req.body?.note || "admin marked as ready";
    appendHistory(p, "ready_flag", { by, note });

    await p.save();
    return res.json({ ok: true, message: "Đã ghi lịch sử: sẵn sàng giao (flag)", data: p });
  } catch (err) {
    console.error("[markReady] ERROR:", err);
    return res
      .status(400)
      .json({ ok: false, message: err?.message || "Lỗi ghi lịch sử ready" });
  }
};

/* =================================
 * CONVERT (Admin) -> CHỈ GHI HISTORY
 * ================================= */
export const convertToOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { orderRef, note } = req.body || {};
    const p = await Preorder.findById(id);
    if (!p) return res.status(404).json({ ok: false, message: "Không tìm thấy đơn đặt trước" });

    const by = req.user?.id || req.user?._id || null;
    appendHistory(p, "converted", {
      by,
      orderRef: orderRef || null,
      note: note || "converted to order",
    });

    await p.save();
    return res.json({ ok: true, message: "Đã ghi lịch sử: chuyển thành đơn hàng", data: p });
  } catch (err) {
    console.error("[convertToOrder] ERROR:", err);
    return res
      .status(400)
      .json({ ok: false, message: err?.message || "Lỗi ghi lịch sử convert" });
  }
};

/* =================================
 * ADMIN EDIT
 * ================================= */
export const adminEditPreorder = async (req, res) => {
  try {
    const { id } = req.params;
    const { depositPercent, fees, internalNote, customerNote } = req.body || {};

    const p = await Preorder.findById(id);
    if (!p) return res.status(404).json({ ok: false, message: "Không tìm thấy đơn đặt trước" });

    if (depositPercent !== undefined) p.depositPercent = Number(depositPercent);
    if (fees?.adjust !== undefined) {
      p.fees = p.fees || {};
      p.fees.adjust = Number(fees.adjust);
    }
    if (internalNote !== undefined) p.internalNote = internalNote;
    if (customerNote !== undefined) p.customerNote = customerNote;

    await recomputeAndAutoTransition(p);

    return res.json({ ok: true, message: "Đã lưu thay đổi", data: p });
  } catch (err) {
    console.error("[adminEditPreorder] ERROR:", err);
    return res.status(400).json({ ok: false, message: err?.message || "Lỗi lưu chỉnh sửa" });
  }
};

/* =================================
 * CANCEL (User)
 * ================================= */
export const cancelPreorder = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ ok: false, message: "Unauthorized" });

    const preorder = await Preorder.findOne({
      _id: id,
      user: userId,
      isDeleted: { $ne: true },
      userHidden: { $ne: true },
    }).populate({ path: "product", select: "preorder name" });
    if (!preorder) return res.status(404).json({ ok: false, message: "Không tìm thấy đơn đặt trước" });

    // User không thể hủy nếu đã giao hoặc đã hủy
    const blocked = ["delivered", "cancelled"];
    if (blocked.includes(preorder.status)) {
      return res
        .status(400)
        .json({ ok: false, message: "Đơn không thể hủy ở trạng thái hiện tại" });
    }

    // phí hủy theo policy
    const prodCfg = preorder?.product?.preorder || {};
    const cancelPolicy = prodCfg?.cancelPolicy || {};
    const now = new Date();
    let cancelFee = 0;
    if (cancelPolicy?.untilDate) {
      const until = new Date(cancelPolicy.untilDate);
      if (now > until) {
        const feePercent = Number(cancelPolicy.feePercent ?? 0);
        if (Number.isFinite(feePercent) && feePercent > 0) {
          cancelFee = Math.round(Number(preorder.subtotal || 0) * (feePercent / 100));
        }
      } else cancelFee = 0;
    } else {
      const feePercent = Number(cancelPolicy?.feePercent ?? 0);
      if (Number.isFinite(feePercent) && feePercent > 0) {
        cancelFee = Math.round(Number(preorder.subtotal || 0) * (feePercent / 100));
      }
    }

    preorder.fees = preorder.fees || {};
    preorder.fees.cancelFee = Number(cancelFee) || 0;

    const depositPaid = Number(preorder.depositPaid || 0);
    preorder.refundAmount = Math.max(0, depositPaid - preorder.fees.cancelFee);

    preorder.status = "cancelled";
    preorder.timeline = preorder.timeline || {};
    preorder.timeline.cancelledAt = now;
    preorder.isDeleted = true; // user hủy: ẩn khỏi list user

    if (typeof preorder.recalcTotals === "function") preorder.recalcTotals();
    await preorder.save();

    // trả quota
    try {
      const prod = await Product.findById(preorder.product);
      if (prod?.preorder) {
        prod.preorder.soldPreorder = Math.max(
          0,
          Number(prod.preorder.soldPreorder || 0) - Number(preorder.qty || 0)
        );
        if (Array.isArray(prod.preorder.perVariantAllocations)) {
          const i = prod.preorder.perVariantAllocations.findIndex((row) =>
            matchAttr(row?.attributes, {
              weight: preorder?.variant?.attributes?.weight,
              ripeness: preorder?.variant?.attributes?.ripeness,
            })
          );
          if (i >= 0) {
            prod.preorder.perVariantAllocations[i].soldPreorder = Math.max(
              0,
              Number(prod.preorder.perVariantAllocations[i].soldPreorder || 0) -
                Number(preorder.qty || 0)
            );
          }
        }
        await prod.save();
      }
    } catch (e) {
      console.warn("[cancelPreorder] Không thể trả quota (non-fatal):", e?.message || e);
    }

    return res.json({ ok: true, message: "Đã hủy đơn đặt trước", preorder });
  } catch (err) {
    console.error("[cancelPreorder] ERROR:", err);
    return res
      .status(400)
      .json({ ok: false, message: err?.message || "Hủy đơn đặt trước thất bại" });
  }
};

/* =================================
 * USER: HIDE (xóa khỏi lịch sử user)
 * PATCH /api/preorders/:id/hide
 * - Cho phép khi đã "delivered" hoặc "cancelled".
 * - Không ảnh hưởng quota/counters.
 * ================================= */
export const userHidePreorder = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ ok: false, message: "Unauthorized" });

    const p = await Preorder.findOne({
      _id: id,
      user: userId,
      isDeleted: { $ne: true }, // chưa bị xóa cứng/soft-delete khác
    });
    if (!p) return res.status(404).json({ ok: false, message: "Không tìm thấy đơn đặt trước" });

    if (!["delivered", "cancelled"].includes(p.status)) {
      return res.status(400).json({ ok: false, message: "Chỉ có thể xóa đơn đã giao hoặc đã hủy" });
    }

    p.userHidden = true; // ẩn với user
    await p.save();

    return res.json({ ok: true, message: "Đã xóa đơn đặt trước khỏi lịch sử" });
  } catch (err) {
    console.error("[userHidePreorder] ERROR:", err);
    return res.status(400).json({ ok: false, message: err?.message || "Xóa đơn thất bại" });
  }
};

/* =================================
 * ADMIN: CANCEL (hủy tay)
 * PATCH /api/preorders/:id/admin-cancel
 * ================================= */
export const adminCancelPreorder = async (req, res) => {
  try {
    const { id } = req.params;

    const preorder = await Preorder.findById(id).populate({
      path: "product",
      select: "preorder name",
    });
    if (!preorder) return res.status(404).json({ ok: false, message: "Không tìm thấy đơn đặt trước" });

    // Không cho hủy nếu đã giao hoặc đã hủy
    const blocked = ["delivered", "cancelled"];
    if (blocked.includes(preorder.status)) {
      return res
        .status(400)
        .json({ ok: false, message: "Đơn không thể hủy ở trạng thái hiện tại" });
    }

    // Cho phép hủy khi đang: pending_payment | confirmed | shipping
    const cancellable = ["pending_payment", "confirmed", "shipping"];
    if (!cancellable.includes(preorder.status)) {
      return res.status(400).json({ ok: false, message: "Trạng thái này không hỗ trợ hủy" });
    }

    // phí hủy (nếu có policy)
    const prodCfg = preorder?.product?.preorder || {};
    const cancelPolicy = prodCfg?.cancelPolicy || {};
    const now = new Date();
    let cancelFee = 0;
    if (cancelPolicy?.untilDate) {
      const until = new Date(cancelPolicy.untilDate);
      if (now > until) {
        const feePercent = Number(cancelPolicy.feePercent ?? 0);
        if (Number.isFinite(feePercent) && feePercent > 0) {
          cancelFee = Math.round(Number(preorder.subtotal || 0) * (feePercent / 100));
        }
      } else cancelFee = 0;
    } else {
      const feePercent = Number(cancelPolicy?.feePercent ?? 0);
      if (Number.isFinite(feePercent) && feePercent > 0) {
        cancelFee = Math.round(Number(preorder.subtotal || 0) * (feePercent / 100));
      }
    }

    preorder.fees = preorder.fees || {};
    preorder.fees.cancelFee = Number(cancelFee) || 0;

    const depositPaid = Number(preorder.depositPaid || 0);
    preorder.refundAmount = Math.max(0, depositPaid - preorder.fees.cancelFee);

    const prev = preorder.status;
    preorder.status = "cancelled";
    preorder.timeline = preorder.timeline || {};
    preorder.timeline.cancelledAt = now;
    preorder.isDeleted = false; // admin hủy: vẫn hiển thị trong admin

    if (typeof preorder.recalcTotals === "function") preorder.recalcTotals();
    await preorder.save();

    // trả quota theo thay đổi
    await adjustQuotaOnStatusChange(preorder, prev, "cancelled");

    return res.json({ ok: true, message: "Đã hủy đơn đặt trước", data: preorder });
  } catch (err) {
    console.error("[adminCancelPreorder] ERROR:", err);
    return res.status(400).json({ ok: false, message: err?.message || "Lỗi hủy đơn (admin)" });
  }
};

/* =================================
 * ADMIN: DELETE (xóa mềm)
 * DELETE /api/preorders/:id
 *  - Chỉ cho phép xóa khi đã "cancelled"
 * ================================= */
export const adminDeletePreorder = async (req, res) => {
  try {
    const { id } = req.params;
    const p = await Preorder.findById(id);
    if (!p) return res.status(404).json({ ok: false, message: "Không tìm thấy đơn đặt trước" });

    if (p.status !== "cancelled") {
      return res.status(400).json({ ok: false, message: "Chỉ xóa đơn đã hủy" });
    }

    p.isDeleted = true;
    await p.save();

    return res.json({ ok: true, message: "Đã xóa đơn đặt trước", data: p });
  } catch (err) {
    console.error("[adminDeletePreorder] ERROR:", err);
    return res.status(400).json({ ok: false, message: err?.message || "Xóa đơn thất bại" });
  }
};

/* =================================
 * ADMIN: SET STATUS (thủ công)
 * PATCH /api/preorders/:id/admin-set-status
 * Body: { status, reason?, refundAmount? }
 * ================================= */
export const adminSetStatus = async (req, res) => {
  try {
    const { id } = req.params;
    let { status, reason, refundAmount } = req.body || {};
    status = normalizeStatus(status);

    // Bộ trạng thái mới
    const allowed = new Set([
      "pending_payment",
      "confirmed",
      "shipping",
      "delivered",
      "cancelled",
    ]);
    if (!allowed.has(status)) {
      return res.status(400).json({ ok: false, message: "Trạng thái không hợp lệ" });
    }

    const p = await Preorder.findById(id).populate({ path: "product", select: "preorder name" });
    if (!p) return res.status(404).json({ ok: false, message: "Không tìm thấy đơn đặt trước" });

    const prev = p.status;
    if (prev === status) {
      return res.json({ ok: true, message: "Trạng thái không đổi", data: p });
    }

    // Không cho đổi nếu đã delivered hoặc cancelled
    if (["delivered", "cancelled"].includes(prev)) {
      return res
        .status(400)
        .json({ ok: false, message: "Không thể cập nhật từ trạng thái hiện tại" });
    }

    // Ghi note admin nếu có
    if (reason) {
      p.internalNote = [p.internalNote, `[ADMIN STATUS] ${new Date().toISOString()}: ${reason}`]
        .filter(Boolean)
        .join("\n");
    }

    // Set status + timeline
    p.status = status;
    stampTimelineByStatus(p, status);

    // Nếu hủy: có thể ghi số tiền hoàn nếu truyền vào
    if (status === "cancelled" && refundAmount != null) {
      const n = Number(refundAmount);
      if (Number.isFinite(n) && n >= 0) p.refundAmount = n;
    }

    if (typeof p.recalcTotals === "function") p.recalcTotals();
    await p.save();

    await adjustQuotaOnStatusChange(p, prev, status);
    await recomputeAndAutoTransition(p);

    return res.json({ ok: true, message: "Đã cập nhật trạng thái thủ công", data: p });
  } catch (err) {
    console.error("[adminSetStatus] ERROR:", err);
    return res
      .status(400)
      .json({ ok: false, message: err?.message || "Lỗi cập nhật trạng thái (admin)" });
  }
};

/* =================================
 * ADMIN: PAYMENTS (thêm/chỉnh tay)
 * ================================= */

/**
 * POST /api/preorders/:id/admin-add-payment
 * Body: { kind: 'deposit'|'remaining'|'refund'|'adjustment', amount, provider?, intentId?, status? }
 * - Thêm một bản ghi thanh toán thủ công vào đơn.
 * - Nếu đơn đã "cancelled" hoặc "delivered" thì chỉ cho phép 'refund' (còn lại bị chặn).
 */
export const adminAddPayment = async (req, res) => {
  try {
    const { id } = req.params;
    let { kind, amount, provider, intentId, status } = req.body || {};

    kind = String(kind || "").trim();
    const allowedKinds = ["deposit", "remaining", "refund", "adjustment"];
    if (!allowedKinds.includes(kind)) {
      return res.status(400).json({ ok: false, message: "Loại thanh toán không hợp lệ" });
    }

    const nAmount = Number(amount);
    if (!Number.isFinite(nAmount) || nAmount <= 0) {
      return res.status(400).json({ ok: false, message: "Số tiền không hợp lệ" });
    }

    status = status || "succeeded";
    const allowedStatuses = ["pending", "succeeded", "failed", "canceled"];
    if (!allowedStatuses.includes(status)) status = "succeeded";

    const p = await Preorder.findById(id);
    if (!p) return res.status(404).json({ ok: false, message: "Không tìm thấy đơn đặt trước" });

    if (["cancelled", "delivered"].includes(p.status) && kind !== "refund") {
      return res.status(400).json({ ok: false, message: "Trạng thái hiện tại chỉ cho phép hoàn tiền" });
    }

    p.payments = Array.isArray(p.payments) ? p.payments : [];
    p.payments.push({
      kind,
      provider: provider || "manual",
      intentId: intentId || null,
      amount: nAmount,
      status,
      meta: { source: "admin_manual" },
      at: new Date(),
    });

    await recomputeAndAutoTransition(p);

    return res.json({ ok: true, message: "Đã thêm bản ghi thanh toán", data: p });
  } catch (err) {
    console.error("[adminAddPayment] ERROR:", err);
    return res.status(400).json({ ok: false, message: err?.message || "Lỗi thêm thanh toán" });
  }
};

/**
 * PATCH /api/preorders/:id/admin-mark-deposit-paid
 * Body: { amount? }
 * - Nếu không truyền amount: tự lấy phần còn thiếu để đủ cọc (depositDue - depositPaid).
 * - Thêm 1 payment kind='deposit', status='succeeded'.
 */
export const adminMarkDepositPaid = async (req, res) => {
  try {
    const { id } = req.params;
    let { amount } = req.body || {};

    const p = await Preorder.findById(id);
    if (!p) return res.status(404).json({ ok: false, message: "Không tìm thấy đơn đặt trước" });

    // Không cho thao tác nếu đã cancelled hoặc delivered
    if (["cancelled", "delivered"].includes(p.status)) {
      return res.status(400).json({ ok: false, message: "Không thể cập nhật thanh toán ở trạng thái hiện tại" });
    }

    // đảm bảo số liệu trước khi tính
    if (typeof p.recalcTotals === "function") p.recalcTotals();

    const needed = Math.max(0, Number(p.depositDue || 0) - Number(p.depositPaid || 0));
    const amt = amount == null ? needed : Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ ok: false, message: "Số tiền không hợp lệ" });
    }

    p.payments = Array.isArray(p.payments) ? p.payments : [];
    p.payments.push({
      kind: "deposit",
      provider: "manual",
      intentId: null,
      amount: amt,
      status: "succeeded",
      meta: { source: "admin_mark_deposit_paid" },
      at: new Date(),
    });

    await recomputeAndAutoTransition(p);

    return res.json({ ok: true, message: "Đã ghi nhận thanh toán cọc", data: p });
  } catch (err) {
    console.error("[adminMarkDepositPaid] ERROR:", err);
    return res.status(400).json({ ok: false, message: err?.message || "Lỗi ghi nhận cọc" });
  }
};

/**
 * PATCH /api/preorders/:id/admin-mark-paid-in-full
 * Body: { amount? }
 * - Nếu không truyền amount: tự thu phần còn lại (remainingDue).
 * - Thêm 1 payment kind='remaining', status='succeeded'.
 */
export const adminMarkPaidInFull = async (req, res) => {
  try {
    const { id } = req.params;
    let { amount } = req.body || {};

    const p = await Preorder.findById(id);
    if (!p) return res.status(404).json({ ok: false, message: "Không tìm thấy đơn đặt trước" });

    // Không cho thao tác nếu đã cancelled hoặc delivered
    if (["cancelled", "delivered"].includes(p.status)) {
      return res.status(400).json({ ok: false, message: "Không thể cập nhật thanh toán ở trạng thái hiện tại" });
    }

    // đảm bảo số liệu trước khi tính
    if (typeof p.recalcTotals === "function") p.recalcTotals();

    const remaining = Math.max(0, Number(p.remainingDue || 0));
    const amt = amount == null ? remaining : Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ ok: false, message: "Số tiền không hợp lệ" });
    }

    p.payments = Array.isArray(p.payments) ? p.payments : [];
    p.payments.push({
      kind: "remaining",
      provider: "manual",
      intentId: null,
      amount: amt,
      status: "succeeded",
      meta: { source: "admin_mark_paid_in_full" },
      at: new Date(),
    });

    await recomputeAndAutoTransition(p);

    return res.json({ ok: true, message: "Đã ghi nhận thanh toán toàn bộ", data: p });
  } catch (err) {
    console.error("[adminMarkPaidInFull] ERROR:", err);
    return res.status(400).json({ ok: false, message: err?.message || "Lỗi ghi nhận thanh toán đầy đủ" });
  }
};
