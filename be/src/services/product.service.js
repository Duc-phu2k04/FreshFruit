import Product from "../models/product.model.js";

// Điều chỉnh giá theo phần trăm
const gradeAdjustment = {
  A: 0,
  B: -10, // giảm 10%
  C: -20  // giảm 20%
};

const weightAdjustment = {
  "2kg": 20,   // tăng 20%
  "1.5kg": 10, // tăng 10%
  "1kg": 0,
  "0.5kg": -10 // giảm 10%
};

const isEqualVariant = (a, b) => {
  return (
    a.grade === b.grade &&
    a.weight === b.weight &&
    a.ripeness === b.ripeness
  );
};

const generateVariants = (base, gradeOpts, weightOpts, ripenessOpts) => {
  const variants = [];
  const basePrice = Number(base.price) || 0;
  const baseStock = Number(base.stock) || 0;

  for (const grade of gradeOpts) {
    for (const weight of weightOpts) {
      for (const ripeness of ripenessOpts) {
        const gradePercent = gradeAdjustment[grade] || 0;
        const weightPercent = weightAdjustment[weight] || 0;

        const adjustedPrice = basePrice * (1 + (gradePercent + weightPercent) / 100);

        variants.push({
          attributes: { grade, weight, ripeness },
          price: Math.round(adjustedPrice),
          stock: baseStock
        });
      }
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
      gradeOptions,
      weightOptions,
      ripenessOptions,
      baseVariant
    } = data;

    const hasFullBase =
      baseVariant &&
      baseVariant.attributes?.grade &&
      baseVariant.attributes?.weight &&
      baseVariant.attributes?.ripeness &&
      typeof baseVariant.price === 'number' &&
      typeof baseVariant.stock === 'number';

    const baseAttrs = baseVariant?.attributes;

    const isDefaultBase = isEqualVariant(baseAttrs, {
      grade: "A",
      weight: "1kg",
      ripeness: "Chín"
    });

    let variants = [];

    if (hasFullBase && isDefaultBase) {
      variants = generateVariants(
        baseVariant,
        gradeOptions,
        weightOptions,
        ripenessOptions
      );
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
      variants
    });

    return await product.save();
  },

  getAllProducts: async () => {
    return await Product.find().populate("category").populate("location");
  },

  getProductById: async (id) => {
    return await Product.findById(id).populate("category").populate("location");
  },

  updateProduct: async (id, data) => {
    const product = await Product.findById(id);
    if (!product) return null;

    if (data.name) product.name = data.name;
    if (data.description) product.description = data.description;
    if (data.image) product.image = data.image;
    if (data.category) product.category = data.category;
    if (data.location) product.location = data.location;
    if (data.gradeOptions) product.gradeOptions = data.gradeOptions;
    if (data.weightOptions) product.weightOptions = data.weightOptions;
    if (data.ripenessOptions) product.ripenessOptions = data.ripenessOptions;
    if (data.baseVariant) product.baseVariant = data.baseVariant;

    const hasFullBase =
      product.baseVariant &&
      product.baseVariant.attributes?.grade &&
      product.baseVariant.attributes?.weight &&
      product.baseVariant.attributes?.ripeness &&
      typeof product.baseVariant.price === 'number' &&
      typeof product.baseVariant.stock === 'number';

    const baseAttrs = product.baseVariant?.attributes;

    const isDefaultBase = isEqualVariant(baseAttrs, {
      grade: "A",
      weight: "1kg",
      ripeness: "Chín"
    });

    if (
      data.gradeOptions ||
      data.weightOptions ||
      data.ripenessOptions ||
      data.baseVariant
    ) {
      if (hasFullBase && isDefaultBase) {
        product.variants = generateVariants(
          product.baseVariant,
          product.gradeOptions,
          product.weightOptions,
          product.ripenessOptions
        );
      } else {
        product.variants = [];
      }
    }

    return await product.save();
  },

  deleteProduct: async (id) => {
    return await Product.findByIdAndDelete(id);
  }
};

export default productService;
