import Product from "../models/product.model.js";

// Hàm sinh biến thể từ baseVariant
const generateVariants = (weights, ripenesses, baseVariant) => {
  const variants = [];
  const basePrice = Number(baseVariant.price); // Ép sang số

  if (isNaN(basePrice)) {
    throw new Error("Giá baseVariant không hợp lệ");
  }

  const weightMultiplier = {
    "0.5kg": 0.5,
    "1kg": 1,
    "1.5kg": 1.5,
    "2kg": 2
  };

  for (const weight of weights) {
    for (const ripeness of ripenesses) {
      // Bỏ qua biến thể gốc
      if (weight === baseVariant.attributes.weight && ripeness === baseVariant.attributes.ripeness) {
        continue;
      }

      const multiplier = weightMultiplier[weight] ?? 1;
      const price = Math.round(basePrice * multiplier);

      variants.push({
        attributes: { weight, ripeness },
        price,
        stock: 0
      });
    }
  }
  return variants;
};

const productService = {
  // Tạo sản phẩm
  createProduct: async (data) => {
    const {
      name, description, image, category, location,
      weightOptions = [], ripenessOptions = [],
      baseVariant, variants: inputVariants
    } = data;

    let variants = [];
    let displayVariant = null;

    // Nếu gửi sẵn variants thủ công
    if (Array.isArray(inputVariants) && inputVariants.length > 0) {
      variants = inputVariants;
      displayVariant = inputVariants[0];
    }
    // Nếu có baseVariant → tự sinh variants còn lại
    else if (baseVariant?.attributes && typeof baseVariant.price !== "undefined") {
      baseVariant.price = Number(baseVariant.price);
      if (isNaN(baseVariant.price)) {
        throw new Error("Giá baseVariant không hợp lệ");
      }
      variants = generateVariants(weightOptions, ripenessOptions, baseVariant);
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
      displayVariant
    });

    await product.save();
    return product;
  },

  // Lấy tất cả sản phẩm
  getAllProducts: async () => {
    const products = await Product.find()
      .populate("category", "name")
      .populate("location", "name");
    return { data: products };
  },

  // Lấy sản phẩm theo ID
  getProductById: async (id) => {
    return await Product.findById(id)
      .populate("category", "name")
      .populate("location", "name");
  },

  // Cập nhật sản phẩm
  updateProduct: async (id, data) => {
    return await Product.findByIdAndUpdate(id, data, { new: true });
  },

  // Xoá sản phẩm
  deleteProduct: async (id) => {
    return await Product.findByIdAndDelete(id);
  },

  // Xoá 1 hoặc nhiều biến thể
  deleteVariants: async (productId, attributesList) => {
    const product = await Product.findById(productId);
    if (!product) return null;

    product.variants = product.variants.filter(v => {
      return !attributesList.some(attr =>
        v.attributes.weight === attr.weight && v.attributes.ripeness === attr.ripeness
      );
    });

    await product.save();
    return product;
  }
};

export default productService;
