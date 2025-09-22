// server/routes/preorder.route.js
import express from "express";
import { verifyToken, isAdminOrManager } from "../middlewares/auth.middleware.js";

import {
  // USER
  createPreorder,
  cancelPreorder,
  listUserPreorders,
  getPreorderDetail,
  userHidePreorder,

  // ADMIN (đơn chính)
  listAdminPreorders,
  recalcPreorder,
  adminEditPreorder,
  adminCancelPreorder,
  adminDeletePreorder,
  adminSetStatus,

  // ADMIN (thanh toán tối giản)
  adminMarkDepositPaid,   // PATCH /:id/admin-mark-deposit
  adminMarkPaidInFull,    // PATCH /:id/admin-mark-paid

  // ADMIN (vận chuyển & tranh chấp theo luồng mới)
  adminUpdateShippingStatus, // PATCH /:id/admin-shipping-status
  disputeOpen,               // PATCH /:id/dispute/open
  disputeClose,              // PATCH /:id/dispute/close

  // ADMIN (ghi lịch sử tiện dụng)
  markReady,               // PATCH /:id/admin-mark-ready
  convertToOrder,          // PATCH /:id/admin-convert-to-order

  // RETURN FLOW (sau khi đã giao)
  returnRequest,          // USER:  POST /:id/return-request
  returnApprove,          // ADMIN: PATCH /:id/return/approve
  returnReject,           // ADMIN: PATCH /:id/return/reject
  returnUpdateShipping,   // ADMIN: PATCH /:id/return/shipping-update
  returnRefundIssue,      // ADMIN: PATCH /:id/return/refund
} from "../controllers/preorder.controller.js";

const router = express.Router();

/* ---------------------------------------
 *            ADMIN ROUTES
 *  (Yêu cầu: token + admin/manager)
 * ------------------------------------- */

// Danh sách admin + tìm kiếm nâng cao
router.get("/admin", verifyToken, isAdminOrManager, listAdminPreorders);

// Đồng bộ lại số liệu & trạng thái đơn (+ auto-complete nếu đủ điều kiện)
router.patch("/:id/recalc", verifyToken, isAdminOrManager, recalcPreorder);

// Chỉnh sửa thông tin đơn (tỷ lệ cọc, điều chỉnh, ghi chú…)
router.patch("/:id/admin-edit", verifyToken, isAdminOrManager, adminEditPreorder);

// Hủy đơn thủ công (admin)
router.patch("/:id/admin-cancel", verifyToken, isAdminOrManager, adminCancelPreorder);

// Xóa mềm đơn đã hủy (admin)
router.delete("/:id/admin-delete", verifyToken, isAdminOrManager, adminDeletePreorder);

// Cập nhật trạng thái 1 chiều (forward-only) hoặc hủy
router.patch("/:id/admin-set-status", verifyToken, isAdminOrManager, adminSetStatus);

// Thanh toán (tối giản — chỉ 2 hành động)
router.patch("/:id/admin-mark-deposit", verifyToken, isAdminOrManager, adminMarkDepositPaid);
router.patch("/:id/admin-mark-paid", verifyToken, isAdminOrManager, adminMarkPaidInFull);

// Trạng thái vận chuyển chi tiết (giống sàn)
router.patch("/:id/admin-shipping-status", verifyToken, isAdminOrManager, adminUpdateShippingStatus);

// Tranh chấp (mở/đóng) — mở thì ngăn auto-complete
router.patch("/:id/dispute/open", verifyToken, isAdminOrManager, disputeOpen);
router.patch("/:id/dispute/close", verifyToken, isAdminOrManager, disputeClose);

// Ghi lịch sử tiện dụng (không đổi status chính)
router.patch("/:id/admin-mark-ready", verifyToken, isAdminOrManager, markReady);
router.patch("/:id/admin-convert-to-order", verifyToken, isAdminOrManager, convertToOrder);

// RETURN FLOW (Admin xử lý sau khi user đã yêu cầu) — path mới chuẩn
router.patch("/:id/return/approve", verifyToken, isAdminOrManager, returnApprove);
router.patch("/:id/return/reject", verifyToken, isAdminOrManager, returnReject);
router.patch("/:id/return/shipping-update", verifyToken, isAdminOrManager, returnUpdateShipping);
router.patch("/:id/return/refund", verifyToken, isAdminOrManager, returnRefundIssue);

/* ---------------------------------------
 *        ALIASES TƯƠNG THÍCH NGƯỢC
 *  (giữ để tránh 404 với FE cũ dùng dấu gạch nối)
 * ------------------------------------- */
// RETURN (cũ -> mới)
router.patch("/:id/return-approve", verifyToken, isAdminOrManager, returnApprove);
router.patch("/:id/return-reject", verifyToken, isAdminOrManager, returnReject);
router.patch("/:id/return-shipping", verifyToken, isAdminOrManager, returnUpdateShipping);
router.patch("/:id/return-refund", verifyToken, isAdminOrManager, returnRefundIssue);

// PAYMENTS (cũ -> mới)
router.patch("/:id/admin-mark-deposit-paid", verifyToken, isAdminOrManager, adminMarkDepositPaid);
router.patch("/:id/admin-mark-paid-in-full", verifyToken, isAdminOrManager, adminMarkPaidInFull);

/* ---------------------------------------
 *             USER ROUTES
 *  (Yêu cầu: token; thao tác của user)
 * ------------------------------------- */

// Tạo preorder
router.post("/", verifyToken, createPreorder);

// Danh sách preorder của chính user (đặt trước "/:id" để tránh match nhầm)
router.get("/mine", verifyToken, listUserPreorders);

// Chi tiết preorder của user (controller đã hỗ trợ admin bypass)
router.get("/:id", verifyToken, getPreorderDetail);

// User tự hủy (controller đã chặn khi đang 'shipping' hoặc đã 'delivered/cancelled')
router.patch("/:id/cancel", verifyToken, cancelPreorder);

// User yêu cầu TRẢ HÀNG (chỉ khi đơn đã 'delivered')
router.post("/:id/return-request", verifyToken, returnRequest);

// User ẩn preorder khỏi lịch sử (chỉ khi delivered/cancelled)
router.patch("/:id/hide", verifyToken, userHidePreorder);

export default router;
