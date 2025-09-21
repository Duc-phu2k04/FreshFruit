// src/pages/Admin/Order/OrderReturnAdmin.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import "./OrderReturnAdmin.css";

const API_URL = "http://localhost:3000";

// controller mapping (must match BE)
const SHIP_SEQUENCE = [
  "return_approved",
  "return_awaiting_pickup",
  "return_picked_up",
  "return_in_transit",
  "return_received",
];

const SHIP_LABEL = {
  return_approved: "Đã duyệt yêu cầu",
  return_awaiting_pickup: "Chờ lấy hàng",
  return_picked_up: "Đã lấy hàng",
  return_in_transit: "Đang hoàn về",
  return_received: "Đã nhận lại",
};

function nextShipStatus(cur) {
  const i = SHIP_SEQUENCE.indexOf(cur);
  if (i === -1) return "return_awaiting_pickup";
  if (i >= SHIP_SEQUENCE.length - 1) return SHIP_SEQUENCE[i];
  return SHIP_SEQUENCE[i + 1];
}

/** ------------------ Helpers to normalize BE variations ------------------ */
const pick = (...vals) => {
  for (const v of vals) {
    if (v === 0) return 0;
    if (typeof v === "string" && v.trim() !== "") return v;
    if (Array.isArray(v) && v.length) return v;
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    if (v && typeof v === "object") return v;
  }
  return undefined;
};

function toImgUrl(raw) {
  if (!raw) return null;

  const ensureAbs = (s) => {
    if (!s) return null;
    try {
      if (/^https?:\/\//i.test(s)) return s;        // absolute
      if (s.startsWith("/")) return `${API_URL}${s}`; // static served with leading slash
      if (s.startsWith("uploads/") || s.startsWith("public/")) return `${API_URL}/${s}`;
      return `${API_URL}/${s}`;
    } catch {
      return null;
    }
  };

  if (typeof raw === "string") return ensureAbs(raw);

  if (typeof raw === "object") {
    const s =
      raw.secure_url ||
      raw.url ||
      raw.src ||
      raw.Location ||
      raw.location ||
      raw.path ||
      raw.filepath ||
      raw.filePath ||
      raw.key ||
      raw.filename;
    return ensureAbs(s);
  }
  return null;
}

function normalizeReturnFlow(order) {
  const rfRaw =
    order?.returnFlow ||
    order?.return ||
    order?.returnRequest ||
    order?.returnInfo ||
    order?.return_data ||
    {};

  // KHÔNG default "return_requested" nếu BE chưa có — tránh false positive
  const status = pick(rfRaw.status, rfRaw.state, rfRaw.phase, rfRaw.stage);

  const preferredResolution = pick(
    rfRaw.preferredResolution,
    rfRaw.resolution,
    rfRaw.type,
    rfRaw.requestType,
    "refund"
  );

  const reason = pick(
    rfRaw.reason,
    rfRaw.userReason,
    rfRaw.customerReason,
    rfRaw.title,
    rfRaw.subject,
    ""
  );

  const customerNote = pick(rfRaw.customerNote, rfRaw.note, rfRaw.message, rfRaw.description, "");

  const customerPhone = pick(
    rfRaw.customerPhone,
    rfRaw.phone,
    rfRaw.contactPhone,
    order?.shippingAddress?.phone,
    ""
  );

  // evidence images (BE may store in different shapes)
  let rawImgs =
    pick(
      rfRaw.evidenceImages,
      rfRaw.images,
      rfRaw.photos,
      rfRaw.attachments,
      rfRaw.media?.images,
      rfRaw.media?.photos,
      []
    ) || [];

  if (!Array.isArray(rawImgs) && typeof rawImgs === "object") {
    // sometimes {items: [...]}
    rawImgs = pick(rawImgs.items, rawImgs.files, rawImgs.list, []) || [];
  }

  const imageUrls = (rawImgs || [])
    .map(toImgUrl)
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i); // dedupe

  const feeDeduction =
    typeof rfRaw.feeDeduction === "number" ? rfRaw.feeDeduction : undefined;
  const refundAmount =
    typeof rfRaw.refundAmount === "number" ? rfRaw.refundAmount : undefined;

  const timeline =
    rfRaw.timeline || {
      requestedAt: rfRaw.requestedAt || rfRaw.createdAt || order?.updatedAt || order?.createdAt,
      approvedAt: rfRaw.approvedAt,
      awaitingPickupAt: rfRaw.awaitingPickupAt,
      pickedUpAt: rfRaw.pickedUpAt,
      inTransitAt: rfRaw.inTransitAt,
      receivedAt: rfRaw.receivedAt,
      refundIssuedAt: rfRaw.refundIssuedAt,
      rejectedAt: rfRaw.rejectedAt,
      closedAt: rfRaw.closedAt,
    };

  // isOpen nếu có status / cờ isOpen / có timestamp yêu cầu
  const isOpen = Boolean(
    status ||
    rfRaw.isOpen ||
    timeline?.requestedAt
  );

  return {
    ...rfRaw,
    status,
    isOpen,
    preferredResolution,
    reason,
    customerNote,
    customerPhone,
    evidenceImages: imageUrls,
    refundAmount,
    feeDeduction,
    timeline,
    carrier: rfRaw.carrier || rfRaw.shipCarrier || "",
    trackingCode: rfRaw.trackingCode || rfRaw.shipCode || "",
  };
}
/** ---------------------------------------------------------------------- */

export default function OrderReturnAdmin() {
  const { id } = useParams(); // orderId
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");

  // form states
  const [adminNote, setAdminNote] = useState("");
  const [feeDeduction, setFeeDeduction] = useState("");
  const [shipCarrier, setShipCarrier] = useState("");
  const [shipCode, setShipCode] = useState("");
  const [shipNote, setShipNote] = useState("");
  const [shipStatus, setShipStatus] = useState("return_awaiting_pickup");
  const [refundAmount, setRefundAmount] = useState("");

  const authHeader = useMemo(
    () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }),
    [token]
  );

  async function fetchDetail() {
    setLoading(true);
    setError("");
    try {
      // try single first
      let data = null;
      try {
        const resOne = await fetch(`${API_URL}/api/orders/${id}`, { headers: authHeader });
        if (resOne.ok) data = await resOne.json();
      } catch {
        /* ignore */
      }

      // fallback to /all
      if (!data) {
        const resAll = await fetch(`${API_URL}/api/orders/all`, { headers: authHeader });
        const list = await resAll.json();
        const orders = Array.isArray(list) ? list : list?.orders || [];
        data = orders.find((o) => String(o._id) === String(id)) || null;
      }
      if (!data) throw new Error("Không tìm thấy đơn hàng.");

      setOrder(data);

      const rf = normalizeReturnFlow(data);
      // preset UI fields
      setShipCarrier(rf.carrier || "");
      setShipCode(rf.trackingCode || "");
      setShipNote("");
      setShipStatus(nextShipStatus(rf.status || "return_approved"));
      if (typeof rf.refundAmount === "number") setRefundAmount(String(rf.refundAmount));
      else setRefundAmount("");
      if (typeof rf.feeDeduction === "number") setFeeDeduction(String(rf.feeDeduction));
      else setFeeDeduction("");
    } catch (e) {
      setError(e?.message || "Không tải được chi tiết đơn hàng.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }
    fetchDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  const rf = normalizeReturnFlow(order || {});
  const rfStatus = rf.status || "";

  // ===== Hiển thị "Đổi trả" thay cho status giao hàng khi đã có yêu cầu
  const orderStatusText = rfStatus ? "Đổi trả" : (order?.status || "—");

  async function doPatch(path, body = {}) {
    const res = await fetch(`${API_URL}/api/orders/${id}${path}`, {
      method: "PATCH",
      headers: authHeader,
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { ok: res.ok, message: text };
    }
    if (!res.ok || data?.ok === false) {
      throw new Error(data?.message || "Thao tác thất bại");
    }
    return data;
  }

  const approve = async () => {
    try {
      await doPatch(`/return/approve`, {
        adminNote: adminNote || "",
        feeDeduction: Number(feeDeduction || 0),
        carrier: shipCarrier || undefined,
        trackingCode: shipCode || undefined,
      });
      await fetchDetail();
      alert("Đã duyệt yêu cầu đổi/trả.");
    } catch (e) {
      alert(e.message);
    }
  };

  const reject = async () => {
    if (!window.confirm("Từ chối yêu cầu đổi/trả?")) return;
    try {
      await doPatch(`/return/reject`, { adminNote: adminNote || "" });
      await fetchDetail();
      alert("Đã từ chối yêu cầu đổi/trả.");
    } catch (e) {
      alert(e.message);
    }
  };

  const updateShipping = async () => {
    try {
      await doPatch(`/return/shipping-update`, {
        status: shipStatus, // ✅ BE expects `status`
        carrier: shipCarrier || undefined, // optional
        trackingCode: shipCode || undefined,
        raw: shipNote ? { note: shipNote } : undefined,
      });
      await fetchDetail();
      alert("Đã cập nhật vận chuyển cho đổi/trả.");
    } catch (e) {
      alert(e.message);
    }
  };

  const issueRefund = async () => {
    if (!refundAmount || Number(refundAmount) <= 0) {
      alert("Nhập số tiền hoàn hợp lệ.");
      return;
    }
    try {
      await doPatch(`/return/refund`, {
        amount: Number(refundAmount), // ✅ BE expects `amount`
        adminNote: adminNote || "",
      });
      await fetchDetail();
      alert("Đã ghi hoàn tiền.");
    } catch (e) {
      alert(e.message);
    }
  };

  if (loading) return <div className="ora-wrap">Đang tải…</div>;
  if (error) {
    return (
      <div className="ora-wrap">
        <div className="ora-error">{error}</div>
        <div className="ora-actions">
          <button className="ora-btn ora-btn-light" onClick={fetchDetail}>
            Thử lại
          </button>
          <Link to="/admin/orders" className="ora-btn ora-btn-outline">
            Về danh sách
          </Link>
        </div>
      </div>
    );
  }

  const items = order?.items || [];
  const phone = rf?.customerPhone || "";
  const reason = rf?.reason || "";
  const customerNote = rf?.customerNote || "";
  const pref = rf?.preferredResolution === "exchange" ? "exchange" : "refund";
  const timeline = rf?.timeline || {};
  const imgs = Array.isArray(rf?.evidenceImages) ? rf.evidenceImages : [];

  return (
    <div className="ora-wrap">
      <div className="ora-header">
        <div>
          <div className="ora-breadcrumbs">
            <Link to="/admin/orders" className="ora-bc-link">
              Đơn hàng
            </Link>
            <span className="ora-bc-sep">/</span>
            <span className="ora-bc-current">
              Đổi/Trả #{order?.customId || String(order?._id).slice(-6)}
            </span>
          </div>
          <h1 className="ora-title">Quản lý đổi/trả (Đơn hàng)</h1>
        </div>

        <div className="ora-status">
          <span className={`ora-chip ${rfStatus ? "ora-chip-open" : ""}`}>
            {rfStatus ? "Đổi trả" : "Không có yêu cầu đổi/trả"}
          </span>
          {rfStatus && (
            <span className="ora-chip">Trạng thái: {SHIP_LABEL[rfStatus] || rfStatus}</span>
          )}
        </div>
      </div>

      <div className="ora-grid">
        {/* Thông tin đơn */}
        <div className="ora-card">
          <div className="ora-card-title">Thông tin đơn</div>
          <div className="ora-row">
            <div className="ora-key">Mã đơn</div>
            <div className="ora-val">#{order?.customId || String(order?._id).slice(-6)}</div>
          </div>
          <div className="ora-row">
            <div className="ora-key">Khách</div>
            <div className="ora-val">
              {order?.user?.username || "—"} {order?.user?.email ? `(${order.user.email})` : ""}
            </div>
          </div>
          <div className="ora-row">
            <div className="ora-key">Trạng thái</div>
            <div className="ora-val">{orderStatusText}</div>
          </div>
          <div className="ora-row">
            <div className="ora-key">Thanh toán</div>
            <div className="ora-val">
              {order?.paymentStatus === "paid"
                ? "Đã thanh toán"
                : order?.paymentStatus === "unpaid"
                ? "Chưa thanh toán"
                : "Thất bại"}
              {" · "}
              {(order?.paymentMethod || "COD").toUpperCase()}
            </div>
          </div>
          <div className="ora-row">
            <div className="ora-key">Ngày đặt</div>
            <div className="ora-val">
              {order?.createdAt ? new Date(order.createdAt).toLocaleString("vi-VN") : "—"}
            </div>
          </div>
        </div>

        {/* Yêu cầu đổi/trả */}
        <div className="ora-card ora-rf">
          <div className="ora-card-title">Yêu cầu đổi/trả</div>

          <div className="ora-row">
            <div className="ora-key">SĐT</div>
            <div className="ora-val">{phone || "—"}</div>
          </div>

          <div className="ora-row">
            <div className="ora-key">Lý do</div>
            <div className="ora-val">{reason || "—"}</div>
          </div>

          <div className="ora-row">
            <div className="ora-key">Ghi chú KH</div>
            <div className="ora-val" style={{ whiteSpace: "pre-wrap" }}>
              {customerNote || "—"}
            </div>
          </div>

          <div className="ora-row">
            <div className="ora-key">Hướng giải quyết</div>
            <div className="ora-val">{pref === "exchange" ? "Đổi hàng" : "Hoàn tiền"}</div>
          </div>

          {imgs.length > 0 && (
            <>
              <div className="ora-sep" />
              <div className="ora-field">
                <div className="ora-label">Hình ảnh đính kèm</div>
                <div className="ora-img-grid">
                  {imgs.map((raw, i) => {
                    const src = toImgUrl(raw);
                    if (!src) return null;
                    return (
                      <a key={i} href={src} target="_blank" rel="noreferrer" className="ora-img-cell">
                        <img src={src} alt={`evidence-${i}`} />
                      </a>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          <div className="ora-sep"></div>

          <div className="ora-field">
            <label className="ora-label">Ghi chú nội bộ</label>
            <textarea
              className="ora-textarea"
              rows={2}
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="Ghi chú cho hành động duyệt / từ chối / hoàn tiền…"
            />
          </div>

          <div className="ora-field">
            <label className="ora-label">Khấu trừ phí (nếu có)</label>
            <input
              className="ora-input"
              type="number"
              min={0}
              value={feeDeduction}
              onChange={(e) => setFeeDeduction(e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="ora-actions">
            <button
              className="ora-btn ora-btn-primary"
              onClick={approve}
              disabled={!rfStatus || rfStatus !== "return_requested"}
            >
              Duyệt yêu cầu
            </button>
            <button
              className="ora-btn ora-btn-danger"
              onClick={reject}
              disabled={!rfStatus || rfStatus !== "return_requested"}
            >
              Từ chối
            </button>
          </div>
        </div>

        {/* Vận chuyển & Hoàn tiền */}
        <div className="ora-card">
          <div className="ora-card-title">Vận chuyển & Hoàn tiền</div>

          <div className="ora-field">
            <label className="ora-label">Trạng thái vận chuyển (đổi/trả)</label>
            <select
              className="ora-input"
              value={shipStatus}
              onChange={(e) => setShipStatus(e.target.value)}
              disabled={!rfStatus}
            >
              {SHIP_SEQUENCE.slice(1).map((s) => (
                <option key={s} value={s}>
                  {SHIP_LABEL[s]}
                </option>
              ))}
            </select>
          </div>

          <div className="ora-field">
            <label className="ora-label">Đơn vị vận chuyển</label>
            <input
              className="ora-input"
              value={shipCarrier}
              onChange={(e) => setShipCarrier(e.target.value)}
              placeholder="VD: GHTK, GHN…"
              disabled={!rfStatus}
            />
          </div>

          <div className="ora-field">
            <label className="ora-label">Mã vận chuyển</label>
            <input
              className="ora-input"
              value={shipCode}
              onChange={(e) => setShipCode(e.target.value)}
              placeholder="Mã vận đơn đổi/trả"
              disabled={!rfStatus}
            />
          </div>

          <div className="ora-field">
            <label className="ora-label">Ghi chú vận chuyển</label>
            <textarea
              className="ora-textarea"
              rows={2}
              value={shipNote}
              onChange={(e) => setShipNote(e.target.value)}
              placeholder="Ghi chú thêm về vận chuyển…"
              disabled={!rfStatus}
            />
          </div>

          <div className="ora-actions">
            <button className="ora-btn ora-btn-outline" onClick={updateShipping} disabled={!rfStatus}>
              Cập nhật vận chuyển
            </button>
          </div>

          <div className="ora-sep"></div>

          <div className="ora-field">
            <label className="ora-label">Số tiền hoàn (₫)</label>
            <input
              className="ora-input"
              type="number"
              min={0}
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              placeholder="Nhập số tiền hoàn"
              disabled={!rfStatus || rfStatus !== "return_received"}
            />
          </div>

          <div className="ora-actions">
            <button
              className="ora-btn ora-btn-primary"
              onClick={issueRefund}
              disabled={!rfStatus || rfStatus !== "return_received"}
            >
              Ghi hoàn tiền & đóng yêu cầu
            </button>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="ora-card" style={{ marginTop: 16 }}>
        <div className="ora-card-title">Tiến trình đổi/trả</div>
        <ul className="ora-timeline">
          {timeline.requestedAt && (
            <li>
              <span>Yêu cầu</span>
              <time>{new Date(timeline.requestedAt).toLocaleString("vi-VN")}</time>
            </li>
          )}
          {timeline.approvedAt && (
            <li>
              <span>Duyệt</span>
              <time>{new Date(timeline.approvedAt).toLocaleString("vi-VN")}</time>
            </li>
          )}
          {timeline.awaitingPickupAt && (
            <li>
              <span>Chờ lấy</span>
              <time>{new Date(timeline.awaitingPickupAt).toLocaleString("vi-VN")}</time>
            </li>
          )}
          {timeline.pickedUpAt && (
            <li>
              <span>Đã lấy</span>
              <time>{new Date(timeline.pickedUpAt).toLocaleString("vi-VN")}</time>
            </li>
          )}
          {timeline.inTransitAt && (
            <li>
              <span>Đang hoàn</span>
              <time>{new Date(timeline.inTransitAt).toLocaleString("vi-VN")}</time>
            </li>
          )}
          {timeline.receivedAt && (
            <li>
              <span>Đã nhận lại</span>
              <time>{new Date(timeline.receivedAt).toLocaleString("vi-VN")}</time>
            </li>
          )}
          {timeline.refundIssuedAt && (
            <li>
              <span>Hoàn tiền</span>
              <time>{new Date(timeline.refundIssuedAt).toLocaleString("vi-VN")}</time>
            </li>
          )}
          {timeline.rejectedAt && (
            <li>
              <span>Từ chối</span>
              <time>{new Date(timeline.rejectedAt).toLocaleString("vi-VN")}</time>
            </li>
          )}
          {timeline.closedAt && (
            <li>
              <span>Đóng yêu cầu</span>
              <time>{new Date(timeline.closedAt).toLocaleString("vi-VN")}</time>
            </li>
          )}
          {!Object.keys(timeline || {}).length && <li>Chưa có dữ liệu tiến trình.</li>}
        </ul>
      </div>

      {/* Toàn bộ SP trong đơn */}
      <div className="ora-card" style={{ marginTop: 16 }}>
        <div className="ora-card-title">Toàn bộ sản phẩm trong đơn</div>
        <ul className="ora-items-list">
          {items.map((it, idx) => (
            <li key={idx} className="ora-item">
              <span className="ora-item-name">{it.productName}</span>
              <span className="ora-item-variant">
                {it?.variant?.weight || it?.variant?.ripeness
                  ? `(${[it.variant.weight, it.variant.ripeness].filter(Boolean).join(", ")})`
                  : ""}
              </span>
              <span className="ora-item-qty">× {it.quantity}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="ora-actions" style={{ marginTop: 12 }}>
        <Link to="/admin/orders" className="ora-btn ora-btn-light">
          ← Về danh sách
        </Link>
      </div>
    </div>
  );
}
