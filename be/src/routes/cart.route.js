// server/routes/cart.routes.js
import express from "express";
import {
  addToCart,
  updateCartItem,
  getCartByUser,
  removeCartItem,
  clearCart,
} from "../controllers/cart.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";

const router = express.Router();

/**
 * ============================
 * CART ROUTES
 * ============================
 * - Biến thể/thùng: POST /add  { productId, variantId, quantity }
 * - Xoá item:
 *    + Mới:    DELETE /item/:id
 *    + Legacy: DELETE /variant/:productId/:variantId
 *    + Legacy (rất cũ): DELETE /:productId/:variantId   ← thêm để tương thích FE cũ
 */

/* Lấy giỏ hàng người dùng */
router.get("/", verifyToken, getCartByUser);   // legacy
router.get("/me", verifyToken, getCartByUser); // khuyên dùng

/* Thêm vào giỏ */
router.post("/add", verifyToken, addToCart);

/* Cập nhật số lượng */
router.patch("/item", verifyToken, updateCartItem); // khuyên dùng
router.put("/update", verifyToken, updateCartItem);  // legacy

/* Xoá 1 item (id trực tiếp) */
router.delete("/item/:id", verifyToken, removeCartItem);

/* Xoá 1 item theo productId + variantId (legacy có prefix 'variant') */
router.delete(
  "/variant/:productId/:variantId",
  verifyToken,
  (req, res, next) => {
    req.query.productId = req.params.productId;
    req.query.variantId = req.params.variantId;
    return removeCartItem(req, res, next);
  }
);

/* Xoá 1 item theo productId + variantId (legacy rất cũ, KHÔNG prefix) */
router.delete(
  "/:productId/:variantId",
  verifyToken,
  (req, res, next) => {
    // Chuyển tiếp như legacy ở trên
    req.query.productId = req.params.productId;
    req.query.variantId = req.params.variantId;
    return removeCartItem(req, res, next);
  }
);

/* Xoá toàn bộ giỏ */
router.delete("/clear", verifyToken, clearCart);

export default router;
