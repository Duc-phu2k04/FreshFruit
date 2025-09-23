// server/controllers/statistics.controller.js
import Order from "../models/order.model.js";
import Product from "../models/product.model.js";
import Category from "../models/category.model.js";
import mongoose from "mongoose";

const statisticsController = {
  // Lấy tổng quan thống kê
  getOverview: async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      // Build date filter
      let dateFilter = {};
      if (startDate && endDate) {
        dateFilter.createdAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }

      // ✅ Tổng doanh thu từ đơn hàng đã thanh toán - tính từ items để nhất quán với category stats
      const revenueResult = await Order.aggregate([
        {
          $match: {
            paymentStatus: "paid",
            ...dateFilter
          }
        },
        { $unwind: "$items" },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } },
            totalOrders: { $addToSet: "$_id" }
          }
        },
        {
          $project: {
            totalRevenue: 1,
            totalOrders: { $size: "$totalOrders" }
          }
        }
      ]);

      // Tổng số lượng sản phẩm đã bán
      const quantityResult = await Order.aggregate([
        {
          $match: {
            paymentStatus: "paid",
            ...dateFilter
          }
        },
        { $unwind: "$items" },
        {
          $group: {
            _id: null,
            totalQuantity: { $sum: "$items.quantity" }
          }
        }
      ]);

      // Đơn hàng thành công (delivered)
      const successfulOrders = await Order.countDocuments({
        status: "delivered",
        paymentStatus: "paid",
        ...dateFilter
      });

      const overview = {
        totalRevenue: revenueResult[0]?.totalRevenue || 0,
        totalProductsSold: quantityResult[0]?.totalQuantity || 0,
        successfulOrders: successfulOrders,
        totalOrders: revenueResult[0]?.totalOrders || 0
      };

      res.json({
        success: true,
        data: overview
      });
    } catch (error) {
      console.error("Error getting overview statistics:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi lấy thống kê tổng quan",
        error: error.message
      });
    }
  },

  // Thống kê theo danh mục
  getByCategory: async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      let dateFilter = {};
      if (startDate && endDate) {
        dateFilter.createdAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }

      // Lấy thống kê theo danh mục
      const categoryStats = await Order.aggregate([
        {
          $match: {
            paymentStatus: "paid",
            ...dateFilter
          }
        },
        { $unwind: "$items" },
        {
          $lookup: {
            from: "products",
            localField: "items.product",
            foreignField: "_id",
            as: "productInfo"
          }
        },
        { $unwind: "$productInfo" },
        {
          $lookup: {
            from: "categories",
            localField: "productInfo.category",
            foreignField: "_id",
            as: "categoryInfo"
          }
        },
        { $unwind: "$categoryInfo" },
        {
          $group: {
            _id: {
              categoryId: "$categoryInfo._id",
              categoryName: "$categoryInfo.name"
            },
            totalRevenue: { 
              $sum: { $multiply: ["$items.quantity", "$items.price"] } 
            },
            totalQuantity: { $sum: "$items.quantity" },
            orderCount: { $addToSet: "$_id" }
          }
        },
        {
          $project: {
            categoryId: "$_id.categoryId",
            categoryName: "$_id.categoryName",
            totalRevenue: 1,
            totalQuantity: 1,
            orderCount: { $size: "$orderCount" },
            _id: 0
          }
        },
        { $sort: { totalRevenue: -1 } }
      ]);

      // Lấy top sản phẩm bán chạy
      const topProducts = await Order.aggregate([
        {
          $match: {
            paymentStatus: "paid",
            ...dateFilter
          }
        },
        { $unwind: "$items" },
        {
          $lookup: {
            from: "products",
            localField: "items.product",
            foreignField: "_id",
            as: "productInfo"
          }
        },
        { $unwind: "$productInfo" },
        {
          $group: {
            _id: {
              productId: "$productInfo._id",
              productName: "$productInfo.name"
            },
            totalQuantity: { $sum: "$items.quantity" },
            totalRevenue: { 
              $sum: { $multiply: ["$items.quantity", "$items.price"] }
            }
          }
        },
        {
          $project: {
            productName: "$_id.productName",
            totalQuantity: 1,
            totalRevenue: 1,
            _id: 0
          }
        },
        { $sort: { totalQuantity: -1 } },
        { $limit: 5 }
      ]);

      res.json({
        success: true,
        data: {
          categories: categoryStats,
          topProducts: topProducts
        }
      });
    } catch (error) {
      console.error("Error getting category statistics:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi lấy thống kê theo danh mục", 
        error: error.message
      });
    }
  },

  // Thống kê theo thời gian (biểu đồ)
  getTimeSeriesStats: async (req, res) => {
    try {
      const { period = "month" } = req.query; // day, week, month
      
      let groupBy;
      let dateRange = {};
      
      // Xác định khoảng thời gian và format group by
      switch (period) {
        case "day":
          groupBy = {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" }
          };
          // 30 ngày gần nhất
          dateRange.createdAt = {
            $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          };
          break;
        case "week":
          groupBy = {
            year: { $year: "$createdAt" },
            week: { $week: "$createdAt" }
          };
          // 12 tuần gần nhất
          dateRange.createdAt = {
            $gte: new Date(Date.now() - 12 * 7 * 24 * 60 * 60 * 1000)
          };
          break;
        default: // month
          groupBy = {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" }
          };
          // 12 tháng gần nhất
          dateRange.createdAt = {
            $gte: new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000)
          };
      }

      const timeSeriesData = await Order.aggregate([
        {
          $match: {
            paymentStatus: "paid",
            ...dateRange
          }
        },
        {
          $group: {
            _id: groupBy,
            revenue: { $sum: "$total" },
            orderCount: { $sum: 1 }
          }
        },
        { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1, "_id.week": 1 } }
      ]);

      res.json({
        success: true,
        data: timeSeriesData
      });
    } catch (error) {
      console.error("Error getting time series statistics:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi lấy thống kê theo thời gian",
        error: error.message
      });
    }
  },

  // Thống kê trạng thái đơn hàng
  getOrderStatusStats: async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      let dateFilter = {};
      if (startDate && endDate) {
        dateFilter.createdAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }

      const statusStats = await Order.aggregate([
        {
          $match: dateFilter
        },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            totalValue: { $sum: "$total" }
          }
        },
        { $sort: { count: -1 } }
      ]);

      const paymentStats = await Order.aggregate([
        {
          $match: dateFilter
        },
        {
          $group: {
            _id: "$paymentStatus",
            count: { $sum: 1 },
            totalValue: { $sum: "$total" }
          }
        },
        { $sort: { count: -1 } }
      ]);

      res.json({
        success: true,
        data: {
          orderStatus: statusStats,
          paymentStatus: paymentStats
        }
      });
    } catch (error) {
      console.error("Error getting order status statistics:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi khi lấy thống kê trạng thái đơn hàng",
        error: error.message
      });
    }
  }
};

export default statisticsController;