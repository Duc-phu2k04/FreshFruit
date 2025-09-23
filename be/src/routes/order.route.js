// src/routes/order.route.js
import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import mongoose from "mongoose";

import {
  // ORDER core
  checkout,
  getUserOrders,
  getAllOrders,
  getOrderById,
  updateStatus,
  deleteOrder,
  cancelOrder,
  hideOrderFromHistory,

  // Return/Refund flow
  orderReturnRequest,        // USER
  orderReturnApprove,        // ADMIN
  orderReturnReject,         // ADMIN
  orderReturnShippingUpdate, // ADMIN
  orderReturnRefund,         // ADMIN
} from "../controllers/order.controller.js";

import { verifyToken, isAdminOrManager } from "../middlewares/auth.middleware.js";
import { quoteShipping } from "../services/shipping.service.js";
import Address from "../models/address.model.js";

const router = express.Router();

/* ================================
 *        Multer (ảnh đổi/trả)
 * ============================== */
const RETURNS_DIR = path.resolve(process.cwd(), "uploads", "returns");
if (!fs.existsSync(RETURNS_DIR)) fs.mkdirSync(RETURNS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, RETURNS_DIR),
  filename: (_req, file, cb) => {
    const ts = Date.now();
    const safe = (file.originalname || "evidence")
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9._-]/g, "");
    cb(null, `${ts}-${safe}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 10 }, // 10MB/file, tối đa 10 ảnh
});

/* ================================
 *   Helpers cho shipping code
 * ============================== */
const isDistrictCode = (v) => /^\d{3}$/.test(String(v ?? "").trim());
const isWardCode = (v) => /^\d{5}$/.test(String(v ?? "").trim());
const padDistrict = (v) =>
  /^\d+$/.test(String(v ?? "")) ? String(v).padStart(3, "0") : "";
const padWard = (v) =>
  /^\d+$/.test(String(v ?? "")) ? String(v).padStart(5, "0") : "";

/** Chuẩn hoá code: pad trước rồi validate */
function normalizeDistrictCode(raw) {
  const padded = padDistrict(raw);
  return isDistrictCode(padded) ? padded : "";
}
function normalizeWardCode(raw) {
  const padded = padWard(raw);
  return isWardCode(padded) ? padded : "";
}

/* ================================
 *    Chuẩn hoá body giỏ hàng
 * ============================== */
/**
 * Một số FE (hoặc gateway) có thể gửi cartItems/mixPackages ở dạng chuỗi JSON
 * hoặc không gửi các field đó. Middleware này ép về mảng hợp lệ trước khi vào controller.
 */
function normalizeCartBody(req, res, next) {
  try {
    const b = req.body || {};
    const parseMaybe = (v) => (typeof v === "string" ? JSON.parse(v) : v);
    const toArray = (v) => (Array.isArray(v) ? v : []);

    // Chuẩn hoá hai mảng quan trọng
    req.body.cartItems = toArray(parseMaybe(b.cartItems));
    req.body.mixPackages = toArray(parseMaybe(b.mixPackages));

    // Optionally: ép quantity về số >=1 (không bắt buộc, controller vẫn tự xử lý)
    // req.body.cartItems = req.body.cartItems.map((it) => ({
    //   ...it,
    //   quantity: Math.max(1, Number(it?.quantity || 1)),
    // }));

    next();
  } catch (e) {
    return res
      .status(400)
      .json({ message: "Payload không hợp lệ (cartItems/mixPackages)" });
  }
}

/* ================================
 *            ORDER
 * ============================== */
// Giữ endpoint cũ để không vỡ luồng
router.post("/add", verifyToken, normalizeCartBody, checkout);
// Endpoint mới rõ nghĩa
router.post("/checkout", verifyToken, normalizeCartBody, checkout);

// Đơn của user
router.get("/user", verifyToken, getUserOrders);

// Tất cả đơn cho admin/manager
router.get("/all", verifyToken, isAdminOrManager, getAllOrders);

// Cập nhật trạng thái đơn (admin/manager)
router.put("/:id/status", verifyToken, isAdminOrManager, updateStatus);

/* ================================
 *         RETURN FLOW
 * ============================== */
/**
 * USER gửi yêu cầu đổi/trả.
 * Hỗ trợ JSON hoặc multipart/form-data (field "images").
 * Ảnh sẽ được controller chuẩn hoá thành absolute URL.
 */
router.post(
  "/:id/return-request",
  verifyToken,
  upload.array("images", 10),
  orderReturnRequest
);

// ADMIN thao tác duyệt / từ chối / cập nhật vận chuyển / hoàn tiền
router.patch(
  "/:id/return/approve",
  verifyToken,
  isAdminOrManager,
  orderReturnApprove
);
router.patch(
  "/:id/return/reject",
  verifyToken,
  isAdminOrManager,
  orderReturnReject
);
router.patch(
  "/:id/return/shipping-update",
  verifyToken,
  isAdminOrManager,
  orderReturnShippingUpdate
);
router.patch(
  "/:id/return/refund",
  verifyToken,
  isAdminOrManager,
  orderReturnRefund
);

/* ================================
 *   Ẩn / Huỷ (giữ luồng cũ)
 * ============================== */
router.patch("/:id/hide", verifyToken, hideOrderFromHistory);
router.patch("/:id/cancel", verifyToken, cancelOrder); // ✅ Hủy đơn hàng (thay đổi trạng thái)
router.delete("/:id", verifyToken, deleteOrder);

/* ================================
 *   SHIPPING QUOTE (cho Checkout)
 * ============================== */
/** GET bằng addressId (ưu tiên bảo mật: chỉ cho dùng address của chính user) */
router.get("/shipping/quote", verifyToken, async (req, res) => {
  try {
    const { addressId, subtotal = 0 } = req.query;
    if (!addressId) {
      return res.status(400).json({ ok: false, message: "addressId required" });
    }

    // chỉ lấy address thuộc user đang đăng nhập
    const address = await Address.findOne({
      _id: addressId,
      user: req.user._id,
    }).lean();
    if (!address) {
      return res.status(404).json({ ok: false, message: "Address not found" });
    }

    const districtCode = normalizeDistrictCode(
      address.districtCode ?? address.district_code
    );
    const wardCode = normalizeWardCode(address.wardCode ?? address.ward_code);

    const result = await quoteShipping({
      provinceCode: 1, // Hà Nội (ví dụ)
      districtCode: districtCode || undefined,
      wardCode: wardCode || undefined,
      cartSubtotal: Number(subtotal || 0),
    });

    res.json({ ok: true, data: result });
  } catch (e) {
    console.error("[GET /orders/shipping/quote] error:", e);
    res.status(500).json({ ok: false, message: "Quote error" });
  }
});

/** POST bằng districtCode/wardCode trực tiếp (chấp nhận số ngắn, sẽ pad) */
router.post("/shipping/quote", verifyToken, async (req, res) => {
  try {
    const { districtCode: dBody, wardCode: wBody, subtotal = 0 } = req.body || {};
    const districtCode = normalizeDistrictCode(dBody);
    const wardCode = normalizeWardCode(wBody);

    if (!districtCode && !wardCode) {
      return res.status(400).json({
        ok: false,
        message:
          "districtCode hoặc wardCode là bắt buộc (chấp nhận số, sẽ chuẩn hoá thành DDD/WWWWW).",
      });
    }

    const result = await quoteShipping({
      provinceCode: 1,
      districtCode: districtCode || undefined,
      wardCode: wardCode || undefined,
      cartSubtotal: Number(subtotal || 0),
    });

    res.json({ ok: true, data: result });
  } catch (e) {
    console.error("[POST /orders/shipping/quote] error:", e);
    res.status(500).json({ ok: false, message: "Quote error" });
  }
});

/* ===========================================================
 *  CUỐI FILE: GET /api/orders/:id  (ADMIN) — chi tiết đơn
 *  (đặt cuối để tránh nuốt các route tĩnh bên trên)
 * ==========================================================*/
router.get("/:id", verifyToken, isAdminOrManager, getOrderById);

/* ================================
 *     PARAM VALIDATION :id
 * ============================== */
router.param("id", (req, res, next, val) => {
  if (!mongoose.Types.ObjectId.isValid(val)) {
    return res.status(400).json({ message: "Invalid order id" });
  }
  next();
});

export default router;
