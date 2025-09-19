import express from "express";
import mongoose from "mongoose";
import productController from "../controllers/product.controller.js";
import { verifyToken, isAdminOrManager } from "../middlewares/auth.middleware.js";

const router = express.Router();

/* ================= PUBLIC ================= */

// Danh sách sản phẩm (hỗ trợ query filter, ví dụ: ?preorder=true)
router.get("/", productController.getAll);

// Trang “Sắp vào mùa”
router.get("/coming-soon", productController.getComingSoon);

// Lấy sản phẩm theo tên danh mục
router.get("/category-name/:categoryName", productController.getByCategoryName);

// Lấy sản phẩm theo category ID với filter
router.get("/category/:categoryId", productController.getByCategoryWithFilter);

// Chi tiết sản phẩm (đặt CUỐI để không nuốt các route tĩnh)
router.get("/:id", productController.getById);

/* ================= ADMIN / MANAGER ================= */

// Tạo mới sản phẩm
router.post("/add", verifyToken, isAdminOrManager, productController.create);

// Cập nhật sản phẩm
router.put("/:id", verifyToken, isAdminOrManager, productController.update);

// Xoá sản phẩm
router.delete("/:id", verifyToken, isAdminOrManager, productController.remove);

// Xoá NHIỀU biến thể theo danh sách attributes
router.delete("/:id/variant", verifyToken, isAdminOrManager, productController.removeVariants);

// Cập nhật 1 biến thể theo ID
router.put("/:id/variant/:variantId", verifyToken, isAdminOrManager, productController.updateVariant);

// Xoá 1 biến thể theo ID
router.delete("/:id/variant/:variantId", verifyToken, isAdminOrManager, productController.removeVariantById);

/* ================= PARAM VALIDATION ================= */
router.param("id", (req, res, next, val) => {
  if (!mongoose.Types.ObjectId.isValid(val)) {
    return res.status(400).json({ message: "Invalid product id" });
  }
  next();
});

router.param("variantId", (req, res, next, val) => {
  if (!mongoose.Types.ObjectId.isValid(val)) {
    return res.status(400).json({ message: "Invalid variant id" });
  }
  next();
});

export default router;
