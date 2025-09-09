// src/routes/category.route.js
import express from "express";
import * as categoryController from "../controllers/category.controller.js";
import { verifyToken, isAdminOrManager } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Public
router.get("/", categoryController.getAllCategories);
router.get("/:id", categoryController.getCategoryById);

// Admin / Manager
router.post("/add", verifyToken, isAdminOrManager, categoryController.createCategory);
router.put("/:id", verifyToken, isAdminOrManager, categoryController.updateCategory);
router.delete("/:id", verifyToken, isAdminOrManager, categoryController.deleteCategory);

export default router;
