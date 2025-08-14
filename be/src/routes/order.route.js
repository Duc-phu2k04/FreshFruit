import express from "express";
import { 
  checkout, 
  getUserOrders, 
  getAllOrders, 
  updateStatus, 
  deleteOrder,
  hideOrderFromHistory //  thêm controller mới
} from "../controllers/order.controller.js";
import { verifyToken, isAdmin } from "../middlewares/auth.middleware.js";

const router = express.Router();

// 🛒 Tạo đơn hàng
router.post("/add", verifyToken, checkout); // POST /api/orders/add

//  Lấy lịch sử đơn hàng của người dùng
router.get("/user", verifyToken, getUserOrders); // GET /api/orders/user

//  Lấy toàn bộ đơn hàng (admin)
router.get("/all", verifyToken, isAdmin, getAllOrders); // GET /api/orders/all

//  Cập nhật trạng thái đơn (admin)
router.put("/:id/status", verifyToken, isAdmin, updateStatus); // PUT /api/orders/:id/status

// Huỷ đơn hàng (user hoặc admin)
router.delete("/:id", verifyToken, deleteOrder); // DELETE /api/orders/:id

//  Ẩn đơn hàng khỏi lịch sử (soft delete)
router.patch("/:id/hide", verifyToken, hideOrderFromHistory); // PATCH /api/orders/:id/hide

export default router;
