// server/routes/statistics.route.js
import express from "express";
import statisticsController from "../controllers/statistics.controller.js";
import { verifyToken, isAdminOrManager } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Tất cả routes đều yêu cầu quyền Admin hoặc Manager
router.use(verifyToken, isAdminOrManager);

// GET /api/statistics/overview - Thống kê tổng quan
router.get("/overview", statisticsController.getOverview);

// GET /api/statistics/by-category - Thống kê theo danh mục  
router.get("/by-category", statisticsController.getByCategory);

// GET /api/statistics/time-series?period=month - Thống kê theo thời gian
router.get("/time-series", statisticsController.getTimeSeriesStats);

// GET /api/statistics/order-status - Thống kê trạng thái đơn hàng
router.get("/order-status", statisticsController.getOrderStatusStats);

export default router;

// Thêm vào server/app.js hoặc server/index.js:
/*
import statisticsRoutes from './routes/statistics.route.js';
app.use('/api/statistics', statisticsRoutes);
*/