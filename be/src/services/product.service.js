// src/services/product.service.js
import Product from "../models/product.model.js";
import mongoose from "mongoose";

/* -------------------------------
 * Helpers
 * ------------------------------- */
const generateVariants = (weights, ripenesses, baseVariant) => {
  const variants = [];
  const basePrice = Number(baseVariant.price);
  if (isNaN(basePrice)) throw new Error("Giá baseVariant không hợp lệ");

  const weightMultiplier = { "0.5kg": 0.5, "1kg": 1, "1.5kg": 1.5, "2kg": 2 };
  const baseWeightMultiplier = weightMultiplier[baseVariant.attributes.weight] ?? 1;

  for (const weight of weights) {
    for (const ripeness of ripenesses) {
      // Bỏ qua chính baseVariant
      if (
        weight === baseVariant.attributes.weight &&
        ripeness === baseVariant.attributes.ripeness
      ) continue;

      let price = basePrice;
      if (weight !== baseVariant.attributes.weight) {
        const targetWeightMultiplier = weightMultiplier[weight] ?? 1;
        price = Math.round(basePrice * (targetWeightMultiplier / baseWeightMultiplier));
      }

      variants.push({ attributes: { weight, ripeness }, price, stock: 0 });
    }
  }
  return variants;
};

// Gộp preorder an toàn (không cho FE chỉnh soldPreorder)
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
    perVariantAllocations: []
  };

  const p = payloadPreorder;

  if (typeof p.enabled === "boolean") doc.preorder.enabled = p.enabled;

  if (typeof p.depositPercent === "number") {
    doc.preorder.depositPercent = Math.max(0, Math.min(100, p.depositPercent));
  }

  if (typeof p.quota === "number") {
    doc.preorder.quota = Math.max(0, p.quota);
  }

  if (p.windowStart !== undefined) {
    doc.preorder.windowStart = p.windowStart ? new Date(p.windowStart) : null;
  }
  if (p.windowEnd !== undefined) {
    doc.preorder.windowEnd = p.windowEnd ? new Date(p.windowEnd) : null;
  }

  if (p.expectedHarvestStart !== undefined) {
    doc.preorder.expectedHarvestStart = p.expectedHarvestStart ? new Date(p.expectedHarvestStart) : null;
  }
  if (p.expectedHarvestEnd !== undefined) {
    doc.preorder.expectedHarvestEnd = p.expectedHarvestEnd ? new Date(p.expectedHarvestEnd) : null;
  }

  if (typeof p.priceLock === "boolean") doc.preorder.priceLock = p.priceLock;

  if (p.cancelPolicy && typeof p.cancelPolicy === "object") {
    const { untilDate, feePercent } = p.cancelPolicy;
    if (untilDate !== undefined) {
      doc.preorder.cancelPolicy.untilDate = untilDate ? new Date(untilDate) : null;
    }
    if (typeof feePercent === "number") {
      doc.preorder.cancelPolicy.feePercent = Math.max(0, Math.min(100, feePercent));
    }
  }
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
      preorder //    thêm vào
    } = data;

    let variants = [];
    let displayVariant = null;

    if (Array.isArray(inputVariants) && inputVariants.length > 0) {
      variants = inputVariants;
      displayVariant = inputVariants[0];
    } else if (
      baseVariant?.attributes &&
      typeof baseVariant.price !== "undefined"
    ) {
      baseVariant.price = Number(baseVariant.price);
      if (isNaN(baseVariant.price))
        throw new Error("Giá baseVariant không hợp lệ");

      //  Generate và đưa baseVariant vào variants
      const autoVariants = generateVariants(weightOptions, ripenessOptions, baseVariant);
      variants = [
        { ...baseVariant },
        ...autoVariants,
      ];
      displayVariant = baseVariant;
    }

    const product = new Product({
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

    //  NEW: ghi preorder nếu FE gửi
    mergePreorderToDoc(product, preorder);

    await product.save();
    return product;
  },

  //  nhận query để lọc /api/product?preorder=true
  // MẶC ĐỊNH: loại bỏ sản phẩm preorder khỏi danh sách chung
  getAllProducts: async (query = {}) => {
    const filter = {};

    // giữ logic cũ: cho phép lọc theo category/location nếu controller pass qua
    if (query.category) filter.category = query.category;
    if (query.location) filter.location = query.location;

    //  Chế độ hiển thị:
    // - ?preorder=true  -> chỉ lấy hàng Coming Soon (preorder.enabled = true)
    // - (mặc định/khác) -> LOẠI hàng Coming Soon khỏi list chung
    if (String(query.preorder) === "true") {
      filter["preorder.enabled"] = true;
    } else {
      filter.$or = [
        { preorder: { $exists: false } },
        { "preorder.enabled": { $ne: true } },
      ];
    }

    const products = await Product.find(filter)
      .populate("category", "name")
      .populate("location", "name")
      .sort({ createdAt: -1 });

    // Giữ logic cũ: thêm _id cho baseVariant nếu thiếu
    return products.map((p) => {
      if (p.baseVariant && !p.baseVariant._id) {
        p.baseVariant = {
          ...(p.baseVariant.toObject?.() || p.baseVariant),
          _id: new mongoose.Types.ObjectId(),
        };
      }
      return p;
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

    return product;
  },

  updateProduct: async (id, data) => {
    // GIỮ LOGIC CŨ cho các trường bình thường,
    // nhưng MERGE preorder an toàn để không cho FE tự ý sửa các field nhạy cảm.
    const doc = await Product.findById(id);
    if (!doc) return null;

    // merge các trường đơn giản (giữ nguyên logic cũ)
    const updatable = [
      "name","description","image","category","location",
      "weightOptions","ripenessOptions","baseVariant","variants","displayVariant"
    ];
    for (const k of updatable) {
      if (k in data) doc[k] = data[k];
    }

    // merge preorder an toàn
    if ("preorder" in data) {
      mergePreorderToDoc(doc, data.preorder);
    }

    await doc.save();
    return doc;
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
            v.attributes.weight === attr.weight &&
            v.attributes.ripeness === attr.ripeness
        )
    );
    await product.save();
    return product;
  },

  updateVariant: async (productId, variantId, updateData) => {
    const product = await Product.findById(productId);
    if (!product) return null;
    const variant = product.variants.id(variantId);
    if (!variant) return null;

    if (updateData.price !== undefined) variant.price = updateData.price;
    if (updateData.stock !== undefined) variant.stock = updateData.stock;
    if (updateData.attributes) {
      variant.attributes = { ...variant.attributes, ...updateData.attributes };
    }

    await product.save();
    return product;
  },

  deleteVariantById: async (productId, variantId) => {
    const product = await Product.findById(productId);
    if (!product) return null;

    const exists = product.variants.id(variantId);
    if (!exists) return null;

    product.variants.pull({ _id: variantId });
    await product.save();
    return product;
  },
};

export default productService;
