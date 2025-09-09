// src/routes/order.route.js
import express from "express";
import {
  checkout,
  getUserOrders,
  getAllOrders,
  updateStatus,
  deleteOrder,
  hideOrderFromHistory, // giữ controller hiện có
} from "../controllers/order.controller.js";
import { verifyToken, isAdmin,isAdminOrManager } from "../middlewares/auth.middleware.js";

// ✅ import đúng service & model
import { quoteShipping } from "../services/shipping.service.js";
import Address from "../models/address.model.js";

const router = express.Router();

// ========= Helpers: chuẩn hoá/validate mã =========
const isDistrictCode = (v) => /^\d{3}$/.test(String(v ?? "").trim());
const isWardCode = (v) => /^\d{5}$/.test(String(v ?? "").trim());
const padDistrict = (v) => {
  const s = String(v ?? "").trim();
  return /^\d+$/.test(s) ? s.padStart(3, "0") : "";
};
const padWard = (v) => {
  const s = String(v ?? "").trim();
  return /^\d+$/.test(s) ? s.padStart(5, "0") : "";
};

// Tạo đơn hàng
router.post("/add", verifyToken, checkout); // POST /api/orders/add

// Lấy lịch sử đơn hàng của người dùng
router.get("/user", verifyToken, getUserOrders); // GET /api/orders/user

// Lấy toàn bộ đơn hàng (admin)
router.get("/all", verifyToken, isAdminOrManager, getAllOrders); // GET /api/orders/all

// Cập nhật trạng thái đơn (admin)
router.put("/:id/status", verifyToken, isAdminOrManager, updateStatus); // PUT /api/orders/:id/status

// Huỷ đơn hàng (user hoặc admin)
router.delete("/:id", verifyToken, deleteOrder); // DELETE /api/orders/:id

//  Ẩn đơn hàng khỏi lịch sử (soft delete)
router.patch("/:id/hide", verifyToken, hideOrderFromHistory); // PATCH /api/orders/:id/hide

// ================================
// SHIPPING QUOTE (dành cho Checkout)
// ================================

// GET /api/orders/shipping/quote?addressId=...&subtotal=...
router.get("/shipping/quote", verifyToken, async (req, res) => {
  try {
    const { addressId, subtotal = 0 } = req.query;
    if (!addressId) {
      return res.status(400).json({ ok: false, message: "addressId required" });
    }

    const address = await Address.findById(addressId).lean();
    if (!address) {
      return res.status(404).json({ ok: false, message: "Address not found" });
    }

    // Lấy raw code từ DB (hỗ trợ cả field cũ: district_code/ward_code)
    const dRaw = address.districtCode ?? address.district_code;
    const wRaw = address.wardCode ?? address.ward_code;

    // CHỈ chấp nhận wardCode đúng 5 chữ số; districtCode đúng 3 chữ số
    const districtCode = isDistrictCode(dRaw) ? padDistrict(dRaw) : "";
    const wardCode = isWardCode(wRaw) ? padWard(wRaw) : "";

    // Log gỡ lỗi (có thể tắt sau khi test xong)
    console.debug("[QUOTE] addressId:", addressId, {
      districtCode_raw: dRaw,
      districtCode_normalized: districtCode,
      wardCode_raw: wRaw,
      wardCode_normalized: wardCode,
      subtotal: Number(subtotal || 0),
    });

    const result = await quoteShipping({
      provinceCode: 1, // Hà Nội
      districtCode: districtCode || undefined, // nếu rỗng thì không gửi để tránh match sai
      wardCode: wardCode || undefined,
      cartSubtotal: Number(subtotal || 0),
    });

    return res.json({ ok: true, data: result });
  } catch (e) {
    console.error("[GET /orders/shipping/quote] error:", e);
    res.status(500).json({ ok: false, message: "Quote error" });
  }
});

// (Tuỳ chọn) POST /api/orders/shipping/quote
router.post("/shipping/quote", verifyToken, async (req, res) => {
  try {
    const { districtCode: dBody, wardCode: wBody, subtotal = 0 } = req.body || {};
    // Chuẩn hoá input từ FE
    const districtCode = isDistrictCode(dBody) ? padDistrict(dBody) : "";
    const wardCode = isWardCode(wBody) ? padWard(wBody) : "";

    if (!districtCode && !wardCode) {
      return res.status(400).json({
        ok: false,
        message: "districtCode or wardCode is required (must be numeric: DDD or WWWWW)",
      });
    }

    console.debug("[QUOTE-POST] normalized:", {
      districtCode,
      wardCode,
      subtotal: Number(subtotal || 0),
    });

    const result = await quoteShipping({
      provinceCode: 1,
      districtCode: districtCode || undefined,
      wardCode: wardCode || undefined,
      cartSubtotal: Number(subtotal || 0),
    });

    return res.json({ ok: true, data: result });
  } catch (e) {
    console.error("[POST /orders/shipping/quote] error:", e);
    res.status(500).json({ ok: false, message: "Quote error" });
  }
});

export default router;
