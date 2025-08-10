import express from "express";
import productController from "../controllers/product.controller.js";
import { verifyToken, isAdmin } from "../middlewares/auth.middleware.js";

const router = express.Router();

// PUBLIC
router.get("/", productController.getAll);
router.get("/:id", productController.getById);

// ADMIN
router.post("/add", verifyToken, isAdmin, productController.create);
router.put("/:id", verifyToken, isAdmin, productController.update);
router.delete("/:id", verifyToken, isAdmin, productController.remove);

// ✅ Xóa 1 hoặc nhiều biến thể (truyền mảng attributesList)
router.delete("/:id/variant", verifyToken, isAdmin, productController.removeVariants);

// ✅ Cập nhật 1 biến thể theo ID
router.put("/:id/variant/:variantId", verifyToken, isAdmin, productController.updateVariant);

// ✅ Xóa 1 biến thể theo ID
router.delete("/:id/variant/:variantId", verifyToken, isAdmin, productController.removeVariantById);

export default router;
