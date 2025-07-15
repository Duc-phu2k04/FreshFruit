import Product from "../models/product.model.js";
import Category from "../models/category.model.js";
import Location from "../models/location.model.js";

/**
 * GET /api/product?category=cat1,cat2&location=loc1,loc2
 */
const getAllProducts = async (req, res) => {
  try {
    const { category, location } = req.query;

    const filter = {};
    if (category) {
      const arr = category.split(",").filter(Boolean);
      filter.category = { $in: arr };
    }
    if (location) {
      const arr = location.split(",").filter(Boolean);
      filter.location = { $in: arr };
    }

    const products = await Product.find(filter)
      .populate("category")
      .populate("location");

    const result = products.map((p) => {
      const obj = p.toObject({ getters: true }); // preserve _id
      obj.status = p.stock > 0 ? "Còn hàng" : "Hết hàng";
      return obj;
    });

    console.log("📦 Sản phẩm gửi về:", result.map(p => ({
      _id: p._id, name: p.name
    })));

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * GET /api/product/:id
 */
const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("category")
      .populate("location");

    if (!product) return res.status(404).json({ message: "Not found" });

    res.json({
      ...product.toObject({ getters: true }),
      status: product.stock > 0 ? "Còn hàng" : "Hết hàng",
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * POST /api/product/add
 */
const createProduct = async (req, res) => {
  try {
    const { category, location, name, price } = req.body;

    // Validate required fields
    if (!name || !price || !category) {
      return res.status(400).json({ message: "Thiếu thông tin sản phẩm" });
    }

    const catOK = await Category.findById(category);
    const locOK = location ? await Location.findById(location) : true;

    if (!catOK || !locOK) {
      return res.status(400).json({ message: "Danh mục hoặc địa điểm không hợp lệ" });
    }

    const saved = await new Product(req.body).save();
    const populated = await Product.findById(saved._id)
      .populate("category")
      .populate("location");

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * PUT /api/product/:id
 */
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

/**
 * DELETE /api/product/:id
 */
const deleteProduct = async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Not found" });
    res.json({ message: "Xoá sản phẩm thành công" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Export tất cả controller
export default {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};
