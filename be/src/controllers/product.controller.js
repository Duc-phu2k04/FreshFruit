import Product   from "../models/product.model.js";
import Category  from "../models/category.model.js";
import Location  from "../models/location.model.js";

/* -------------------------------------------------- *
 * GET /api/product?category=cat1,cat2&location=loc1,loc2
 * -------------------------------------------------- */
const getAllProducts = async (req, res) => {
  try {
    const { category, location } = req.query;

    // ---------------------  build filter  --------------------- //
    const filter = {};
    if (category) {
      // hỗ trợ nhiều ID, tách bởi dấu “,”
      const arr = category.split(",").filter(Boolean);
      filter.category = { $in: arr };
    }
    if (location) {
      const arr = location.split(",").filter(Boolean);
      filter.location = { $in: arr };
    }

    // ---------------------  query & populate  ------------------ //
    const products = await Product.find(filter)
      .populate("category")
      .populate("location");

    // Thêm trạng thái “Còn / Hết hàng”
    const result = products.map((p) => ({
      ...p.toObject(),
      status: p.stock > 0 ? "Còn hàng" : "Hết hàng",
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/* -------------------------------------------------- *
 * GET /api/product/:id
 * -------------------------------------------------- */
const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("category")
      .populate("location");

    if (!product) return res.status(404).json({ message: "Not found" });

    res.json({
      ...product.toObject(),
      status: product.stock > 0 ? "Còn hàng" : "Hết hàng",
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/* -------------------------------------------------- *
 *  POST /api/product/add   (ADMIN)
 * -------------------------------------------------- */
const createProduct = async (req, res) => {
  try {
    const { category, location } = req.body;

    // validate FK
    const catOK = await Category.findById(category);
    const locOK = await Location.findById(location);
    if (!catOK || !locOK)
      return res.status(400).json({ message: "Invalid category or location" });

    const saved = await new Product(req.body).save();
    const populated = await Product.findById(saved._id)
      .populate("category")
      .populate("location");

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/* -------------------------------------------------- */
const updateProduct = async (req, res) => {
  try {
    const updated = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate("category location");

    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
/* -------------------------------------------------- */
const deleteProduct = async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Not found" });
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
/* -------------------------------------------------- */
export default {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};
