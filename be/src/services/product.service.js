// src/services/product.service.js
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

/* Đính kèm view: _expiry (mới) + expiryView/priceView (tương thích ngược) */
function attachExpiryViews(doc) {
  if (!doc) return doc;
  const p = doc.toObject ? doc.toObject() : doc;

  // Helper BE mới -> { expireAt, daysLeft, isNearExpiry, discountPercent, finalPrice, basePrice }
  const _expiry = beComputeExpiryInfo(p);

  // Tương thích ngược: expiryView / priceView
  const threshold =
    Number(
      p?.expiry?.discountNearExpiry?.thresholdDays ??
        p?.expiry?.nearExpiryDays // legacy
    ) || 0;

  const expiryView = {
    enabled: !!_expiry?.expireAt, // coi là đang theo dõi khi có hạn
    expiryDate: _expiry?.expireAt || null,
    daysLeft: _expiry?.daysLeft ?? null,
    nearExpiryDays: threshold,
    discountPercent: _expiry?.discountPercent ?? 0,
    isNearExpiry: !!_expiry?.isNearExpiry,
  };

  const baseOriginal = Number(_expiry?.basePrice) || 0;
  const baseFinal = Number(_expiry?.finalPrice) || baseOriginal;
  const discountApplied = Number(_expiry?.discountPercent) || 0;

  const variants = Array.isArray(p?.variants)
    ? p.variants.map((v) => {
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

  return { ...p, _expiry, expiryView, priceView };
}

/* -------------------------------
 * Service
 * ------------------------------- */
const productService = {
  createProduct: async (data) => {
    const {
      name,
      description,
      image,
      category,
      location,
      weightOptions = [],
      ripenessOptions = [],
      baseVariant,
      variants: inputVariants,
      preorder,
      expiry, // NEW schema
    } = data;

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
      name,
      description,
      image,
      category,
      location,
      weightOptions,
      ripenessOptions,
      baseVariant,
      variants,
      displayVariant,
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
      .populate("location", "name");

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

    if (String(query.preorder) === "true") {
      filter["preorder.enabled"] = true;
    } else {
      filter.$or = [{ preorder: { $exists: false } }, { "preorder.enabled": { $ne: true } }];
    }

    const products = await Product.find(filter)
      .populate("category", "name")
      .populate("location", "name")
      .sort({ createdAt: -1 });

    return products.map((p) => {
      if (p.baseVariant && !p.baseVariant._id) {
        p.baseVariant = {
          ...(p.baseVariant.toObject?.() || p.baseVariant),
          _id: new mongoose.Types.ObjectId(),
        };
      }
      return attachExpiryViews(p);
    });
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
      .populate("location", "name");

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
      .populate("location", "name");
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
    const doc = await Product.findById(id);
    if (!doc) return null;

    // merge đơn giản
    const updatable = [
      "name",
      "description",
      "image",
      "category",
      "location",
      "weightOptions",
      "ripenessOptions",
      "baseVariant",
      "variants",
      "displayVariant",
    ];
    for (const k of updatable) {
      if (k in data) doc[k] = data[k];
    }

    if ("preorder" in data) {
      mergePreorderToDoc(doc, data.preorder);
    }

    if ("expiry" in data) {
      const norm = normalizeExpiry(data.expiry);
      if (norm) doc.expiry = norm;
      else if (data.expiry === null) doc.expiry = undefined; // cho phép xoá
    }

    await doc.save();
    return attachExpiryViews(doc);
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

  updateVariant: async (productId, variantId, updateData) => {
    const product = await Product.findById(productId);
    if (!product) return null;
    const variant = product.variants.id(variantId);
    if (!variant) return null;

    if (updateData.price !== undefined) variant.price = Number(updateData.price) || 0;
    if (updateData.stock !== undefined) variant.stock = Number(updateData.stock) || 0;
    if (updateData.attributes) {
      variant.attributes = { ...variant.attributes, ...updateData.attributes };
    }

    await product.save();
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
};

export default productService;
