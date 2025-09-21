// src/pages/admin/ReturnRequestAdmin.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import "./PreordersAdmin.css";
import "./ReturnRequestAdmin.css";

const API_URL = "http://localhost:3000";

const RETURN_LABELS = {
  return_requested: "KH yêu cầu trả hàng",
  return_approved: "Đã duyệt trả hàng",
  return_rejected: "Đã từ chối trả hàng",
  return_awaiting_pickup: "Chờ lấy hàng hoàn",
  return_picked_up: "Đã lấy hàng hoàn",
  return_in_transit: "Đang chuyển hoàn",
  return_received: "Đã nhận hàng hoàn",
  refund_issued: "Đã hoàn tiền",
};
const RETURN_NEXT = {
  return_approved: "return_awaiting_pickup",
  return_awaiting_pickup: "return_picked_up",
  return_picked_up: "return_in_transit",
  return_in_transit: "return_received",
};
const RETURN_SHIP_OPTIONS = [
  "return_awaiting_pickup",
  "return_picked_up",
  "return_in_transit",
  "return_received",
];

const toVND = (n) => Number(n || 0).toLocaleString("vi-VN") + "₫";

// lấy object preorder bất kể BE trả {data}, {preorder}, hay object thẳng
function extractPreorderPayload(raw) {
  return raw?.data || raw?.preorder || raw?.item || raw;
}

// lấy returnFlow dù BE dùng tên gì
function pickReturnFlow(po) {
  return po?.returnFlow || po?.return || po?.returnRequest || po?.returnInfo || null;
}

export default function ReturnRequestAdmin() {
  const { id } = useParams(); // preorderId
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [loading, setLoading] = useState(false);
  const [po, setPo] = useState(null);

  const [approveForm, setApproveForm] = useState({
    adminNote: "",
    feeDeduction: "",
    carrier: "",
    trackingCode: "",
  });
  const [shipForm, setShipForm] = useState({ status: "", carrier: "", trackingCode: "" });
  const [refundForm, setRefundForm] = useState({ amount: "", adminNote: "" });

  const rf = pickReturnFlow(po) || {};
  const st = rf.status || null;

  const imgs =
    (Array.isArray(rf.evidenceImages) && rf.evidenceImages.length ? rf.evidenceImages :
    Array.isArray(po?.returnImages) ? po.returnImages : []);

  const headerTitle = useMemo(() => {
    const code = po?.customId || po?._id?.slice(-6) || "";
    return `Yêu cầu đổi/trả · ${code}`;
  }, [po]);

  async function fetchDetail() {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/preorders/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch { json = { message: text }; }
      if (!res.ok) throw new Error(json?.message || "Không tải được chi tiết preorder");

      const payload = extractPreorderPayload(json);
      setPo(payload);

      const nextShip = {
        status: RETURN_NEXT[pickReturnFlow(payload)?.status] || "",
        carrier: pickReturnFlow(payload)?.carrier || "",
        trackingCode: pickReturnFlow(payload)?.trackingCode || "",
      };
      setShipForm(nextShip);
      setApproveForm({
        adminNote: pickReturnFlow(payload)?.adminNote || "",
        feeDeduction: "",
        carrier: pickReturnFlow(payload)?.carrier || "",
        trackingCode: pickReturnFlow(payload)?.trackingCode || "",
      });
      setRefundForm({ amount: "", adminNote: "" });
    } catch (e) {
      alert(e?.message || "Không tải được chi tiết");
      setPo(null);
    } finally {
      setLoading(false);
    }
  }

  
  useEffect(() => { fetchDetail(); /* eslint-disable-next-line */ }, [id]);

  const approveReturn = async () => {
    if (!window.confirm("Duyệt yêu cầu trả hàng của khách?")) return;
    try {
      const res = await fetch(`${API_URL}/api/preorders/${id}/return/approve`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          adminNote: approveForm.adminNote || "",
          feeDeduction: approveForm.feeDeduction !== "" ? Number(approveForm.feeDeduction) : 0,
          carrier: approveForm.carrier || undefined,
          trackingCode: approveForm.trackingCode || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data?.message || "Duyệt yêu cầu trả hàng thất bại");
      setPo(extractPreorderPayload(data));
      alert("Đã duyệt yêu cầu trả hàng.");
    } catch (err) {
      alert(err?.message || "Lỗi duyệt yêu cầu");
    }
  };

  const rejectReturn = async () => {
    const note = approveForm.adminNote || window.prompt("Lý do từ chối (tuỳ chọn):") || "";
    if (!window.confirm("Từ chối yêu cầu trả hàng của khách?")) return;
    try {
      const res = await fetch(`${API_URL}/api/preorders/${id}/return/reject`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ adminNote: note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data?.message || "Từ chối yêu cầu thất bại");
      setPo(extractPreorderPayload(data));
      alert("Đã từ chối yêu cầu trả hàng.");
    } catch (err) {
      alert(err?.message || "Lỗi từ chối yêu cầu");
    }
  };

  const updateReturnShipping = async () => {
    if (!shipForm.status) {
      alert("Vui lòng chọn trạng thái vận chuyển kế tiếp.");
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/preorders/${id}/return/shipping-update`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          status: shipForm.status,
          carrier: shipForm.carrier || undefined,
          trackingCode: shipForm.trackingCode || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data?.message || "Cập nhật vận chuyển hoàn trả thất bại");
      setPo(extractPreorderPayload(data));
      alert("Đã cập nhật vận chuyển hoàn trả.");
    } catch (err) {
      alert(err?.message || "Lỗi cập nhật vận chuyển");
    }
  };

  const issueReturnRefund = async () => {
    if (refundForm.amount === "" || Number(refundForm.amount) < 0) {
      alert("Vui lòng nhập số tiền hoàn hợp lệ.");
      return;
    }
    if (!window.confirm(`Xác nhận hoàn tiền: ${toVND(Number(refundForm.amount))}?`)) return;
    try {
      const res = await fetch(`${API_URL}/api/preorders/${id}/return/refund`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(refundForm.amount), adminNote: refundForm.adminNote || "" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data?.message || "Hoàn tiền thất bại");
      setPo(extractPreorderPayload(data));
      alert("Đã hoàn tiền & đóng yêu cầu.");
    } catch (err) {
      alert(err?.message || "Lỗi hoàn tiền");
    }
  };

  const reasonText =
    rf.reason || po?.returnReason || "—";
  const customerNote =
    rf.customerNote || rf.note || po?.customerReturnNote || "";

  return (
    <div className="preorders-admin">
      <header className="pa-header">
        <h1>{headerTitle}</h1>
        <div className="pa-actions" style={{ gap: 8 }}>
          <button className="pa-refresh" onClick={fetchDetail} disabled={loading}>
            {loading ? "Đang tải..." : "Tải lại"}
          </button>
          <button className="btn-light" onClick={() => navigate(-1)}>← Quay lại</button>
          <Link className="btn-secondary" to="/admin/preorders">Về danh sách</Link>
        </div>
      </header>

      {!po ? (
        <div style={{ padding: 24 }}>{loading ? "Đang tải..." : "Không có dữ liệu"}</div>
      ) : (
        <section className="pa-table-wrap">
          <div className="po-detail">
            <div className="po-detail-row">
              <div><strong>Người dùng:</strong> {po?.user?.email || po?.user?.name || po?.user || "—"}</div>
              <div><strong>Ngày tạo:</strong> {po.createdAt ? new Date(po.createdAt).toLocaleString("vi-VN") : "—"}</div>
            </div>
            <div className="po-detail-row">
              <div><strong>Sản phẩm:</strong> {po?.product?.name || "—"}</div>
              <div>
                <strong>Biến thể:</strong>{" "}
                {(po?.variant?.label ||
                  [po?.variant?.attributes?.weight, po?.variant?.attributes?.ripeness]
                    .filter(Boolean)
                    .join(" · ")) || "—"}{" "}
                · SL {po.qty}
              </div>
            </div>
            <div className="po-detail-row">
              <div><strong>Tạm tính:</strong> {toVND(po.subtotal)}</div>
              <div><strong>Đã trả cọc:</strong> {toVND(po.depositPaid)} · <strong>Còn lại:</strong> {toVND(po.remainingDue)}</div>
            </div>
          </div>

          <div className="po-return-wrap" style={{ marginTop: 16 }}>
            <div className="po-return-head">
              <strong>Trả hàng / Hoàn tiền</strong>{" "}
              {pickReturnFlow(po) ? (
                <span className={`po-return-status ${st || ""}`}>• {RETURN_LABELS[st] || st || "Đang mở"}</span>
              ) : (
                <span className="po-return-status">• Không có yêu cầu</span>
              )}
              {rf.isOpen ? <span className="po-return-open"> (Đang mở)</span> : null}
            </div>

            {(reasonText !== "—" || customerNote) && (
              <div className="po-return-box">
                <div><strong>Lý do KH:</strong> {reasonText}</div>
                {customerNote ? <div><strong>Ghi chú KH:</strong> {customerNote}</div> : null}
              </div>
            )}

            {imgs.length > 0 && (
              <div className="po-return-evidences">
                {imgs.map((src, i) => (
                  <a key={i} href={src} target="_blank" rel="noreferrer">
                    <img alt={`evi-${i}`} src={src} />
                  </a>
                ))}
              </div>
            )}

            {st === "return_requested" && (
              <div className="po-return-box">
                <div className="po-return-row">
                  <label>Ghi chú admin</label>
                  <input
                    value={approveForm.adminNote}
                    onChange={(e) => setApproveForm((f) => ({ ...f, adminNote: e.target.value }))}
                    placeholder="VD: đồng ý trả vì lỗi kỹ thuật"
                  />
                </div>
                <div className="po-return-row">
                  <label>Phí khấu trừ (₫)</label>
                  <input
                    type="number"
                    value={approveForm.feeDeduction}
                    onChange={(e) => setApproveForm((f) => ({ ...f, feeDeduction: e.target.value }))}
                    placeholder="VD: 30000"
                  />
                </div>
                <div className="po-return-row">
                  <label>Hãng VC (tuỳ chọn)</label>
                  <input
                    value={approveForm.carrier}
                    onChange={(e) => setApproveForm((f) => ({ ...f, carrier: e.target.value }))}
                    placeholder="GHN / GHTK / Viettel Post..."
                  />
                </div>
                <div className="po-return-row">
                  <label>Mã vận đơn (tuỳ chọn)</label>
                  <input
                    value={approveForm.trackingCode}
                    onChange={(e) => setApproveForm((f) => ({ ...f, trackingCode: e.target.value }))}
                    placeholder="Mã vận đơn chiều ngược"
                  />
                </div>
                <div className="po-return-actions">
                  <button className="btn" onClick={approveReturn}>Duyệt yêu cầu</button>
                  <button className="btn-secondary" onClick={rejectReturn}>Từ chối</button>
                </div>
              </div>
            )}

            {["return_approved", "return_awaiting_pickup", "return_picked_up", "return_in_transit"].includes(st) && (
              <div className="po-return-box">
                <div className="po-return-row">
                  <label>Trạng thái vận chuyển</label>
                  <select
                    value={shipForm.status}
                    onChange={(e) => setShipForm((f) => ({ ...f, status: e.target.value }))}
                  >
                    <option value="">-- Chọn trạng thái --</option>
                    {RETURN_SHIP_OPTIONS.map((code) => (
                      <option key={code} value={code}>{RETURN_LABELS[code]}</option>
                    ))}
                  </select>
                </div>
                <div className="po-return-row">
                  <label>Hãng VC</label>
                  <input
                    value={shipForm.carrier}
                    onChange={(e) => setShipForm((f) => ({ ...f, carrier: e.target.value }))}
                    placeholder="GHN / GHTK / Viettel Post..."
                  />
                </div>
                <div className="po-return-row">
                  <label>Mã vận đơn</label>
                  <input
                    value={shipForm.trackingCode}
                    onChange={(e) => setShipForm((f) => ({ ...f, trackingCode: e.target.value }))}
                    placeholder="Mã vận đơn chiều ngược"
                  />
                </div>
                <div className="po-return-actions">
                  <button className="btn" onClick={updateReturnShipping}>Cập nhật vận chuyển</button>
                </div>
              </div>
            )}

            {st === "return_received" && (
              <div className="po-return-box">
                <div className="po-return-row">
                  <label>Số tiền hoàn (₫)</label>
                  <input
                    type="number"
                    value={refundForm.amount}
                    onChange={(e) => setRefundForm((f) => ({ ...f, amount: e.target.value }))}
                    placeholder="VD: 150000"
                  />
                </div>
                <div className="po-return-row">
                  <label>Ghi chú admin</label>
                  <input
                    value={refundForm.adminNote}
                    onChange={(e) => setRefundForm((f) => ({ ...f, adminNote: e.target.value }))}
                    placeholder="VD: trừ phí xử lý 10k..."
                  />
                </div>
                <div className="po-return-actions">
                  <button className="btn" onClick={issueReturnRefund}>Hoàn tiền & đóng yêu cầu</button>
                </div>
              </div>
            )}

            {["refund_issued", "return_rejected"].includes(st) && (
              <div className="po-return-box">
                <div><strong>Kết quả:</strong> {RETURN_LABELS[st]}</div>
                {rf.refundAmount > 0 && <div><strong>Hoàn tiền:</strong> {toVND(rf.refundAmount)}</div>}
                {rf.adminNote ? <div><strong>Ghi chú admin:</strong> {rf.adminNote}</div> : null}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
