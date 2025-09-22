// server/controllers/preorder.controller.js
import Product from "../models/product.model.js";
import Preorder from "../models/preorder.model.js";

const WHERE = "[preorder.controller]";

/* =================================
 * Chuẩn hoá & hằng số trạng thái (1 chiều)
 * ================================= */
function normalizeStatus(s) {
  if (!s) return "pending_payment";
  const v = String(s || "").trim();
  if (!v) return "pending_payment";
  if (v === "pending-payment") return "pending_payment";
  return v;
}

// Flow 1 chiều: chỉ tiến lên, không lùi
const STATUS_FLOW = ["pending_payment", "confirmed", "shipping", "delivered"];
const RANK = STATUS_FLOW.reduce((m, s, i) => ((m[s] = i), m), {});
function canForwardOnly(prev, next) {
  if (next === "cancelled") return prev !== "delivered";
  if (!(next in RANK) || !(prev in RANK)) return false;
  return RANK[next] > RANK[prev];
}

// Shipping flow chi tiết giống sàn
const SHIPPING_ALLOWED = new Set([
  "awaiting_pickup",     // Chờ lấy hàng
  "picked_up",           // Đã lấy hàng
  "in_transit",          // Đang trung chuyển
  "out_for_delivery",    // Đang giao
  "delivered_success",   // Giao thành công (hãng VC xác nhận)
  "delivery_failed",     // Giao thất bại
  "returned_to_seller",  // Hoàn về
]);
const SHIPPING_TS_KEY = {
  awaiting_pickup: "awaitingPickupAt",
  picked_up: "pickedUpAt",
  in_transit: "inTransitAt",
  out_for_delivery: "outForDeliveryAt",
  delivered_success: "deliveredSuccessAt",
  delivery_failed: "deliveryFailedAt",
  returned_to_seller: "returnedToSellerAt",
};

/* ====== RETURN / REFUND flow ====== */
const RETURN_FLOW_SEQ = [
  "return_requested",
  "return_approved",
  "return_awaiting_pickup",
  "return_picked_up",
  "return_in_transit",
  "return_received",
  "refund_issued",
  "return_rejected",
];
const RETURN_RANK = RETURN_FLOW_SEQ.reduce((m, s, i) => ((m[s] = i), m), {});
const RETURN_SHIP_NEXT = {
  return_approved: "return_awaiting_pickup",
  return_awaiting_pickup: "return_picked_up",
  return_picked_up: "return_in_transit",
  return_in_transit: "return_received",
};
const RETURN_SHIP_MAP = {
  return_awaiting_pickup: "awaitingPickupAt",
  return_picked_up: "pickedUpAt",
  return_in_transit: "inTransitAt",
  return_received: "receivedAt",
};
function canForwardReturn(prev, next) {
  if (!(prev in RETURN_RANK) || !(next in RETURN_RANK)) return false;
  return RETURN_RANK[next] > RETURN_RANK[prev];
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
  if (typeof preorderDoc.applyStatusByShipping === "function") preorderDoc.applyStatusByShipping();
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

/** Ghi mốc timeline theo status (bộ trạng thái chính) */
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
    type, // ví dụ: 'ready_flag', 'converted', 'auto_completed'
    at: new Date(),
    ...payload, // { by, note, orderRef, ... }
  });
}

/** Lấy mốc auto-complete (3 ngày sau deliveredAt) — dùng virtual nếu có, fallback nếu chưa */
function getAutoCompleteAt(preorder) {
  if (preorder.autoCompleteAt) return preorder.autoCompleteAt;
  const t = preorder?.timeline?.deliveredAt;
  if (!t) return null;
  const d = new Date(t);
  d.setDate(d.getDate() + 3);
  return d;
}

/** Tự đánh dấu auto-complete (flag) nếu đủ điều kiện */
async function maybeAutoComplete(preorder) {
  try {
    if (preorder.status !== "delivered") return preorder;
    const isDisputeOpen = !!preorder?.dispute?.isOpen;
    const isReturnOpen = !!preorder?.returnFlow?.isOpen;
    if (isDisputeOpen || isReturnOpen) return preorder;

    const autoAt = getAutoCompleteAt(preorder);
    if (!autoAt) return preorder;

    const now = new Date();
    if (now >= autoAt) {
      const was = preorder?.meta?.autoCompleted === true;
      if (!was) {
        preorder.meta = preorder.meta || {};
        preorder.meta.autoCompleted = true;
        appendHistory(preorder, "auto_completed", { note: "Tự động hoàn tất sau 3 ngày" });
        await preorder.save();
      }
    }
    return preorder;
  } catch (e) {
    console.warn(WHERE, "maybeAutoComplete warning:", e?.message || e);
    return preorder;
  }
}

/* =================================
 * CREATE (User)
 * ================================= */
export const createPreorder = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const origin = req.headers["x-preorder-origin"] || "unknown";
    const { productId, variant, qty, payMethod = "deposit" } = req.body || {};

    if (!userId) return res.status(401).json({ ok: false, message: "Không có quyền" });
    if (!productId || !qty || Number(qty) <= 0) {
      return res.status(400).json({ ok: false, message: "Thiếu dữ liệu sản phẩm hoặc số lượng" });
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
    if (!userId) return res.status(401).json({ ok: false, message: "Không có quyền" });

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
      .json({ ok: false, message: err?.message || "Lỗi tải danh sách đặt trước" });
  }
};

/* =================================
 * DETAIL (User + Admin bypass)
 * ================================= */
export const getPreorderDetail = async (req, res) => {
  try {
    const isAdmin = !!(req.user?.role === "admin" || req.user?.isAdmin === true);
    const userId = req.user?.id || req.user?._id;
    const { id } = req.params;

    const base = isAdmin
      ? { _id: id, isDeleted: { $ne: true } }
      : { _id: id, user: userId, isDeleted: { $ne: true }, userHidden: { $ne: true } };

    const doc = await Preorder.findOne(base).populate({
      path: "product",
      select: "name images baseVariant",
    });

    if (!doc) return res.status(404).json({ ok: false, message: "Không tìm thấy đơn đặt trước" });
    return res.json({ ok: true, preorder: doc });
  } catch (err) {
    console.error("[getPreorderDetail] ERROR:", err);
    return res
      .status(400)
      .json({ ok: false, message: err?.message || "Lỗi lấy chi tiết đơn đặt trước" });
  }
};

/* (Tuỳ chọn) Admin-only detail để FE gọi /:id/admin */
export const getAdminPreorderDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const p = await Preorder.findById(id)
      .populate({ path: "product", select: "name images baseVariant" });
    if (!p) return res.status(404).json({ ok: false, message: "Không tìm thấy đơn đặt trước" });
    return res.json({ ok: true, data: p });
  } catch (err) {
    console.error("[getAdminPreorderDetail] ERROR:", err);
    return res.status(400).json({ ok: false, message: err?.message || "Lỗi lấy chi tiết (admin)" });
  }
};

/* =================================
 * RECALC (Admin/User) + Auto-complete
 * ================================= */
export const recalcPreorder = async (req, res) => {
  try {
    const { id } = req.params;
    const p = await Preorder.findById(id);
    if (!p) return res.status(404).json({ ok: false, message: "Không tìm thấy đơn đặt trước" });

    await recomputeAndAutoTransition(p);
    await maybeAutoComplete(p);

    return res.json({ ok: true, message: "Đã tính lại & đồng bộ trạng thái", data: p });
  } catch (err) {
    console.error("[recalcPreorder] ERROR:", err);
    return res
      .status(400)
      .json({ ok: false, message: err?.message || "Lỗi đồng bộ trạng thái" });
  }
};

/* =================================
 * ADMIN LIST (tối ưu tìm kiếm)
 * ================================= */
export const listAdminPreorders = async (req, res) => {
  try {
    const { status, q = "", page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Math.min(100, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Ẩn các bản ghi đã xóa mềm trong admin
    const baseMatch = { isDeleted: { $ne: true } };
    if (status && status !== "all") baseMatch.status = status;

    const searchMatch = q
      ? {
          $or: [
            { customId: { $regex: q, $options: "i" } },
            { "productDoc.name": { $regex: q, $options: "i" } },
            { "userDoc.email": { $regex: q, $options: "i" } },
            { "userDoc.username": { $regex: q, $options: "i" } },
            { "userDoc.name": { $regex: q, $options: "i" } },
          ],
        }
      : {};

    const pipeline = [
      { $match: baseMatch },
      {
        $lookup: {
          from: "products",
          localField: "product",
          foreignField: "_id",
          as: "productDoc",
        },
      },
      { $unwind: { path: "$productDoc", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "userDoc",
        },
      },
      { $unwind: { path: "$userDoc", preserveNullAndEmptyArrays: true } },
      ...(q ? [{ $match: searchMatch }] : []),
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          items: [{ $skip: skip }, { $limit: limitNum }],
          totalCount: [{ $count: "total" }],
        },
      },
      {
        $project: {
          items: 1,
          total: { $ifNull: [{ $arrayElemAt: ["$totalCount.total", 0] }, 0] },
        },
      },
    ];

    const [agg] = await Preorder.aggregate(pipeline);
    const items = (agg?.items || []).map((it) => ({
      ...it,
      product: it.productDoc ? { _id: it.productDoc._id, name: it.productDoc.name } : null,
      user: it.userDoc
        ? {
            _id: it.userDoc._id,
            email: it.userDoc.email,
            username: it.userDoc.username,
            name: it.userDoc.name,
          }
        : null,
    }));

    return res.json({
      ok: true,
      items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: agg?.total || 0,
        pages: Math.ceil((agg?.total || 0) / limitNum) || 1,
      },
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
    const note = req.body?.note || "Đánh dấu sẵn sàng (ready)";
    appendHistory(p, "ready_flag", { by, note });

    await p.save();
    return res.json({ ok: true, message: "Đã ghi lịch sử: sẵn sàng giao", data: p });
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
      note: note || "Chuyển thành đơn hàng",
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
    if (!userId) return res.status(401).json({ ok: false, message: "Không có quyền" });

    const preorder = await Preorder.findOne({
      _id: id,
      user: userId,
      isDeleted: { $ne: true },
      userHidden: { $ne: true },
    }).populate({ path: "product", select: "preorder name" });
    if (!preorder) return res.status(404).json({ ok: false, message: "Không tìm thấy đơn đặt trước" });

    // ❗User không thể hủy nếu đang shipping, đã giao hoặc đã hủy
    const blocked = ["shipping", "delivered", "cancelled"];
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
    preorder.refundAmount = Math.max(0, depositPaid - (preorder.fees.cancelFee || 0));

    preorder.status = "cancelled";
    preorder.timeline = preorder.timeline || {};
    preorder.timeline.cancelledAt = now;

    // Ẩn với user, NHƯNG KHÔNG xóa khỏi admin
    preorder.userHidden = true;

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
 * ================================= */
export const userHidePreorder = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ ok: false, message: "Không có quyền" });

    const p = await Preorder.findOne({
      _id: id,
      user: userId,
      isDeleted: { $ne: true },
    });
    if (!p) return res.status(404).json({ ok: false, message: "Không tìm thấy đơn đặt trước" });

    if (!["delivered", "cancelled"].includes(p.status)) {
      return res.status(400).json({ ok: false, message: "Chỉ có thể xoá đơn đã giao hoặc đã hủy" });
    }

    p.userHidden = true; // ẩn với user
    await p.save();

    return res.json({ ok: true, message: "Đã xoá đơn đặt trước khỏi lịch sử" });
  } catch (err) {
    console.error("[userHidePreorder] ERROR:", err);
    return res.status(400).json({ ok: false, message: err?.message || "Xóa đơn thất bại" });
  }
};

/* =================================
 * ADMIN: CANCEL (hủy tay)
 * ================================= */
export const adminCancelPreorder = async (req, res) => {
  try {
    const { id } = req.params;

    const preorder = await Preorder.findById(id).populate({
      path: "product",
      select: "preorder name",
    });
    if (!preorder) return res.status(404).json({ ok: false, message: "Không tìm thấy đơn đặt trước" });

    // (Giữ nguyên) Admin có thể hủy trừ khi đã delivered/cancelled
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
    preorder.refundAmount = Math.max(0, depositPaid - (preorder.fees.cancelFee || 0));

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
 *  - Chỉ cho phép xóa khi đã "cancelled"
 * ================================= */
export const adminDeletePreorder = async (req, res) => {
  try {
    const { id } = req.params;
    const p = await Preorder.findById(id);
    if (!p) return res.status(404).json({ ok: false, message: "Không tìm thấy đơn đặt trước" });

    if (p.status !== "cancelled") {
      return res.status(400).json({ ok: false, message: "Chỉ xoá được đơn đã hủy" });
    }

    p.isDeleted = true;
    await p.save();

    return res.json({ ok: true, message: "Đã xoá đơn đặt trước", data: p });
  } catch (err) {
    console.error("[adminDeletePreorder] ERROR:", err);
    return res.status(400).json({ ok: false, message: err?.message || "Xoá đơn thất bại" });
  }
};

/* =================================
 * ADMIN: SET STATUS (thủ công) — 1 CHIỀU
 * Body: { status, reason? }
 * ❶ Sang 'confirmed' chỉ khi đủ tiền cọc.
 * ❷ Sang 'delivered' chỉ khi đã thanh toán toàn bộ.
 * ================================= */
export const adminSetStatus = async (req, res) => {
  try {
    const { id } = req.params;
    let { status, reason } = req.body || {};
    status = normalizeStatus(status);

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

    // Khoá nếu đã delivered/cancelled
    if (["delivered", "cancelled"].includes(prev)) {
      return res
        .status(400)
        .json({ ok: false, message: "Không thể cập nhật từ trạng thái hiện tại" });
    }

    // Chỉ cho tiến lên (hoặc huỷ)
    if (!canForwardOnly(prev, status)) {
      return res.status(400).json({ ok: false, message: "Chỉ được chuyển tiếp theo thứ tự trạng thái" });
    }

    // Luôn recalc trước khi kiểm tra điều kiện tiền
    if (typeof p.recalcTotals === "function") p.recalcTotals();

    // ❗ Điều kiện mới:
    if (status === "confirmed" && Number(p.depositPaid || 0) < Number(p.depositDue || 0)) {
      return res.status(400).json({ ok: false, message: "Chưa nhận đủ tiền cọc để xác nhận đơn hàng" });
    }
    if (status === "delivered" && Number(p.remainingDue || 0) > 0) {
      return res.status(400).json({ ok: false, message: "Chưa thanh toán đủ để chuyển sang đã giao hàng" });
    }

    // Ghi note admin nếu có
    if (reason) {
      p.internalNote = [p.internalNote, `[ADMIN] ${new Date().toLocaleString("vi-VN")}: ${reason}`]
        .filter(Boolean)
        .join("\n");
    }

    p.status = status;
    stampTimelineByStatus(p, status);

    if (typeof p.recalcTotals === "function") p.recalcTotals();
    await p.save();

    await adjustQuotaOnStatusChange(p, prev, status);
    await recomputeAndAutoTransition(p);
    await maybeAutoComplete(p);

    return res.json({ ok: true, message: "Đã cập nhật trạng thái", data: p });
  } catch (err) {
    console.error("[adminSetStatus] ERROR:", err);
    return res.status(400).json({ ok: false, message: err?.message || "Lỗi cập nhật trạng thái (admin)" });
  }
};

/* =================================
 * ADMIN: CẬP NHẬT TRẠNG THÁI VẬN CHUYỂN (giống sàn) — 1 CHIỀU
 * PATCH /api/preorders/:id/admin-shipping-status
 * Body: { status: one-of SHIPPING_ALLOWED, raw? }
 * - Khi status='delivered_success' → CHỈ set 'delivered' nếu đã thanh toán đủ (remainingDue=0).
 * ================================= */
export const adminUpdateShippingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, raw } = req.body || {};

    if (!SHIPPING_ALLOWED.has(status)) {
      return res.status(400).json({ ok: false, message: "Trạng thái vận chuyển không hợp lệ" });
    }

    const p = await Preorder.findById(id);
    if (!p) return res.status(404).json({ ok: false, message: "Không tìm thấy đơn đặt trước" });

    // luôn recalc để có remainingDue chính xác
    if (typeof p.recalcTotals === "function") p.recalcTotals();

    // Cập nhật shipping raw/timeline
    p.shippingFlow = p.shippingFlow || { timeline: {} };
    p.shippingFlow.status = status;
    p.shippingFlow.raw = raw || p.shippingFlow.raw || {};

    const now = new Date();
    const k = SHIPPING_TS_KEY[status];
    if (k) {
      p.shippingFlow.timeline = p.shippingFlow.timeline || {};
      if (!p.shippingFlow.timeline[k]) p.shippingFlow.timeline[k] = now;
    }

    let msg = "Đã cập nhật trạng thái vận chuyển";

    // Nếu hãng VC báo "giao thành công"
    if (status === "delivered_success") {
      if (!["delivered", "cancelled"].includes(p.status)) {
        // Chỉ set delivered khi đã thanh toán đủ
        if (Number(p.remainingDue || 0) === 0) {
          const prev = p.status;
          p.status = "delivered";
          stampTimelineByStatus(p, "delivered");
          await adjustQuotaOnStatusChange(p, prev, "delivered");
          msg = "Giao thành công & đã chuyển đơn sang ĐÃ GIAO (đã thanh toán đủ)";
        } else {
          msg = "Giao thành công từ hãng VC, nhưng CHƯA thanh toán đủ nên chưa chuyển sang ĐÃ GIAO";
        }
      }
    }

    await recomputeAndAutoTransition(p);
    await maybeAutoComplete(p);

    return res.json({ ok: true, message: msg, data: p });
  } catch (err) {
    console.error("[adminUpdateShippingStatus] ERROR:", err);
    return res.status(400).json({ ok: false, message: err?.message || "Lỗi cập nhật vận chuyển" });
  }
};

/* =================================
 * TRANH CHẤP: MỞ / ĐÓNG
 * ================================= */
export const disputeOpen = async (req, res) => {
  try {
    const { id } = req.params;
    const p = await Preorder.findById(id);
    if (!p) return res.status(404).json({ ok: false, message: "Không tìm thấy đơn đặt trước" });

    p.dispute = p.dispute || {};
    if (!p.dispute.isOpen) {
      p.dispute.isOpen = true;
      p.dispute.openedAt = new Date();
      appendHistory(p, "dispute_open", { note: "Mở tranh chấp" });
      await p.save();
    }

    return res.json({ ok: true, message: "Đã mở tranh chấp", data: p });
  } catch (err) {
    console.error("[disputeOpen] ERROR:", err);
    return res.status(400).json({ ok: false, message: err?.message || "Lỗi mở tranh chấp" });
  }
};

export const disputeClose = async (req, res) => {
  try {
    const { id } = req.params;
    const p = await Preorder.findById(id);
    if (!p) return res.status(404).json({ ok: false, message: "Không tìm thấy đơn đặt trước" });

    p.dispute = p.dispute || {};
    if (p.dispute.isOpen) {
      p.dispute.isOpen = false;
      p.dispute.closedAt = new Date();
      appendHistory(p, "dispute_close", { note: "Đóng tranh chấp" });
      await p.save();
      // Sau khi đóng tranh chấp, nếu đã delivered đủ 3 ngày → auto-complete
      await maybeAutoComplete(p);
    }

    return res.json({ ok: true, message: "Đã đóng tranh chấp", data: p });
  } catch (err) {
    console.error("[disputeClose] ERROR:", err);
    return res.status(400).json({ ok: false, message: err?.message || "Lỗi đóng tranh chấp" });
  }
};

/* =================================
 * RETURN / REFUND (sau khi delivered) — Luồng độc lập
 * ================================= */

// 1) KH gửi yêu cầu trả hàng
export const returnRequest = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { id } = req.params;

    // FE gửi: { reason, note, images, qty, preferredResolution, phone }
    const {
      reason,
      note,
      images = [],
      qty,
      preferredResolution,
      phone,
    } = req.body || {};

    const p = await Preorder.findOne({ _id: id, user: userId, isDeleted: { $ne: true } });
    if (!p) return res.status(404).json({ ok:false, message: "Không tìm thấy đơn" });

    if (p.status !== "delivered")
      return res.status(400).json({ ok:false, message: "Chỉ yêu cầu trả hàng khi đơn đã giao" });

    p.returnFlow = p.returnFlow || {};
    if (p.returnFlow.isOpen)
      return res.status(400).json({ ok:false, message: "Đơn đang có yêu cầu trả hàng" });

    // validate qty (tùy sản phẩm có thể cho đổi/trả 1 phần)
    let requestedQty = Number(qty || p.qty || 1);
    if (!Number.isFinite(requestedQty) || requestedQty < 1) requestedQty = 1;
    requestedQty = Math.min(requestedQty, Number(p.qty || 1));

    // lưu thông tin yêu cầu (các field mở rộng để vào raw cho khớp schema)
    p.returnFlow.isOpen = true;
    p.returnFlow.status = "return_requested";
    p.returnFlow.reason = reason || null;
    p.returnFlow.customerNote = note || null;
    p.returnFlow.evidenceImages = Array.isArray(images) ? images.slice(0, 10) : [];
    p.returnFlow.raw = {
      ...(p.returnFlow.raw || {}),
      requestedQty,
      preferredResolution: preferredResolution || "refund",
      customerPhone: phone || null,
    };
    p.returnFlow.timeline = p.returnFlow.timeline || {};
    p.returnFlow.timeline.requestedAt = new Date();

    appendHistory(p, "return_requested", { note: reason || note });

    await p.save();
    return res.json({ ok:true, message: "Đã gửi yêu cầu trả hàng", data: p });
  } catch (e) {
    console.error("[returnRequest] ERROR:", e);
    return res.status(400).json({ ok:false, message: e?.message || "Lỗi yêu cầu trả hàng" });
  }
};

// 2) Admin duyệt
export const returnApprove = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNote, feeDeduction = 0, carrier, trackingCode } = req.body || {};

    const p = await Preorder.findById(id);
    if (!p) return res.status(404).json({ ok:false, message: "Không tìm thấy đơn" });
    if (p.status !== "delivered") return res.status(400).json({ ok:false, message: "Đơn chưa giao xong" });

    p.returnFlow = p.returnFlow || {};
    if (!p.returnFlow.isOpen || p.returnFlow.status !== "return_requested")
      return res.status(400).json({ ok:false, message: "Trạng thái không hợp lệ để duyệt" });

    p.returnFlow.status = "return_approved";
    p.returnFlow.adminNote = adminNote || null;
    p.returnFlow.timeline = p.returnFlow.timeline || {};
    p.returnFlow.timeline.approvedAt = new Date();
    p.returnFlow.feeDeduction = Math.max(0, Number(feeDeduction)||0);
    p.returnFlow.carrier = carrier || p.returnFlow.carrier || null;
    p.returnFlow.trackingCode = trackingCode || p.returnFlow.trackingCode || null;

    appendHistory(p, "return_approved", { note: adminNote });

    await p.save();
    return res.json({ ok:true, message:"Đã duyệt yêu cầu trả hàng", data:p });
  } catch (e) {
    console.error("[returnApprove] ERROR:", e);
    return res.status(400).json({ ok:false, message: e?.message || "Lỗi duyệt trả hàng" });
  }
};

// 2b) Admin từ chối
export const returnReject = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNote } = req.body || {};
    const p = await Preorder.findById(id);
    if (!p) return res.status(404).json({ ok:false, message: "Không tìm thấy đơn" });

    p.returnFlow = p.returnFlow || {};
    if (!p.returnFlow.isOpen || p.returnFlow.status !== "return_requested")
      return res.status(400).json({ ok:false, message: "Trạng thái không hợp lệ để từ chối" });

    p.returnFlow.status = "return_rejected";
    p.returnFlow.adminNote = adminNote || null;
    p.returnFlow.timeline = p.returnFlow.timeline || {};
    p.returnFlow.timeline.rejectedAt = new Date();
    p.returnFlow.isOpen = false; // đóng luồng

    appendHistory(p, "return_rejected", { note: adminNote });

    await p.save();
    return res.json({ ok:true, message:"Đã từ chối yêu cầu trả hàng", data:p });
  } catch (e) {
    console.error("[returnReject] ERROR:", e);
    return res.status(400).json({ ok:false, message: e?.message || "Lỗi từ chối trả hàng" });
  }
};

// 3) Admin cập nhật vận chuyển chiều ngược
export const returnUpdateShipping = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, carrier, trackingCode, raw } = req.body || {};

    if (!RETURN_SHIP_MAP[status]) {
      return res.status(400).json({ ok:false, message: "Trạng thái vận chuyển trả hàng không hợp lệ" });
    }

    const p = await Preorder.findById(id);
    if (!p) return res.status(404).json({ ok:false, message: "Không tìm thấy đơn" });

    p.returnFlow = p.returnFlow || {};
    if (!p.returnFlow.isOpen)
      return res.status(400).json({ ok:false, message: "Không có yêu cầu trả hàng đang mở" });

    // Chỉ cho đi tới next hợp lệ
    const cur = p.returnFlow.status || "return_approved";
    const nextExpected = RETURN_SHIP_NEXT[cur] || cur;
    if (status !== nextExpected && !canForwardReturn(cur, status)) {
      return res.status(400).json({ ok:false, message: "Không thể chuyển trạng thái vận chuyển hiện tại" });
    }

    p.returnFlow.status = status;
    p.returnFlow.carrier = carrier || p.returnFlow.carrier || null;
    p.returnFlow.trackingCode = trackingCode || p.returnFlow.trackingCode || null;
    p.returnFlow.timeline = p.returnFlow.timeline || {};
    const key = RETURN_SHIP_MAP[status];
    if (key && !p.returnFlow.timeline[key]) p.returnFlow.timeline[key] = new Date();
    p.returnFlow.raw = { ...(p.returnFlow.raw || {}), ...(raw || {}) };

    appendHistory(p, "return_shipping_update", { note: status });

    await p.save();
    return res.json({ ok:true, message:"Đã cập nhật vận chuyển trả hàng", data:p });
  } catch (e) {
    console.error("[returnUpdateShipping] ERROR:", e);
    return res.status(400).json({ ok:false, message: e?.message || "Lỗi cập nhật vận chuyển trả hàng" });
  }
};

// 4) Admin thực hiện hoàn tiền (kết sổ)
export const returnRefundIssue = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, adminNote } = req.body || {};

    const p = await Preorder.findById(id);
    if (!p) return res.status(404).json({ ok:false, message: "Không tìm thấy đơn" });

    p.returnFlow = p.returnFlow || {};
    if (!p.returnFlow.isOpen)
      return res.status(400).json({ ok:false, message: "Không có yêu cầu trả hàng đang mở" });

    // Chỉ cho hoàn tiền sau khi return_received
    if (p.returnFlow.status !== "return_received") {
      return res.status(400).json({ ok:false, message: "Chỉ hoàn tiền sau khi đã nhận lại hàng" });
    }

    const nAmt = Number(amount);
    if (!Number.isFinite(nAmt) || nAmt < 0) {
      return res.status(400).json({ ok:false, message: "Số tiền hoàn không hợp lệ" });
    }

    // Tổng đã thanh toán (được tính) trừ đi phí khấu trừ và các khoản refund đã ghi trước đó
    const totalPaid = (p.payments || []).reduce(
      (s, x) =>
        x.status === "succeeded" && ["deposit", "remaining", "adjustment"].includes(x.kind)
          ? s + Number(x.amount || 0)
          : s,
      0
    );
    const refundedSoFar = (p.payments || []).reduce(
      (s, x) => (x.status === "succeeded" && x.kind === "refund" ? s + Number(x.amount || 0) : s),
      0
    );
    const fee = Math.max(0, Number(p.returnFlow.feeDeduction || 0));
    const maxRefund = Math.max(0, totalPaid - fee - refundedSoFar);
    const refundAmount = Math.min(nAmt, maxRefund);

    // Ghi payment hoàn tiền
    p.payments = Array.isArray(p.payments) ? p.payments : [];
    p.payments.push({
      kind: "refund",
      provider: "manual",
      intentId: null,
      amount: refundAmount,
      status: "succeeded",
      meta: { source: "admin_return_refund" },
      at: new Date(),
    });

    // Cập nhật returnFlow
    p.returnFlow.refundAmount = (Number(p.returnFlow.refundAmount || 0) + refundAmount);
    p.returnFlow.status = "refund_issued";
    p.returnFlow.timeline = p.returnFlow.timeline || {};
    p.returnFlow.timeline.refundIssuedAt = new Date();
    p.returnFlow.timeline.closedAt = new Date();
    p.returnFlow.adminNote = adminNote || p.returnFlow.adminNote || null;
    p.returnFlow.isOpen = false;

    appendHistory(p, "return_refund_issued", { note: `Hoàn ${refundAmount}₫` });

    await recomputeAndAutoTransition(p);
    await maybeAutoComplete(p);
    return res.json({ ok:true, message:"Đã hoàn tiền và đóng yêu cầu trả hàng", data:p });
  } catch (e) {
    console.error("[returnRefundIssue] ERROR:", e);
    return res.status(400).json({ ok:false, message: e?.message || "Lỗi hoàn tiền trả hàng" });
  }
};

/* =================================
 * ADMIN: THANH TOÁN — CHỈ 2 HÀNH ĐỘNG
 * ================================= */

/**
 * PATCH /api/preorders/:id/admin-mark-deposit
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

    if (typeof p.recalcTotals === "function") p.recalcTotals();

    const needed = Math.max(0, Number(p.depositDue || 0) - Number(p.depositPaid || 0));
    const amt = amount == null ? needed : Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ ok: false, message: "Số tiền không hợp lệ" });
    }

    // Ghi payment tối thiểu để recalcTotals hoạt động đúng
    p.payments = Array.isArray(p.payments) ? p.payments : [];
    p.payments.push({
      kind: "deposit",
      provider: "manual",
      intentId: null,
      amount: amt,
      status: "succeeded",
      meta: { source: "admin_mark_deposit" },
      at: new Date(),
    });

    // Nếu đang 'pending_payment' → tự đẩy sang 'confirmed'
    if (p.status === "pending_payment") {
      const prev = p.status;
      p.status = "confirmed";
      stampTimelineByStatus(p, "confirmed");
      await adjustQuotaOnStatusChange(p, prev, "confirmed");
    }

    await recomputeAndAutoTransition(p);
    await maybeAutoComplete(p);

    return res.json({ ok: true, message: "Đã ghi nhận thanh toán cọc", data: p });
  } catch (err) {
    console.error("[adminMarkDepositPaid] ERROR:", err);
    return res.status(400).json({ ok: false, message: err?.message || "Lỗi ghi nhận cọc" });
  }
};

/**
 * PATCH /api/preorders/:id/admin-mark-paid
 */
export const adminMarkPaidInFull = async (req, res) => {
  try {
    const { id } = req.params;
    let { amount } = req.body || {};

    const p = await Preorder.findById(id);
    if (!p) return res.status(404).json({ ok: false, message: "Không tìm thấy đơn đặt trước" });

    if (["cancelled", "delivered"].includes(p.status)) {
      return res.status(400).json({ ok: false, message: "Không thể cập nhật thanh toán ở trạng thái hiện tại" });
    }

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
    await maybeAutoComplete(p);

    return res.json({ ok: true, message: "Đã ghi nhận thanh toán toàn bộ", data: p });
  } catch (err) {
    console.error("[adminMarkPaidInFull] ERROR:", err);
    return res.status(400).json({ ok: false, message: err?.message || "Lỗi ghi nhận thanh toán đầy đủ" });
  }
};
