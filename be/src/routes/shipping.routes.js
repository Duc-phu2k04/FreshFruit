// server/routes/shipping.routes.js
import express from "express";
import { verifyToken } from "../middlewares/auth.middleware.js";
import { quoteShipping } from "../services/shipping.service.js";
//  Import đúng với file model bạn có. Nếu bạn lưu là address.model.js, đổi lại cho khớp:
import Address from "../models/address.model.js";

const router = express.Router();

/**
 * GET /api/shipping/quote?addressId=...&subtotal=...
 * - Tính phí theo KHU VỰC dựa trên addressId (đã lưu districtCode/wardCode trong DB).
 * - Trả về: { ok, data: { amount, ruleName, matchedBy, zoneId, freeThreshold } }
 */
router.get("/quote", verifyToken, async (req, res) => {
  try {
    const { addressId, subtotal = 0 } = req.query;

    if (!addressId) {
      return res.status(400).json({ ok: false, message: "addressId required" });
    }

    const address = await Address.findById(addressId).lean();
    if (!address) {
      return res.status(404).json({ ok: false, message: "Address not found" });
    }

    const result = await quoteShipping({
      provinceCode: 1, // Hà Nội
      // service sẽ tự pad "004" / "00139" nên chỉ cần String hoá
      districtCode: String(address?.districtCode || address?.district_code || ""),
      wardCode: String(address?.wardCode || address?.ward_code || ""),
      cartSubtotal: Number(subtotal) || 0,
    });

    return res.json({ ok: true, data: result });
  } catch (e) {
    console.error("[GET /api/shipping/quote] error:", e);
    res.status(500).json({ ok: false, message: "Quote error" });
  }
});

/**
 * POST /api/shipping/quote
 * Body: { districtCode, wardCode, subtotal }
 * - Dùng khi FE đã có sẵn mã quận/phường và muốn quote nhanh (không cần addressId).
 */
router.post("/quote", verifyToken, async (req, res) => {
  try {
    const { districtCode, wardCode, subtotal = 0 } = req.body || {};
    if (!districtCode && !wardCode) {
      return res.status(400).json({
        ok: false,
        message: "districtCode or wardCode is required",
      });
    }

    const result = await quoteShipping({
      provinceCode: 1, // Hà Nội
      districtCode: String(districtCode || ""),
      wardCode: String(wardCode || ""),
      cartSubtotal: Number(subtotal) || 0,
    });

    return res.json({ ok: true, data: result });
  } catch (e) {
    console.error("[POST /api/shipping/quote] error:", e);
    res.status(500).json({ ok: false, message: "Quote error" });
  }
});

export default router;
