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
  const [msg, setMsg] = useState(null);

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
        if (requireLoginHint) setMsg("Bạn cần đăng nhập để đặt trước.");
        return;
      }
      if (!withinWindow) {
        setMsg("Hiện không trong thời gian đặt trước.");
        return;
      }
      const safeQty = sanitizeInt(qty);
      if (safeQty < 1 || safeQty > remainingQuota) {
        setMsg("Số lượng không hợp lệ hoặc vượt hạn mức đặt trước.");
        return;
      }
      if (!productId) {
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
        // Gợi ý đơn giá để BE có thể log/đối chiếu (BE không tin giá client)
        unitPriceClientHint: Number(unitPrice) || 0,
      };

      // ====== LOG GỌI API ======
      console.groupCollapsed("[PreorderWidget] createPreorder");
      console.log("Endpoint:", endpoint);
      console.log("Headers:", {
        "Content-Type": "application/json",
        Authorization: token ? "Bearer <token_present>" : "NO_TOKEN",
        "X-Preorder-Origin": originHeaderValue,
      });
      console.log("Request Body:", body);
      console.groupEnd();
      // =========================

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Preorder-Origin": originHeaderValue,
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

      setMsg("Đặt trước thành công! Kiểm tra mục 'Đơn đặt trước' của bạn.");
      setQty(1);

      if (typeof onSuccess === "function" && data?.preorder) {
        onSuccess(data.preorder);
      }
    } catch (err) {
      console.error("[PreorderWidget] ERROR:", err);
      setMsg(err?.message || "Có lỗi xảy ra. Vui lòng thử lại.");
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
      <div
        style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}
      >
        <Badge>ĐẶT TRƯỚC</Badge>
        <div style={{ color: "#6B7280", fontSize: 13 }}>
          {withinWindow ? "Đang mở đặt trước" : "Ngoài thời gian đặt trước"}
        </div>
      </div>

      {/* ETA */}
      <Row label="Dự kiến giao">
        {fmtDate(preorderCfg?.expectedHarvestStart)} –{" "}
        {fmtDate(preorderCfg?.expectedHarvestEnd)}
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

      {/* Policy */}
      <div style={{ marginTop: 8, fontSize: 12, color: "#6B7280", lineHeight: 1.6 }}>
        {preorderCfg?.cancelPolicy?.untilDate ? (
          <>
            Hủy trước <b>{fmtDate(preorderCfg.cancelPolicy.untilDate)}</b> hoàn cọc 100%.
            {typeof preorderCfg?.cancelPolicy?.feePercent === "number" && (
              <> Sau đó, phí hủy <b>{preorderCfg.cancelPolicy.feePercent}%</b>.</>
            )}
          </>
        ) : (
          <>Vui lòng xem chính sách hủy đặt trước của cửa hàng.</>
        )}
      </div>

      {/* Status / Errors */}
      {msg && (
        <div
          style={{
            marginTop: 8,
            padding: 8,
            background: "#FEF2F2",
            border: "1px solid #FCA5A5",
            color: "#991B1B",
            borderRadius: 8,
          }}
        >
          {msg}
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
