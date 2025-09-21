import "./OrderReturnRequest.css";
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams, Link } from "react-router-dom";
import axios from "axios";

const API_URL = "http://localhost:3000";

const MAX_FILES = 6;
const MAX_MB = 5;
const ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/jpg"];

export default function OrderReturnRequest() {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const token = localStorage.getItem("token");
  const location = useLocation();

  // state từ ProfilePage (nếu có)
  const state = (location && location.state) || {};
  const presetItems = Array.isArray(state.items) ? state.items : [];
  const presetPhone = state.defaultPhone || "";
  const customId = state.customId || "";

  const [loading, setLoading] = useState(false);
  const [orderItems, setOrderItems] = useState(presetItems);
  const [phone, setPhone] = useState(presetPhone);
  const [reason, setReason] = useState(""); // giữ nguyên: nhập tự do
  const [note, setNote] = useState("");
  const [lines, setLines] = useState(
    presetItems.map((it, idx) => ({
      key: `${idx}`,
      checked: true,
      productName: it.productName,
      variant: it.variant,
      productId: it.productId || "",
      maxQty: Number(it.quantity || 1),
      qty: Math.min(1, Number(it.quantity || 1)) || 1,
    }))
  );

  // ===== Thêm: upload ảnh minh hoạ =====
  const [files, setFiles] = useState([]);
  const [uploadErrors, setUploadErrors] = useState([]);

  const anyChecked = useMemo(() => lines.some((l) => l.checked), [lines]);
  const canSubmit = useMemo(() => {
    return anyChecked && reason.trim() && files.length > 0 && !loading;
  }, [anyChecked, reason, files, loading]);

  const handleChooseFiles = (e) => {
    const incoming = Array.from(e.target.files || []);
    if (!incoming.length) return;

    const next = [];
    const errs = [];

    for (const f of incoming) {
      if (!ACCEPT.includes(f.type)) {
        errs.push(`❌ ${f.name}: Định dạng không hỗ trợ (chỉ JPG/PNG/WebP).`);
        continue;
      }
      if (f.size > MAX_MB * 1024 * 1024) {
        errs.push(`❌ ${f.name}: Vượt quá ${MAX_MB}MB.`);
        continue;
      }
      next.push(f);
    }

    const merged = [...files, ...next].slice(0, MAX_FILES);
    if (files.length + next.length > MAX_FILES) {
      errs.push(`❗Chỉ chọn tối đa ${MAX_FILES} ảnh.`);
    }

    setFiles(merged);
    setUploadErrors(errs);
    e.target.value = "";
  };

  const removeFileAt = (idx) => setFiles((prev) => prev.filter((_, i) => i !== idx));
  const clearAllFiles = () => setFiles([]);

  // nếu mở trực tiếp qua URL (không có state) → lấy từ /api/orders/user rồi find theo id
  useEffect(() => {
    const needFetch = !presetItems.length;
    if (!needFetch) return;

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${API_URL}/api/orders/user`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const orders = Array.isArray(res.data) ? res.data : [];
        const found = orders.find((o) => String(o._id) === String(orderId));
        if (!found) {
          alert("Không tìm thấy đơn hàng.");
          navigate("/thong-tin");
          return;
        }
        const items = (found.items || []).map((it) => ({
          productName: it.productName,
          variant: it.variant,
          quantity: it.quantity,
          productId:
            (it.product && (it.product.$oid || it.product._id?.$oid || it.product._id || it.product.id)) ||
            it.productId ||
            it.product_id ||
            it.productID ||
            it.pid ||
            (it.variant && it.variant.productId) ||
            "",
        }));
        if (!cancelled) {
          setOrderItems(items);
          setPhone(found?.shippingAddress?.phone || "");
          setLines(
            items.map((i, idx) => ({
              key: `${idx}`,
              checked: true,
              productName: i.productName,
              variant: i.variant,
              productId: i.productId || "",
              maxQty: Number(i.quantity || 1),
              qty: Math.min(1, Number(i.quantity || 1)) || 1,
            }))
          );
        }
      } catch {
        alert("Không tải được chi tiết đơn hàng.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, token]);

  const updateLine = (key, patch) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const toggleAll = (checked) =>
    setLines((prev) => prev.map((l) => ({ ...l, checked })));

  const submit = async () => {
    if (!anyChecked) {
      alert("Vui lòng chọn ít nhất một sản phẩm muốn đổi/trả.");
      return;
    }
    if (!reason.trim()) {
      alert("Vui lòng nhập lý do đổi/trả.");
      return;
    }
    if (files.length === 0) {
      alert("Vui lòng tải lên ít nhất 1 ảnh minh hoạ sản phẩm hỏng/lỗi.");
      return;
    }

    const selected = lines
      .filter((l) => l.checked)
      .map((l) => ({
        productId: l.productId || null,
        productName: l.productName,
        variant: l.variant || null,
        quantity: Number(l.qty || 1),
      }));

    // Dùng FormData để gửi kèm ảnh
    const form = new FormData();
    form.append("reason", reason.trim());
    form.append("note", note || "");
    form.append("phone", phone || "");
    form.append("items", JSON.stringify(selected));
    form.append("customId", customId || "");
    form.append("orderId", orderId || "");

    files.forEach((f) => form.append("images", f)); // field "images" (nhiều)

    try {
      setLoading(true);
      const res = await axios.post(`${API_URL}/api/orders/${orderId}/return-request`, form, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      if (!res?.status || res.status >= 400 || res?.data?.ok === false) {
        throw new Error(res?.data?.message || "Gửi yêu cầu đổi/trả thất bại");
      }
      alert(res?.data?.message || "Đã gửi yêu cầu đổi/trả. Bộ phận CSKH sẽ liên hệ bạn sớm nhất.");
      navigate("/thong-tin");
    } catch (e) {
      alert(e?.response?.data?.message || e?.message || "Không thể gửi yêu cầu đổi/trả");
    } finally {
      setLoading(false);
    }
  };

  const previewURL = (f) => URL.createObjectURL(f);

  return (
    <div className="orq-container">
      <div className="orq-header">
        <h1 className="orq-title">Yêu cầu đổi/trả</h1>
        <div className="orq-breadcrumbs">
          <Link to="/thong-tin" className="orq-breadcrumb-link">Trang cá nhân</Link>
          <span className="orq-breadcrumb-sep">/</span>
          <span className="orq-breadcrumb-current">Đổi/Trả đơn {customId || orderId?.slice(-6)}</span>
        </div>
      </div>

      <div className="orq-card">
        <div className="orq-form">
          <div className="orq-row">
            <label className="orq-label">Số điện thoại liên hệ</label>
            <input
              className="orq-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="VD: 09xxxxxx"
            />
          </div>

          <div className="orq-row">
            <label className="orq-label">
              Lý do đổi/trả <span className="orq-required">*</span>
            </label>
            <textarea
              className="orq-textarea"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Hãy mô tả vấn đề của bạn…"
              rows={3}
            />
          </div>

          <div className="orq-row">
            <label className="orq-label">Ghi chú (tuỳ chọn)</label>
            <textarea
              className="orq-textarea"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Thêm thông tin để shop hỗ trợ nhanh hơn…"
              rows={2}
            />
          </div>

          {/* ====== KHU VỰC UPLOAD ẢNH ====== */}
          <div className="orq-row">
            <label className="orq-label">
              Ảnh minh hoạ sản phẩm hỏng/lỗi <span className="orq-required">*</span>
            </label>
            <div
              className="orq-upload"
              style={{
                border: "1px dashed #CBD5E1",
                padding: 12,
                borderRadius: 10,
                background: "#F9FAFB",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <small>Chọn tối đa {MAX_FILES} ảnh • ≤ {MAX_MB}MB/ảnh • JPG/PNG/WebP</small>
                {files.length > 0 && (
                  <button type="button" className="orq-btn-light" onClick={clearAllFiles}>
                    Xoá tất cả
                  </button>
                )}
              </div>

              <input
                type="file"
                accept={ACCEPT.join(",")}
                multiple
                onChange={handleChooseFiles}
                style={{ marginBottom: 8 }}
              />

              {uploadErrors.length > 0 && (
                <ul style={{ color: "#B91C1C", margin: "4px 0 8px 16px" }}>
                  {uploadErrors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              )}

              {files.length > 0 && (
                <div
                  className="orq-thumb-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                    gap: 12,
                    marginTop: 8,
                  }}
                >
                  {files.map((f, i) => (
                    <div
                      key={`${f.name}-${i}`}
                      style={{
                        position: "relative",
                        borderRadius: 8,
                        overflow: "hidden",
                        border: "1px solid #E5E7EB",
                      }}
                    >
                      <img
                        src={previewURL(f)}
                        alt={f.name}
                        style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }}
                        onLoad={(e) => URL.revokeObjectURL(e.currentTarget.src)}
                      />
                      <button
                        type="button"
                        className="orq-btn-light"
                        onClick={() => removeFileAt(i)}
                        title="Xoá ảnh"
                        style={{
                          position: "absolute",
                          top: 6,
                          right: 6,
                          background: "rgba(0,0,0,.6)",
                          color: "white",
                          border: "none",
                          borderRadius: 6,
                          padding: "4px 8px",
                          cursor: "pointer",
                        }}
                      >
                        Xoá
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {/* ====== HẾT KHU VỰC UPLOAD ====== */}

          <div className="orq-items">
            <div className="orq-items-head">
              <div className="orq-items-title">Chọn sản phẩm đổi/trả</div>
              <div className="orq-items-actions">
                <button className="orq-btn-light" onClick={() => toggleAll(true)}>Chọn hết</button>
                <button className="orq-btn-light" onClick={() => toggleAll(false)}>Bỏ chọn</button>
              </div>
            </div>

            {orderItems.length === 0 ? (
              <div className="orq-empty">Không có sản phẩm trong đơn.</div>
            ) : (
              <div className="orq-item-list">
                {lines.map((l) => {
                  const vText =
                    l?.variant?.weight || l?.variant?.ripeness
                      ? `(${[l.variant.weight, l.variant.ripeness].filter(Boolean).join(", ")})`
                      : "";
                  return (
                    <div key={l.key} className={`orq-item ${l.checked ? "is-checked" : ""}`}>
                      <label className="orq-item-left">
                        <input
                          type="checkbox"
                          checked={l.checked}
                          onChange={(e) => updateLine(l.key, { checked: e.target.checked })}
                        />
                        <span className="orq-item-name">
                          {l.productName} <span className="orq-item-variant">{vText}</span>
                        </span>
                      </label>

                      <div className="orq-item-right">
                        <span className="orq-item-max">Tối đa: {l.maxQty}</span>
                        <input
                          className="orq-input orq-qty"
                          type="number"
                          min={1}
                          max={l.maxQty}
                          value={l.qty}
                          onChange={(e) => {
                            const val = Math.max(1, Math.min(Number(e.target.value || 1), l.maxQty));
                            updateLine(l.key, { qty: val });
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="orq-actions">
            <button className="orq-btn" onClick={submit} disabled={!canSubmit}>
              {loading ? "Đang gửi..." : "Gửi yêu cầu"}
            </button>
            <Link to="/thong-tin" className="orq-btn-secondary">Huỷ</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
