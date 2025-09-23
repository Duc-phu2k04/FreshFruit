// src/controllers/category.controller.js
import  Category  from "../models/category.model.js";
import Product from "../models/product.model.js";

export const getAllCategories = async (req, res) => {
  const categories = await Category.find();
  res.json(categories);
};

export const getCategoryById = async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) return res.status(404).json({ message: "Not found" });
  res.json(category);
};

export const createCategory = async (req, res) => {
  const newCategory = new Category(req.body);
  const saved = await newCategory.save();
  res.status(201).json(saved);
};

export const updateCategory = async (req, res) => {
  const updated = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!updated) return res.status(404).json({ message: "Not found" });
  res.json(updated);
};

export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    
    // ✅ Kiểm tra xem danh mục có tồn tại không
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ message: "Không tìm thấy danh mục" });
    }
    
    // ✅ Kiểm tra xem danh mục có sản phẩm nào không
    const productsInCategory = await Product.countDocuments({ category: id });
    if (productsInCategory > 0) {
      return res.status(400).json({ 
        message: `Không thể xóa danh mục "${category.name}" vì còn ${productsInCategory} sản phẩm thuộc danh mục này. Vui lòng xóa hoặc chuyển các sản phẩm sang danh mục khác trước khi xóa danh mục.`,
        productCount: productsInCategory
      });
    }
    
    // ✅ Nếu không có sản phẩm, tiến hành xóa danh mục
    const deleted = await Category.findByIdAndDelete(id);
    res.json({ 
      message: `Đã xóa danh mục "${deleted.name}" thành công`,
      deletedCategory: deleted
    });
  } catch (err) {
    console.error("[deleteCategory] Lỗi:", err);
    res.status(500).json({ message: "Lỗi server khi xóa danh mục", error: err.message });
  }
};

