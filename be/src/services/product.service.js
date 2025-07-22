import Product from '../models/product.model.js';

const productService = {
  createProduct: async (data) => {
    const product = new Product(data);
    return await product.save();
  },

  getAllProducts: async () => {
    return await Product.find()
      .populate('category')
      .populate('location');
  },

  getProductById: async (id) => {
    return await Product.findById(id)
      .populate('category')
      .populate('location');
  },

  updateProduct: async (id, data) => {
    return await Product.findByIdAndUpdate(id, data, { new: true });
  },

  deleteProduct: async (id) => {
    return await Product.findByIdAndDelete(id);
  },
};

export default productService;
