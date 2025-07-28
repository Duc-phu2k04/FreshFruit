import express from "express";
import productController from "../controllers/product.controller.js";
import { verifyToken, isAdmin } from "../middlewares/auth.middleware.js";

const router = express.Router();

// PUBLIC
router.get("/", productController.getAll);                  // ✅ Lấy tất cả sản phẩm
router.get("/related/:id", productController.getById);     // Lấy sản phẩm liên quan
router.get("/:id", productController.getById);              // Lấy sản phẩm theo id

// ADMIN
router.post("/add", verifyToken, isAdmin, productController.create);  // Thêm sản phẩm
router.put("/:id", verifyToken, isAdmin, productController.update);   // Cập nhật
router.delete("/:id", verifyToken, isAdmin, productController.remove); // Xoá

export default router;
