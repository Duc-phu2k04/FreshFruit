// src/pages/admin/PreordersAdmin.jsx
import React, { useEffect, useMemo, useState } from "react";
import "./PreordersAdmin.css";

const API_URL = "http://localhost:4000";

/** ===============================
 *  Trạng thái sử dụng ở FE (VN)
 *  Map sang code gửi/nhận với BE
 *  =============================== */
const STATUS_LABELS = {
  pending_payment: "Chờ thanh toán",
  confirmed: "Đã xác nhận đơn hàng",
  shipping: "Đang giao hàng",
  delivered: "Đã giao hàng",
  cancelled: "Đã hủy",
};

const ALL_STATUS_CODES = [
  "all",
  "pending_payment",
  "confirmed",
  "shipping",
  "delivered",
  "cancelled",
];

// Các trạng thái Admin được phép set thủ công
const ADMIN_SETTABLE = [
  "pending_payment",
  "confirmed",
  "shipping",
  "delivered",
  "cancelled",
];

// Status pill
const StatusChip = ({ s }) => {
  const label = STATUS_LABELS[s] || s;
  const styleMap = {
    pending_payment: { bg: "#FEF3C7", color: "#92400E" }, // vàng nhạt
    confirmed: { bg: "#DCFCE7", color: "#065F46" },       // xanh lá nhạt
    shipping: { bg: "#E0F2FE", color: "#075985" },        // xanh dương nhạt
    delivered: { bg: "#EDE9FE", color: "#5B21B6" },       // tím nhạt
    cancelled: { bg: "#FEE2E2", color: "#991B1B" },       // đỏ nhạt
  };
  const ui = styleMap[s] || { bg: "#EEE", color: "#333" };
  return (
    <span className="po-status-chip" style={{ background: ui.bg, color: ui.color }}>
      {label}
    </span>
  );
};

function useAdminToken() {
  return localStorage.getItem("token");
}

// FE chặn 1 số chuyển đổi đơn giản; BE vẫn là nguồn quyết định cuối
function canTransitionFE(current, next) {
  if (current === next) return false;
  // Đã giao/đã hủy thì không cho chuyển tiếp ở FE
  if (["delivered", "cancelled"].includes(current)) return false;
  return true;
}

export default function PreordersAdmin() {
  const token = useAdminToken();

  // Query state
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Data state
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);

  // Edit inline
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    depositPercent: "",
    feesAdjust: "",
    internalNote: "",
    customerNote: "",
  });

  // Form đổi status (lưu theo từng id)
  const [statusForms, setStatusForms] = useState({});
  const getStatusForm = (id, currentStatus) =>
    statusForms[id] || { status: currentStatus, reason: "", refundAmount: "" };
  const setStatusFormVal = (id, patch) =>
    setStatusForms((prev) => ({ ...prev, [id]: { ...getStatusForm(id, ""), ...patch } }));

  // ====== FORM THANH TOÁN (mỗi dòng) ======
  const [payForms, setPayForms] = useState({});
  const getPayForm = (id) =>
    payForms[id] || { kind: "deposit", amount: "", provider: "", note: "" };
  const setPayFormVal = (id, patch) =>
    setPayForms((prev) => ({ ...prev, [id]: { ...getPayForm(id), ...patch } }));

  // Fetch admin list
  async function fetchAdminPreorders() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status && status !== "all") params.append("status", status);
      if (q) params.append("q", q);
      params.append("page", String(page));
      params.append("limit", String(limit));

      const res = await fetch(`${API_URL}/api/preorders/admin?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { ok: false, message: text };
      }

      if (!res.ok || data.ok === false) {
        throw new Error(data?.message || "Tải danh sách thất bại");
      }

      const list = Array.isArray(data.items) ? data.items : [];
      setItems(list);
      const totalFromBE = data?.pagination?.total ?? list.length;
      setTotal(Number(totalFromBE) || list.length);

      // reset form theo dữ liệu mới
      const nextStatusForms = {};
      const nextPayForms = {};
      list.forEach((p) => {
        nextStatusForms[p._id] = { status: p.status, reason: "", refundAmount: "" };
        nextPayForms[p._id] = { kind: "deposit", amount: "", provider: "", note: "" };
      });
      setStatusForms(nextStatusForms);
      setPayForms(nextPayForms);
    } catch (err) {
      console.error("[PreordersAdmin] fetch error:", err);
      alert(err?.message || "Không tải được danh sách");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    fetchAdminPreorders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, status, q, page, limit]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  // ===== Actions =====
  const recalcOne = async (id) => {
    if (!window.confirm("Đồng bộ lại số liệu & trạng thái đơn này?")) return;
    try {
      const res = await fetch(`${API_URL}/api/preorders/${id}/recalc`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) throw new Error(data?.message || "Đồng bộ thất bại");
      setItems((prev) => prev.map((it) => (it._id === id ? data.data || it : it)));
      alert("Đã đồng bộ.");
    } catch (err) {
      alert(err?.message || "Lỗi đồng bộ");
    }
  };

  // Hủy đơn (Admin)
  const adminCancellableStatuses = useMemo(
    () => ["pending_payment", "confirmed", "shipping"],
    []
  );

  const adminCancel = async (id) => {
    const reason = window.prompt(
      "Lý do hủy (tùy chọn):\nVí dụ: KH yêu cầu hủy, hết hàng, phát hiện trùng đơn..."
    );
    if (!window.confirm("Xác nhận hủy đơn này?")) return;
    try {
      const res = await fetch(`${API_URL}/api/preorders/${id}/admin-cancel`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason || "" }),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) throw new Error(data?.message || "Hủy đơn thất bại");
      setItems((prev) => prev.map((it) => (it._id === id ? data.data || it : it)));
      alert("Đã hủy đơn.");
    } catch (err) {
      alert(err?.message || "Lỗi hủy đơn");
    }
  };

  // Xoá đơn (chỉ hiển thị khi đã hủy)
  const adminDelete = async (id) => {
    if (!window.confirm("Bạn có chắc muốn xoá vĩnh viễn đơn đã hủy này?")) return;
    try {
      const res = await fetch(`${API_URL}/api/preorders/${id}/admin-delete`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        throw new Error(data?.message || "Xoá đơn thất bại");
      }
      setItems((prev) => prev.filter((it) => it._id !== id));
      setTotal((t) => Math.max(0, t - 1));
      alert("Đã xoá đơn.");
    } catch (err) {
      alert(err?.message || "Lỗi xoá đơn");
    }
  };

  const startEdit = (po) => {
    setEditingId(po._id);
    setEditForm({
      depositPercent: po.depositPercent ?? "",
      feesAdjust: po?.fees?.adjust ?? "",
      internalNote: po.internalNote ?? "",
      customerNote: po.customerNote ?? "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({
      depositPercent: "",
      feesAdjust: "",
      internalNote: "",
      customerNote: "",
    });
  };

  const saveEdit = async (id) => {
    try {
      const payload = {
        depositPercent:
          editForm.depositPercent !== "" ? Number(editForm.depositPercent) : undefined,
        fees: {
          adjust:
            editForm.feesAdjust !== "" ? Number(editForm.feesAdjust) : undefined,
        },
        internalNote:
          editForm.internalNote !== "" ? editForm.internalNote : undefined,
        customerNote:
          editForm.customerNote !== "" ? editForm.customerNote : undefined,
      };

      const res = await fetch(`${API_URL}/api/preorders/${id}/admin-edit`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) throw new Error(data?.message || "Lưu chỉnh sửa thất bại");

      setItems((prev) => prev.map((it) => (it._id === id ? data.data || it : it)));
      cancelEdit();
      alert("Đã lưu thay đổi.");
    } catch (err) {
      alert(err?.message || "Lỗi lưu chỉnh sửa");
    }
  };

  // ======== THANH TOÁN (Admin) ========
  // 1) Ghi đã thanh toán cọc
  const markDepositPaid = async (id) => {
    if (!window.confirm("Ghi nhận: đơn này đã thanh toán CỌC?")) return;
    try {
      const res = await fetch(`${API_URL}/api/preorders/${id}/admin-mark-deposit-paid`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({}), // có thể mở rộng amount, provider... nếu controller hỗ trợ
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) throw new Error(data?.message || "Cập nhật cọc thất bại");
      setItems((prev) => prev.map((it) => (it._id === id ? data.preorder || data.data || it : it)));
      alert("Đã ghi nhận thanh toán cọc.");
    } catch (err) {
      alert(err?.message || "Lỗi ghi nhận cọc");
    }
  };

  // 2) Ghi đã thanh toán toàn bộ
  const markPaidInFull = async (id) => {
    if (!window.confirm("Ghi nhận: đơn này đã thanh toán TOÀN BỘ?")) return;
    try {
      const res = await fetch(`${API_URL}/api/preorders/${id}/admin-mark-paid-in-full`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({}), // có thể mở rộng amount, provider... nếu controller hỗ trợ
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) throw new Error(data?.message || "Cập nhật thanh toán thất bại");
      setItems((prev) => prev.map((it) => (it._id === id ? data.preorder || data.data || it : it)));
      alert("Đã ghi nhận thanh toán toàn bộ.");
    } catch (err) {
      alert(err?.message || "Lỗi ghi nhận thanh toán");
    }
  };

  // 3) Thêm bản ghi thanh toán thủ công
  const addPaymentManual = async (id) => {
    const f = getPayForm(id);
    const payload = {
      kind: f.kind, // deposit | remaining | refund | adjustment
      amount: f.amount !== "" ? Number(f.amount) : undefined,
      provider: f.provider || undefined,
      note: f.note || undefined,
    };
    if (!payload.kind || !payload.amount || payload.amount <= 0) {
      alert("Vui lòng nhập loại và số tiền hợp lệ.");
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/preorders/${id}/admin-add-payment`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) throw new Error(data?.message || "Thêm bản ghi thanh toán thất bại");
      setItems((prev) => prev.map((it) => (it._id === id ? data.preorder || data.data || it : it)));
      // reset form dòng đó
      setPayFormVal(id, { kind: "deposit", amount: "", provider: "", note: "" });
      alert("Đã thêm bản ghi thanh toán.");
    } catch (err) {
      alert(err?.message || "Lỗi thêm bản ghi thanh toán");
    }
  };

  // Đổi trạng thái thủ công
  const adminSetStatus = async (id, currentStatus) => {
    const form = getStatusForm(id, currentStatus);
    const { status: nextStatus, reason, refundAmount } = form;

    if (!ADMIN_SETTABLE.includes(nextStatus)) {
      alert("Trạng thái không hợp lệ.");
      return;
    }
    if (!canTransitionFE(currentStatus, nextStatus)) {
      alert("Không thể chuyển trạng thái này (quy tắc FE).");
      return;
    }
    if (!window.confirm(`Xác nhận đổi trạng thái sang: ${STATUS_LABELS[nextStatus] || nextStatus}?`)) return;

    try {
      const payload = {
        status: nextStatus,
        reason: reason || "",
      };
      if (nextStatus === "cancelled" && refundAmount !== "") {
        payload.refundAmount = Number(refundAmount);
      }

      const res = await fetch(`${API_URL}/api/preorders/${id}/admin-set-status`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) throw new Error(data?.message || "Cập nhật trạng thái thất bại");

      setItems((prev) => prev.map((it) => (it._id === id ? data.data || it : it)));
      setStatusFormVal(id, { status: data?.data?.status || nextStatus, reason: "", refundAmount: "" });
      alert("Đã cập nhật trạng thái.");
    } catch (err) {
      alert(err?.message || "Lỗi cập nhật trạng thái");
    }
  };

  const clearFilters = () => {
    setStatus("all");
    setQ("");
    setPage(1);
  };

  return (
    <div className="preorders-admin">
      <header className="pa-header">
        <h1>Quản trị đơn đặt trước</h1>
        <div className="pa-actions">
          <button className="pa-refresh" onClick={fetchAdminPreorders} disabled={loading}>
            {loading ? "Đang tải..." : "Tải lại"}
          </button>
        </div>
      </header>

      <section className="pa-filters">
        <div className="pa-filter-row">
          <div className="pa-filter">
            <label>Trạng thái</label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              {ALL_STATUS_CODES.map((code) => (
                <option key={code} value={code}>
                  {code === "all" ? "Tất cả" : (STATUS_LABELS[code] || code)}
                </option>
              ))}
            </select>
          </div>

          <div className="pa-filter">
            <label>Tìm kiếm</label>
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Mã PO, tên sản phẩm, email người dùng..."
            />
          </div>

          <div className="pa-filter">
            <label>Hiển thị</label>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n} dòng
                </option>
              ))}
            </select>
          </div>

          <div className="pa-filter">
            <label>&nbsp;</label>
            <button className="pa-clear" onClick={clearFilters}>
              Xoá lọc
            </button>
          </div>
        </div>
      </section>

      <section className="pa-table-wrap">
        <table className="pa-table">
          <thead>
            <tr>
              <th style={{ width: 120 }}>Mã</th>
              <th>Người dùng</th>
              <th>Sản phẩm</th>
              <th className="ta-right">Tạm tính</th>
              <th className="ta-right">Cọc / Còn lại</th>
              <th>Trạng thái</th>
              <th style={{ width: 520 }}>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: 24 }}>
                  {loading ? "Đang tải..." : "Không có dữ liệu"}
                </td>
              </tr>
            ) : (
              items.map((p) => {
                const label =
                  p?.variant?.label ||
                  [p?.variant?.attributes?.weight, p?.variant?.attributes?.ripeness]
                    .filter(Boolean)
                    .join(" · ");

                const isEditing = editingId === p._id;
                const canAdminCancel = adminCancellableStatuses.includes(p.status);
                const canAdminDelete = p.status === "cancelled";

                // form đổi trạng thái
                const sf = getStatusForm(p._id, p.status);
                const canSet = sf.status && canTransitionFE(p.status, sf.status);

                // form thanh toán
                const pf = getPayForm(p._id);

                return (
                  <tr key={p._id}>
                    <td className="po-id">
                      <div className="po-id-text">{p.customId || p._id?.slice(-6)}</div>
                      <div className="po-date">
                        {p.createdAt ? new Date(p.createdAt).toLocaleString("vi-VN") : "—"}
                      </div>
                    </td>

                    <td>
                      <div className="po-user">{p?.user?.email || p?.user?.name || p.user || "—"}</div>
                      <div className="po-note">
                        {p.customerNote ? `Ghi chú KH: ${p.customerNote}` : ""}
                      </div>
                    </td>

                    <td>
                      <div className="po-product">{p?.product?.name || "—"}</div>
                      <div className="po-variant">
                        {label ? `(${label})` : ""} × {p.qty}
                      </div>
                    </td>

                    <td className="ta-right">
                      {Number(p.subtotal || 0).toLocaleString("vi-VN")}₫
                      {Number(p?.fees?.adjust || 0) !== 0 && (
                        <div className="po-adjust">
                          Điều chỉnh: {Number(p.fees.adjust).toLocaleString("vi-VN")}₫
                        </div>
                      )}
                    </td>

                    <td className="ta-right">
                      <div>Cọc đã trả: {Number(p.depositPaid || 0).toLocaleString("vi-VN")}₫</div>
                      <div>Còn lại: {Number(p.remainingDue || 0).toLocaleString("vi-VN")}₫</div>
                    </td>

                    <td>
                      <StatusChip s={p.status} />
                    </td>

                    <td>
                      {!isEditing ? (
                        <>
                          <div className="po-actions">
                            <button className="btn" onClick={() => recalcOne(p._id)}>Đồng bộ</button>

                            {canAdminCancel && (
                              <button className="btn-secondary" onClick={() => adminCancel(p._id)}>
                                {STATUS_LABELS.cancelled}
                              </button>
                            )}

                            {canAdminDelete && (
                              <button className="btn-secondary" onClick={() => adminDelete(p._id)}>
                                Xoá đơn
                              </button>
                            )}

                            <button className="btn-secondary" onClick={() => startEdit(p)}>Sửa</button>
                          </div>

                          {/* Khối ĐỔI TRẠNG THÁI THỦ CÔNG */}
                          <div className="po-status-edit">
                            <div className="po-status-row">
                              <label>Đổi trạng thái</label>
                              <select
                                value={sf.status}
                                onChange={(e) => setStatusFormVal(p._id, { status: e.target.value })}
                              >
                                {ADMIN_SETTABLE.map((code) => (
                                  <option key={code} value={code}>
                                    {STATUS_LABELS[code] || code}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="po-status-row">
                              <label>Lý do (tuỳ chọn)</label>
                              <input
                                placeholder="Ghi chú cho admin log"
                                value={sf.reason}
                                onChange={(e) => setStatusFormVal(p._id, { reason: e.target.value })}
                              />
                            </div>

                            <div className="po-status-actions">
                              <button
                                className="btn"
                                disabled={!canSet}
                                onClick={() => adminSetStatus(p._id, p.status)}
                              >
                                Cập nhật trạng thái
                              </button>
                            </div>
                          </div>

                          {/* ====== KHỐI THANH TOÁN (ADMIN) ====== */}
                          <div className="po-status-edit" style={{ marginTop: 8 }}>
                            <div className="po-status-row" style={{ gap: 8 }}>
                              <button className="btn" onClick={() => markDepositPaid(p._id)}>
                                Ghi đã thanh toán cọc
                              </button>
                              <button className="btn-secondary" onClick={() => markPaidInFull(p._id)}>
                                Ghi đã thanh toán toàn bộ
                              </button>
                            </div>

                            <div style={{ marginTop: 8, fontWeight: 600 }}>Thêm bản ghi thanh toán</div>
                            <div className="po-edit" style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}>
                              <div className="po-edit-row">
                                <label>Loại</label>
                                <select
                                  value={pf.kind}
                                  onChange={(e) => setPayFormVal(p._id, { kind: e.target.value })}
                                >
                                  {["deposit", "remaining", "refund", "adjustment"].map((k) => (
                                    <option key={k} value={k}>{k}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="po-edit-row">
                                <label>Số tiền (₫)</label>
                                <input
                                  type="number"
                                  min="0"
                                  value={pf.amount}
                                  onChange={(e) => setPayFormVal(p._id, { amount: e.target.value })}
                                  placeholder="VD: 150000"
                                />
                              </div>
                              <div className="po-edit-row">
                                <label>Provider</label>
                                <input
                                  value={pf.provider}
                                  onChange={(e) => setPayFormVal(p._id, { provider: e.target.value })}
                                  placeholder="VD: momo, vnpay, tiền mặt..."
                                />
                              </div>
                              <div className="po-edit-row">
                                <label>Ghi chú</label>
                                <input
                                  value={pf.note}
                                  onChange={(e) => setPayFormVal(p._id, { note: e.target.value })}
                                  placeholder="Ghi chú nội bộ"
                                />
                              </div>

                              <div className="po-edit-actions" style={{ gridColumn: "1 / -1" }}>
                                <button className="btn" onClick={() => addPaymentManual(p._id)}>
                                  Thêm thanh toán
                                </button>
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="po-edit">
                          <div className="po-edit-row">
                            <label>Tỷ lệ cọc (%)</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={editForm.depositPercent}
                              onChange={(e) => setEditForm((f) => ({ ...f, depositPercent: e.target.value }))}
                              placeholder="VD: 30"
                            />
                          </div>

                          <div className="po-edit-row">
                            <label>Điều chỉnh (₫)</label>
                            <input
                              type="number"
                              value={editForm.feesAdjust}
                              onChange={(e) => setEditForm((f) => ({ ...f, feesAdjust: e.target.value }))}
                              placeholder="VD: 50000 hoặc -30000"
                            />
                          </div>

                          <div className="po-edit-row">
                            <label>Ghi chú nội bộ</label>
                            <input
                              value={editForm.internalNote}
                              onChange={(e) => setEditForm((f) => ({ ...f, internalNote: e.target.value }))}
                              placeholder="Ghi chú nội bộ"
                            />
                          </div>

                          <div className="po-edit-row">
                            <label>Ghi chú hiển thị cho khách</label>
                            <input
                              value={editForm.customerNote}
                              onChange={(e) => setEditForm((f) => ({ ...f, customerNote: e.target.value }))}
                              placeholder="Ghi chú hiển thị cho khách"
                            />
                          </div>

                          <div className="po-edit-actions">
                            <button className="btn" onClick={() => saveEdit(p._id)}>Lưu</button>
                            <button className="btn-secondary" onClick={cancelEdit}>Hủy</button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="pa-pagination">
          <button
            className="btn-secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Trước
          </button>
          <div className="pa-pageinfo">
            Trang {page}/{totalPages} · {total} đơn
          </div>
          <button
            className="btn-secondary"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Sau →
          </button>
        </div>
      </section>
    </div>
  );
}
