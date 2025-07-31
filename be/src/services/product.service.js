
import Product from "../models/product.model.js";

// src/services/product.service.js
import Product from '../models/product.model.js';

const isEqualVariant = (v1, v2) => {
  return (
    v1.grade === v2.grade &&
    v1.weight === v2.weight &&
    v1.ripeness === v2.ripeness
  );
};


const generateVariants = (weights, ripenesses, baseVariant) => {
  const variants = [];

  const basePrice = Number(baseVariant.price);
  if (isNaN(basePrice)) throw new Error("Giá baseVariant không hợp lệ");

  const weightMultiplier = { "0.5kg": 0.5, "1kg": 1, "1.5kg": 1.5, "2kg": 2 };
  const baseWeightMultiplier = weightMultiplier[baseVariant.attributes.weight] ?? 1;

  for (const weight of weights) {
    for (const ripeness of ripenesses) {
      // Bỏ qua chính baseVariant
      if (weight === baseVariant.attributes.weight && ripeness === baseVariant.attributes.ripeness) continue;

      let price = basePrice;

      // Nếu khác cân nặng thì tính giá theo tỉ lệ cân nặng
      if (weight !== baseVariant.attributes.weight) {
        const targetWeightMultiplier = weightMultiplier[weight] ?? 1;
        price = Math.round(basePrice * (targetWeightMultiplier / baseWeightMultiplier));

  for (const grade of grades) {
    for (const weight of weights) {
      for (const ripeness of ripenesses) {
        if (isEqualVariant({ grade, weight, ripeness }, baseVariant)) continue;
        variants.push({
          attributes: { grade, weight, ripeness },
          price: baseVariant.price,
          stock: 0
        });

      }

      variants.push({ attributes: { weight, ripeness }, price, stock: 0 });
    }
  }
  return variants;
};


const productService = {
  createProduct: async (data) => {
    const { name, description, image, category, location,
      weightOptions = [], ripenessOptions = [],
      baseVariant, variants: inputVariants } = data;

    let variants = [];
    let displayVariant = null;

    if (Array.isArray(inputVariants) && inputVariants.length > 0) {

      variants = inputVariants;
      displayVariant = inputVariants[0];
    } else if (baseVariant?.attributes && typeof baseVariant.price !== "undefined") {
      baseVariant.price = Number(baseVariant.price);
      if (isNaN(baseVariant.price)) throw new Error("Giá baseVariant không hợp lệ");
      variants = generateVariants(weightOptions, ripenessOptions, baseVariant);
      displayVariant = baseVariant;
    }

    const product = new Product({
      name, description, image, category, location,
      weightOptions, ripenessOptions,
      baseVariant, variants, displayVariant

      variants = inputVariants.map(v => ({
        attributes: {
          grade: v.grade,
          weight: v.weight,
          ripeness: v.ripeness,
        },
        price: v.price,
        stock: v.stock
      }));
    } else if (isDefaultBase && hasFullBase) {
      variants = generateVariants(gradeList, weightList, ripenessList, baseAttrs);
    }

    const product = new Product({
      name,
      description,
      image,
      category,
      location,
      gradeOptions: gradeList,
      weightOptions: weightList,
      ripenessOptions: ripenessList,
      baseVariant: {
        attributes: {
          grade: baseAttrs.grade,
          weight: baseAttrs.weight,
          ripeness: baseAttrs.ripeness
        },
        price: baseVariant.price,
        stock: baseVariant.stock
      },
      variants

    });

    await product.save();
    return product;
  },

  getAllProducts: async () => {

    const products = await Product.find()
      .populate("category", "name")
      .populate("location", "name");
    return { data: products };
  },

  getProductById: async (id) => {
    return await Product.findById(id)
      .populate("category", "name")
      .populate("location", "name");
  },

  updateProduct: async (id, data) => {
    return await Product.findByIdAndUpdate(id, data, { new: true });
  },

  deleteProduct: async (id) => {
    return await Product.findByIdAndDelete(id);
  },

  deleteVariants: async (productId, attributesList) => {
    const product = await Product.findById(productId);
    if (!product) return null;
    product.variants = product.variants.filter(v =>
      !attributesList.some(attr =>
        v.attributes.weight === attr.weight && v.attributes.ripeness === attr.ripeness
      )
    );
    await product.save();
    return product;
  },

  // ✅ Cập nhật biến thể theo ID
  updateVariant: async (productId, variantId, updateData) => {
    const product = await Product.findById(productId);
    if (!product) return null;
    const variant = product.variants.id(variantId);
    if (!variant) return null;

    if (updateData.price !== undefined) variant.price = updateData.price;
    if (updateData.stock !== undefined) variant.stock = updateData.stock;

    await product.save();
    return product;
  },

  // ✅ Xóa biến thể theo ID
  deleteVariantById: async (productId, variantId) => {
  const product = await Product.findById(productId);
  if (!product) return null;

  const exists = product.variants.id(variantId);
  if (!exists) return null;

  product.variants.pull({ _id: variantId }); // <-- Sửa ở đây
  await product.save();
  return product;
}

    const products = await Product.find({}).lean();
    return products.map(p => ({
      _id: p._id,
      name: p.name,
      description: p.description,
      image: p.image,
      category: p.category,
      location: p.location,
      price: p.baseVariant?.price ?? 0,
    }));
  },

  // ✅ Hàm cần thêm để sửa lỗi 500
  getProductById: async (id) => {
    const product = await Product.findById(id).lean();
    return product;
  }
};

export default productService;
