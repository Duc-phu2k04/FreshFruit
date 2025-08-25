// server/routes/preorder.route.js
import express from "express";
import { verifyToken, isAdmin } from "../middlewares/auth.middleware.js";
import {
  // USER
  createPreorder,
  cancelPreorder,
  listUserPreorders,
  getPreorderDetail,
  userHidePreorder, // user “xóa khỏi lịch sử” khi đã delivered/cancelled

  // ADMIN
  listAdminPreorders,
  recalcPreorder,
  adminEditPreorder,
  adminCancelPreorder,
  adminDeletePreorder,
  adminSetStatus,
  //  các handler liên quan thanh toán admin
  adminAddPayment,
  adminMarkDepositPaid,
  adminMarkPaidInFull,
} from "../controllers/preorder.controller.js";

const router = express.Router();

/* ---------- ADMIN ROUTES ---------- */
router.get("/admin", verifyToken, isAdmin, listAdminPreorders);
router.patch("/:id/recalc", verifyToken, isAdmin, recalcPreorder);
router.patch("/:id/admin-edit", verifyToken, isAdmin, adminEditPreorder);
router.patch("/:id/admin-cancel", verifyToken, isAdmin, adminCancelPreorder);
router.delete("/:id/admin-delete", verifyToken, isAdmin, adminDeletePreorder);
router.patch("/:id/admin-set-status", verifyToken, isAdmin, adminSetStatus);

//  Payment ops for admin (thiếu các route này sẽ gây 404 ở FE)
router.post("/:id/admin-add-payment", verifyToken, isAdmin, adminAddPayment);
router.patch("/:id/admin-mark-deposit-paid", verifyToken, isAdmin, adminMarkDepositPaid);
router.patch("/:id/admin-mark-paid-in-full", verifyToken, isAdmin, adminMarkPaidInFull);

/* ---------- USER ROUTES ---------- */
router.post("/", verifyToken, createPreorder);
router.get("/mine", verifyToken, listUserPreorders); // đặt trước /:id để tránh match nhầm
router.get("/:id", verifyToken, getPreorderDetail);
router.patch("/:id/cancel", verifyToken, cancelPreorder);

// NEW: User ẩn preorder khỏi lịch sử (soft hide) – chỉ khi delivered/cancelled
router.patch("/:id/hide", verifyToken, userHidePreorder);

export default router;
