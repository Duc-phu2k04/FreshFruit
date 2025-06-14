import express from "express";
import productController from "../controllers/product.controller.js";
import { verifyToken, isAdmin } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Public
router.get("/", productController.getAllProducts);
router.get("/:id", productController.getProductById);

// Admin
router.post("/add", verifyToken, isAdmin, productController.createProduct);
router.put("/:id", verifyToken, isAdmin, productController.updateProduct);
router.delete("/:id", verifyToken, isAdmin, productController.deleteProduct);
router.get("/", verifyToken, isAdmin, productController.getAllProducts);
router.get("/:id", verifyToken, isAdmin, productController.getProductById);

export default router;
