// src/services/order.service.js
import mongoose from "mongoose";
import Order from "../models/order.model.js";
import Voucher from "../models/voucher.model.js";
import Product from "../models/product.model.js";
import Cart from "../models/cart.model.js";
import Address from "../models/address.model.js";
import { quoteShipping } from "./shipping.service.js";
import voucherService from "./voucher.service.js";

// So sánh biến thể theo attributes
const isSameVariantAttr = (a = {}, b = {}) =>
  String(a.weight || "") === String(b.weight || "") &&
  String(a.ripeness || "") === String(b.ripeness || "");

// Tiện ích số tiền
const toMoney = (v) => Math.max(0, Math.round(Number(v || 0)));

/* ===== Helper quy đổi trọng lượng -> kg (để dùng chung kho 1kg) ===== */
const kgFromWeight = (w) => {
  if (!w) return null;
  const s = String(w).toLowerCase().trim();
  const mKg = s.match(/(\d+(?:[.,]\d+)?)\s*kg/);
  if (mKg) return parseFloat(mKg[1].replace(",", "."));
  const mG = s.match(/(\d+(?:[.,]\d+)?)\s*g/);
  if (mG) return parseFloat(mG[1].replace(",", ".")) / 1000;
  return null;
};

// Lấy biến thể 1kg (nếu có)
const findBase1kgVariant = (p) =>
  (p?.variants || []).find((v) => (kgFromWeight(v?.attributes?.weight) || 0) === 1) || null;

/* ===== “Giá ưu tiên” legacy cho combo dựa trên product con ===== */
function pickUnitPriceForProduct(p) {
  if (!p) return 0;
  const dv = Number(p?.displayVariant?.price || 0);
  if (dv > 0) return dv;

  const pack = Array.isArray(p?.packagingOptions)
    ? p.packagingOptions.find((x) => Number(x?.price) > 0)
    : null;
  if (pack) return Number(pack.price || 0);

  const v0 = Number(p?.variants?.[0]?.price || 0);
  if (v0 > 0) return v0;

  const base = Number(p?.baseVariant?.price || 0);
  if (base > 0) return base;

  return 0;
}

/**
 * Legacy: tính giá combo từ product type combo/mix nếu DB có cấu trúc comboItems/discount.
 * (Luồng mới FE gửi snapshot nên có thể không cần hàm này, nhưng giữ để tương thích.)
 */
async function computeComboPrice(comboProductDoc) {
  const combo = comboProductDoc?.toObject ? comboProductDoc.toObject() : comboProductDoc;
  if (!combo) return 0;

  // fixed (có thể là comboPrice cũ)
  const fixed = Number(combo.comboPrice || combo?.comboPricing?.fixedPrice || 0);
  if (fixed > 0) return fixed;

  let subtotal = 0;
  const items = Array.isArray(combo.comboItems) ? combo.comboItems : [];
  for (const it of items) {
    const pid = it?.product?._id || it?.product;
    if (!pid) continue;
    const p =
      it?.product && typeof it.product === "object"
        ? it.product
        : await Product.findById(pid).lean();
    if (!p) continue;
    subtotal += pickUnitPriceForProduct(p) * (Number(it?.qty || 1));
  }

  const percent =
    Number(combo?.comboPricing?.discountPercent || 0) ||
    Number(combo.comboDiscountPercent || 0);
  const total = toMoney(subtotal * (1 - Math.max(0, Math.min(percent, 100)) / 100));
  return total;
}

/* ===========================================================
 * Atomic stock helpers (non-transaction) + rollback
 * - Ưu tiên trừ kho theo biến thể 1kg (nếu có)
 * - decUnits = ROUND(qty * weightKg)
 * - ĐỐI VỚI COMBO: KHÔNG trừ kho thành phần
 * =========================================================*/
async function decOneStockNonTx(item) {
  // Combo: không trừ kho
  if (item?.isCombo) return { ok: true, mode: "combo-no-stock-change" };

  const qty = Math.max(1, Number(item.quantity || 1));

  // Cần doc để biết weight & tìm base 1kg
  const pDoc = await Product.findById(item.product).lean();
  if (!pDoc) return { ok: false, reason: "product-not-found" };

  // Xác định biến thể đã chọn
  let chosen =
    (pDoc.variants || []).find((v) => String(v._id) === String(item.variantId)) || null;

  if (!chosen) {
    const w = item?.variant?.weight ?? "";
    const r = item?.variant?.ripeness ?? "";
    if (w || r) {
      chosen = (pDoc.variants || []).find((v) =>
        isSameVariantAttr(v?.attributes || {}, { weight: w, ripeness: r })
      ) || null;
    }
  }

  // Nếu không tìm được → thử trừ trực tiếp theo id (giữ hành vi cũ)
  if (!chosen) {
    const resFallback = await Product.updateOne(
      { _id: item.product, "variants._id": item.variantId, "variants.stock": { $gte: qty } },
      { $inc: { "variants.$.stock": -qty } }
    );
    if (resFallback.modifiedCount > 0) return { ok: true, mode: "variantsById-fallback" };
    return { ok: false, reason: "variant-not-found" };
  }

  // Tính số đơn vị 1kg cần trừ
  const weightKg = kgFromWeight(chosen?.attributes?.weight) || 1;
  const decUnits = Math.round(qty * weightKg);

  // Tìm biến thể 1kg để trừ
  const base1kg = findBase1kgVariant(pDoc);
  if (base1kg?._id) {
    const resBase = await Product.updateOne(
      { _id: item.product, "variants._id": base1kg._id, "variants.stock": { $gte: decUnits } },
      { $inc: { "variants.$.stock": -decUnits } }
    );
    if (resBase.modifiedCount > 0)
      return { ok: true, mode: "base1kg", baseId: base1kg._id, decUnits };
  }

  // Không có 1kg → trừ trực tiếp biến thể chọn
  const resChosen = await Product.updateOne(
    { _id: item.product, "variants._id": chosen._id, "variants.stock": { $gte: qty } },
    { $inc: { "variants.$.stock": -qty } }
  );
  if (resChosen.modifiedCount > 0) return { ok: true, mode: "variantsById", chosenId: chosen._id };

  return { ok: false, reason: "insufficient-stock" };
}

async function rollbackOneStock(item, info) {
  if (!info?.ok) return;
  if (info.mode === "combo-no-stock-change") return;

  const qty = Math.max(1, Number(item.quantity || 1));

  if (info.mode === "base1kg") {
    const incUnits = Math.max(0, Number(info.decUnits || 0)) || Math.round(qty);
    await Product.updateOne(
      { _id: item.product, "variants._id": info.baseId },
      { $inc: { "variants.$.stock": incUnits } }
    );
    return;
  }

  if (info.mode === "variantsById" || info.mode === "variantsById-fallback") {
    await Product.updateOne(
      { _id: item.product, "variants._id": item.variantId },
      { $inc: { "variants.$.stock": qty } }
    );
    return;
  }

  if (info.mode === "variantsByAttr") {
    const w = info.selector?.w ?? item?.variant?.weight ?? "";
    const r = info.selector?.r ?? item?.variant?.ripeness ?? "";
    await Product.updateOne(
      {
        _id: item.product,
        "variants.attributes.weight": w,
        "variants.attributes.ripeness": r,
      },
      { $inc: { "variants.$.stock": qty } }
    );
  }
}

/* ===========================================================
 * Tạo Order (non-transaction)
 * - Nhận cartItems kiểu MỚI:
 *   + type="combo" với snapshot {title,image,unitPrice,items:[{productId,qty}],discountPercent?}
 *   + type null/"variant" với { productId, quantity, variantId? | variant{weight,ripeness} }
 * - “Thùng” vẫn là 1 variant như thường
 * - TỒN KHO: ưu tiên trừ trên biến thể 1kg
 * =========================================================*/
export const createOrder = async ({
  userId,
  cartItems = [],
  voucher,                 // code hoặc ObjectId
  address,                 // {_id} hoặc object đầy đủ
  paymentMethod = "cod",
}) => {
  // 1) Địa chỉ giao hàng
  let addr = null;
  if (address?._id) {
    addr = await Address.findById(address._id).lean();
    if (!addr) throw new Error("Địa chỉ giao hàng không hợp lệ");
  } else if (address && address.fullName && address.phone && address.province) {
    addr = address;
  } else {
    throw new Error("Thiếu thông tin địa chỉ giao hàng");
  }

  // 2) Duyệt cart items
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    throw new Error("Giỏ hàng trống");
  }

  const items = [];  // để lưu vào Order
  let subtotal = 0;

  for (const ci of cartItems) {
    const type = String(ci?.type || "variant").toLowerCase();

    /* ===== COMBO/MIX kiểu MỚI (snapshot price lock) ===== */
    if (type === "combo") {
      const qty = Math.max(1, Number(ci.quantity || 0));

      const snap = ci?.snapshot || {};
      const unitPrice = toMoney(snap.unitPrice || ci?.unitPrice || 0);
      const line = unitPrice * qty;

      const comboInfo = {
        title: snap.title || ci?.title || "Combo",
        image: snap.image || ci?.image || null,
        discountPercent: Number(snap.discountPercent || 0),
        items: Array.isArray(snap.items)
          ? snap.items.map((x) => ({ productId: x.productId, qty: Number(x.qty || 1) }))
          : [],
      };

      items.push({
        product: ci?.productId || null,
        productName: comboInfo.title,
        isCombo: true,
        quantity: qty,
        price: unitPrice,       // đơn giá combo
        unitPriceFinal: unitPrice,
        lineTotal: line,
        combo: comboInfo,
        variantId: null,
        variant: null,
      });

      subtotal += line;
      continue;
    }

    /* ===== LEGACY COMBO (product.isCombo) – vẫn hỗ trợ nếu còn dùng ===== */
    const product = await Product.findById(ci.productId).lean();
    if (!product) throw new Error(`Sản phẩm không tồn tại: ${ci.productId}`);

    const qty = Math.max(1, Number(ci.quantity || 0));

    if (product.isCombo === true || product?.type === "combo") {
      const unitPrice = await computeComboPrice(product);
      const line = unitPrice * qty;

      items.push({
        product: product._id,
        productName: product.name,
        isCombo: true,
        quantity: qty,
        price: unitPrice,
        unitPriceFinal: unitPrice,
        lineTotal: line,
        combo: {
          title: product.name,
          image: product.image || null,
          discountPercent:
            Number(product?.comboPricing?.discountPercent || 0) ||
            Number(product?.comboDiscountPercent || 0),
          items: Array.isArray(product?.comboItems)
            ? product.comboItems.map((x) => ({
                productId: x?.product?._id || x?.product,
                qty: Number(x?.qty || 1),
              }))
            : [],
        },
        variantId: null,
        variant: null,
      });

      subtotal += line;
      continue;
    }

    /* ===== SẢN PHẨM THƯỜNG (bao gồm “thùng”) ===== */
    let chosenVariant = null;

    if (ci.variantId) {
      chosenVariant =
        (product.variants || []).find((v) => String(v._id) === String(ci.variantId)) || null;
    }
    if (!chosenVariant && ci.variant) {
      const { weight = "", ripeness = "" } = ci.variant || {};
      chosenVariant = (product.variants || []).find((v) =>
        isSameVariantAttr(v?.attributes || {}, { weight, ripeness })
      ) || null;
    }
    if (!chosenVariant && product.baseVariant && product.baseVariant.price != null) {
      chosenVariant = {
        ...product.baseVariant,
        _id: product.baseVariant?._id || new mongoose.Types.ObjectId(),
      };
    }
    if (!chosenVariant) {
      throw new Error(`Không tìm thấy biến thể phù hợp cho sản phẩm ${product.name}`);
    }

    // Kiểm tra tồn kho (ưu tiên 1kg)
    const base1kg = findBase1kgVariant(product);
    const weightKg = kgFromWeight(chosenVariant?.attributes?.weight) || 1;
    const needBaseUnits = Math.round(qty * weightKg);

    if (base1kg) {
      const baseRemain = Number(base1kg.stock || 0);
      if (baseRemain < needBaseUnits) {
        throw new Error(`Không đủ tồn kho (cần ${needBaseUnits}kg) cho sản phẩm ${product.name}`);
      }
    } else {
      const remain = Number(chosenVariant.stock || 0);
      if (remain < qty) {
        throw new Error(`Không đủ tồn kho cho sản phẩm ${product.name}`);
      }
    }

    const unitPrice = Number(chosenVariant.price || 0);
    const line = unitPrice * qty;

    items.push({
      product: product._id,
      productName: product.name,
      isCombo: false,
      quantity: qty,
      price: unitPrice,
      unitPriceFinal: unitPrice,
      lineTotal: line,
      variant: {
        grade: "",
        weight: chosenVariant?.attributes?.weight || "",
        ripeness: chosenVariant?.attributes?.ripeness || "",
      },
      variantId: chosenVariant._id,
    });

    subtotal += line;
  }

  // 3) Phí ship
  let shippingFee = 0;
  let ruleName;
  try {
    const quoted = await quoteShipping({
      provinceCode: 1, // ví dụ
      districtCode: String(addr.districtCode || addr.district_code || ""),
      wardCode: String(addr.wardCode || addr.ward_code || ""),
      cartSubtotal: subtotal,
    });
    shippingFee = Number(quoted?.amount || 0);
    ruleName = quoted?.ruleName;
  } catch (e) {
    console.warn("[order.service] quoteShipping lỗi, dùng 0đ:", e?.message || e);
  }

  // 4) Voucher
  let appliedVoucher = null;
  let discountAmount = 0;
  let vDoc = null;

  if (voucher) {
    if (typeof voucher === "string") {
      vDoc = await Voucher.findOne({ code: voucher.trim().toUpperCase() });
    } else if (mongoose.isValidObjectId(voucher)) {
      vDoc = await Voucher.findById(voucher);
    }

    if (!vDoc) throw new Error("Mã giảm giá không hợp lệ");

    // kiểm tra voucher gán cho user (nếu có)
    if (Array.isArray(vDoc.assignedUsers) && vDoc.assignedUsers.length > 0) {
      const assigned = vDoc.assignedUsers.map(String);
      if (!assigned.includes(String(userId))) {
        throw new Error("Mã giảm giá không thuộc về bạn");
      }
    }

    if (vDoc.discount > 0 && vDoc.discount <= 100) {
      discountAmount = (subtotal * vDoc.discount) / 100;
    } else {
      discountAmount = Number(vDoc.discount || 0);
    }

    if (vDoc.maxDiscount) {
      discountAmount = Math.min(discountAmount, Number(vDoc.maxDiscount || 0));
    }

    discountAmount = toMoney(discountAmount);
    appliedVoucher = vDoc._id;
  }

  // 5) Tổng tiền
  const subtotalMoney = toMoney(subtotal);
  const shippingMoney = toMoney(shippingFee);
  const total = toMoney(subtotalMoney + shippingMoney - discountAmount);

  // 6) Trừ kho (non-transaction) + rollback
  const decLogs = [];
  try {
    for (const it of items) {
      const info = await decOneStockNonTx(it);
      if (!info.ok) {
        throw new Error(
          `Hết hàng hoặc không đủ tồn kho cho biến thể ${it?.variant?.weight || ""} ${it?.variant?.ripeness || ""}`
        );
      }
      decLogs.push({ it, info });
    }
  } catch (stockErr) {
    for (const d of decLogs.reverse()) {
      try { await rollbackOneStock(d.it, d.info); } catch {}
    }
    throw stockErr;
  }

  // 7) Lưu Order (rollback kho nếu lỗi)
  let createdOrder = null;
  try {
    const order = new Order({
      user: userId,
      items, // chứa cả isCombo/combo
      total,
      subtotal: subtotalMoney,
      shippingFee: shippingMoney,
      shippingRuleName: ruleName || null,
      voucher: appliedVoucher || null,
      status: "pending",
      paymentStatus: paymentMethod === "momo" ? "paid" : "unpaid",
      paymentMethod,
      shippingAddress: {
        fullName: addr.fullName,
        phone: addr.phone,
        province: addr.province,
        district: addr.district,
        ward: addr.ward,
        detail: addr.detail,
        districtCode: addr.districtCode || addr.district_code || "",
        wardCode: addr.wardCode || addr.ward_code || "",
      },
    });

    createdOrder = await order.save();
  } catch (saveErr) {
    for (const d of decLogs.reverse()) {
      try { await rollbackOneStock(d.it, d.info); } catch {}
    }
    throw saveErr;
  }

  // 8) Hậu xử lý
  // 8a) Giảm số lượng voucher (nếu có quản lý số lượng)
  try {
    if (vDoc && vDoc.quantity != null && vDoc.quantity > 0) {
      vDoc.quantity -= 1;
      await vDoc.save();
    }
  } catch (e) {
    console.warn("[order.service] giảm số lượng voucher lỗi:", e?.message || e);
  }

  // 8b) Xoá các item variant khỏi giỏ (combo để nguyên) – soft fail
  try {
    const pullConds = items
      .filter((i) => i.variantId) // chỉ xoá dòng variant
      .map((i) => ({ product: i.product, variantId: i.variantId }));
    if (pullConds.length) {
      await Cart.findOneAndUpdate(
        { user: userId },
        { $pull: { items: { $or: pullConds } } }
      );
    }
  } catch (e) {
    console.warn("[order.service] remove-from-cart lỗi (bỏ qua):", e?.message || e);
  }

  // 8c) Gán voucher theo chi tiêu nếu đã thanh toán
  try {
    if (createdOrder?.paymentStatus === "paid") {
      await voucherService.assignVoucherBasedOnSpending(userId);
    }
  } catch (e) {
    console.warn("[order.service] assignVoucherBasedOnSpending error:", e?.message || e);
  }

  return createdOrder;
};

/* ======================== Admin utils ======================== */
export const getAllOrders = async () => {
  const orders = await Order.find()
    .populate("user", "username email")
    .populate("items.product", "name image")
    .populate("voucher", "code discount")
    .sort({ createdAt: -1 });
  return orders;
};

/**
 * Cập nhật trạng thái đơn hàng
 * - Nếu delivered & COD => coi như đã thanh toán
 * - Khi chuyển sang paid => auto-assign voucher theo ngưỡng chi tiêu
 */
export const updateOrderStatus = async (orderId, updates = {}) => {
  const { status, paymentStatus } = updates;

  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");

  let changed = false;

  if (status && status !== order.status) {
    order.status = status;
    changed = true;
  }

  if (paymentStatus && paymentStatus !== order.paymentStatus) {
    order.paymentStatus = paymentStatus;
    changed = true;
  }

  if (status === "delivered" && order.paymentMethod === "cod") {
    if (order.paymentStatus !== "paid") {
      order.paymentStatus = "paid";
      changed = true;
    }
  }

  if (changed) {
    await order.save();

    if (order.paymentStatus === "paid") {
      try {
        await voucherService.assignVoucherBasedOnSpending(order.user);
      } catch (err) {
        console.error("Auto-assign voucher error:", err.message);
      }
    }
  }

  return order;
};
