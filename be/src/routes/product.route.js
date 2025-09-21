// server/routes/product.routes.js
import express from "express";
import mongoose from "mongoose";
import productController from "../controllers/product.controller.js";
import { verifyToken, isAdminOrManager } from "../middlewares/auth.middleware.js";

const router = express.Router();

/* ================= PUBLIC ================= */

/**
 * Danh sách sản phẩm (hàng lẻ)
 * Hỗ trợ filter cũ & mới (preorder, ripeness, weight, category, ...)
 * VD:
 *  - /api/product?preorder=true
 *  - /api/product?category=<id>
 */
router.get("/", productController.getAll);

// Trang “Sắp vào mùa”
router.get("/coming-soon", productController.getComingSoon);

// Danh sách COMBO (mới)
router.get("/combos", productController.getCombos);

// Tính giá COMBO động (mới)
router.post("/combo-quote", productController.comboQuote);

// Lấy sản phẩm theo tên danh mục
router.get("/category-name/:categoryName", productController.getByCategoryName);

// Lấy sản phẩm theo category ID với filter
router.get("/category/:categoryId", productController.getByCategoryWithFilter);

// Gợi ý sản phẩm thay thế (khi hết hàng)
router.get("/:id/alternatives", productController.getAlternatives);

// Ứng viên MIX builder cho 1 sản phẩm mix (mới)
router.get("/:id/mix-candidates", productController.getMixCandidates);

// Lấy danh sách lựa chọn “thùng” (map từ variants.kind="box" + legacy packagingOptions)
router.get("/:id/packaging", productController.getPackagingOptions);

// Chi tiết sản phẩm (đặt CUỐI để không nuốt các route tĩnh ở trên)
router.get("/:id", productController.getById);

/* ================= ADMIN / MANAGER ================= */

// Tạo mới sản phẩm (hàng lẻ: variants kind="loose"/"box")
router.post("/add", verifyToken, isAdminOrManager, productController.create);

// Cập nhật sản phẩm
router.put("/:id", verifyToken, isAdminOrManager, productController.update);

// Xoá sản phẩm
router.delete("/:id", verifyToken, isAdminOrManager, productController.remove);

// Xoá NHIỀU biến thể theo danh sách attributes (legacy loose)
// (Đối với biến thể “thùng” (box) nên dùng API xóa theo variantId bên dưới)
router.delete(
  "/:id/variant",
  verifyToken,
  isAdminOrManager,
  productController.removeVariants
);

// Cập nhật 1 biến thể theo ID (áp dụng cho cả loose & box)
router.put(
  "/:id/variant/:variantId",
  verifyToken,
  isAdminOrManager,
  productController.updateVariant
);

// Xoá 1 biến thể theo ID (áp dụng cho cả loose & box)
router.delete(
  "/:id/variant/:variantId",
  verifyToken,
  isAdminOrManager,
  productController.removeVariantById
);

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

// (Tuỳ chọn) validate categoryId nếu bạn muốn chặt chẽ hơn
router.param("categoryId", (req, res, next, val) => {
  if (!mongoose.Types.ObjectId.isValid(val)) {
    return res.status(400).json({ message: "Invalid category id" });
  }
  next();
});

export default router;
