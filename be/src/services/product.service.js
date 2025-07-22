import Product from "../models/product.model.js";

// Điều chỉnh theo grade: A cao nhất, C thấp nhất
const gradeAdjustment = {
  A: 0,
  B: -10000,
  C: -20000
};

// Điều chỉnh theo weight: 2kg cao nhất, 0.5kg thấp nhất
const weightAdjustment = {
  "2kg": 20000,
  "1.5kg": 10000,
  "1kg": 0,
  "0.5kg": -10000
};

// ripeness không ảnh hưởng đến giá
const generateVariants = (base, gradeOpts, weightOpts, ripenessOpts) => {
  const variants = [];

  for (const grade of gradeOpts) {
    for (const weight of weightOpts) {
      for (const ripeness of ripenessOpts) {
        const price =
          base.price +
          (gradeAdjustment[grade] || 0) +
          (weightAdjustment[weight] || 0);

        variants.push({
          attributes: { grade, weight, ripeness },
          price,
          stock: base.stock || 0
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
      category,
      location,
      gradeOptions,
      weightOptions,
      ripenessOptions,
      baseVariant
    } = data;

    const variants = generateVariants(
      baseVariant,
      gradeOptions,
      weightOptions,
      ripenessOptions
    );

    const product = new Product({
      name,
      description,
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
    return await Product.find()
      .populate("category")
      .populate("location");
  },

  getProductById: async (id) => {
    return await Product.findById(id)
      .populate("category")
      .populate("location");
  },

  updateProduct: async (id, data) => {
    return await Product.findByIdAndUpdate(id, data, { new: true });
  },

  deleteProduct: async (id) => {
    return await Product.findByIdAndDelete(id);
  }
};

export default productService;
