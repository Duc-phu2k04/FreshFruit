// src/services/momo.service.js
import crypto from "crypto";
import https from "https";
import Order from "../models/order.model.js";
import Product from "../models/product.model.js";
import Voucher from "../models/voucher.model.js";
import voucherService from "./voucher.service.js";

// Dùng lại helpers & luồng trừ kho từ inventory.service
import {
  decOneStockNonTx,
  // rollbackOneStock, // (không cần vì service tự tính chiều đảo để hoàn kho)
  kgFromWeight,
  isBoxVariant,
  findOneKgVariant,
  kgPerBox,
} from "../services/inventory.service.js";

/* ---------------------------------------------
 * MoMo credentials (test)
 * -------------------------------------------*/
const partnerCode = "MOMO";
const accessKey = "F8BBA842ECF85";
const secretKey = "K951B6PE1waDMi640xX08PD3vg6EkVlz";
const redirectUrl = "http://localhost:5173/order-success";
const ipnUrl = "https://d2fd82414e58.ngrok-free.app/api/momo/ipn"; // ✅ bỏ khoảng trắng thừa

/* ---------------------------------------------
 * Utils
 * -------------------------------------------*/
// Giống chuẩn normalize của controller
const normalizeShippingAddress = (src = {}) => ({
  fullName: src.fullName || "",
  phone: src.phone || "",
  province: src.provinceName || src.province || "",
  district: src.districtName || src.district || "",
  ward: src.wardName || src.ward || "",
  detail: src.addressLine || src.detail || src.address || "",
  districtCode: src.districtCode || null,
  wardCode: src.wardCode || null,
});

// Tính tiền cho 1 entry mix nếu thiếu linePrice
const _calcMixEntryPrice = (e) => {
  const qty = Math.max(0, Number(e?.qty || 0));
  const weightGram = Math.max(0, Number(e?.weightGram || 0));
  const pricePerKg = Number(e?.pricePerKg || 0);
  const unitPrice = Number(e?.unitPrice || 0);

  if (weightGram > 0 && pricePerKg > 0) {
    return Math.round(qty * (weightGram / 1000) * pricePerKg);
  }
  if (qty > 0 && unitPrice > 0) {
    return Math.round(qty * unitPrice);
  }
  return 0;
};

// Kế hoạch đảo chiều cho MIX khi hoàn kho (giống ý tưởng decMixEntriesNonTx nhưng theo chiều +)
async function _restoreStockForMixItem(mixSnap) {
  // Gom tổng kg theo product
  const boxQty = Math.max(1, Number(mixSnap?.quantity || 1));
  const entries = Array.isArray(mixSnap?.mix?.items) ? mixSnap.mix.items : [];
  const needKgByProduct = new Map(); // productId -> totalKg

  for (const e of entries) {
    const pid = String(e?.productId || e?.product || "");
    if (!pid) continue;
    const grams = Number(e?.weightGram || 0);
    const qty = Math.max(0, Number(e?.qty || 0));
    if (grams <= 0 || qty <= 0) continue;
    const kg = (grams / 1000) * qty * boxQty;
    needKgByProduct.set(pid, (needKgByProduct.get(pid) || 0) + kg);
  }

  // Cộng lại đúng biến thể lẻ đã “quy ước”: ưu tiên 1kg, nếu không có thì lẻ nhỏ nhất
  for (const [pid, totalKg] of needKgByProduct.entries()) {
    const pDoc = await Product.findById(pid).lean();
    if (!pDoc) continue;

    // Ưu tiên 1kg
    const v1 = findOneKgVariant(pDoc);
    let chosen = null;
    let perUnitKg = 0;

    if (v1) {
      chosen = v1;
      perUnitKg = 1;
    } else {
      // tìm biến thể lẻ nhỏ nhất theo kg
      const vs = Array.isArray(pDoc?.variants) ? pDoc.variants : [];
      const loose = vs
        .filter((v) => !isBoxVariant(v))
        .map((v) => ({ v, kg: kgFromWeight(v?.attributes?.weight) || 1 }))
        .filter((x) => x.kg > 0)
        .sort((a, b) => a.kg - b.kg);

      if (!loose.length) continue;
      chosen = loose[0].v;
      perUnitKg = loose[0].kg || 1;
    }

    const units = Math.max(
      1,
      Math.ceil(totalKg / Math.max(perUnitKg, 1e-9) - 1e-9)
    );

    await Product.updateOne(
      { _id: pid, "variants._id": chosen._id },
      { $inc: { "variants.$.stock": units } }
    );
  }
}

// Hoàn kho cho item COMBO theo breakdown hiện tại của sản phẩm
async function _restoreStockForComboItem(comboSnap) {
  const comboId = comboSnap?.product;
  const qty = Math.max(1, Number(comboSnap?.quantity || 1));
  if (!comboId) return;

  const combo = await Product.findById(comboId)
    .select({
      type: 1,
      isCombo: 1,
      "comboInventory.stock": 1,
      "comboInventory.autoDeduct.aggregatedBreakdown": 1,
      comboItems: 1,
      variants: 1,
    })
    .lean();
  if (!combo) return;

  // 1) trả stock combo
  await Product.updateOne(
    { _id: combo._id },
    { $inc: { "comboInventory.stock": qty } }
  );

  // 2) trả stock biến thể con theo autoDeduct (hoặc fallback từ comboItems)
  const agg =
    combo?.comboInventory?.autoDeduct?.aggregatedBreakdown &&
    combo.comboInventory.autoDeduct.aggregatedBreakdown.length
      ? combo.comboInventory.autoDeduct.aggregatedBreakdown
      : // fallback: gom theo comboItems (sử dụng dạng {product, weight, ripeness, need})
        (combo?.comboItems || []).map((ci) => ({
          product: ci.product,
          weight: ci.weight || "",
          ripeness: ci.ripeness || "",
          need: Math.max(1, Number(ci.qty || 1)),
        }));

  for (const row of agg) {
    const childPid = row.product;
    const weight = String(row.weight || "");
    const ripeness = String(row.ripeness || "");
    const need = Math.max(0, Number(row.need || 0));
    if (!childPid || need <= 0) continue;

    const incQty = need * qty;
    await Product.updateOne(
      { _id: childPid },
      { $inc: { "variants.$[elem].stock": incQty } },
      {
        arrayFilters: [
          {
            "elem.attributes.weight": weight,
            "elem.attributes.ripeness": ripeness,
          },
        ],
      }
    );
  }
}

// Hoàn kho cho item VARIANT (nhận biết BOX → cộng về base 1kg; LOẺ → cộng đúng biến thể)
async function _restoreStockForVariantItem(snap) {
  const qty = Math.max(1, Number(snap?.quantity || 1));
  if (!qty || !snap?.product) return;

  const pDoc = await Product.findById(snap.product).lean();
  if (!pDoc) return;

  // tìm biến thể theo id (ưu tiên) → để biết có phải BOX không
  const v =
    (pDoc.variants || []).find((vv) => String(vv._id) === String(snap.variantId)) ||
    (pDoc.variants || []).find(
      (vv) =>
        String(vv?.attributes?.weight || "") === String(snap?.variant?.weight || "") &&
        String(vv?.attributes?.ripeness || "") === String(snap?.variant?.ripeness || "")
    ) ||
    null;

  if (!v) return;

  if (isBoxVariant(v)) {
    // Trường hợp mua thùng: đã trừ base 1kg theo decOneStockNonTx → trả lại base 1kg theo kgPerBox
    const base1kg = findOneKgVariant(pDoc);
    if (!base1kg?._id) return;

    const perBoxKg = kgPerBox(v);
    const incUnits = Math.max(1, Math.round(qty * perBoxKg - 1e-9));

    await Product.updateOne(
      { _id: snap.product, "variants._id": base1kg._id },
      { $inc: { "variants.$.stock": incUnits } }
    );
    return;
  }

  // Hàng lẻ: trả đúng biến thể đã mua
  await Product.updateOne(
    { _id: snap.product, "variants._id": v._id },
    { $inc: { "variants.$.stock": qty } }
  );
}

/* ---------------------------------------------
 * Snapshot builders (fallback khi controller chưa truyền itemsSnapshot)
 * -------------------------------------------*/
// Regular variant snapshot (giống momo.controller)
import { computeExpiryInfo } from "../utils/expiryHelpers.js";
async function _buildVariantSnapshotFromCartItem(ci) {
  const productDoc = await Product.findById(ci.productId).lean();
  if (!productDoc) throw new Error(`Sản phẩm không tồn tại: ${ci.productId}`);

  // chọn variant (id trước, rồi attributes)
  const variants = Array.isArray(productDoc.variants) ? productDoc.variants : [];
  let variant =
    (ci.variantId &&
      variants.find((v) => String(v._id) === String(ci.variantId))) ||
    variants.find(
      (v) =>
        String(v?.attributes?.weight || "") === String(ci?.variant?.weight || "") &&
        String(v?.attributes?.ripeness || "") === String(ci?.variant?.ripeness || "")
    ) ||
    null;

  if (!variant && productDoc.baseVariant?.price != null) {
    variant = { ...productDoc.baseVariant, _id: productDoc.baseVariant?._id || "base" };
  }
  if (!variant) {
    throw new Error(`Biến thể không tồn tại cho sản phẩm ${productDoc?.name || ci.productId}`);
  }

  const vPrice = Number(variant?.price ?? productDoc?.baseVariant?.price ?? 0);
  const info = computeExpiryInfo(productDoc, vPrice);
  if (info.expireAt && info.expireAt < new Date()) {
    throw new Error(`"${productDoc.name || "Sản phẩm"}" đã hết hạn sử dụng`);
  }

  const qty = Math.max(1, Number(ci?.quantity || 0)) || 1;
  const line = Math.round(Number(info.finalPrice) * qty);

  return {
    type: "variant",
    product: productDoc._id,
    productName: productDoc.name,
    isCombo: false,
    isMix: false,
    variantId: variant?._id || null,
    variant: {
      weight: variant?.attributes?.weight || "",
      ripeness: variant?.attributes?.ripeness || "",
      grade: variant?.grade || "",
    },
    quantity: qty,
    unitPrice: Math.round(Number(info.basePrice)),
    unitPriceFinal: Math.round(Number(info.finalPrice)),
    price: Math.round(Number(info.finalPrice)),
    lineTotal: line,
    nearExpiryDiscountPercent: Number(info.discountPercent || 0),
    _expiry: {
      expireAt: info.expireAt || null,
      daysLeft: info.daysLeft ?? null,
    },
  };
}

// Combo snapshot từ payload FE (giữ nguyên cấu trúc đã thống nhất)
function _buildComboSnapshotFromCartItem(ci) {
  const qty = Math.max(1, Number(ci?.quantity || 0)) || 1;
  const snap = ci?.snapshot || {};
  const unit = Number(snap.unitPrice ?? ci?.unitPrice ?? 0) || 0;

  const items =
    Array.isArray(snap.items) && snap.items.length
      ? snap.items.map((x) => ({
          productId: x.productId || x.id || null,
          qty: Math.max(1, Number(x.qty || x.quantity || 1)) || 1,
        }))
      : [];

  return {
    type: "combo",
    product: ci?.productId || null,
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
    unitPrice: Math.round(unit),
    unitPriceFinal: Math.round(unit),
    price: Math.round(unit),
    lineTotal: Math.round(unit * qty),
    nearExpiryDiscountPercent: 0,
    _expiry: null,
  };
}

// Mix snapshot từ payload FE
function _buildMixSnapshotFromCartItem(ci) {
  const boxQty = Math.max(1, Number(ci?.quantity || 1));
  const raw = Array.isArray(ci?.items) ? ci.items : [];

  const entries = raw.map((x) => {
    const linePrice =
      Number(x?.linePrice || 0) > 0 ? Number(x.linePrice) : _calcMixEntryPrice(x);
    return {
      product: x?.productId || null,
      productId: x?.productId || null,
      productName: "",
      qty: Math.max(0, Number(x?.qty || 0)),
      unitPrice: Number(x?.unitPrice || 0),
      pricePerKg: Number(x?.pricePerKg || 0),
      weightGram: Math.max(0, Number(x?.weightGram || 0)),
      linePrice: Math.max(0, linePrice),
    };
  });

  // giá 1 hộp
  let totalPrice = Number(ci?.totalPrice || 0);
  if (!totalPrice || totalPrice < 0) {
    totalPrice = entries.reduce((s, e) => s + Number(e.linePrice || 0), 0);
  }
  totalPrice = Math.max(0, Math.round(totalPrice));

  return {
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
    lineTotal: totalPrice * boxQty,
    nearExpiryDiscountPercent: 0,
    _expiry: null,
  };
}

// Ghép snapshot fallback khi controller chưa truyền sẵn
async function _ensureSnapshots({ cartItems, itemsSnapshot }) {
  if (Array.isArray(itemsSnapshot) && itemsSnapshot.length) return itemsSnapshot;

  const out = [];
  for (const ci of cartItems || []) {
    const t = String(ci?.type || "").toLowerCase();

    if (t === "mix" || Array.isArray(ci?.items)) {
      out.push(_buildMixSnapshotFromCartItem(ci));
      continue;
    }
    if (t === "combo" || ci?.snapshot) {
      out.push(_buildComboSnapshotFromCartItem(ci));
      continue;
    }
    // regular
    const snap = await _buildVariantSnapshotFromCartItem(ci);
    out.push(snap);
  }
  return out;
}

/* ---------------------------------------------
 * Service core
 * -------------------------------------------*/
const createOrderTemp = async ({
  userId,
  cartItems = [],
  itemsSnapshot = [],
  voucher, // code string (optional)
  shippingAddress = {},
  subtotal: subtotalFromReq, // optional (controller đã tính)
  shippingFee = 0,
  shippingRuleName,
}) => {
  // Chuẩn hoá địa chỉ sang shape order.shippingAddress
  const ship = normalizeShippingAddress(shippingAddress);

  // 1) Build/ensure snapshots (đã gồm MIX/COMBO/VARIANT)
  const snaps = await _ensureSnapshots({ cartItems, itemsSnapshot });

  // 2) Subtotal chuẩn từ snapshot
  const subtotal =
    Number.isFinite(Number(subtotalFromReq)) && Number(subtotalFromReq) > 0
      ? Math.round(Number(subtotalFromReq))
      : snaps.reduce((s, it) => s + Math.round(Number(it.lineTotal || 0)), 0);

  // 3) Voucher validate (KHÔNG trừ quantity ở đây)
  let validVoucher = null;
  let discountAmount = 0;
  if (voucher) {
    try {
      validVoucher = await voucherService.validate(voucher, userId);
      if (validVoucher) {
        const minOrder = Number(validVoucher.minOrder || validVoucher.min_order || 0);
        if (!minOrder || subtotal >= minOrder) {
          const discountVal = Number(validVoucher.discount || validVoucher.percent || 0);
          if (discountVal > 0 && discountVal <= 100) {
            discountAmount = Math.floor(subtotal * (discountVal / 100));
            const maxDiscount = Number(validVoucher.maxDiscount || validVoucher.max_amount || 0);
            if (maxDiscount > 0) discountAmount = Math.min(discountAmount, maxDiscount);
          } else if (discountVal > 0) {
            discountAmount = Math.floor(discountVal);
          }
          discountAmount = Math.min(discountAmount, subtotal);
        }
      }
    } catch (e) {
      // Voucher không hợp lệ → bỏ qua, không chặn tạo đơn tạm
      validVoucher = null;
      discountAmount = 0;
    }
  }

  // 4) Tính total
  const total = Math.max(0, Math.round(subtotal + Number(shippingFee || 0) - discountAmount));

  // 5) TRỪ KHO TẠM bằng decOneStockNonTx cho từng snapshot
  const decDone = [];
  try {
    for (const snap of snaps) {
      const info = await decOneStockNonTx(snap);
      if (!info?.ok) {
        throw new Error(
          snap?.isMix
            ? "Giỏ Mix không đủ tồn kho cho một hoặc nhiều thành phần"
            : snap?.isCombo
            ? "Không đủ tồn kho cho combo"
            : "Không đủ tồn kho cho sản phẩm"
        );
      }
      decDone.push({ snap, info });
    }
  } catch (e) {
    // rollback những cái đã trừ
    // (không dùng rollbackOneStock vì không persist info; các decDone đã có info cho phần đã trừ)
    for (const d of decDone.reverse()) {
      try {
        // Thay vì gọi rollbackOneStock (cũng ok), ta hoàn kho thủ công theo info:
        // Tuy nhiên info.mode đã đủ để hoàn kho; để đơn giản gọi rollbackOneStock cũng được
        // nhưng module này không import rollbackOneStock theo yêu cầu thiết kế ban đầu.
        // Ở đây ta dùng chính chiều đảo tự viết cho các mode phổ biến nếu muốn.
        // Để kín kẽ, dùng cách đơn giản: tự khôi phục theo snapshot (đã viết các hàm _restore*).
        if (d.snap.isMix) await _restoreStockForMixItem(d.snap);
        else if (d.snap.isCombo) await _restoreStockForComboItem(d.snap);
        else await _restoreStockForVariantItem(d.snap);
      } catch (_) {}
    }
    throw e;
  }

  // 6) Tạo ORDER tạm (unpaid)
  const order = new Order({
    user: userId,
    items: snaps,
    itemsSnapshot: snaps,
    voucher: validVoucher ? validVoucher._id : null,
    paymentMethod: "momo",
    paymentStatus: "unpaid",
    status: "pending",
    shippingAddress: ship,
    shippingFee: Math.round(Number(shippingFee || 0)),
    shippingRuleName,
    subtotal: Math.round(subtotal),
    discount: Math.round(discountAmount),
    total,
  });

  await order.save();

  // 7) Auto-cancel sau 15 phút nếu chưa thanh toán
  setTimeout(async () => {
    try {
      const latest = await Order.findById(order._id).lean();
      if (latest && latest.paymentStatus === "unpaid") {
        await cancelMomoOrder(order._id, { reason: "Auto-cancel: timeout" });
      }
    } catch (err) {
      console.error("[momo.service] auto-cancel error:", err?.message || err);
    }
  }, 15 * 60 * 1000);

  return order;
};

const createMomoPayment = async (order, amountOverride) => {
  const requestId = `${partnerCode}${Date.now()}`;
  const orderId = order._id.toString();
  const orderInfo = "Thanh toán đơn hàng FreshFruit";
  const amount = String(
    Math.max(0, Math.round(Number(amountOverride ?? order.total ?? 0)))
  );
  const requestType = "payWithMethod";
  const extraData = "";

  const rawSignature = [
    `accessKey=${accessKey}`,
    `amount=${amount}`,
    `extraData=${extraData}`,
    `ipnUrl=${ipnUrl}`,
    `orderId=${orderId}`,
    `orderInfo=${orderInfo}`,
    `partnerCode=${partnerCode}`,
    `redirectUrl=${redirectUrl}`,
    `requestId=${requestId}`,
    `requestType=${requestType}`,
  ].join("&");

  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(rawSignature)
    .digest("hex");

  const body = JSON.stringify({
    partnerCode,
    partnerName: "MoMo Payment",
    storeId: "FreshFruitStore",
    requestId,
    amount,
    orderId,
    orderInfo,
    redirectUrl,
    ipnUrl,
    lang: "vi",
    requestType,
    signature,
    extraData,
  });

  const options = {
    hostname: "test-payment.momo.vn",
    path: "/v2/gateway/api/create",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      res.setEncoding("utf8");
      let responseBody = "";
      res.on("data", (chunk) => (responseBody += chunk));
      res.on("end", () => {
        try {
          const data = JSON.parse(responseBody);
          if (data && data.payUrl) return resolve(data.payUrl);
          reject(new Error("MoMo không trả về payUrl"));
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on("error", (err) => reject(err));
    req.write(body);
    req.end();
  });
};

const confirmMomoOrder = async (orderId) => {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Không tìm thấy đơn hàng");
  if (order.paymentStatus === "paid") return;

  order.paymentStatus = "paid";
  order.status = "confirmed";
  await order.save();

  // Nếu có voucher, chỉ "use" lúc đã thanh toán
  try {
    if (order.voucher) {
      const v = await Voucher.findById(order.voucher).lean();
      if (v?.code) {
        await voucherService.useVoucher(v.code, order.user);
      }
    }
  } catch (e) {
    console.error("[momo.service] useVoucher error:", e?.message || e);
  }

  // Tặng voucher theo chi tiêu (best-effort)
  try {
    await voucherService.assignVoucherBasedOnSpending(order.user);
  } catch (e) {
    console.error("[momo.service] assignVoucherBasedOnSpending error:", e?.message || e);
  }
};

const cancelMomoOrder = async (orderId, { reason } = {}) => {
  const order = await Order.findById(orderId);
  if (!order) return;
  if (order.paymentStatus !== "unpaid") return; // đã thanh toán/đã fail thì không hủy lại

  // HOÀN KHO theo snapshot
  for (const it of order.items || []) {
    try {
      if (it.isMix || (it.mix && Array.isArray(it.mix.items))) {
        await _restoreStockForMixItem(it);
      } else if (it.isCombo && it.combo) {
        await _restoreStockForComboItem(it);
      } else {
        await _restoreStockForVariantItem(it);
      }
    } catch (e) {
      console.error("[momo.service] restore stock error:", e?.message || e);
    }
  }

  // Voucher: không cần hoàn số lượng vì chưa "use" lúc tạo đơn tạm

  // Cập nhật trạng thái
  order.paymentStatus = "failed";
  order.status = "cancelled";
  order.note = [order.note || "", reason || ""].filter(Boolean).join(" | ");
  await order.save();

  console.log(`[momo.service] Cancelled order ${orderId}. Reason: ${reason || "N/A"}`);
};

export default {
  createOrderTemp,
  createMomoPayment,
  confirmMomoOrder,
  cancelMomoOrder,
  _restoreStockForMixItem,
  _restoreStockForComboItem,
  _restoreStockForVariantItem,
};
