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
        // Nếu là biến thể cơ bản, bỏ qua không tạo lại
        if (
          isEqualVariant({ grade, weight, ripeness }, baseVariant)
        ) continue;

        variants.push({
          grade,
          weight,
          ripeness,
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

    // Nếu FE gửi sẵn variants thì dùng luôn
    if (Array.isArray(inputVariants) && inputVariants.length > 0) {
      variants = inputVariants;
    }
    // Nếu không có variants mà baseVariant là mặc định thì sinh tự động
    else if (isDefaultBase && hasFullBase) {
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
        ...baseVariant,
        grade: baseAttrs.grade,
        weight: baseAttrs.weight,
        ripeness: baseAttrs.ripeness
      },
      variants
    });

    await product.save();
    return product;
  }
};

export default productService;
