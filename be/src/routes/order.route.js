import express from "express";
import { 
  checkout, 
  getUserOrders, 
  getAllOrders, 
  updateStatus, 
  deleteOrder 
} from "../controllers/order.controller.js";
import { verifyToken, isAdmin } from "../middlewares/auth.middleware.js";

const router = express.Router();

//  Tạo đơn hàng
router.post("/add", verifyToken, checkout);                      // POST  /api/orders/add - tạo đơn hàng

//  Lấy lịch sử đơn hàng của người dùng
router.get("/user", verifyToken, getUserOrders);                 // GET   /api/orders/user - user xem đơn của mình

//  Lấy toàn bộ đơn hàng (admin)
router.get("/all", verifyToken, isAdmin, getAllOrders);          // GET   /api/orders/all - admin xem tất cả đơn

//  Cập nhật trạng thái đơn (admin)
router.put("/:id/status", verifyToken, isAdmin, updateStatus);   // PUT   /api/orders/:id/status - cập nhật trạng thái

//  Huỷ đơn hàng (user hoặc admin)
router.delete("/:id", verifyToken, deleteOrder);                 // DELETE /api/orders/:id - user hoặc admin huỷ đơn

export default router;
