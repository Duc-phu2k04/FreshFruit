// src/controllers/order.controller.js
import * as orderService from "../services/order.service.js";
import voucherService from "../services/voucher.service.js";
import Order from "../models/order.model.js";
import Address from "../models/address.model.js";
import Product from "../models/product.model.js";
import mongoose from "mongoose";
import { quoteShipping } from "../services/shipping.service.js";
import { computeExpiryInfo } from "../utils/expiryHelpers.js";

// ✅ DÙNG CHUNG logic tồn kho cho variant/combo + rollback
import {
  decOneStockNonTx,
  rollbackOneStock,
  kgFromWeight,            // dùng parse kg từ text
  findOneKgVariant,        // chọn biến thể 1kg nếu có
} from "../services/inventory.service.js";

/* -----------------------------------------------------------
 * DEBUG helpers
 * ---------------------------------------------------------*/
const ORDER_DEBUG =
  String(process.env.ORDER_DEBUG || "").trim() === "1" ||
  (process.env.NODE_ENV && process.env.NODE_ENV !== "production" && process.env.ORDER_DEBUG !== "0");

function makeReqId() {
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${Date.now().toString(36)}-${rnd}`;
}
function dbg(tag, obj) {
  if (!ORDER_DEBUG) return;
  const safe = (() => {
    try { return JSON.stringify(obj, null, 2); } catch { return String(obj); }
  })();
  console.log(`[ORDER_DEBUG][${tag}]`, safe);
}
function briefItem(it) {
  return {
    t: it?.type || (it?.isMix ? "mix" : it?.isCombo ? "combo" : "variant"),
    product: String(it?.product || ""),
    isMix: !!it?.isMix,
    isCombo: !!it?.isCombo,
    variant: it?.variant || null,
    variantId: it?.variantId || null,
    qty: it?.quantity,
    line: it?.lineTotal,
  };
}

/* -----------------------------------------------------------
 * Helpers nội bộ
 * ---------------------------------------------------------*/
function toWebRelativePath(raw) {
  if (!raw) return null;
  let s = String(raw).trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;

  s = s.replace(/\\/g, "/");
  const idx = s.search(/\/(uploads|public)\//i);
  if (idx !== -1) s = s.slice(idx);
  if (s.startsWith("/public/")) s = s.replace(/^\/public\//i, "/");
  if (s.startsWith("public/")) s = s.replace(/^public\//i, "");
  if (!s.startsWith("/")) s = `/${s}`;
  return s;
}

function toAbsUrl(req, rawUrl) {
  if (!rawUrl) return null;
  if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
  const webRel = toWebRelativePath(rawUrl);
  if (!webRel) return null;
  const base = process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;
  return `${base}${webRel}`;
}

function normalizeEvidenceImage(req, img) {
  if (!img) return null;
  const pickUrl = (o) =>
    o?.secure_url || o?.url || o?.src || o?.Location || o?.location ||
    o?.path || o?.filepath || o?.filePath || o?.key || o?.filename || null;

  if (typeof img === "string") {
    const abs = toAbsUrl(req, img);
    return abs ? { url: abs, mime: undefined } : null;
  }
  if (typeof img === "object") {
    const raw = pickUrl(img);
    const mime = img?.mimetype || img?.mime || img?.type || undefined;
    const abs = toAbsUrl(req, raw);
    return abs ? { url: abs, mime } : null;
  }
  return null;
}

function collectEvidenceImages(req) {
  const fromBody = Array.isArray(req.body?.images) ? req.body.images : [];
  const fromFiles = Array.isArray(req.files)
    ? req.files.map((f) => ({ path: f.path || f.filename || f.key, mimetype: f.mimetype }))
    : [];
  return [...fromBody, ...fromFiles]
    .map((x) => normalizeEvidenceImage(req, x))
    .filter(Boolean)
    .slice(0, 10);
}

/* ---------- Resolve variant ---------- */
async function resolveVariant(productDoc, cartItem) {
  const p = productDoc?.toObject ? productDoc.toObject() : productDoc;
  if (!p) return { product: null, variant: null };

  let variant = null;

  if (cartItem?.variantId) {
    variant = p.variants?.find((v) => String(v._id) === String(cartItem.variantId)) || null;
  }
  if (!variant && cartItem?.variant) {
    const w = String(cartItem.variant.weight ?? "");
    const r = String(cartItem.variant.ripeness ?? "");
    variant =
      p.variants?.find(
        (v) =>
          String(v?.attributes?.weight ?? "") === w &&
          String(v?.attributes?.ripeness ?? "") === r
      ) || null;
  }
  if (!variant && p.baseVariant?.price != null) {
    variant = { ...p.baseVariant, __id: p.baseVariant?._id || "base" };
  }

  return { product: p, variant };
}

/* ---------- Snapshot VARIANT ---------- */
function buildVariantSnapshot(product, variant, cartItem) {
  const vPrice = Number(variant?.price ?? product?.baseVariant?.price ?? 0);
  const info = computeExpiryInfo(product, vPrice);

  if (info.expireAt && info.expireAt < new Date()) {
    const name = product?.name || "Sản phẩm";
    const err = new Error(`"${name}" đã hết hạn sử dụng`);
    err.code = "EXPIRED_PRODUCT";
    throw err;
  }

  const qty = Math.max(1, Number(cartItem?.quantity || 0)) || 1;
  const unitFinal = Number.isFinite(info.finalPrice) ? Number(info.finalPrice) : Number(vPrice);
  const unitBase = Number.isFinite(info.basePrice) ? Number(info.basePrice) : Number(vPrice);
  const line = Math.round(unitFinal * qty);

  return {
    type: "variant",
    product: product._id,
    productName: product.name,
    isCombo: false,
    isMix: false,
    variantId: variant?._id || null,
    variant: {
      weight: variant?.attributes?.weight || "",
      ripeness: variant?.attributes?.ripeness || "",
      grade: variant?.grade || "",
    },
    quantity: qty,
    unitPrice: Math.round(unitBase),
    unitPriceFinal: Math.round(unitFinal),
    price: Math.round(unitFinal),
    lineTotal: line,
    nearExpiryDiscountPercent: Number(info.discountPercent || 0),
    _expiry: {
      expireAt: info.expireAt || null,
      daysLeft: info.daysLeft ?? null,
    },
  };
}

/* ---------- Combo ---------- */
function isComboCartItem(ci) {
  const type = String(ci?.type || "").toLowerCase();
  const snap = ci?.snapshot || {};
  return type === "combo" || snap?.isCombo === true || Array.isArray(snap?.items);
}

function buildComboSnapshotForOrder(ci) {
  const qty = Math.max(1, Number(ci?.quantity || 0)) || 1;

  const snap = ci?.snapshot || {};
  const rawUnit = snap.unitPrice ?? ci?.unitPrice ?? 0;
  const unitPrice = Math.max(0, Number(rawUnit) || 0);
  const items =
    Array.isArray(snap.items) && snap.items.length
      ? snap.items.map((x) => ({
          productId: x.productId || x.id || null,
          qty: Math.max(1, Number(x.qty || x.quantity || 1)) || 1,
        }))
      : [];

  const line = Math.round(unitPrice * qty);

  return {
    type: "combo",
    // 🔧 đảm bảo có id combo cho inventory service
    product: ci?.productId || ci?.product || null,
    productName: snap.title || ci?.title || "Combo",
    isCombo: true,
    isMix: false,
    variantId: null,
    variant: null,
    combo: {
      title: snap.title || ci?.title || "Combo",
      image: snap.image || ci?.image || null,
      discountPercent: Number(snap.discountPercent || 0),
      items,
    },
    quantity: qty,
    unitPrice: Math.round(unitPrice),
    unitPriceFinal: Math.round(unitPrice),
    price: Math.round(unitPrice),
    lineTotal: line,
    nearExpiryDiscountPercent: 0,
    _expiry: null,
  };
}

/* ---------- Mix ---------- */
function isMixCartItem(ci) {
  return String(ci?.type || "").toLowerCase() === "mix" || Array.isArray(ci?.items);
}

async function buildMixSnapshotForOrder(ci) {
  const boxQty = Math.max(1, Number(ci?.quantity || 1));
  const rawEntries = Array.isArray(ci?.items) ? ci.items : [];

  const entries = rawEntries.map((x) => {
    const qty = Math.max(0, Number(x?.qty || 0));
    const unitPrice = Number(x?.unitPrice || 0);
    const pricePerKg = Number(x?.pricePerKg || 0);
    const weightGram = Math.max(0, Number(x?.weightGram || 0));
    const variantId = x?.variantId || null;

    let linePrice = Number(x?.linePrice || 0);
    if (!linePrice || linePrice < 0) {
      if (weightGram > 0 && pricePerKg > 0) {
        linePrice = Math.round((pricePerKg * (weightGram / 1000)) * qty);
      } else if (unitPrice > 0 && qty > 0) {
        linePrice = Math.round(unitPrice * qty);
      } else {
        linePrice = 0;
      }
    }

    return {
      product: x?.productId || null,
      productId: x?.productId || null,
      productName: "",
      qty,
      unitPrice,
      pricePerKg,
      weightGram,
      variantId,
      linePrice,
    };
  });

  const ids = [...new Set(entries.map((e) => String(e.productId || "")).filter(Boolean))];
  if (ids.length) {
    const nameDocs = await Product.find({ _id: { $in: ids } }, { name: 1 }).lean();
    const nameMap = new Map(nameDocs.map((d) => [String(d._id), d.name]));
    entries.forEach((e) => {
      const id = String(e.productId || "");
      if (id && !e.productName) e.productName = nameMap.get(id) || "";
    });
  }

  let totalPrice = Number(ci?.totalPrice || 0);
  if (!totalPrice || totalPrice < 0) {
    totalPrice = entries.reduce((s, e) => s + Number(e.linePrice || 0), 0);
  }
  totalPrice = Math.max(0, Math.round(totalPrice));

  const lineTotal = totalPrice * boxQty;

  const snap = {
    type: "mix",
    product: null,
    productName: "Giỏ Mix",
    isCombo: false,
    isMix: true,
    variantId: null,
    variant: null,
    mix: {
      items: entries,
      totalPrice,
      note: ci?.note || "",
    },
    quantity: boxQty,
    unitPrice: totalPrice,
    unitPriceFinal: totalPrice,
    price: totalPrice,
    lineTotal,
    nearExpiryDiscountPercent: 0,
    _expiry: null,
  };

  if (ORDER_DEBUG) {
    const kgEntries = entries
      .filter((e) => Number(e.weightGram) > 0 && Number(e.qty) > 0)
      .map((e) => ({
        productId: e.productId,
        productName: e.productName,
        qty: e.qty,
        weightGram: e.weightGram,
        totalKg: (e.weightGram / 1000) * e.qty * boxQty,
      }));
    const unitEntries = entries
      .filter((e) => !(Number(e.weightGram) > 0))
      .map((e) => ({
        productId: e.productId,
        productName: e.productName,
        qty: e.qty * boxQty,
        variantId: e.variantId || null,
        unitPrice: e.unitPrice || 0,
      }));
    dbg("MIX_SNAPSHOT_SUMMARY", {
      boxQty,
      perBoxPrice: totalPrice,
      kgEntries,
      unitEntries,
      note: ci?.note || "",
    });
  }

  return snap;
}

/* -----------------------------------------------------------
 * DEC MIX — Trừ tồn kho cho MIX (kg + đơn vị)
 * ---------------------------------------------------------*/

/** smaller helper: tìm biến thể lẻ nhỏ nhất (kg) */
function findSmallestLooseVariantLocal(product) {
  const vs = Array.isArray(product?.variants) ? product.variants : [];
  const candidates = vs
    .map((v) => ({ v, kg: kgFromWeight(v?.attributes?.weight) || 0 }))
    .filter((x) => x.kg > 0); // chỉ lấy biến thể có kg hợp lệ (loose)
  if (!candidates.length) return null;
  candidates.sort((a, b) => a.kg - b.kg);
  return candidates[0]; // { v, kg }
}

/** ép id sang ObjectId nếu được */
const asOid = (x) => {
  try { return new mongoose.Types.ObjectId(String(x)); } catch { return null; }
};

/** tính số “đơn vị biến thể” từ tổng kg, làm tròn lên */
function unitsFromKg(totalKg, perUnitKg) {
  const eps = 1e-9;
  return Math.max(1, Math.ceil(totalKg / Math.max(perUnitKg, eps) - eps));
}

/**
 * Trừ tồn kho MIX trong controller (bao cả kg + đơn vị)
 * - snap: snapshot của 1 dòng MIX (đã gồm quantity = số hộp)
 * Return: { ok, mode:"mix", logs:[{productId, variantId, units}] } để rollbackOneStock dùng lại
 */
async function decMixInController(mixSnap) {
  const logs = [];
  try {
    const boxQty = Math.max(1, Number(mixSnap?.quantity || 1));
    const entries = Array.isArray(mixSnap?.mix?.items) ? mixSnap.mix.items : [];

    // 1) Gom kg theo product
    const needKgByProduct = new Map(); // productId -> totalKg
    // 2) Gom đơn vị theo variant (nếu có) hoặc chờ match
    const unitEntriesByProduct = new Map(); // productId -> [{variantId?, unitPrice, qtyPerBox}]

    for (const e of entries) {
      const pid = String(e?.productId || e?.product || "");
      if (!pid) continue;
      const qty = Math.max(0, Number(e?.qty || 0));
      if (!qty) continue;

      const grams = Number(e?.weightGram || 0);
      if (grams > 0) {
        const kg = (grams / 1000) * qty * boxQty;
        needKgByProduct.set(pid, (needKgByProduct.get(pid) || 0) + kg);
      } else {
        // entry theo "đơn vị/biến thể"
        const list = unitEntriesByProduct.get(pid) || [];
        list.push({
          variantId: e?.variantId || null,
          unitPrice: Number(e?.unitPrice || 0),
          qtyTotal: qty * boxQty,
        });
        unitEntriesByProduct.set(pid, list);
      }
    }

    // Nếu không có gì cần trừ → coi như thành công
    if (needKgByProduct.size === 0 && unitEntriesByProduct.size === 0) {
      return { ok: true, mode: "mix", logs: [] };
    }

    // Lấy toàn bộ product cần thiết
    const productIds = [
      ...new Set([
        ...Array.from(needKgByProduct.keys()),
        ...Array.from(unitEntriesByProduct.keys()),
      ]),
    ];
    const products = await Product.find(
      { _id: { $in: productIds } },
      { variants: 1, name: 1 }
    ).lean();
    const byId = new Map(products.map((d) => [String(d._id), d]));

    // ========== Trừ theo KG ==========
    for (const [pid, totalKg] of needKgByProduct.entries()) {
      const pDoc = byId.get(pid);
      if (!pDoc) {
        // rollback các log đã trừ
        for (const d of logs.reverse()) {
          await Product.updateOne(
            { _id: d.productId },
            { $inc: { "variants.$[elem].stock": d.units } },
            { arrayFilters: [{ "elem._id": { $in: [asOid(d.variantId), String(d.variantId)] } }] }
          );
        }
        return { ok: false, reason: "mix-product-not-found", productId: pid };
      }

      const v1 = findOneKgVariant(pDoc);
      let chosen = null;
      let perKg = 0;
      if (v1) {
        chosen = v1;
        perKg = 1;
      } else {
        const vMin = findSmallestLooseVariantLocal(pDoc);
        if (!vMin) {
          for (const d of logs.reverse()) {
            await Product.updateOne(
              { _id: d.productId },
              { $inc: { "variants.$[elem].stock": d.units } },
              { arrayFilters: [{ "elem._id": { $in: [asOid(d.variantId), String(d.variantId)] } }] }
            );
          }
          return { ok: false, reason: "no-loose-variant-for-kg", productId: pid };
        }
        chosen = vMin.v;
        perKg = vMin.kg || 1;
      }

      const units = unitsFromKg(totalKg, perKg);
      const pidOid = asOid(pid);
      const vidOid = asOid(chosen._id);

      const r = await Product.updateOne(
        { _id: pidOid || String(pid) },
        { $inc: { "variants.$[elem].stock": -units } },
        {
          arrayFilters: [
            {
              "elem._id": { $in: [vidOid, String(chosen._id)] },
              "elem.stock": { $gte: units },
            },
          ],
        }
      );

      if (r.modifiedCount !== 1) {
        // rollback những gì đã trừ trước
        for (const d of logs.reverse()) {
          await Product.updateOne(
            { _id: d.productId },
            { $inc: { "variants.$[elem].stock": d.units } },
            { arrayFilters: [{ "elem._id": { $in: [asOid(d.variantId), String(d.variantId)] } }] }
          );
        }
        return {
          ok: false,
          reason: "insufficient-mix-kg",
          productId: pid,
          variantId: String(chosen._id),
          needUnits: units,
        };
      }

      logs.push({ productId: pid, variantId: String(chosen._id), units });
    }

    // ========== Trừ các entry theo ĐƠN VỊ/BIẾN THỂ ==========
    for (const [pid, list] of unitEntriesByProduct.entries()) {
      const pDoc = byId.get(pid);
      if (!pDoc) {
        for (const d of logs.reverse()) {
          await Product.updateOne(
            { _id: d.productId },
            { $inc: { "variants.$[elem].stock": d.units } },
            { arrayFilters: [{ "elem._id": { $in: [asOid(d.variantId), String(d.variantId)] } }] }
          );
        }
        return { ok: false, reason: "mix-product-not-found", productId: pid };
      }

      const variants = Array.isArray(pDoc.variants) ? pDoc.variants : [];

      for (const entry of list) {
        let chosenId = entry.variantId || null;

        if (!chosenId) {
          // Heuristic: match theo đơn giá biến thể (ưu tiên lẻ)
          const price = Number(entry.unitPrice || 0);
          const maybe = variants
            .filter((v) => (kgFromWeight(v?.attributes?.weight) || 0) >= 0) // chấp nhận cả lẻ/0kg
            .sort((a, b) => {
              const akg = kgFromWeight(a?.attributes?.weight) || 0;
              const bkg = kgFromWeight(b?.attributes?.weight) || 0;
              return (akg === 0) - (bkg === 0);
            })
            .find((v) => Number(v?.price || 0) === price);

          if (maybe) chosenId = String(maybe._id);
          if (!chosenId) {
            const vLoose = variants.find((v) => (kgFromWeight(v?.attributes?.weight) || 0) > 0);
            chosenId = String((vLoose || variants[0] || {})._id || "");
          }
        }

        if (!chosenId) {
          for (const d of logs.reverse()) {
            await Product.updateOne(
              { _id: d.productId },
              { $inc: { "variants.$[elem].stock": d.units } },
              { arrayFilters: [{ "elem._id": { $in: [asOid(d.variantId), String(d.variantId)] } }] }
            );
          }
          return { ok: false, reason: "mix-unit-no-variant", productId: pid };
        }

        const qty = Math.max(1, Number(entry.qtyTotal || 0));
        const pidOid = asOid(pid);
        const vidOid = asOid(chosenId);

        const r = await Product.updateOne(
          { _id: pidOid || String(pid) },
          { $inc: { "variants.$[elem].stock": -qty } },
          {
            arrayFilters: [
              {
                "elem._id": { $in: [vidOid, String(chosenId)] },
                "elem.stock": { $gte: qty },
              },
            ],
          }
        );

        if (r.modifiedCount !== 1) {
          // rollback
          for (const d of logs.reverse()) {
            await Product.updateOne(
              { _id: d.productId },
              { $inc: { "variants.$[elem].stock": d.units } },
              { arrayFilters: [{ "elem._id": { $in: [asOid(d.variantId), String(d.variantId)] } }] }
            );
          }
          return { ok: false, reason: "insufficient-mix-unit", productId: pid, variantId: String(chosenId), needUnits: qty };
        }

        logs.push({ productId: pid, variantId: String(chosenId), units: qty });
      }
    }

    return { ok: true, mode: "mix", logs };
  } catch (e) {
    // rollback nếu exception
    for (const d of logs.reverse()) {
      try {
        await Product.updateOne(
          { _id: d.productId },
          { $inc: { "variants.$[elem].stock": d.units } },
          { arrayFilters: [{ "elem._id": { $in: [asOid(d.variantId), String(d.variantId)] } }] }
        );
      } catch {}
    }
    return { ok: false, reason: "mix-exception", error: e?.message || String(e) };
  }
}

/* =========================
 * RETURN / REFUND flow: constants
 * ========================= */
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

/* -----------------------------------------------------------
 * Chuẩn hoá order trả về FE (đảm bảo có shippingFee/total) + AUTO-HEAL
 * ---------------------------------------------------------*/
async function normalizeOrderForResponse(req, orderLean) {
  const o = { ...(orderLean || {}) };

  if (o?.returnFlow?.evidenceImages) {
    o.returnFlow.evidenceImages = o.returnFlow.evidenceImages
      .map((img) => normalizeEvidenceImage(req, img))
      .filter(Boolean);
  }

  const subtotal = Math.max(0, Number(o?.subtotal || 0));
  const discount = Math.max(0, Number(o?.discount || 0));

  let shippingFee = Number(o?.shippingFee ?? 0);
  let shippingRuleName = o?.shippingRuleName;
  if (!Number.isFinite(shippingFee) || shippingFee < 0) shippingFee = 0;

  const needRequote =
    o?.shippingFee == null ||
    !Number.isFinite(Number(o?.shippingFee)) ||
    (Number(o?.shippingFee) === 0 && !o?.shippingRuleName);

  if (needRequote && o?.shippingAddress) {
    try {
      const districtCode = String(
        o?.shippingAddress?.districtCode || o?.shippingAddress?.district_code || ""
      ).trim();
      const wardCode = String(
        o?.shippingAddress?.wardCode || o?.shippingAddress?.ward_code || ""
      ).trim();

      const quote = await quoteShipping({
        provinceCode: 1,
        districtCode,
        wardCode,
        cartSubtotal: subtotal,
      });
      shippingFee = Math.max(0, Math.round(Number(quote?.amount || 0)));
      shippingRuleName = quote?.ruleName || shippingRuleName;

      console.log("[SHIPPING_DEBUG][normalizeUserOrder] re-quote]:", {
        orderId: o._id,
        districtCode,
        wardCode,
        subtotal,
        shippingFee,
        shippingRuleName,
        matchedBy: quote?.matchedBy,
      });
    } catch (e) {
      console.log("[SHIPPING_DEBUG][normalizeUserOrder] quote error:", {
        orderId: o._id,
        err: e?.message || e,
      });
    }
  }

  const expectedTotal = Math.max(0, Math.round(subtotal - discount + shippingFee));
  const savedTotalOk =
    Number.isFinite(Number(o?.total)) && Math.round(Number(o.total)) === expectedTotal;

  let total = expectedTotal;
  if (!savedTotalOk) {
    console.log("[ORDER_DEBUG][normalizeUserOrder] fix total mismatch:", {
      orderId: o?._id,
      subtotal,
      discount,
      shippingFee,
      savedTotal: o?.total,
      expectedTotal,
    });
    try {
      if (o?._id) {
        await Order.updateOne(
          { _id: o._id },
          { $set: { total: expectedTotal, shippingFee, shippingRuleName } }
        );
      }
    } catch (e) {
      console.warn("[ORDER_DEBUG][normalizeUserOrder] db patch fail:", e?.message || e);
    }
  }

  if (Array.isArray(o.items)) {
    o.items = o.items.map((it) => ({
      ...it,
      productName: it.productName || it?.product?.name || it?.snapshot?.productName || "Sản phẩm",
    }));
  }

  return {
    ...o,
    shippingFee,
    shippingRuleName,
    total,
  };
}

/* -----------------------------------------------------------
 * Tạo đơn hàng — không transaction
 * ---------------------------------------------------------*/
export const checkout = async (req, res) => {
  const reqId = makeReqId();
  try {
    const { cartItems = [], voucher, address, paymentMethod } = req.body;

    // ✅ Hỗ trợ Mix gửi tách riêng: mixPackages
    const mixPackages = Array.isArray(req.body?.mixPackages) ? req.body.mixPackages : [];

    dbg("REQ_BEGIN", {
      reqId,
      bodyKeys: Object.keys(req.body || {}),
      cartItemsCount: Array.isArray(cartItems) ? cartItems.length : 0,
      mixPackagesCount: mixPackages.length,
      paymentMethod,
    });

    const userId = req.user._id;

    // Gom các dòng sẽ xử lý: cartItems + mixPackages (chuẩn hoá type:"mix")
    const allLines = [
      ...cartItems,
      ...mixPackages.map((pkg) => ({ type: "mix", ...pkg })),
    ];

    if (!Array.isArray(allLines) || allLines.length === 0) {
      return res.status(400).json({ message: "Giỏ hàng trống" });
    }
    if (!address) {
      return res.status(400).json({ message: "Thiếu địa chỉ giao hàng" });
    }

    let validVoucher = null;
    if (voucher) {
      try {
        validVoucher = await voucherService.validate(voucher, userId);
      } catch (err) {
        return res.status(400).json({ message: "Voucher không hợp lệ", error: err.message });
      }
    }

    const itemsSnapshot = [];
    let subtotal = 0;

    for (const ci of allLines) {
      // ===== COMBO =====
      if (isComboCartItem(ci)) {
        const snap = buildComboSnapshotForOrder(ci);
        itemsSnapshot.push(snap);
        subtotal += snap.lineTotal;
        continue;
      }

      // ===== MIX =====
      if (isMixCartItem(ci)) {
        const mixSnap = await buildMixSnapshotForOrder(ci);
        itemsSnapshot.push(mixSnap);
        subtotal += mixSnap.lineTotal;
        continue;
      }

      // ===== VARIANT (mặc định) =====
      const productDoc = await Product.findById(ci.productId).lean();
      if (!productDoc) {
        return res.status(400).json({ message: `Sản phẩm không tồn tại: ${ci.productId}` });
      }
      const { product, variant } = await resolveVariant(productDoc, ci);
      if (!variant) {
        return res
          .status(400)
          .json({ message: `Biến thể không tồn tại cho sản phẩm ${product?.name || ci.productId}` });
      }
      const snap = buildVariantSnapshot(product, variant, ci);
      itemsSnapshot.push(snap);
      subtotal += snap.lineTotal;
    }

    dbg("ITEMS_SNAPSHOT", {
      reqId,
      count: itemsSnapshot.length,
      subtotal,
      preview: itemsSnapshot.slice(0, 5).map(briefItem),
    });

    // Lấy & chuẩn hoá mã khu vực
    let addrDoc = null;
    let districtCode = String(address?.districtCode || address?.district_code || "").trim();
    let wardCode = String(address?.wardCode || address?.ward_code || "").trim();

    if ((!districtCode || !wardCode) && address?._id) {
      addrDoc = await Address.findById(address._id).lean().catch(() => null);
      if (addrDoc) {
        districtCode = String(addrDoc.districtCode || addrDoc.district_code || districtCode || "").trim();
        wardCode = String(addrDoc.wardCode || addrDoc.ward_code || wardCode || "").trim();
      }
    }

    const a = address || {};
    const shippingAddressSave = {
      fullName: a.fullName || addrDoc?.fullName || "",
      phone: a.phone || addrDoc?.phone || "",
      province: a.province || addrDoc?.province || "",
      district: a.district || addrDoc?.district || "",
      ward: a.ward || addrDoc?.ward || "",
      detail: a.detail || a.address || addrDoc?.detail || "",
      districtCode: districtCode || "",
      wardCode: wardCode || "",
    };

    dbg("ADDR_QUOTE_INPUT", {
      reqId,
      districtCode: shippingAddressSave.districtCode,
      wardCode: shippingAddressSave.wardCode,
      subtotal,
    });

    // ===== Quote ship
    let shippingFee = 0;
    let shippingRuleName;
    try {
      const quote = await quoteShipping({
        provinceCode: 1,
        districtCode: shippingAddressSave.districtCode,
        wardCode: shippingAddressSave.wardCode,
        cartSubtotal: subtotal,
      });
      shippingFee = Number(quote?.amount || 0);
      if (!Number.isFinite(shippingFee)) shippingFee = 0;
      shippingFee = Math.max(0, Math.round(shippingFee));
      shippingRuleName = quote?.ruleName;

      dbg("QUOTE_OK", {
        reqId,
        shippingFee,
        shippingRuleName,
        matchedBy: quote?.matchedBy,
        zoneId: quote?.zoneId,
      });
    } catch (e) {
      console.error("[SHIPPING_DEBUG][checkout] quote error:", e?.message || e);
    }

    // Voucher
    let discountAmount = 0;
    if (validVoucher) {
      const v = validVoucher;
      const minOrder = Number(v.minOrder || v.min_order || 0);
      if (!minOrder || subtotal >= minOrder) {
        const discountVal = Number(v.discount || v.percent || 0);
        if (discountVal > 0 && discountVal <= 100) {
          discountAmount = Math.floor(subtotal * (discountVal / 100));
          const maxDiscount = Number(v.maxDiscount || v.max_amount || 0);
          if (maxDiscount > 0) discountAmount = Math.min(discountAmount, maxDiscount);
        } else if (discountVal > 0) {
          discountAmount = Math.floor(discountVal);
        }
        discountAmount = Math.min(discountAmount, subtotal);
      }
      dbg("VOUCHER_APPLIED", { reqId, code: voucher, discountAmount });
    }

    const total = Math.max(0, Math.round(subtotal + shippingFee - discountAmount));
    const payStatus = paymentMethod === "momo" ? "paid" : "unpaid";

    dbg("TOTALS", {
      reqId, subtotal, discountAmount, shippingFee, total, paymentMethod, payStatus,
    });

    // ====== TRỪ KHO ngay (không transaction)
    const decLogs = [];
    try {
      for (const snap of itemsSnapshot) {
        dbg("DEC_BEGIN", { reqId, item: briefItem(snap), isMix: !!snap.isMix, isCombo: !!snap.isCombo });

        let info;
        if (snap?.isMix) {
          // ✅ Mix: dùng decMixInController (trừ cả kg + đơn vị/biến thể)
          info = await decMixInController(snap);
        } else {
          // ✅ Variant & Combo: dùng inventory service chung
          info = await decOneStockNonTx(snap);
        }

        dbg("DEC_RESULT", {
          reqId,
          ok: info?.ok,
          reason: info?.reason,
          mode: info?.mode,
          extra: {
            baseId: info?.baseId,
            decUnits: info?.decUnits,
            logsLen: Array.isArray(info?.logs) ? info.logs.length : undefined,
          },
        });

        if (!info?.ok) {
          let msg = "Không đủ tồn kho";
          if (snap?.isMix) msg = "Giỏ Mix không đủ tồn kho cho một hoặc nhiều thành phần.";
          if (snap?.isCombo) msg = "Combo không đủ tồn kho hoặc thành phần combo thiếu hàng.";

          // Rollback những gì đã dec trước
          for (const d of decLogs.reverse()) {
            try { await rollbackOneStock(d.snap, d.info); } catch (rbErr) {
              console.warn("[ORDER_DEBUG][rollback fail]", rbErr?.message || rbErr);
            }
          }

          const payload = { message: msg };
          if (ORDER_DEBUG) {
            payload.debug = { reqId, reason: info?.reason, info, snapPreview: briefItem(snap) };
            dbg("DEC_FAIL_RESPONSE", payload.debug);
          }
          return res.status(400).json(payload);
        }

        decLogs.push({ snap, info });
      }
    } catch (stockErr) {
      for (const d of decLogs.reverse()) {
        try { await rollbackOneStock(d.snap, d.info); } catch (rbErr) {
          console.warn("[ORDER_DEBUG][rollback fail-catch]", rbErr?.message || rbErr);
        }
      }
      const payload = { message: stockErr.message || "Không đủ tồn kho" };
      if (ORDER_DEBUG) payload.debug = { reqId, error: stockErr?.message };
      return res.status(400).json(payload);
    }

    // create order
    const orderDoc = new Order({
      user: userId,
      items: itemsSnapshot,
      itemsSnapshot,
      voucher: validVoucher ? validVoucher._id : null,
      shippingAddress: shippingAddressSave,
      paymentMethod,
      paymentStatus: payStatus,
      status: "pending",
      subtotal: Math.round(subtotal),
      discount: Math.round(discountAmount),
      shippingFee: Math.round(shippingFee),
      shippingRuleName,
      total,
    });

    dbg("BEFORE_SAVE", {
      reqId,
      itemsCount: orderDoc.items?.length || 0,
      subtotal: orderDoc.subtotal,
      discount: orderDoc.discount,
      shippingFee: orderDoc.shippingFee,
      total: orderDoc.total,
      payStatus: orderDoc.paymentStatus,
    });

    let order;
    try {
      order = await orderDoc.save();
    } catch (saveErr) {
      for (const d of decLogs.reverse()) {
        try { await rollbackOneStock(d.snap, d.info); } catch (rbErr) {
          console.warn("[ORDER_DEBUG][rollback fail-on-save]", rbErr?.message || rbErr);
        }
      }
      console.error("[ORDER_DEBUG][save error]", saveErr?.message || saveErr);
      throw saveErr;
    }

    dbg("SAVED", { reqId, orderId: String(order._id), customId: order.customId, total: order.total });

    if (validVoucher && order.paymentStatus === "paid") {
      try { await voucherService.useVoucher(voucher, userId); } catch (e) { console.error("[voucher.use] ", e); }
    }

    let assignedVouchers = null;
    if (order.paymentStatus === "paid") {
      try { assignedVouchers = await voucherService.assignVoucherBasedOnSpending(userId); }
      catch (e) { assignedVouchers = null; }
    }

    // ✅ bổ sung orderId ở top-level để FE dễ bắt
    return res.status(201).json({
      message: "Đặt hàng thành công",
      orderId: order._id,
      order: {
        _id: order._id,
        customId: order.customId,
        items: order.items,
        total: order.total,
        subtotal: order.subtotal,
        discount: order.discount,
        shippingFee: order.shippingFee,
        shippingRuleName: order.shippingRuleName,
        status: order.status,
        paymentStatus: order.paymentStatus,
        voucher: order.voucher,
        shippingAddress: order.shippingAddress,
        createdAt: order.createdAt,
        returnFlow: order.returnFlow || null,
      },
      assignedVouchers,
      ...(ORDER_DEBUG ? { debug: { reqId } } : {}),
    });
  } catch (err) {
    if (err?.code === "EXPIRED_PRODUCT") {
      return res.status(400).json({ message: err.message });
    }
    console.error("[ORDER_DEBUG][checkout fatal]", err);
    const payload = { message: "Lỗi khi tạo đơn hàng", error: err.message };
    if (ORDER_DEBUG) payload.debug = { fatal: true };
    return res.status(500).json(payload);
  }
};

/* -----------------------------------------------------------
 * Lấy đơn hàng của người dùng
 * ---------------------------------------------------------*/
export const getUserOrders = async (req, res) => {
  try {
    const userId = req.user._id;
    const orders = await Order.find({
      user: userId,
      $or: [{ deletedByUser: { $exists: false } }, { deletedByUser: false }],
    })
      .populate("items.product", "name image")
      .populate("voucher")
      .sort({ createdAt: -1 })
      .lean();

    const normalized = await Promise.all(
      (orders || []).map((o) => normalizeOrderForResponse(req, o))
    );

    console.log("[SHIPPING_DEBUG][getUserOrders] first row:", normalized?.[0] && {
      id: normalized[0]._id,
      subtotal: normalized[0].subtotal,
      discount: normalized[0].discount,
      shippingFee: normalized[0].shippingFee,
      total: normalized[0].total,
    });

    res.json(normalized);
  } catch (err) {
    console.error("[ORDER_DEBUG][getUserOrders] error:", err?.message || err);
    res.status(500).json({ message: "Lỗi khi lấy đơn hàng", error: err.message });
  }
};

/* -----------------------------------------------------------
 * Lấy tất cả đơn hàng (admin)
 * ---------------------------------------------------------*/
export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find({})
      .populate("items.product", "name image")
      .populate("voucher")
      .populate("user", "username email")
      .sort({ createdAt: -1 })
      .lean();

  const normalized = await Promise.all(
      (Array.isArray(orders) ? orders : []).map((o) => normalizeOrderForResponse(req, o))
    );

    for (const o of normalized) {
      if (Array.isArray(o.items)) {
        o.items = o.items.map((it) => ({
          ...it,
          productName:
            it.productName ||
            it?.product?.name ||
            it?.snapshot?.productName ||
            "Sản phẩm",
        }));
      }
    }

    console.log("[SHIPPING_DEBUG][getAllOrders] sample:", normalized?.[0] && {
      id: normalized[0]._id,
      user: normalized[0]?.user?.username,
      subtotal: normalized[0].subtotal,
      shippingFee: normalized[0].shippingFee,
      total: normalized[0].total,
    });

    res.json(normalized);
  } catch (err) {
    console.error("[ORDER_DEBUG][getAllOrders] error:", err?.message || err);
    res.status(500).json({ message: "Lỗi khi lấy tất cả đơn hàng", error: err.message });
  }
};

/* -----------------------------------------------------------
 * Lấy chi tiết 1 đơn (admin)
 * ---------------------------------------------------------*/
export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id)
      .populate("items.product", "name image variants")
      .populate("voucher")
      .populate("user", "username email")
      .lean();

    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }

    const normalized = await normalizeOrderForResponse(req, order);
    console.log("[SHIPPING_DEBUG][getOrderById] normalized:", {
      id: normalized._id,
      subtotal: normalized.subtotal,
      discount: normalized.discount,
      shippingFee: normalized.shippingFee,
      total: normalized.total,
    });
    res.json(normalized);
  } catch (err) {
    console.error("[ORDER_DEBUG][getOrderById] error:", err?.message || err);
    res.status(500).json({
      message: "Lỗi khi lấy chi tiết đơn hàng",
      error: err.message,
    });
  }
};

/* -----------------------------------------------------------
 * Cập nhật trạng thái đơn (admin)
 * ---------------------------------------------------------*/
export const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, paymentStatus } = req.body;

    const updated = await orderService.updateOrderStatus(id, { status, paymentStatus });
    res.json({ message: "Cập nhật trạng thái thành công", order: updated });
  } catch (err) {
    res.status(500).json({ message: "Lỗi cập nhật trạng thái", error: err.message });
  }
};

/* -----------------------------------------------------------
 * Huỷ đơn hàng (hard delete)
 * ---------------------------------------------------------*/
export const deleteOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const isAdmin = req.user.role === "admin";
    const { id } = req.params;

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ message: "Không tìm thấy đơn hàng" });

    if (!isAdmin && order.user.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Bạn không có quyền huỷ đơn này" });
    }

    if (order.status !== "pending" && order.paymentStatus !== "failed") {
      return res.status(400).json({
        message: "Chỉ được huỷ đơn khi đang chờ xác nhận hoặc đã thất bại",
      });
    }

    await Order.findByIdAndDelete(id);
    res.json({ message: "Đã huỷ đơn hàng thành công" });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server khi huỷ đơn hàng", error: err.message });
  }
};

/* -----------------------------------------------------------
 * Ẩn đơn hàng khỏi lịch sử (soft delete)
 * ---------------------------------------------------------*/
export const hideOrderFromHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const order = await Order.findOne({ _id: id, user: userId });
    if (!order) return res.status(404).json({ message: "Không tìm thấy đơn hàng" });

    order.deletedByUser = true;
    await order.save();

    res.json({ message: "Đã ẩn đơn hàng khỏi lịch sử" });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server khi ẩn đơn hàng", error: err.message });
  }
};

/* ===========================================================
 * RETURN / REFUND FLOW — ORDER
 * =========================================================*/
export const orderReturnRequest = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const {
      reason,
      note,
      images = [],
      qty,
      preferredResolution,
      phone,
      items = [],
    } = req.body || {};

    const o = await Order.findOne({
      _id: id,
      user: userId,
      $or: [{ deletedByUser: { $exists: false } }, { deletedByUser: false }],
    });
    if (!o) return res.status(404).json({ ok: false, message: "Không tìm thấy đơn hàng" });

    if (o.status !== "delivered") {
      return res.status(400).json({ ok: false, message: "Chỉ yêu cầu đổi/trả khi đơn đã giao" });
    }

    o.returnFlow = o.returnFlow || {};
    if (o.returnFlow.isOpen) {
      return res.status(400).json({ ok: false, message: "Đơn hàng đang có yêu cầu đổi/trả" });
    }

    const maxQtyInOrder =
      (o.items || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0) || 1;
    const requestedQty = Math.max(1, Math.min(Number(qty || 1), maxQtyInOrder));

    let normalizedItems = [];
    if (Array.isArray(items) && items.length > 0) {
      normalizedItems = items.slice(0, 50).map((it) => ({
        productId: it.productId || null,
        productName: it.productName || "",
        variant: it.variant || null,
        quantity: Math.max(1, Number(it.quantity || 1)),
      }));
    }

    const evidence = collectEvidenceImages(req);

    o.returnFlow.isOpen = true;
    o.returnFlow.status = "return_requested";
    o.returnFlow.reason = reason || null;
    o.returnFlow.note = note || null;
    o.returnFlow.customerNote = note || null;
    o.returnFlow.preferredResolution = preferredResolution || "refund";
    o.returnFlow.phone = phone || null;
    o.returnFlow.customerPhone = phone || null;
    o.returnFlow.requestedQty = requestedQty;
    o.returnFlow.items = normalizedItems;
    o.returnFlow.evidenceImages = evidence;
    o.returnFlow.timeline = o.returnFlow.timeline || {};
    o.returnFlow.timeline.requestedAt = new Date();

    await o.save();
    return res.json({ ok: true, message: "Đã gửi yêu cầu đổi/trả", data: o });
  } catch (e) {
    console.error("[orderReturnRequest] ERROR:", e);
    return res.status(400).json({ ok: false, message: e?.message || "Lỗi yêu cầu đổi/trả" });
  }
};

export const orderReturnApprove = async (req, res) => {
  try {
    const { id } = req.params;
    const adminNote = req.body?.adminNote ?? req.body?.note ?? null;
    const feeDeduction = Math.max(0, Number(req.body?.feeDeduction || 0));
    const carrier = req.body?.carrier || null;
    const trackingCode = req.body?.trackingCode ?? req.body?.code ?? null;

    const o = await Order.findById(id);
    if (!o) return res.status(404).json({ ok: false, message: "Không tìm thấy đơn hàng" });
    if (o.status !== "delivered") {
      return res.status(400).json({ ok: false, message: "Đơn chưa giao xong" });
    }

    o.returnFlow = o.returnFlow || {};
    if (!o.returnFlow.isOpen || o.returnFlow.status !== "return_requested") {
      return res.status(400).json({ ok: false, message: "Trạng thái không hợp lệ để duyệt" });
    }

    o.returnFlow.status = "return_approved";
    o.returnFlow.adminNote = adminNote;
    o.returnFlow.timeline = o.returnFlow.timeline || {};
    o.returnFlow.timeline.approvedAt = new Date();
    o.returnFlow.feeDeduction = feeDeduction;
    o.returnFlow.carrier = carrier || o.returnFlow.carrier || null;
    o.returnFlow.trackingCode = trackingCode || o.returnFlow.trackingCode || null;

    await o.save();
    return res.json({ ok: true, message: "Đã duyệt yêu cầu đổi/trả", data: o });
  } catch (e) {
    console.error("[orderReturnApprove] ERROR:", e);
    return res.status(400).json({ ok: false, message: e?.message || "Lỗi duyệt đổi/trả" });
  }
};

export const orderReturnReject = async (req, res) => {
  try {
    const { id } = req.params;
    const adminNote = req.body?.adminNote ?? req.body?.note ?? null;

    const o = await Order.findById(id);
    if (!o) return res.status(404).json({ ok: false, message: "Không tìm thấy đơn hàng" });

    o.returnFlow = o.returnFlow || {};
    if (!o.returnFlow.isOpen || o.returnFlow.status !== "return_requested") {
      return res.status(400).json({ ok: false, message: "Trạng thái không hợp lệ để từ chối" });
    }

    o.returnFlow.status = "return_rejected";
    o.returnFlow.adminNote = adminNote;
    o.returnFlow.timeline = o.returnFlow.timeline || {};
    o.returnFlow.timeline.rejectedAt = new Date();
    o.returnFlow.timeline.closedAt = new Date();
    o.returnFlow.isOpen = false;

    await o.save();
    return res.json({ ok: true, message: "Đã từ chối yêu cầu đổi/trả", data: o });
  } catch (e) {
    console.error("[orderReturnReject] ERROR:", e);
    return res.status(400).json({ ok: false, message: e?.message || "Lỗi từ chối đổi/trả" });
  }
};

export const orderReturnShippingUpdate = async (req, res) => {
  try {
    const { id } = req.params;
    const status = req.body?.status || null;
    const carrier = req.body?.carrier || null;
    const trackingCode = req.body?.trackingCode ?? req.body?.code ?? null;
    const note = req.body?.note || null;
    const raw = req.body?.raw || {};

    const o = await Order.findById(id);
    if (!o) return res.status(404).json({ ok: false, message: "Không tìm thấy đơn hàng" });

    o.returnFlow = o.returnFlow || {};
    if (!o.returnFlow.isOpen) {
      return res.status(400).json({ ok: false, message: "Không có yêu cầu đổi/trả đang mở" });
    }

    if (status) {
      if (!RETURN_SHIP_MAP[status]) {
        return res.status(400).json({ ok: false, message: "Trạng thái vận chuyển đổi/trả không hợp lệ" });
      }
      const cur = o.returnFlow.status || "return_approved";
      const nextExpected = RETURN_SHIP_NEXT[cur] || cur;
      if (status !== nextExpected && !canForwardReturn(cur, status)) {
        return res.status(400).json({ ok: false, message: "Không thể chuyển trạng thái vận chuyển hiện tại" });
      }

      o.returnFlow.status = status;
      o.returnFlow.timeline = o.returnFlow.timeline || {};
      const key = RETURN_SHIP_MAP[status];
      if (key && !o.returnFlow.timeline[key]) o.returnFlow.timeline[key] = new Date();
    }

    if (carrier) o.returnFlow.carrier = carrier;
    if (trackingCode) o.returnFlow.trackingCode = trackingCode;
    if (note) o.returnFlow.shipNote = note;
    o.returnFlow.raw = { ...(o.returnFlow.raw || {}), ...(raw || {}) };

    await o.save();
    return res.json({ ok: true, message: "Đã cập nhật vận chuyển đổi/trả", data: o });
  } catch (e) {
    console.error("[orderReturnShippingUpdate] ERROR:", e);
    return res.status(400).json({ ok: false, message: e?.message || "Lỗi cập nhật vận chuyển đổi/trả" });
  }
};

export const orderReturnRefund = async (req, res) => {
  try {
    const { id } = req.params;
    const amount = Number(req.body?.amount);
    const adminNote = req.body?.adminNote ?? req.body?.note ?? null;

    const o = await Order.findById(id);
    if (!o) return res.status(404).json({ ok: false, message: "Không tìm thấy đơn hàng" });

    o.returnFlow = o.returnFlow || {};
    if (!o.returnFlow.isOpen) {
      return res.status(400).json({ ok: false, message: "Không có yêu cầu đổi/trả đang mở" });
    }
    if (o.returnFlow.status !== "return_received") {
      return res.status(400).json({ ok: false, message: "Chỉ hoàn tiền sau khi đã nhận lại hàng" });
    }

    if (!Number.isFinite(amount) || amount < 0) {
      return res.status(400).json({ ok: false, message: "Số tiền hoàn không hợp lệ" });
    }

    const fee = Math.max(0, Number(o.returnFlow.feeDeduction || 0));
    const refundedSoFar = Math.max(0, Number(o.returnFlow.refundAmount || 0));
    const orderTotal = Math.max(0, Number(o.total || 0));
    const maxRefund = Math.max(0, orderTotal - fee - refundedSoFar);
    const refundAmount = Math.min(amount, maxRefund);

    o.returnFlow.refundAmount = refundedSoFar + refundAmount;
    o.returnFlow.status = "refund_issued";
    o.returnFlow.timeline = o.returnFlow.timeline || {};
    o.returnFlow.timeline.refundIssuedAt = new Date();
    o.returnFlow.timeline.closedAt = new Date();
    o.returnFlow.adminNote = adminNote || o.returnFlow.adminNote || null;
    o.returnFlow.isOpen = false;

    await o.save();
    return res.json({
      ok: true,
      message: `Đã hoàn tiền ${refundAmount.toLocaleString("vi-VN")}₫ và đóng yêu cầu đổi/trả`,
      data: o,
    });
  } catch (e) {
    console.error("[orderReturnRefund] ERROR:", e);
    return res.status(400).json({ ok: false, message: e?.message || "Lỗi hoàn tiền đổi/trả" });
  }
};
