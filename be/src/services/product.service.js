// server/services/product.service.js
import mongoose from "mongoose";
import Product from "../models/product.model.js";
import Category from "../models/category.model.js";
import { computeExpiryInfo as beComputeExpiryInfo } from "../utils/expiryHelpers.js";

/* -------------------------------
 * Local helpers
 * ------------------------------- */
const toNumberOr = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const toDateOrNull = (v) => (v ? new Date(v) : null);
const isValidDate = (d) => d instanceof Date && !Number.isNaN(d.getTime());

/** Nhận 1 giá trị query, trả về:
 *  - 1 id nếu chỉ có 1
 *  - { $in: [...] } nếu là nhiều (mảng hoặc chuỗi CSV)
 */
const toInFilterIfMany = (qVal) => {
  if (!qVal) return undefined;
  if (Array.isArray(qVal)) {
    const arr = qVal.filter(Boolean);
    return arr.length > 1 ? { $in: arr } : arr[0];
  }
  if (typeof qVal === "string" && qVal.includes(",")) {
    const arr = qVal.split(",").map((s) => s.trim()).filter(Boolean);
    return arr.length > 1 ? { $in: arr } : arr[0] || undefined;
  }
  return qVal;
};

const generateVariants = (weights, ripenesses, baseVariant) => {
  const variants = [];
  const basePrice = Number(baseVariant.price);
  if (Number.isNaN(basePrice)) throw new Error("Giá baseVariant không hợp lệ");

  const weightMultiplier = { "0.5kg": 0.5, "1kg": 1, "1.5kg": 1.5, "2kg": 2 };
  const baseWeightMultiplier = weightMultiplier[baseVariant.attributes?.weight] ?? 1;

  for (const weight of weights) {
    for (const ripeness of ripenesses) {
      if (
        weight === baseVariant.attributes?.weight &&
        ripeness === baseVariant.attributes?.ripeness
      ) {
        continue;
      }
      let price = basePrice;
      if (weight !== baseVariant.attributes?.weight) {
        const targetWeightMultiplier = weightMultiplier[weight] ?? 1;
        price = Math.round(basePrice * (targetWeightMultiplier / baseWeightMultiplier));
      }
      variants.push({ attributes: { weight, ripeness }, price, stock: 0 });
    }
  }
  return variants;
};

/** Kiểm tra “còn hàng” nhanh */
const hasAnyStock = (p) => {
  const base = Number(p?.baseVariant?.stock || 0);
  const varSum = Array.isArray(p?.variants)
    ? p.variants.reduce((s, v) => s + Number(v?.stock || 0), 0)
    : 0;
  const packSum = Array.isArray(p?.packagingOptions)
    ? p.packagingOptions.reduce((s, o) => s + Number(o?.stock || 0), 0)
    : 0;
  return base + varSum + packSum > 0;
};

/* ===========================================================
 * Helpers tồn kho “kg ↔ thùng”
 * ===========================================================*/
function kgFromWeightText(txt) {
  if (!txt) return null;
  const s = String(txt).toLowerCase();
  const mk = s.match(/(\d+(?:[.,]\d+)?)\s*kg/);
  if (mk) return parseFloat(mk[1].replace(",", "."));
  const mg = s.match(/(\d+(?:[.,]\d+)?)\s*g/);
  if (mg) return parseFloat(mg[1].replace(",", ".")) / 1000;
  return null;
}

function isBoxish(v) {
  if (!v) return false;
  if (v.kind === "box") return true;
  if (v.isBoxVariant === true) return true; // từ packagingOptions → view
  if (Number(v?.attributes?.boxWeightKg || 0) > 0) return true;
  const w = String(v?.attributes?.weight || "");
  const lbl = String(v?.attributes?.boxLabel || "");
  return /thùng/i.test(w) || /thùng/i.test(lbl);
}

function getVariantKg(v) {
  const attr = v?.attributes || {};
  if (Number(attr.boxWeightKg) > 0) return Number(attr.boxWeightKg);
  if (v?.fromPackaging?.unitSize > 0) return Number(v.fromPackaging.unitSize);
  const fromText = kgFromWeightText(attr.weight);
  return Number.isFinite(fromText) ? fromText : null;
}

function findOneKgVariant(product) {
  const vs = Array.isArray(product?.variants) ? product.variants : [];

  // Ưu tiên variant loose 1kg
  let v = vs.find(
    (x) => (x.kind === "loose" || !x.kind) && getVariantKg(x) === 1
  );
  if (v) return { where: "variants", doc: v };

  // Chấp nhận boxWeightKg=1 (hiếm)
  v = vs.find((x) => Number(x?.attributes?.boxWeightKg || 0) === 1);
  if (v) return { where: "variants", doc: v };

  // Fallback baseVariant nếu weight là 1kg
  const baseKg = kgFromWeightText(product?.baseVariant?.attributes?.weight);
  if (baseKg === 1 && Number(product?.baseVariant?.stock) >= 0) {
    return { where: "base", doc: product.baseVariant };
  }
  return null;
}

/** Tính tồn kho hiển thị cho 1 biến thể.
 *  - BOX: floor(stock_1kg / kg_thùng)
 *  - NON-BOX: trả stock gốc.
 */
function effectiveStockOfVariant(product, v) {
  const raw = Number(v?.stock || 0);
  if (!isBoxish(v)) return raw;

  const oneKg = findOneKgVariant(product);
  if (!oneKg) return raw; // không xác định 1kg → dùng số đang lưu

  const stock1kg =
    oneKg.where === "variants"
      ? Number(oneKg.doc.stock || 0)
      : Number(product?.baseVariant?.stock || 0);

  const kg = getVariantKg(v);
  if (!kg || kg <= 0) return raw;
  return Math.floor(stock1kg / kg);
}

/** Gắn stock hiển thị cho toàn bộ variants:
 *  - Thêm `_stockRaw` (giá trị DB)
 *  - Ghi đè `stock` = tồn “hiển thị” (derive cho BOX)
 */
function attachDerivedStocks(pDoc) {
  if (!pDoc) return pDoc;
  const plain = pDoc?.toObject ? pDoc.toObject() : { ...(pDoc || {}) };

  if (Array.isArray(plain.variants)) {
    plain.variants = plain.variants.map((v) => {
      const _stockRaw = Number(v?.stock || 0);
      const stockDerived = effectiveStockOfVariant(plain, v);
      return { ...v, _stockRaw, stock: stockDerived };
    });
  }
  return plain;
}

/* --------- Preorder: merge an toàn --------- */
function mergePreorderToDoc(doc, payloadPreorder) {
  if (!payloadPreorder || typeof payloadPreorder !== "object") return;

  doc.preorder = doc.preorder || {
    cancelPolicy: { untilDate: null, feePercent: 0 },
    enabled: false,
    windowStart: null,
    windowEnd: null,
    expectedHarvestStart: null,
    expectedHarvestEnd: null,
    quota: 0,
    soldPreorder: 0,
    depositPercent: 20,
    priceLock: true,
    perVariantAllocations: [],
  };

  const p = payloadPreorder;

  if (typeof p.enabled === "boolean") doc.preorder.enabled = p.enabled;

  if (typeof p.depositPercent === "number") {
    doc.preorder.depositPercent = clamp(toNumberOr(p.depositPercent, 20), 0, 100);
  }

  if (typeof p.quota === "number") {
    doc.preorder.quota = Math.max(0, toNumberOr(p.quota, 0));
  }

  if (p.windowStart !== undefined) {
    const d = toDateOrNull(p.windowStart);
    doc.preorder.windowStart = d && isValidDate(d) ? d : null;
  }
  if (p.windowEnd !== undefined) {
    const d = toDateOrNull(p.windowEnd);
    doc.preorder.windowEnd = d && isValidDate(d) ? d : null;
  }

  if (p.expectedHarvestStart !== undefined) {
    const d = toDateOrNull(p.expectedHarvestStart);
    doc.preorder.expectedHarvestStart = d && isValidDate(d) ? d : null;
  }
  if (p.expectedHarvestEnd !== undefined) {
    const d = toDateOrNull(p.expectedHarvestEnd);
    doc.preorder.expectedHarvestEnd = d && isValidDate(d) ? d : null;
  }

  if (typeof p.priceLock === "boolean") doc.preorder.priceLock = p.priceLock;

  if (p.cancelPolicy && typeof p.cancelPolicy === "object") {
    const { untilDate, feePercent } = p.cancelPolicy;
    if (untilDate !== undefined) {
      const d = toDateOrNull(untilDate);
      doc.preorder.cancelPolicy.untilDate = d && isValidDate(d) ? d : null;
    }
    if (typeof feePercent === "number") {
      doc.preorder.cancelPolicy.feePercent = clamp(toNumberOr(feePercent, 0), 0, 100);
    }
  }

  if (Array.isArray(p.perVariantAllocations)) {
    const existing = Array.isArray(doc.preorder.perVariantAllocations)
      ? doc.preorder.perVariantAllocations
      : [];
    const keyOf = (a = {}) =>
      `${String(a.weight || "").trim()}|${String(a.ripeness || "").trim()}`;
    const oldMap = new Map(
      existing.map((row) => [keyOf(row.attributes || {}), toNumberOr(row.soldPreorder, 0)])
    );

    const nextMap = new Map();
    for (const row of p.perVariantAllocations) {
      if (!row || typeof row !== "object") continue;
      const weight = String(row?.attributes?.weight ?? "").trim();
      const ripeness = String(row?.attributes?.ripeness ?? "").trim();
      if (!weight && !ripeness) continue;

      const quota = Math.max(0, toNumberOr(row.quota, 0));
      const key = `${weight}|${ripeness}`;
      const keptSold = oldMap.get(key) ?? 0;

      nextMap.set(key, {
        attributes: { weight, ripeness },
        quota,
        soldPreorder: keptSold,
      });
    }
    doc.preorder.perVariantAllocations = Array.from(nextMap.values());
  }
}

/* --------- Expiry: chuẩn hoá theo helper MỚI + chấp nhận key cũ --------- */
function normalizeExpiry(raw) {
  if (!raw || typeof raw !== "object") return undefined;

  const out = {};

  // Ưu tiên expireDate mới; fallback từ expiryDate cũ
  const expireKey = raw.expireDate ?? raw.expiryDate;
  if (expireKey) {
    const d = new Date(expireKey);
    if (!Number.isNaN(d.getTime())) out.expireDate = d;
  } else {
    if (raw.mfgDate) {
      const m = new Date(raw.mfgDate);
      if (!Number.isNaN(m.getTime())) out.mfgDate = m;
    }
    if (raw.shelfLifeDays !== undefined && raw.shelfLifeDays !== null) {
      const n = Number(raw.shelfLifeDays);
      if (Number.isFinite(n)) out.shelfLifeDays = n;
    }
  }

  // discountNearExpiry (mới) hoặc map từ nearExpiryDays/discountPercent (cũ)
  if (raw.discountNearExpiry && typeof raw.discountNearExpiry === "object") {
    const dne = raw.discountNearExpiry;
    out.discountNearExpiry = {
      active:
        typeof dne.active === "boolean"
          ? dne.active
          : ((Number(dne.thresholdDays) || 0) > 0 && (Number(dne.percent) || 0) > 0),
      thresholdDays: Number.isFinite(Number(dne.thresholdDays)) ? Number(dne.thresholdDays) : 0,
      percent: Number.isFinite(Number(dne.percent)) ? Number(dne.percent) : 0,
    };
  } else if (
    raw.nearExpiryDays !== undefined ||
    raw.discountPercent !== undefined ||
    raw.enabled !== undefined
  ) {
    // bản cũ
    const thresholdDays = Number.isFinite(Number(raw.nearExpiryDays))
      ? Number(raw.nearExpiryDays)
      : 0;
    const percent = Number.isFinite(Number(raw.discountPercent))
      ? Number(raw.discountPercent)
      : 0;
    const active = typeof raw.enabled === "boolean" ? raw.enabled : thresholdDays > 0 && percent > 0;

    out.discountNearExpiry = { active, thresholdDays, percent };
  }

  // nếu rỗng → không set
  if (!out.expireDate && !out.mfgDate && out.shelfLifeDays == null && !out.discountNearExpiry) {
    return undefined;
  }
  return out;
}

/* ==========
 * Chuẩn hoá “BÁN THEO THÙNG” thành BIẾN THỂ (view-only)
 *  - Không thay đổi dữ liệu trong DB.
 *  - Trả về object MỚI, đã hợp nhất packagingOptions → variants + weightOptions/ripenessOptions.
 * ========== */
function unifyBoxesIntoVariantView(productObj) {
  const p = productObj?.toObject ? productObj.toObject() : { ...(productObj || {}) };
  const boxes = Array.isArray(p.packagingOptions) ? p.packagingOptions : [];
  if (!boxes.length) return p; // không có thùng → giữ nguyên

  // Chọn nhãn ripeness dùng cho “thùng” để không phá UX chọn biến thể cũ
  const fallbackRipeness =
    p?.ripenessOptions?.[0] ||
    p?.baseVariant?.attributes?.ripeness ||
    "Mặc định";

  // Bảo đảm ripenessOptions có chứa fallbackRipeness
  const ripenessOpts = Array.isArray(p.ripenessOptions) ? [...p.ripenessOptions] : [];
  if (!ripenessOpts.includes(fallbackRipeness)) ripenessOpts.unshift(fallbackRipeness);

  // Build variants hiện có
  const existed = Array.isArray(p.variants) ? [...p.variants] : [];

  // Tạo nhãn weight cho “thùng”
  const mkBoxWeightLabel = (box) => {
    if (box?.unitLabel && String(box.unitLabel).trim()) return String(box.unitLabel).trim();
    if (Number(box?.unitSize) > 0) return `Thùng ${box.unitSize}kg`;
    return "Thùng";
  };

  // Dựng các biến thể THÙNG từ packagingOptions
  const boxVariants = boxes
    .map((b) => {
      const weightLabel = mkBoxWeightLabel(b);
      // tránh trùng nếu đã có variant trùng trọng lượng + ripeness fallback
      const duplicated = existed.some(
        (v) =>
          v?.attributes?.weight === weightLabel &&
          v?.attributes?.ripeness === fallbackRipeness
      );
      if (duplicated) return null;

      return {
        _id: new mongoose.Types.ObjectId(), // id tạm để FE chọn
        attributes: { weight: weightLabel, ripeness: fallbackRipeness },
        price: Number(b?.price || 0),
        stock: Number(b?.stock || 0), // sẽ được derive lại ở attachDerivedStocks
        isBoxVariant: true,
        fromPackaging: { unitSize: b?.unitSize ?? null, type: b?.type ?? "box" },
      };
    })
    .filter(Boolean);

  // Hợp nhất danh sách weightOptions
  const weightOpts = Array.isArray(p.weightOptions) ? [...p.weightOptions] : [];
  for (const b of boxes) {
    const w = mkBoxWeightLabel(b);
    if (!weightOpts.includes(w)) weightOpts.push(w);
  }

  return {
    ...p,
    variants: [...existed, ...boxVariants],
    weightOptions: weightOpts,
    ripenessOptions: ripenessOpts,
  };
}

/* Đính kèm view: _expiry (mới) + expiryView/priceView (tương thích ngược)
 * + HỢP NHẤT THÙNG THÀNH BIẾN THỂ
 * + GẮN tồn kho derive cho BOX (stock = floor(stock_1kg / kg_thùng), _stockRaw = DB)
 */
function attachExpiryViews(doc) {
  if (!doc) return doc;

  // Hợp nhất “thùng” -> “biến thể”
  const merged = unifyBoxesIntoVariantView(doc);

  // Gắn tồn kho derive cho BOX
  const mergedWithStocks = attachDerivedStocks(merged);

  // Helper BE mới -> { expireAt, daysLeft, isNearExpiry, discountPercent, finalPrice, basePrice }
  const _expiry = beComputeExpiryInfo(mergedWithStocks);

  // Tương thích ngược: expiryView / priceView
  const threshold =
    Number(
      mergedWithStocks?.expiry?.discountNearExpiry?.thresholdDays ??
        mergedWithStocks?.expiry?.nearExpiryDays // legacy
    ) || 0;

  const expiryView = {
    enabled: !!_expiry?.expireAt,
    expiryDate: _expiry?.expireAt || null,
    daysLeft: _expiry?.daysLeft ?? null,
    nearExpiryDays: threshold,
    discountPercent: _expiry?.discountPercent ?? 0,
    isNearExpiry: !!_expiry?.isNearExpiry,
  };

  const baseOriginal = Number(_expiry?.basePrice) || 0;
  const baseFinal = Number(_expiry?.finalPrice) || baseOriginal;
  const discountApplied = Number(_expiry?.discountPercent) || 0;

  const variants = Array.isArray(mergedWithStocks?.variants)
    ? mergedWithStocks.variants.map((v) => {
        const vp = Number(v?.price) || 0;
        const vf =
          discountApplied > 0 && _expiry?.isNearExpiry
            ? Math.round(vp * (1 - discountApplied / 100))
            : vp;
        return {
          _id: String(v?._id || ""),
          attributes: v?.attributes || {},
          originalPrice: vp,
          finalPrice: vf,
          isBoxVariant: !!v?.isBoxVariant,
          stock: Number(v?.stock ?? 0),      // tồn kho hiển thị (đã derive nếu là box)
          _stockRaw: Number(v?._stockRaw ?? v?.stock ?? 0), // tồn kho DB
        };
      })
    : [];

  const priceView = {
    base: {
      originalPrice: baseOriginal,
      finalPrice: baseFinal,
      discountPercentApplied: discountApplied,
    },
    variants,
  };

  return { ...mergedWithStocks, _expiry, expiryView, priceView };
}

/* -------------------------------
 * COMBO: Chuẩn hoá input để không làm rơi field khi lưu
 * ------------------------------- */
function normalizeComboInput(body = {}) {
  // Chỉ xử lý khi là combo hoặc client gửi comboInventory/comboItems
  const looksLikeCombo =
    body.type === "combo" ||
    body.isCombo === true ||
    body.comboInventory != null ||
    Array.isArray(body.comboItems);

  if (!looksLikeCombo) return body;

  const out = { ...body };

  // Ép type/isCombo nhất quán
  out.type = "combo";
  out.isCombo = true;

  // comboItems: giữ ripeness/weight/qty, convert product->_id
  if (Array.isArray(out.comboItems)) {
    out.comboItems = out.comboItems.map((it) => ({
      product: (it?.product && it.product._id) ? it.product._id : it?.product,
      qty: Math.max(1, Number(it?.qty || 1)),
      ripeness: it?.ripeness ?? null,
      weight: it?.weight ?? null,
    }));
  }

  // comboInventory: giữ stock + autoDeduct.{pool,aggregatedBreakdown}
  const rootStockLegacy = Number(out.stock ?? out.comboStock ?? 0);
  if (out.comboInventory && typeof out.comboInventory === "object") {
    const ci = { ...out.comboInventory };
    ci.stock = Math.max(0, Number(ci.stock ?? rootStockLegacy ?? 0));

    if (ci.autoDeduct && typeof ci.autoDeduct === "object") {
      const ad = { ...ci.autoDeduct };
      if (ad.perComboPickCount != null) {
        ad.perComboPickCount = Math.max(0, Number(ad.perComboPickCount || 0));
      }
      ad.pool = Array.isArray(ad.pool)
        ? ad.pool.map((p) => ({
            product: (p?.product && p.product._id) ? p.product._id : p?.product,
            ripeness: p?.ripeness ?? null,
            weight: p?.weight ?? null, // model hiện tại có thể bỏ qua field dư thừa này → OK
            qty: Math.max(1, Number(p?.qty || 1)),
          }))
        : [];
      ad.aggregatedBreakdown = Array.isArray(ad.aggregatedBreakdown)
        ? ad.aggregatedBreakdown.map((b) => ({
            product: (b?.product && b.product._id) ? b.product._id : b?.product,
            ripeness: b?.ripeness ?? null,
            weight: b?.weight ?? null, // model hiện tại có thể bỏ qua field dư thừa này → OK
            need: Math.max(0, Number(b?.need || 0)),
          }))
        : [];
      ci.autoDeduct = ad;
    }

    out.comboInventory = ci;
  } else {
    // Không có comboInventory → map legacy sang comboInventory.stock
    out.comboInventory = { stock: Math.max(0, rootStockLegacy) };
  }

  return out;
}

/* -------------------------------
 * Service
 * ------------------------------- */
const productService = {
  createProduct: async (data) => {
    // 🔧 CHUẨN HOÁ COMBO để không rơi comboInventory.stock
    const normalizedData = normalizeComboInput(data);

    const {
      // cũ
      name,
      description,
      image,
      images,
      category,
      location,
      weightOptions = [],
      ripenessOptions = [],
      baseVariant,
      variants: inputVariants,
      preorder,
      expiry,

      // mới/legacy combo+mix (được giữ để tương thích)
      type,
      isCombo,
      isMixBuilder,
      comboItems,
      comboPricing,
      comboPrice,
      comboDiscountPercent,
      mixRules,
      comboInventory, // ✅ LẤY comboInventory sau khi normalize

      // cũ khác
      packagingOptions,
      alternatives,
      certifications,
      origin,
      storage,
      storageTips,
      tags,
    } = normalizedData;

    // build variants
    let variants = [];
    let displayVariant = null;

    if (Array.isArray(inputVariants) && inputVariants.length > 0) {
      variants = inputVariants;
      displayVariant = inputVariants[0];
    } else if (baseVariant?.attributes && typeof baseVariant.price !== "undefined") {
      baseVariant.price = Number(baseVariant.price);
      if (Number.isNaN(baseVariant.price)) throw new Error("Giá baseVariant không hợp lệ");
      const autoVariants = generateVariants(weightOptions, ripenessOptions, baseVariant);
      variants = [{ ...baseVariant }, ...autoVariants];
      displayVariant = baseVariant;
    }

    const doc = new Product({
      // type mới (ưu tiên) hoặc map từ legacy flags
      type: type || (isCombo ? "combo" : isMixBuilder ? "mix" : "single"),
      isCombo,
      isMixBuilder,

      name,
      description,
      image,
      images,
      category,
      location,
      weightOptions,
      ripenessOptions,
      baseVariant,
      variants,
      displayVariant,

      // combo / mix
      comboItems,
      comboPricing,
      comboPrice,
      comboDiscountPercent,
      mixRules,
      comboInventory, // ✅ GIỮ COMBO INVENTORY

      packagingOptions,
      alternatives,
      certifications,
      origin,       // string
      storage,      // string
      storageTips,  // array
      tags,
    });

    // Merge preorder / expiry
    if (preorder !== undefined) mergePreorderToDoc(doc, preorder);

    const normalizedExpiry = normalizeExpiry(expiry);
    if (normalizedExpiry) {
      doc.expiry = normalizedExpiry;
    }

    await doc.save();

    // trả về kèm _expiry + view tương thích
    const saved = await Product.findById(doc._id)
      .populate("category", "name")
      .populate("location", "name")
      .populate("alternatives.product", "name image")
      .populate("comboItems.product", "name image variants baseVariant displayVariant packagingOptions expiry");

    if (saved?.baseVariant && !saved.baseVariant._id) {
      saved.baseVariant = {
        ...(saved.baseVariant.toObject?.() || saved.baseVariant),
        _id: new mongoose.Types.ObjectId(),
      };
    }

    return attachExpiryViews(saved);
  },

  // ?preorder=true -> chỉ Coming Soon, ngược lại loại Coming Soon khỏi list
  getAllProducts: async (query = {}) => {
    const filter = {};

    const cat = toInFilterIfMany(query.category);
    if (cat) filter.category = cat;

    const loc = toInFilterIfMany(query.location);
    if (loc) filter.location = loc;

    // preorder filter (giữ nguyên hành vi cũ)
    if (String(query.preorder) === "true") {
      filter["preorder.enabled"] = true;
    } else if (String(query.preorder) === "false") {
      filter.$or = [{ preorder: { $exists: false } }, { "preorder.enabled": { $ne: true } }];
    }

    // lọc theo biến thể (ripeness/weight) nếu cung cấp
    if (query.ripeness || query.weight) {
      filter.variants = { $elemMatch: {} };
      if (query.ripeness) filter.variants.$elemMatch["attributes.ripeness"] = query.ripeness;
      if (query.weight) filter.variants.$elemMatch["attributes.weight"] = query.weight;
    }

    // nếu FE muốn lọc riêng combo/mix
    if (query.type === "combo") filter.$or = [{ type: "combo" }, { isCombo: true }];
    if (query.type === "mix") filter.$or = [{ type: "mix" }, { isMixBuilder: true }];

    let sortSpec = { createdAt: -1 };
    switch (query.sort) {
      case "createdAt":
        sortSpec = { createdAt: 1 };
        break;
      case "-createdAt":
        sortSpec = { createdAt: -1 };
        break;
      case "price":
        sortSpec = { "baseVariant.price": 1, "variants.price": 1 };
        break;
      case "-price":
        sortSpec = { "baseVariant.price": -1, "variants.price": -1 };
        break;
      default:
        break;
    }

    const pageNum = Math.max(1, toNumberOr(query.page, 1));
    const limitNum = Math.min(Math.max(1, toNumberOr(query.limit, 24)), 100);
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      Product.find(filter)
        .populate("category", "name")
        .populate("location", "name")
        .populate("comboItems.product", "name image variants baseVariant displayVariant packagingOptions expiry")
        .sort(sortSpec)
        .skip(skip)
        .limit(limitNum),
      Product.countDocuments(filter),
    ]);

    const list = items.map((p) => {
      if (p.baseVariant && !p.baseVariant._id) {
        p.baseVariant = {
          ...(p.baseVariant.toObject?.() || p.baseVariant),
          _id: new mongoose.Types.ObjectId(),
        };
      }
      return attachExpiryViews(p);
    });

    return {
      products: list,
      data: list, // BC với FE cũ
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    };
  },

  // Coming soon list
  getComingSoonProducts: async (query = {}) => {
    const now = new Date();
    const { limit = 24 } = query;

    const filter = {
      "preorder.enabled": true,
      $or: [
        { "preorder.windowEnd": { $gte: now } },
        { "preorder.expectedHarvestStart": { $gte: now } },
        { "preorder.windowEnd": { $exists: false } },
      ],
    };

    const cat = toInFilterIfMany(query.category);
    if (cat) filter.category = cat;

    const items = await Product.find(filter)
      .sort({ "preorder.expectedHarvestStart": 1, createdAt: -1 })
      .limit(Number(limit))
      .populate("category", "name")
      .populate("location", "name")
      .populate("comboItems.product", "name image variants baseVariant displayVariant packagingOptions expiry");

    return items.map((p) => {
      if (p.baseVariant && !p.baseVariant._id) {
        p.baseVariant = {
          ...(p.baseVariant.toObject?.() || p.baseVariant),
          _id: new mongoose.Types.ObjectId(),
        };
      }
      return attachExpiryViews(p);
    });
  },

  getProductById: async (id) => {
    const product = await Product.findById(id)
      .populate("category", "name")
      .populate("location", "name")
      .populate("alternatives.product", "name image")
      .populate("comboItems.product", "name image variants baseVariant displayVariant packagingOptions expiry");
    if (!product) return null;

    if (product.baseVariant && !product.baseVariant._id) {
      product.baseVariant = {
        ...(product.baseVariant.toObject?.() || product.baseVariant),
        _id: new mongoose.Types.ObjectId(),
      };
    }

    return attachExpiryViews(product);
  },

  // Lấy theo danh mục với sort/limit
  getProductsByCategory: async (categoryId, options = {}) => {
    const { limit = 4, sort = "newest" } = options;

    const query = {};
    if (categoryId) query.category = categoryId;

    let sortOptions = {};
    switch (sort) {
      case "newest":
        sortOptions = { createdAt: -1 };
        break;
      case "oldest":
        sortOptions = { createdAt: 1 };
        break;
      case "price_asc":
        sortOptions = { "baseVariant.price": 1 };
        break;
      case "price_desc":
        sortOptions = { "baseVariant.price": -1 };
        break;
      default:
        sortOptions = { createdAt: -1 };
    }

    const products = await Product.find(query)
      .populate("category", "name")
      .populate("location", "name")
      .populate("comboItems.product", "name image variants baseVariant displayVariant packagingOptions expiry")
      .sort(sortOptions)
      .limit(parseInt(limit));

    const productsWithView = products.map((p) => {
      if (p.baseVariant && !p.baseVariant._id) {
        p.baseVariant = {
          ...(p.baseVariant.toObject?.() || p.baseVariant),
          _id: new mongoose.Types.ObjectId(),
        };
      }
      return attachExpiryViews(p);
    });

    return { data: productsWithView };
  },

  // Lấy mới nhất theo tên danh mục (regex)
  getLatestProductsByCategoryName: async (categoryName, limit = 4) => {
    try {
      const category = await Category.findOne({
        name: { $regex: categoryName, $options: "i" },
      });
      if (!category) return { data: [] };

      const products = await Product.find({ category: category._id })
        .populate("category", "name")
        .populate("location", "name")
        .populate("comboItems.product", "name image variants baseVariant displayVariant packagingOptions expiry")
        .sort({ createdAt: -1 })
        .limit(parseInt(limit));

      const productsWithView = products.map((p) => {
        if (p.baseVariant && !p.baseVariant._id) {
          p.baseVariant = {
            ...(p.baseVariant.toObject?.() || p.baseVariant),
            _id: new mongoose.Types.ObjectId(),
          };
        }
        return attachExpiryViews(p);
      });

      return { data: productsWithView };
    } catch (error) {
      console.error("Error in getLatestProductsByCategoryName:", error);
      return { data: [] };
    }
  },

  updateProduct: async (id, data) => {
    // 🔧 CHUẨN HOÁ COMBO trong update (đặc biệt là comboInventory.stock)
    const normalizedData = normalizeComboInput(data);

    const doc = await Product.findById(id);
    if (!doc) return null;

    // merge đơn giản (giữ cũ + thêm field mới)
    const updatable = [
      "type",
      "isCombo",
      "isMixBuilder",
      "comboItems",
      "comboPricing",
      "comboPrice",
      "comboDiscountPercent",
      "mixRules",
      "comboInventory", // ✅ cho phép cập nhật comboInventory

      "name",
      "description",
      "image",
      "images",
      "category",
      "location",
      "weightOptions",
      "ripenessOptions",
      "baseVariant",
      "variants",
      "displayVariant",
      "packagingOptions",
      "alternatives",
      "certifications",
      "origin",
      "storage",
      "storageTips",
      "tags",
    ];
    for (const k of updatable) {
      if (k in normalizedData) doc[k] = normalizedData[k];
    }

    if ("preorder" in normalizedData) {
      mergePreorderToDoc(doc, normalizedData.preorder);
    }

    if ("expiry" in normalizedData) {
      const norm = normalizeExpiry(normalizedData.expiry);
      if (norm) doc.expiry = norm;
      else if (normalizedData.expiry === null) doc.expiry = undefined; // cho phép xoá
    }

    // nếu type chưa có, map từ legacy flags
    if (!doc.type) {
      if (doc.isCombo === true) doc.type = "combo";
      else if (doc.isMixBuilder === true) doc.type = "mix";
      else doc.type = "single";
    }

    await doc.save();

    const saved = await Product.findById(doc._id)
      .populate("category", "name")
      .populate("location", "name")
      .populate("alternatives.product", "name image")
      .populate("comboItems.product", "name image variants baseVariant displayVariant packagingOptions expiry");

    if (saved?.baseVariant && !saved.baseVariant._id) {
      saved.baseVariant = {
        ...(saved.baseVariant.toObject?.() || saved.baseVariant),
        _id: new mongoose.Types.ObjectId(),
      };
    }

    return attachExpiryViews(saved);
  },

  deleteProduct: async (id) => {
    return await Product.findByIdAndDelete(id);
  },

  deleteVariants: async (productId, attributesList) => {
    const product = await Product.findById(productId);
    if (!product) return null;
    product.variants = product.variants.filter(
      (v) =>
        !attributesList.some(
          (attr) =>
            v.attributes.weight === attr.weight && v.attributes.ripeness === attr.ripeness
        )
    );
    await product.save();
    return attachExpiryViews(product);
  },

  /** Cập nhật 1 biến thể theo ID
   *  - Nếu biến thể là BOX → KHÔNG cho set `stock` trực tiếp (tồn kho hiển thị là derive).
   *  - Cho phép cập nhật attributes/price bình thường.
   */
  updateVariant: async (productId, variantId, updateData) => {
    const product = await Product.findById(productId);
    if (!product) return null;
    
    // ✅ Debug: Log tất cả variants trước khi tìm
    console.log("🔍 [updateVariant] All variants:", product.variants.map(v => ({
      _id: v._id,
      weight: v.attributes?.weight,
      ripeness: v.attributes?.ripeness,
      price: v.price,
      stock: v.stock
    })));
    
    // ✅ Sử dụng find() thay vì id() để tránh lỗi tìm variant
    const variant = product.variants.find(v => {
      const vId = v._id ? v._id.toString() : '';
      const targetId = variantId.toString();
      const isMatch = vId === targetId;
      console.log("🔍 [updateVariant] Comparing:", { 
        vId, 
        targetId, 
        match: isMatch,
        weight: v.attributes?.weight,
        ripeness: v.attributes?.ripeness
      });
      return isMatch;
    });
    
    if (!variant) {
      console.error("❌ [updateVariant] Variant not found:", variantId);
      console.error("❌ [updateVariant] Available variant IDs:", product.variants.map(v => v._id.toString()));
      return null;
    }

    // ✅ Debug: Log variant được tìm thấy
    console.log("✅ [updateVariant] Found variant:", {
      _id: variant._id,
      weight: variant.attributes?.weight,
      ripeness: variant.attributes?.ripeness,
      price: variant.price,
      stock: variant.stock,
      updateData
    });

    // xác định có phải boxish không
    const vPlain = variant.toObject ? variant.toObject() : variant;
    const variantIsBox = isBoxish(vPlain);

    if (updateData.price !== undefined) variant.price = Number(updateData.price) || 0;

    // CHẶN set stock nếu là BOX
    if (!variantIsBox && updateData.stock !== undefined) {
      variant.stock = Math.max(0, Number(updateData.stock) || 0);
    }

    if (updateData.attributes) {
      variant.attributes = { ...variant.attributes, ...updateData.attributes };
    }
    if (updateData.kind) {
      variant.kind = updateData.kind;
    }

    // ✅ Debug: Log variant trước khi save
    console.log("💾 [updateVariant] Before save - variant:", {
      _id: variant._id,
      weight: variant.attributes?.weight,
      ripeness: variant.attributes?.ripeness,
      price: variant.price,
      stock: variant.stock
    });
    
    await product.save();
    
    // ✅ Debug: Log variant sau khi save
    console.log("✅ [updateVariant] After save - variant:", {
      _id: variant._id,
      weight: variant.attributes?.weight,
      ripeness: variant.attributes?.ripeness,
      price: variant.price,
      stock: variant.stock
    });
    
    return attachExpiryViews(product);
  },

  deleteVariantById: async (productId, variantId) => {
    const product = await Product.findById(productId);
    if (!product) return null;

    const exists = product.variants.id(variantId);
    if (!exists) return null;

    product.variants.pull({ _id: variantId });
    await product.save();
    return attachExpiryViews(product);
  },

  /** Batch get theo danh sách IDs (phục vụ alternatives đã lưu id) */
  getProductsByIds: async (ids = []) => {
    const arr = (Array.isArray(ids) ? ids : []).filter(Boolean);
    if (arr.length === 0) return [];
    const items = await Product.find({ _id: { $in: arr } })
      .populate("category", "name")
      .populate("location", "name")
      .populate("alternatives.product", "name image")
      .populate("comboItems.product", "name image variants baseVariant displayVariant packagingOptions expiry");
    return items.map(attachExpiryViews);
  },

  /** Gợi ý sản phẩm liên quan (ưu tiên cùng category, còn hàng, tránh chính nó) */
  getRelatedProducts: async (product, limit = 8) => {
    if (!product) return [];
    const q = { _id: { $ne: product._id } };
    if (product.category) q.category = product.category;

    // Tìm ứng viên
    const candidates = await Product.find(q)
      .populate("category", "name")
      .populate("location", "name")
      .limit(Math.max(16, limit * 2)); // lấy nhiều hơn để lọc stock

    // Ưu tiên: còn hàng → có tags trùng → gần giá
    const origPrice =
      Number(product?.displayVariant?.price || 0) ||
      Number(product?.packagingOptions?.[0]?.price || 0) ||
      Number(product?.variants?.[0]?.price || 0) ||
      Number(product?.baseVariant?.price || 0) || 0;

    const pTags = new Set((product?.tags || []).map((t) => String(t).toLowerCase()));
    const scored = candidates
      .filter((c) => hasAnyStock(c))
      .map((c) => {
        const cPrice =
          Number(c?.displayVariant?.price || 0) ||
          Number(c?.packagingOptions?.[0]?.price || 0) ||
          Number(c?.variants?.[0]?.price || 0) ||
          Number(c?.baseVariant?.price || 0) || 0;
        const tagOverlap = (c?.tags || []).reduce(
          (s, t) => (pTags.has(String(t).toLowerCase()) ? s + 1 : s),
          0
        );
        const priceDiffPct = origPrice > 0 ? Math.abs(cPrice - origPrice) / origPrice : 0.5;
        const score = tagOverlap * 5 - priceDiffPct; // càng cao càng tốt
        return { c, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ c }) => attachExpiryViews(c));

    return scored;
  },

  /* =========================
   *  MỚI CHO COMBO & MIX
   * ========================= */

  /** Danh sách COMBO */
  getCombos: async (query = {}) => {
    const filter = { $or: [{ type: "combo" }, { isCombo: true }] };

    const cat = toInFilterIfMany(query.category);
    if (cat) filter.category = cat;

    const items = await Product.find(filter)
      .populate("category", "name")
      .populate("location", "name")
      .populate("comboItems.product", "name image variants baseVariant displayVariant packagingOptions expiry")
      .sort({ createdAt: -1 });

    return items.map(attachExpiryViews);
  },

  /** Ứng viên cho MIX builder từ 1 sản phẩm mix */
  getMixCandidates: async ({ product, category }) => {
    if (!product) return [];

    // xác định category mục tiêu: ưu tiên param, sau đó mixRules, fallback category của product
    let targetCats = [];
    if (category) targetCats = Array.isArray(category) ? category : [category];

    if (targetCats.length === 0 && product?.mixRules?.categoriesAllowed?.length) {
      targetCats = product.mixRules.categoriesAllowed.map(String);
    }

    const q = {
      _id: { $ne: product._id },
      // không lấy combo/mix khác
      $and: [{ $or: [{ type: { $ne: "combo" } }, { type: { $exists: false } }] }],
    };
    if (targetCats.length) q.category = { $in: targetCats };
    else if (product.category) q.category = product.category;

    const items = await Product.find(q)
      .limit(60)
      .populate("category", "name")
      .populate("location", "name");

    const filtered = items.filter((it) => hasAnyStock(it));
    return filtered.map(attachExpiryViews);
  },
};

export default productService;
