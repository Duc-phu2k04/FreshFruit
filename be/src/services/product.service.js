import Product from "../models/product.model.js";

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
      if (
        weight === baseVariant.attributes.weight &&
        ripeness === baseVariant.attributes.ripeness
      ) {
        continue;
      }

      let price = basePrice;
      const targetWeightMultiplier = weightMultiplier[weight] ?? 1;
      price = Math.round(basePrice * (targetWeightMultiplier / baseWeightMultiplier));

      variants.push({
        attributes: {
          weight,
          ripeness
        },
        price,
        stock: 0
      });
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
      gradeOptions = [],
      weightOptions = [],
      ripenessOptions = [],
      baseVariant,
      variants: inputVariants
    } = data;

    let variants = [];
    let displayVariant = null;

    if (Array.isArray(inputVariants) && inputVariants.length > 0) {
      variants = inputVariants.map(v => ({
        attributes: {
          grade: v.grade,
          weight: v.weight,
          ripeness: v.ripeness
        },
        price: Number(v.price),
        stock: Number(v.stock)
      }));
      displayVariant = variants[0];
    } else if (baseVariant?.attributes && typeof baseVariant.price !== "undefined") {
      baseVariant.price = Number(baseVariant.price);
      if (isNaN(baseVariant.price)) throw new Error("Giá baseVariant không hợp lệ");

      variants = generateVariants(weightOptions, ripenessOptions, baseVariant);
      displayVariant = baseVariant;
    }

    const product = new Product({
      name,
      description,
      image,
      category,
      location,
      gradeOptions,
      weightOptions,
      ripenessOptions,
      baseVariant,
      variants,
      displayVariant
    });

    await product.save();
    return product;
  },

  // ✅ SỬA Ở ĐÂY: Trả về mảng trực tiếp thay vì object { data: products }
  getAllProducts: async () => {
    const products = await Product.find()
      .populate("category", "name")
      .populate("location", "name");
    return products;
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
  }
};

export default productService;
