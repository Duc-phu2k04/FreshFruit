import express from "express";
import { checkout, getUserOrders, getAllOrders, updateStatus, deleteOrder } from "../controllers/order.controller.js";
import { verifyToken, isAdmin } from "../middlewares/auth.middleware.js";


const router = express.Router();

router.post("/add", verifyToken, checkout);                       // POST /api/order       - tạo đơn hàng
router.get("/", verifyToken, getUserOrders);                  // GET  /api/order       - user xem đơn của mình
router.get("/all", verifyToken, isAdmin, getAllOrders);   // GET  /api/order/all   - admin xem tất cả đơn
router.put("/:id/status", verifyToken, isAdmin, updateStatus); // PUT /api/order/:id/status - cập nhật trạng thái
router.delete("/:id", verifyToken, isAdmin, deleteOrder); // Xoá đơn theo ID

export default router;

