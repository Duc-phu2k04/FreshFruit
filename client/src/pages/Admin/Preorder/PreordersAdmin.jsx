// src/pages/admin/PreordersAdmin.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./PreordersAdmin.css";

const API_URL = "http://localhost:3000";

const STATUS_LABELS = {
  pending_payment: "Chờ thanh toán",
  confirmed: "Đã xác nhận đơn hàng",
  shipping: "Đang giao hàng",
  delivered: "Đã giao hàng",
  cancelled: "Đã hủy",
  // NEW: khi có returnFlow đang mở
  return_open: "Đổi/Trả (đang xử lý)",
};

const ALL_STATUS_CODES = [
  "all",
  "pending_payment",
  "confirmed",
  "shipping",
  "delivered",
  "cancelled",
];

const STATUS_FLOW = ["pending_payment", "confirmed", "shipping", "delivered"];
const RANK = STATUS_FLOW.reduce((m, s, i) => ((m[s] = i), m), {});
function nextStatusOf(s) {
  const i = RANK[s];
  return Number.isInteger(i) && i < STATUS_FLOW.length - 1 ? STATUS_FLOW[i + 1] : null;
}
function canForwardOnly(prev, next) {
  if (next === "cancelled") return prev !== "delivered";
  if (!(prev in RANK) || !(next in RANK)) return false;
  return RANK[next] > RANK[prev];
}

function useAdminToken() {
  return localStorage.getItem("token");
}

const toVND = (n) => Number(n || 0).toLocaleString("vi-VN") + "₫";
const isDepositSatisfied = (po) => Number(po?.depositPaid || 0) >= Number(po?.depositDue || 0);
const isPaidInFull = (po) => Number(po?.remainingDue || 0) === 0;

// helper: phát hiện có yêu cầu đổi/trả bất kể BE đặt key gì
function hasReturnFlow(po) {
  const rf = po?.returnFlow || po?.return || po?.returnRequest || po?.returnInfo || null;
  const isOpen = !!rf?.isOpen;
  const status = rf?.status;
  return !!rf && (isOpen || (typeof status === "string" && status.trim() !== ""));
}

// Hằng dùng để kiểm tra trạng thái cho phép admin hủy
const ADMIN_CANCELLABLE_STATUSES = new Set(["pending_payment", "confirmed", "shipping"]);

const StatusChip = ({ s }) => {
  const label = STATUS_LABELS[s] || s;
  const styleMap = {
    pending_payment: { bg: "#FEF3C7", color: "#92400E" },
    confirmed: { bg: "#DCFCE7", color: "#065F46" },
    shipping: { bg: "#E0F2FE", color: "#075985" },
    delivered: { bg: "#EDE9FE", color: "#5B21B6" },
    cancelled: { bg: "#FEE2E2", color: "#991B1B" },
    // NEW: màu chip cho Đổi/Trả
    return_open: { bg: "#FFE4E6", color: "#BE123C" }, // hồng nhạt/đỏ mận
  };
  const ui = styleMap[s] || { bg: "#EEE", color: "#333" };
  return (
    <span className="po-status-chip" style={{ background: ui.bg, color: ui.color }}>
      {label}
    </span>
  );
};

export default function PreordersAdmin() {
  const token = useAdminToken();

  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    depositPercent: "",
    feesAdjust: "",
    internalNote: "",
    customerNote: "",
  });

  const [statusNotes, setStatusNotes] = useState({});
  const getStatusNote = (id) => statusNotes[id] || "";
  const setStatusNote = (id, val) => setStatusNotes((prev) => ({ ...prev, [id]: val }));

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
      try { data = JSON.parse(text); } catch { data = { ok: false, message: text }; }
      if (!res.ok || data.ok === false) throw new Error(data?.message || "Tải danh sách thất bại");

      const list = Array.isArray(data.items) ? data.items : [];
      setItems(list);
      const totalFromBE = data?.pagination?.total ?? list.length;
      setTotal(Number(totalFromBE) || list.length);

      const nextNotes = {};
      list.forEach((p) => (nextNotes[p._id] = ""));
      setStatusNotes(nextNotes);
    } catch (err) {
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

  const adminCancel = async (id) => {
    const reason = window.prompt("Lý do hủy (tuỳ chọn):") || "";
    if (!window.confirm("Xác nhận hủy đơn này?")) return;
    try {
      const res = await fetch(`${API_URL}/api/preorders/${id}/admin-cancel`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) throw new Error(data?.message || "Hủy đơn thất bại");
      setItems((prev) => prev.map((it) => (it._id === id ? data.data || it : it)));
      alert("Đã hủy đơn.");
    } catch (err) {
      alert(err?.message || "Lỗi hủy đơn");
    }
  };

  const adminDelete = async (id) => {
    if (!window.confirm("Bạn có chắc muốn xoá vĩnh viễn đơn đã hủy này?")) return;
    try {
      const res = await fetch(`${API_URL}/api/preorders/${id}/admin-delete`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data?.message || "Xoá đơn thất bại");
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
          adjust: editForm.feesAdjust !== "" ? Number(editForm.feesAdjust) : undefined,
        },
        internalNote: editForm.internalNote !== "" ? editForm.internalNote : undefined,
        customerNote: editForm.customerNote !== "" ? editForm.customerNote : undefined,
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

  const markDepositPaid = async (id) => {
    if (!window.confirm("Ghi nhận: đơn này đã thanh toán CỌC?")) return;
    try {
      const res = await fetch(`${API_URL}/api/preorders/${id}/admin-mark-deposit`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) throw new Error(data?.message || "Cập nhật cọc thất bại");
      setItems((prev) => prev.map((it) => (it._id === id ? data.data || data.preorder || it : it)));
      alert("Đã ghi nhận thanh toán cọc.");
    } catch (err) {
      alert(err?.message || "Lỗi ghi nhận cọc");
    }
  };

  const markPaidInFull = async (id) => {
    if (!window.confirm("Ghi nhận: đơn này đã thanh toán TOÀN BỘ?")) return;
    try {
      const res = await fetch(`${API_URL}/api/preorders/${id}/admin-mark-paid`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) throw new Error(data?.message || "Cập nhật thanh toán thất bại");
      setItems((prev) => prev.map((it) => (it._id === id ? data.data || data.preorder || it : it)));
      alert("Đã ghi nhận thanh toán toàn bộ.");
    } catch (err) {
      alert(err?.message || "Lỗi ghi nhận thanh toán");
    }
  };

  const adminSetStatusForward = async (id, currentStatus, po) => {
    const to = nextStatusOf(currentStatus);
    if (!to) return;

    if (currentStatus === "pending_payment" && to === "confirmed" && !isDepositSatisfied(po)) {
      alert("Chưa đủ tiền cọc — không thể chuyển sang 'Đã xác nhận đơn hàng'.");
      return;
    }
    if (currentStatus === "shipping" && to === "delivered" && !isPaidInFull(po)) {
      alert("Chưa thanh toán toàn bộ — không thể chuyển sang 'Đã giao hàng'.");
      return;
    }

    if (!canForwardOnly(currentStatus, to)) {
      alert("Chỉ được chuyển tiếp theo thứ tự trạng thái.");
      return;
    }
    if (!window.confirm(`Xác nhận chuyển trạng thái sang: ${STATUS_LABELS[to]}?`)) return;

    try {
      const reason = getStatusNote(id);
      const res = await fetch(`${API_URL}/api/preorders/${id}/admin-set-status`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: to, reason: reason || "" }),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) throw new Error(data?.message || "Cập nhật trạng thái thất bại");
      setItems((prev) => prev.map((it) => (it._id === id ? data.data || it : it)));
      setStatusNote(id, "");
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
                  {code === "all" ? "Tất cả" : STATUS_LABELS[code]}
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
              placeholder="Mã PO, tên SP, email..."
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
            <button className="pa-clear" onClick={clearFilters}>Xoá lọc</button>
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
              <th style={{ width: 620 }}>Hành động</th>
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
                const canAdminCancel = ADMIN_CANCELLABLE_STATUSES.has(p.status);
                const canAdminDelete = p.status === "cancelled";

                const next = nextStatusOf(p.status);
                const depositOK = isDepositSatisfied(p);
                const fullPaid = isPaidInFull(p);

                let forwardDisabled = !next || !canForwardOnly(p.status, next);
                let forwardTitle = "";
                if (p.status === "pending_payment" && next === "confirmed" && !depositOK) {
                  forwardDisabled = true;
                  forwardTitle = "Cần đủ tiền cọc để chuyển sang 'Đã xác nhận đơn hàng'.";
                }
                if (p.status === "shipping" && next === "delivered" && !fullPaid) {
                  forwardDisabled = true;
                  forwardTitle = "Cần thanh toán toàn bộ để chuyển sang 'Đã giao hàng'.";
                }

                const showReturnLink = hasReturnFlow(p);
                const displayStatus = showReturnLink ? "return_open" : p.status;

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
                      {toVND(p.subtotal)}
                      {Number(p?.fees?.adjust || 0) !== 0 && (
                        <div className="po-adjust">Điều chỉnh: {toVND(p.fees.adjust)}</div>
                      )}
                    </td>

                    <td className="ta-right">
                      <div>Cọc đã trả: {toVND(p.depositPaid)}</div>
                      <div>Cọc cần: {toVND(p.depositDue)}</div>
                      <div>Còn lại: {toVND(p.remainingDue)}</div>
                      <div style={{ marginTop: 4, fontSize: 12, opacity: 0.85 }}>
                        {depositOK ? "✅ Đủ cọc" : "⏳ Chưa đủ cọc"} · {fullPaid ? "✅ Đã thanh toán đủ" : "⏳ Chưa thanh toán đủ"}
                      </div>
                    </td>

                    <td><StatusChip s={displayStatus} /></td>

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

                            {showReturnLink && (
                              <Link
                                className="btn-light"
                                to={`/admin/preorders/${p._id}/return`}
                                title="Quản lý yêu cầu đổi/trả của đơn này"
                              >
                                Quản lý đổi/trả
                              </Link>
                            )}
                          </div>

                          <div className="po-status-edit">
                            <div className="po-status-row">
                              <label>Ghi chú (tuỳ chọn)</label>
                              <input
                                placeholder="Ví dụ: đã đóng gói, đã bàn giao cho đơn vị vận chuyển..."
                                value={getStatusNote(p._id)}
                                onChange={(e) => setStatusNote(p._id, e.target.value)}
                              />
                            </div>

                            <div className="po-status-actions" style={{ display: "flex", gap: 8 }}>
                              <button
                                className="btn"
                                disabled={forwardDisabled}
                                title={forwardTitle || ""}
                                onClick={() => adminSetStatusForward(p._id, p.status, p)}
                              >
                                {next ? `Chuyển sang: ${STATUS_LABELS[next]}` : "Đã ở trạng thái cuối"}
                              </button>
                            </div>
                          </div>

                          <div className="po-status-edit" style={{ marginTop: 8 }}>
                            <div className="po-status-row" style={{ gap: 8 }}>
                              <button className="btn" onClick={() => markDepositPaid(p._id)}>
                                Ghi đã thanh toán cọc
                              </button>
                              <button className="btn-secondary" onClick={() => markPaidInFull(p._id)}>
                                Ghi đã thanh toán toàn bộ
                              </button>
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
                              onChange={(e) =>
                                setEditForm((f) => ({ ...f, depositPercent: e.target.value }))
                              }
                              placeholder="VD: 30"
                            />
                          </div>

                          <div className="po-edit-row">
                            <label>Điều chỉnh (₫)</label>
                            <input
                              type="number"
                              value={editForm.feesAdjust}
                              onChange={(e) =>
                                setEditForm((f) => ({ ...f, feesAdjust: e.target.value }))
                              }
                              placeholder="VD: 50000 hoặc -30000"
                            />
                          </div>

                          <div className="po-edit-row">
                            <label>Ghi chú nội bộ</label>
                            <input
                              value={editForm.internalNote}
                              onChange={(e) =>
                                setEditForm((f) => ({ ...f, internalNote: e.target.value }))
                              }
                              placeholder="Ghi chú nội bộ"
                            />
                          </div>

                          <div className="po-edit-row">
                            <label>Ghi chú hiển thị cho khách</label>
                            <input
                              value={editForm.customerNote}
                              onChange={(e) =>
                                setEditForm((f) => ({ ...f, customerNote: e.target.value }))
                              }
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
