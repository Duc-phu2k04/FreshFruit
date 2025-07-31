import Product from "../models/product.model.js";

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
};

export default productService;
