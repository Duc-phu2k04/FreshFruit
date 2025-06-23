// src/routes/cart.route.js
import express from "express";
import * as cartController from "../controllers/cart.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Thêm sản phẩm vào giỏ hàng
router.post("/add", verifyToken, cartController.addToCart);

// Cập nhật số lượng hoặc xoá sản phẩm trong giỏ
router.put("/update", verifyToken, cartController.updateCartItem);

// Lấy danh sách giỏ hàng theo user
router.get("/", verifyToken, cartController.getCartByUser);

export default router;
