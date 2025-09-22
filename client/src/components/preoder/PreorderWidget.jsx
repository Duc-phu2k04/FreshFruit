// client/src/components/preorder/PreorderWidget.jsx
import React, { useMemo, useState, useEffect } from "react";

/**
 * PreorderWidget
 * Props:
 *  - product: object Product đã include trường `preorder`
 *      { id/_id, name, baseVariant, variants[], weightOptions[], ripenessOptions[], preorder{...} }
 *  - onSuccess?: (preorder) => void
 *  - requireLoginHint?: boolean
 *  - originHeaderValue?: string  // "coming-soon" | "product-detail"
 */
export default function PreorderWidget({
  product,
  onSuccess,
  requireLoginHint = true,
  originHeaderValue = "coming-soon",
}) {
  // Base URL cho API
  const API_BASE =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) ||
    (typeof window !== "undefined" && window.__API_BASE__) ||
    "http://localhost:3000";

  const [selectedWeight, setSelectedWeight] = useState(
    product?.baseVariant?.attributes?.weight || product?.weightOptions?.[0] || ""
  );
  const [selectedRipeness, setSelectedRipeness] = useState(
    product?.baseVariant?.attributes?.ripeness || product?.ripenessOptions?.[0] || ""
  );
  const [qty, setQty] = useState(1);
  const [payMethod, setPayMethod] = useState("deposit"); // "deposit" | "full"
  const [loading, setLoading] = useState(false);

  // Phân loại thông báo (success/error)
  const [msg, setMsg] = useState(null);
  const [msgType, setMsgType] = useState("error"); // "success" | "error"

  const preorderCfg = product?.preorder || {};
  const enabled = !!preorderCfg?.enabled;

  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");

  const withinWindow = useMemo(() => {
    const now = new Date();
    const ws = preorderCfg?.windowStart ? new Date(preorderCfg.windowStart) : null;
    const we = preorderCfg?.windowEnd ? new Date(preorderCfg.windowEnd) : null;
    if (ws && now < ws) return false;
    if (we && now > we) return false;
    return true;
  }, [preorderCfg?.windowStart, preorderCfg?.windowEnd]);

  // Tìm biến thể khớp
  const matchedVariant = useMemo(() => {
    if (!Array.isArray(product?.variants)) return null;
    return (
      product.variants.find(
        (v) =>
          String(v?.attributes?.weight || "") === String(selectedWeight || "") &&
          String(v?.attributes?.ripeness || "") === String(selectedRipeness || "")
      ) || null
    );
  }, [product?.variants, selectedWeight, selectedRipeness]);

  // Đơn giá (BE vẫn tự tính lại)
  const unitPrice = useMemo(() => {
    const base = Number(product?.baseVariant?.price || 0);
    const v = matchedVariant ? Number(matchedVariant.price || base) : base;
    return Number.isFinite(v) ? v : 0;
  }, [product?.baseVariant?.price, matchedVariant]);

  // Phân bổ theo biến thể (optional)
  const variantAllocation = useMemo(() => {
    const arr = preorderCfg?.perVariantAllocations || [];
    return arr.find(
      (row) =>
        String(row?.attributes?.weight || "") === String(selectedWeight || "") &&
        String(row?.attributes?.ripeness || "") === String(selectedRipeness || "")
    );
  }, [preorderCfg?.perVariantAllocations, selectedWeight, selectedRipeness]);

  // Số lượng còn nhận
  const remainingQuota = useMemo(() => {
    if (variantAllocation) {
      const q =
        Number(variantAllocation?.quota || 0) -
        Number(variantAllocation?.soldPreorder || 0);
      return Math.max(0, q);
    }
    const q =
      Number(preorderCfg?.quota || 0) - Number(preorderCfg?.soldPreorder || 0);
    return Math.max(0, q);
  }, [variantAllocation, preorderCfg?.quota, preorderCfg?.soldPreorder]);

  // Tính giá
  const depositPercent = Number(preorderCfg?.depositPercent ?? 20);
  const subtotal = useMemo(
    () => Math.max(0, Math.round(unitPrice * Number(qty || 0))),
    [unitPrice, qty]
  );
  const depositAmount = useMemo(
    () => Math.round(subtotal * (depositPercent / 100)),
    [subtotal, depositPercent]
  );
  const totalToPayNow = payMethod === "full" ? subtotal : depositAmount;

  // Ràng buộc số lượng theo quota
  useEffect(() => {
    if (!enabled) return;
    if (remainingQuota <= 0) setQty(0);
    else if (!Number.isInteger(qty) || qty < 1) setQty(1);
    else if (qty > remainingQuota) setQty(remainingQuota);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingQuota, enabled]);

  if (!enabled) return null;

  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const canSubmit =
    !!token &&
    withinWindow &&
    remainingQuota > 0 &&
    Number.isInteger(qty) &&
    qty >= 1 &&
    subtotal > 0 &&
    !loading;

  function sanitizeInt(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return 0;
    return Math.trunc(x);
  }

  function buildVariantLabel(weight, ripeness) {
    const w = weight || "";
    const r = ripeness || "";
    if (!w && !r) return null;
    if (w && r) return `${w} · ${r}`;
    return w || r;
  }

  async function handleSubmit() {
    const endpoint = `${API_BASE.replace(/\/+$/, "")}/api/preorders`;
    const productId = product?.id || product?._id;

    try {
      setLoading(true);
      setMsg(null);

      if (!token) {
        if (requireLoginHint) {
          setMsgType("error");
          setMsg("Bạn cần đăng nhập để đặt trước.");
        }
        return;
      }
      if (!withinWindow) {
        setMsgType("error");
        setMsg("Hiện không trong thời gian đặt trước.");
        return;
      }
      const safeQty = sanitizeInt(qty);
      if (safeQty < 1 || safeQty > remainingQuota) {
        setMsgType("error");
        setMsg("Số lượng không hợp lệ hoặc vượt hạn mức đặt trước.");
        return;
      }
      if (!productId) {
        setMsgType("error");
        setMsg("Thiếu mã sản phẩm, vui lòng tải lại trang.");
        return;
      }

      // Tìm variantId (nếu có)
      const matched =
        Array.isArray(product?.variants) &&
        product.variants.find(
          (v) =>
            String(v?.attributes?.weight || "") === String(selectedWeight || "") &&
            String(v?.attributes?.ripeness || "") === String(selectedRipeness || "")
        );

      const body = {
        productId,
        variant: {
          weight: selectedWeight || null,
          ripeness: selectedRipeness || null,
          label: buildVariantLabel(selectedWeight, selectedRipeness),
          variantId: matched?._id || matched?.id || null,
        },
        qty: safeQty,
        payMethod, // "deposit" | "full"
        // thông tin để BE log nguồn gọi mà KHÔNG dùng custom header
        clientOrigin: originHeaderValue,
        // gợi ý đơn giá (BE không tin giá client)
        unitPriceClientHint: Number(unitPrice) || 0,
      };

      // ====== LOG GỌI API ======
      console.groupCollapsed("[PreorderWidget] createPreorder");
      console.log("Endpoint:", endpoint);
      console.log("Headers:", {
        "Content-Type": "application/json",
        Authorization: token ? "Bearer <token_present>" : "NO_TOKEN",
      });
      console.log("Request Body:", body);
      console.groupEnd();
      // =========================

      const res = await fetch(endpoint, {
        method: "POST",
        // ❗ BỎ custom header 'X-Preorder-Origin' để tránh preflight fail (CORS)
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      // Đọc raw text để debug khi JSON lỗi
      const raw = await res.text();
      let data = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        /* giữ raw để log */
      }

      // ====== LOG PHẢN HỒI ======
      console.groupCollapsed("[PreorderWidget] response");
      console.log("HTTP Status:", res.status);
      console.log("Raw body:", raw);
      console.log("Parsed JSON:", data);
      console.groupEnd();
      // ==========================

      if (!res.ok || (data && data.ok === false)) {
        const message =
          (data && (data.message || data.error)) ||
          (res.status === 401
            ? "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại."
            : `Đặt trước thất bại (HTTP ${res.status})`);
        throw new Error(message);
      }

      // Thành công
      setMsgType("success");
      setMsg("Đặt trước thành công! Kiểm tra mục 'Đơn đặt trước' của bạn.");
      setQty(1);

      if (typeof onSuccess === "function" && data?.preorder) {
        onSuccess(data.preorder);
      }
    } catch (err) {
      // TypeError: Failed to fetch → hay xảy ra khi CORS/preflight fail
      console.error("[PreorderWidget] ERROR:", err);
      setMsgType("error");
      const text =
        err?.name === "TypeError" && /Failed to fetch/i.test(err?.message || "")
          ? "Không gọi được máy chủ. Vui lòng kiểm tra kết nối hoặc cấu hình CORS của BE."
          : err?.message || "Có lỗi xảy ra. Vui lòng thử lại.";
      setMsg(text);
    } finally {
      setLoading(false);
    }
  }

  // Small UI helpers
  const Badge = ({ children }) => (
    <span
      style={{
        background: "#F59E0B",
        color: "#fff",
        padding: "3px 8px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {children}
    </span>
  );

  const Row = ({ label, children }) => (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 8,
        margin: "6px 0",
      }}
    >
      <div style={{ color: "#4B5563" }}>{label}</div>
      <div style={{ fontWeight: 600 }}>{children}</div>
    </div>
  );

  // Styles cho thông báo
  const notifyStyleBase = {
    marginTop: 10,
    padding: "12px 16px",
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    gap: 12,
    boxShadow: "0 6px 20px rgba(2,6,23,0.06)",
    fontSize: 14,
    fontWeight: 500,
    lineHeight: 1.45,
    animation: "fadeIn .25s ease-out",
  };
  const notifyStyle =
    msgType === "success"
      ? {
          ...notifyStyleBase,
          background: "#ECFDF5",           // emerald-50
          border: "1px solid #10B981",     // emerald-500
          color: "#065F46",                // emerald-700
        }
      : {
          ...notifyStyleBase,
          background: "#FEF2F2",           // rose-50
          border: "1px solid #FCA5A5",     // rose-300
          color: "#991B1B",                // rose-900
        };

  const closeBtnStyle = {
    marginLeft: "auto",
    background: "transparent",
    border: "none",
    fontSize: 18,
    cursor: "pointer",
    color: "inherit",
    padding: 2,
    lineHeight: 1,
    opacity: 0.8,
  };

  return (
    <div
      className="preorder-widget"
      style={{
        border: "1px solid #E5E7EB",
        borderRadius: 12,
        padding: 16,
        background: "#FFFFFF",
        marginTop: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Badge>ĐẶT TRƯỚC</Badge>
        <div style={{ color: "#6B7280", fontSize: 13 }}>
          {withinWindow ? "Đang mở đặt trước" : "Ngoài thời gian đặt trước"}
        </div>
      </div>

      {/* ETA */}
      <Row label="Dự kiến giao">
        {fmtDate(preorderCfg?.expectedHarvestStart)} – {fmtDate(preorderCfg?.expectedHarvestEnd)}
      </Row>

      {/* Quota */}
      <Row label="Còn nhận">
        {remainingQuota > 0 ? (
          `${remainingQuota} suất`
        ) : (
          <span style={{ color: "#DC2626" }}>Đã đủ số lượng</span>
        )}
      </Row>

      {/* Variant pickers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          marginTop: 8,
        }}
      >
        <div>
          <label style={{ fontSize: 13, color: "#374151" }}>Khối lượng</label>
          <select
            value={selectedWeight}
            onChange={(e) => setSelectedWeight(e.target.value)}
            style={{
              width: "100%",
              padding: 8,
              borderRadius: 8,
              border: "1px solid #E5E7EB",
            }}
          >
            {(product?.weightOptions || [selectedWeight]).map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 13, color: "#374151" }}>Độ chín</label>
          <select
            value={selectedRipeness}
            onChange={(e) => setSelectedRipeness(e.target.value)}
            style={{
              width: "100%",
              padding: 8,
              borderRadius: 8,
              border: "1px solid #E5E7EB",
            }}
          >
            {(product?.ripenessOptions || [selectedRipeness]).map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Qty & Pay method */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          marginTop: 8,
        }}
      >
        <div>
          <label style={{ fontSize: 13, color: "#374151" }}>Số lượng</label>
          <input
            type="number"
            min={remainingQuota > 0 ? 1 : 0}
            max={remainingQuota}
            value={qty}
            onChange={(e) => {
              const v = sanitizeInt(e.target.value);
              setQty(Math.max(remainingQuota > 0 ? 1 : 0, Math.min(remainingQuota, v)));
            }}
            style={{
              width: "100%",
              padding: 8,
              borderRadius: 8,
              border: "1px solid #E5E7EB",
            }}
          />
          {remainingQuota > 0 && (
            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
              Tối đa: {remainingQuota}
            </div>
          )}
        </div>
        <div>
          <label style={{ fontSize: 13, color: "#374151" }}>Thanh toán</label>
          <select
            value={payMethod}
            onChange={(e) => setPayMethod(e.target.value)}
            style={{
              width: "100%",
              padding: 8,
              borderRadius: 8,
              border: "1px solid #E5E7EB",
            }}
          >
            <option value="deposit">
              Cọc {depositPercent}% (≈ {depositAmount.toLocaleString()}đ)
            </option>
            <option value="full">
              Thanh toán đủ (≈ {subtotal.toLocaleString()}đ)
            </option>
          </select>
        </div>
      </div>

      {/* Price summary */}
      <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed #E5E7EB" }}>
        <Row label="Đơn giá">{unitPrice.toLocaleString()}đ</Row>
        <Row label="Tạm tính">{subtotal.toLocaleString()}đ</Row>
        <Row label="Trả ngay">{totalToPayNow.toLocaleString()}đ</Row>
      </div>

      {/* Notification */}
      {msg && (
        <div style={notifyStyle}>
          <span style={{ flex: 1 }}>
            {msgType === "success" ? (
              <>Đặt trước thành công! Kiểm tra mục <b>“Đơn đặt trước”</b> của bạn.</>
            ) : (
              msg
            )}
          </span>
          <button
            onClick={() => setMsg(null)}
            aria-label="Đóng"
            style={closeBtnStyle}
            title="Đóng"
          >
            ×
          </button>
        </div>
      )}

      {!token && requireLoginHint && (
        <div style={{ marginTop: 8, fontSize: 12, color: "#6B7280" }}>
          Bạn chưa đăng nhập. Vui lòng <b>đăng nhập</b> để đặt trước.
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        style={{
          marginTop: 12,
          width: "100%",
          padding: "10px 14px",
          borderRadius: 10,
          border: "none",
          background: canSubmit ? "#16A34A" : "#9CA3AF",
          color: "#fff",
          fontWeight: 700,
          cursor: canSubmit ? "pointer" : "not-allowed",
        }}
      >
        {loading ? "Đang xử lý..." : withinWindow ? "Đặt trước ngay" : "Ngoài thời gian đặt trước"}
      </button>
    </div>
  );
}
