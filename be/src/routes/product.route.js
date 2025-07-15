import express from "express";
import productController from "../controllers/product.controller.js";
import { verifyToken, isAdmin } from "../middlewares/auth.middleware.js";

const router = express.Router();

// PUBLIC
router.get("/", productController.getAllProducts);
router.get("/related/:id", productController.getRelatedProducts); // 👈 Route mới để lấy sản phẩm liên quan
router.get("/:id", productController.getProductById);

// ADMIN
router.post("/add", verifyToken, isAdmin, productController.createProduct);
router.put("/:id", verifyToken, isAdmin, productController.updateProduct);
router.delete("/:id", verifyToken, isAdmin, productController.deleteProduct);

export default router;
