// src/controllers/product.controller.js
import Product from "../models/product.model.js";
import Category from "../models/category.model.js";
import Location from "../models/location.model.js";

const productController = {
  // GET /products
  getAllProducts: async (req, res) => {
    try {
      const products = await Product.find()
        .populate("category")
        .populate("location");
      res.json(products);
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  },

  // GET /products/:id
  getProductById: async (req, res) => {
    try {
      const product = await Product.findById(req.params.id)
        .populate("category")
        .populate("location");
      if (!product) return res.status(404).json({ message: "Not found" });
      res.json(product);
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  },

  // POST /products/add (Admin only)
  createProduct: async (req, res) => {
    try {
      const { category, location } = req.body;

      const categoryExists = await Category.findById(category);
      const locationExists = await Location.findById(location);
      if (!categoryExists || !locationExists) {
        return res.status(400).json({ message: "Invalid category or location ID" });
      }

      const newProduct = new Product(req.body);
      const saved = await newProduct.save();
      const populated = await Product.findById(saved._id)
        .populate("category")
        .populate("location");

      res.status(201).json(populated);
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  },

  // PUT /products/:id (Admin only)
  updateProduct: async (req, res) => {
    try {
      const updated = await Product.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      })
        .populate("category")
        .populate("location");

      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err.message });
    }
  },

  // DELETE /products/:id (Admin only)
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