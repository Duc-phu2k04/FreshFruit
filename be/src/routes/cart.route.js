import express from "express";
import {
  addToCart,
  updateCartItem,
  getCartByUser,
  removeCartItem,
  clearCart
} from "../controllers/cart.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", verifyToken, getCartByUser);
router.post("/add", verifyToken, addToCart);
router.put("/update", verifyToken, updateCartItem);
router.delete("/:productId", verifyToken, removeCartItem);
router.delete("/clear", verifyToken, clearCart); 

export default router;
