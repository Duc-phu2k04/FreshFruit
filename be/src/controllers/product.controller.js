import Product from "../models/product.model.js";

const productController = {
  // GET /products
  getAllProducts: async (req, res) => {
    const products = await Product.find();
    res.json(products);
  },

  // GET /products/:id
  getProductById: async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Not found" });
    res.json(product);
  },

  // POST /products (Admin)
  createProduct: async (req, res) => {
    const newProduct = new Product(req.body);
    const saved = await newProduct.save();
    res.status(201).json(saved);
  },

  // PUT /products/:id (Admin)
  updateProduct: async (req, res) => {
    const updated = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  },

  // DELETE /products/:id (Admin)
  deleteProduct: async (req, res) => {
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Not found" });
    res.json({ message: "Deleted successfully" });
  },
};

export default productController;
