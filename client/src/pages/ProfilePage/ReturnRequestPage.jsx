// src/pages/ReturnRequestPage.jsx
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import "./ReturnRequestPage.css"; // hoặc file CSS bạn đang dùng cho trang này

const API_URL = "http://localhost:3000";

const VN_RETURN_REASONS = [
  "Hàng hư hỏng / dập nát",
  "Sản phẩm có mùi lạ / kém chất lượng",
  "Giao sai sản phẩm",
  "Thiếu sản phẩm",
  "Đóng gói rách / vỡ",
  "Khác",
];

/** ================== TĂNG GIỚI HẠN ẢNH ==================
 * - Mỗi ảnh (sau nén): <= ~2MB
 * - Tổng tất cả ảnh trong 1 yêu cầu: <= ~12MB
 * - Resize tối đa: 2048px theo cạnh dài
 */
const MAX_RETURN_IMAGES = 6;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;     // ~2MB/ảnh sau nén
const MAX_TOTAL_BYTES = 12 * 1024 * 1024;    // ~12MB tổng ảnh
const MAX_DIMENSION = 2048;                  // tối đa 2048px cạnh dài

const dataUrlBytes = (dataUrl) => {
  if (!dataUrl) return 0;
  const idx = dataUrl.indexOf(",");
  const b64 = idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
  return Math.ceil((b64.length * 3) / 4);
};

const compressImage = (
  file,
  { maxDim = MAX_DIMENSION, mime = "image/jpeg", qualityStart = 0.86, minQuality = 0.6 } = {}
) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth || img.width;
      let h = img.naturalHeight || img.height;

      // Scale về trong khung maxDim
      if (w > h && w > maxDim) {
        h = Math.round((h * maxDim) / w);
        w = maxDim;
      } else if (h >= w && h > maxDim) {
        w = Math.round((w * maxDim) / h);
        h = maxDim;
      }

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);

      let q = qualityStart;
      let out = canvas.toDataURL(mime, q);

      // Nén dần tới khi <= MAX_IMAGE_BYTES hoặc chạm minQuality
      while (dataUrlBytes(out) > MAX_IMAGE_BYTES && q > minQuality) {
        q = Math.max(minQuality, q - 0.06);
        out = canvas.toDataURL(mime, q);
      }
      resolve(out);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });

export default function ReturnRequestPage() {
  const { preorderId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const initMeta = {
    productName: location.state?.productName || "",
    variantLabel: location.state?.variantLabel || "",
    qty: Number(location.state?.qty || 1),
    defaultPhone: location.state?.defaultPhone || "",
    customId: location.state?.customId || "",
  };
  const [meta, setMeta] = useState(initMeta);

  const [reason, setReason] = useState("");
  const [qty, setQty] = useState(initMeta.qty || 1);
  const [preference, setPreference] = useState("refund");
  const [phone, setPhone] = useState(initMeta.defaultPhone || "");
  const [note, setNote] = useState("");

  const [images, setImages] = useState([]);   // base64 đã nén
  const [previews, setPreviews] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    const needFetch = !meta.productName || !meta.qty || Number.isNaN(Number(meta.qty));

    async function fetchPreorder() {
      try {
        const res = await fetch(`${API_URL}/api/preorders/${preorderId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || "Không tải được đơn đặt trước");
        if (!mounted) return;

        const name = data?.product?.name || meta.productName || "";
        const label =
          data?.variant?.label ||
          [data?.variant?.attributes?.weight, data?.variant?.attributes?.ripeness]
            .filter(Boolean)
            .join(" · ");
        const q = Number(data?.qty || meta.qty || 1);
        const cid = data?.customId || meta.customId || "";

        setMeta((m) => ({ ...m, productName: name, variantLabel: label, qty: q, customId: cid }));
        if (!phone) setPhone(data?.contactPhone || "");
        if (!qty) setQty(q);
      } catch (e) {
        console.error(e);
      }
    }

    if (needFetch) fetchPreorder();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preorderId]);

  const onPickImages = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    const room = MAX_RETURN_IMAGES - previews.length;
    const selected = files.slice(0, room);
    if (!selected.length) return;

    try {
      const newDataUrls = [];
      for (const file of selected) {
        const compressed = await compressImage(file);
        newDataUrls.push(compressed);
      }

      // Kiểm tra tổng dung lượng
      const currentTotal = images.reduce((s, d) => s + dataUrlBytes(d), 0);
      const allowed = [];
      let rolling = currentTotal;

      for (const d of newDataUrls) {
        const sz = dataUrlBytes(d);
        if (rolling + sz <= MAX_TOTAL_BYTES) {
          allowed.push(d);
          rolling += sz;
        } else {
          break;
        }
      }

      if (allowed.length < newDataUrls.length) {
        alert("Một số ảnh không được thêm vì tổng dung lượng vượt 12MB. Hãy bớt ảnh hoặc chọn ảnh nhẹ hơn.");
      }

      setImages((arr) => [...arr, ...allowed]);
      setPreviews((arr) => [...arr, ...allowed]);
    } catch (err) {
      console.error(err);
      alert("Không đọc được ảnh, vui lòng thử lại.");
    }
  };

  const removeImage = (idx) => {
    const a = [...images];
    const b = [...previews];
    a.splice(idx, 1);
    b.splice(idx, 1);
    setImages(a);
    setPreviews(b);
  };

  const submit = async () => {
    if (!reason) return alert("Vui lòng chọn lý do.");
    if (!phone || String(phone).trim().length < 8) return alert("Số điện thoại không hợp lệ.");
    if (!Number.isFinite(Number(qty)) || Number(qty) < 1) return alert("Số lượng không hợp lệ.");

    const payload = {
      reason,
      note: note || "",
      images: images || [],
      qty: Number(qty),
      preferredResolution: preference || "refund",
      phone,
    };

    // Safety check trước khi gửi (nới lên 15MB)
    const approxSize = new Blob([JSON.stringify(payload)]).size;
    if (approxSize > 15 * 1024 * 1024) {
      return alert("Dữ liệu gửi đi quá lớn (>15MB). Hãy xoá bớt ảnh hoặc nén nhẹ hơn.");
    }

    try {
      setSubmitting(true);
      const res = await fetch(`${API_URL}/api/preorders/${preorderId}/return-request`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.message || "Gửi yêu cầu đổi/trả thất bại");
      }
      alert(data?.message || "Đã gửi yêu cầu đổi/trả. Chúng tôi sẽ liên hệ sớm.");
      navigate("/thong-tin");
    } catch (e) {
      alert(e?.message || "Không thể gửi yêu cầu.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="return-page">
      <div className="return-card">
        <div className="return-card__head">
          <div className="return-card__title">Yêu cầu đổi/trả</div>
          <button className="return-card__close" onClick={() => navigate(-1)} disabled={submitting}>✕</button>
        </div>

        <div className="return-card__meta">
          <div className="return-meta__name">{meta.productName || "Sản phẩm"}</div>
          <div className="return-meta__sub">
            {meta.variantLabel || "—"} <span className="return-dot" /> SL đã nhận: {meta.qty}
            {meta.customId ? (<><span className="return-dot" /> Mã: {meta.customId}</>) : null}
          </div>
        </div>

        <div className="return-body">
          <div className="return-grid">
            <div className="return-field">
              <label className="return-label">Lý do <span className="req">*</span></label>
              <select className="return-select" value={reason} onChange={(e) => setReason(e.target.value)} disabled={submitting}>
                <option value="">-- Chọn lý do --</option>
                {VN_RETURN_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div className="return-field">
              <label className="return-label">Số lượng</label>
              <input className="return-input" type="number" min="1" max={Number(meta.qty || 1)} value={qty} onChange={(e) => setQty(e.target.value)} disabled={submitting} />
            </div>

            <div className="return-field">
              <label className="return-label">Hình thức xử lý</label>
              <select className="return-select" value={preference} onChange={(e) => setPreference(e.target.value)} disabled={submitting}>
                <option value="refund">Hoàn tiền</option>
                <option value="exchange">Đổi hàng</option>
              </select>
            </div>

            <div className="return-field">
              <label className="return-label">SĐT liên hệ <span className="req">*</span></label>
              <input className="return-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={submitting} />
              <div className="return-hint">Số dùng để chúng tôi liên hệ xác minh.</div>
            </div>

            <div className="return-field return-field--full">
              <label className="return-label">Mô tả / ghi chú thêm</label>
              <textarea className="return-textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} disabled={submitting} />
            </div>

            <div className="return-field return-field--full">
              <label className="return-label">Ảnh minh chứng ({previews.length}/{MAX_RETURN_IMAGES})</label>
              <div className="return-uploader">
                <label className="return-upload-btn">
                  <input type="file" accept="image/*" multiple onChange={(e) => onPickImages(e.target.files)} disabled={submitting || previews.length >= MAX_RETURN_IMAGES} />
                  <span>+ Thêm ảnh</span>
                </label>

                <div className="return-previews">
                  {previews.map((src, idx) => (
                    <div key={idx} className="return-preview">
                      <img alt={`evi-${idx}`} src={src} className="return-preview__img" />
                      <button type="button" className="return-preview__remove" onClick={() => removeImage(idx)} disabled={submitting} title="Xoá ảnh">✕</button>
                    </div>
                  ))}
                </div>

                
              </div>
            </div>
          </div>

          <div className="return-actions">
            <button className="return-btn" onClick={submit} disabled={submitting}>{submitting ? "Đang gửi..." : "Gửi yêu cầu"}</button>
            <button className="return-btn return-btn--light" onClick={() => navigate(-1)} disabled={submitting}>Hủy</button>
          </div>
        </div>
      </div>
    </div>
  );
}
