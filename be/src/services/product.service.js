// src/services/product.service.js
import Product from '../models/product.model.js';

const isEqualVariant = (v1, v2) => {
  return (
    v1.grade === v2.grade &&
    v1.weight === v2.weight &&
    v1.ripeness === v2.ripeness
  );
};

const generateVariants = (grades, weights, ripenesses, baseVariant) => {
  const variants = [];
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

    const gradeList = gradeOptions.length ? gradeOptions : ["A", "B", "C"];
    const weightList = weightOptions.length ? weightOptions : ["1kg", "2kg"];
    const ripenessList = ripenessOptions.length ? ripenessOptions : ["Chín", "Xanh"];

    const baseAttrs = {
      grade: baseVariant?.grade,
      weight: baseVariant?.weight,
      ripeness: baseVariant?.ripeness
    };

    const hasFullBase =
      baseAttrs.grade && baseAttrs.weight && baseAttrs.ripeness &&
      typeof baseVariant?.price === 'number' &&
      typeof baseVariant?.stock === 'number';

    const isDefaultBase = isEqualVariant(baseAttrs, {
      grade: "A",
      weight: "1kg",
      ripeness: "Chín"
    });

    let variants = [];

    if (Array.isArray(inputVariants) && inputVariants.length > 0) {
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
