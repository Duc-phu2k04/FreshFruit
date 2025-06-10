import Product from "../models/product.model.js";
import Category from "../models/category.model.js";

const productController = {
  // GET /products
  getAllProducts: async (req, res) => {
    try {
      const products = await Product.find().populate("category");
      res.json(products);
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  },

  // GET /products/:id
  getProductById: async (req, res) => {
    try {
      const product = await Product.findById(req.params.id).populate("category");
      if (!product) return res.status(404).json({ message: "Not found" });
      res.json(product);
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  },

  // POST /products (Admin)
  createProduct: async (req, res) => {
    try {
      const { category } = req.body;
      const categoryExists = await Category.findById(category);
      if (!categoryExists) {
        return res.status(400).json({ message: "Invalid category ID" });
      }

      const newProduct = new Product(req.body);
      const saved = await newProduct.save();
      const populated = await saved.populate("category");

      res.status(201).json(populated);
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  },

  // PUT /products/:id (Admin)
  updateProduct: async (req, res) => {
    try {
      const updated = await Product.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      }).populate("category");

      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  },

  // DELETE /products/:id (Admin)
  deleteProduct: async (req, res) => {
    try {
      const deleted = await Product.findByIdAndDelete(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Not found" });
      res.json({ message: "Deleted successfully" });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  },
};

export default productController;
