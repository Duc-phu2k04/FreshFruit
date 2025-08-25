import Product from "../models/product.model.js";
import Category from "../models/category.model.js"; // ✅ Thêm import này
import mongoose from "mongoose";

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
      )
        continue;

      let price = basePrice;

      if (weight !== baseVariant.attributes.weight) {
        const targetWeightMultiplier = weightMultiplier[weight] ?? 1;
        price = Math.round(
          basePrice * (targetWeightMultiplier / baseWeightMultiplier)
        );
      }

      variants.push({ attributes: { weight, ripeness }, price, stock: 0 });
    }
  }
  return variants;
};

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

      // ✅ Generate and include baseVariant into variants
      const autoVariants = generateVariants(weightOptions, ripenessOptions, baseVariant);
      variants = [
        { ...baseVariant }, // add baseVariant as a real variant
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

    await product.save();
    return product;
  },

  getAllProducts: async () => {
    const products = await Product.find()
      .populate("category", "name")
      .populate("location", "name");

    const productsWithBaseId = products.map((p) => {
      if (p.baseVariant && !p.baseVariant._id) {
        p.baseVariant = {
          ...p.baseVariant.toObject?.() || p.baseVariant,
          _id: new mongoose.Types.ObjectId(),
        };
      }
      return p;
    });

    return { data: productsWithBaseId };
  },

  getProductById: async (id) => {
    const product = await Product.findById(id)
      .populate("category", "name")
      .populate("location", "name");

    if (!product) return null;

    if (product.baseVariant && !product.baseVariant._id) {
      product.baseVariant = {
        ...product.baseVariant.toObject?.() || product.baseVariant,
        _id: new mongoose.Types.ObjectId(),
      };
    }

    return product;
  },

  // ✅ NEW: Lấy sản phẩm theo danh mục với filter
  getProductsByCategory: async (categoryId, options = {}) => {
    const { limit = 4, sort = 'newest' } = options;
    
    let query = {};
    if (categoryId) {
      query.category = categoryId;
    }

    let sortOptions = {};
    switch (sort) {
      case 'newest':
        sortOptions = { createdAt: -1 };
        break;
      case 'oldest':
        sortOptions = { createdAt: 1 };
        break;
      case 'price_asc':
        sortOptions = { 'baseVariant.price': 1 };
        break;
      case 'price_desc':
        sortOptions = { 'baseVariant.price': -1 };
        break;
      default:
        sortOptions = { createdAt: -1 };
    }

    const products = await Product.find(query)
      .populate("category", "name")
      .populate("location", "name")
      .sort(sortOptions)
      .limit(parseInt(limit));

    const productsWithBaseId = products.map((p) => {
      if (p.baseVariant && !p.baseVariant._id) {
        p.baseVariant = {
          ...p.baseVariant.toObject?.() || p.baseVariant,
          _id: new mongoose.Types.ObjectId(),
        };
      }
      return p;
    });

    return { data: productsWithBaseId };
  },

  // ✅ NEW: Lấy sản phẩm mới nhất theo tên danh mục
  getLatestProductsByCategoryName: async (categoryName, limit = 4) => {
    try {
      // Tìm category theo tên
      const category = await Category.findOne({ 
        name: { $regex: categoryName, $options: 'i' } 
      });
      
      if (!category) {
        return { data: [] };
      }

      const products = await Product.find({ category: category._id })
        .populate("category", "name")
        .populate("location", "name")
        .sort({ createdAt: -1 })
        .limit(parseInt(limit));

      const productsWithBaseId = products.map((p) => {
        if (p.baseVariant && !p.baseVariant._id) {
          p.baseVariant = {
            ...p.baseVariant.toObject?.() || p.baseVariant,
            _id: new mongoose.Types.ObjectId(),
          };
        }
        return p;
      });

      return { data: productsWithBaseId };
    } catch (error) {
      console.error("Error in getLatestProductsByCategoryName:", error);
      return { data: [] };
    }
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