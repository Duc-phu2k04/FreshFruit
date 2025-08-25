import express from "express";
import productController from "../controllers/product.controller.js";
import { verifyToken, isAdmin } from "../middlewares/auth.middleware.js";

const router = express.Router();

/* ========== PUBLIC ========== */
// Danh sách sản phẩm (giữ nguyên logic cũ – hỗ trợ thêm query khác)
router.get("/", productController.getAll);

//  MỚI: Trang “Sắp vào mùa” — chỉ trả về sản phẩm có preorder.enabled = true
// (đặt trước trước /:id để tránh đụng route param)
router.get("/coming-soon", productController.getComingSoon);

// Chi tiết sản phẩm (giữ nguyên)
router.get("/:id", productController.getById);

/* ========== ADMIN ========== */
router.post("/add", verifyToken, isAdmin, productController.create);
router.put("/:id", verifyToken, isAdmin, productController.update);
router.delete("/:id", verifyToken, isAdmin, productController.remove);

//  Xóa 1 hoặc nhiều biến thể (truyền mảng attributesList)
router.delete("/:id/variant", verifyToken, isAdmin, productController.removeVariants);

//  Cập nhật 1 biến thể theo ID
router.put("/:id/variant/:variantId", verifyToken, isAdmin, productController.updateVariant);

//  Xóa 1 biến thể theo ID
router.delete("/:id/variant/:variantId", verifyToken, isAdmin, productController.removeVariantById);

export default router;
