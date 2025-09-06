import React, { useEffect, useState } from "react";
import "../CommingSoon/comingsoonAdmin.css";

/**
 * ComingSoonAdmin.jsx
 * Admin CRUD cho nhóm sản phẩm "Coming Soon" (preorder).
 *
 * API:
 * - GET    {API_BASE}/api/products?preorder=true            → list sản phẩm có preorder.enabled
 * - PUT    {API_BASE}/api/products/:id                      → cập nhật sản phẩm (admin)
 * - DELETE {API_BASE}/api/products/:id                      → xóa sản phẩm (admin)
 */

const API_ORIGIN =
  (import.meta?.env?.VITE_API_BASE && import.meta.env.VITE_API_BASE.replace(/\/$/, "")) ||
  "http://localhost:3000";
const API_BASE = API_ORIGIN + "/api";

const jsonHeaders = (token) => ({
  "Content-Type": "application/json",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

async function apiGet(path, token, params = null) {
  const base = API_BASE + path;
  const url = new URL(base);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { headers: jsonHeaders(token) });
  if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
  return res.json();
}
async function apiPut(path, token, body) {
  const res = await fetch(API_BASE + path, {
    method: "PUT",
    headers: jsonHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
  return res.json();
}
async function apiDelete(path, token) {
  const res = await fetch(API_BASE + path, { method: "DELETE", headers: jsonHeaders(token) });
  if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
  return res.json();
}

/* =================== UI helpers =================== */
const Btn = ({ children, className = "", ...rest }) => (
  <button
    className={
      "cs-btn px-3 py-2 rounded-xl text-sm shadow-sm border border-gray-200 hover:shadow transition " +
      className
    }
    {...rest}
  >
    {children}
  </button>
);

const Input = ({ label, hint, error, className = "", ...rest }) => (
  <label className={"cs-field block mb-3 " + className}>
    {label && <div className="cs-label mb-1 text-sm text-gray-700">{label}</div>}
    <input
      className={
        "cs-input w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 " +
        (error ? "border-red-400" : "border-gray-300")
      }
      {...rest}
    />
    {hint && <div className="cs-hint mt-1 text-xs text-gray-500">{hint}</div>}
    {error && <div className="cs-error mt-1 text-xs text-red-500">{error}</div>}
  </label>
);
const NumberInput = (props) => (
  <Input {...props} type="number" step={props.step ?? 1} inputMode="decimal" />
);

const Switch = ({ checked, onChange, label }) => (
  <div className="cs-switch flex items-center gap-2 select-none">
    <span className="text-sm text-gray-700">{label}</span>
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={
        "cs-switch__track w-10 h-6 rounded-full relative transition " +
        (checked ? "bg-blue-500" : "bg-gray-300")
      }
      aria-pressed={checked}
    >
      <span
        className={
          "cs-switch__thumb absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition " +
          (checked ? "translate-x-4" : "translate-x-0")
        }
      />
    </button>
  </div>
);

const Chip = ({ children, tone = "gray" }) => (
  <span
    className={
      `cs-chip inline-flex items-center rounded-full px-2 py-0.5 text-xs border ` +
      (tone === "green"
        ? "bg-green-50 text-green-700 border-green-200"
        : tone === "red"
        ? "bg-red-50 text-red-700 border-red-200"
        : tone === "blue"
        ? "bg-blue-50 text-blue-700 border-blue-200"
        : "bg-gray-50 text-gray-700 border-gray-200")
    }
  >
    {children}
  </span>
);

/* ================= Helpers cho ngày giờ ================= */
const fmtDateInput = (v) => {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
};
const toDateOrNull = (s) => (s ? new Date(s) : null);

/* ========================== Mặc định sản phẩm ========================== */
const emptyProduct = () => ({
  name: "",
  description: "",
  image: "",
  category: null,
  location: null,
  baseVariant: { price: 0, attributes: { weight: "", ripeness: "" }, stock: 0 },
  variants: [],
  preorder: {
    enabled: true,
    windowStart: null,
    windowEnd: null,
    expectedHarvestStart: null,
    expectedHarvestEnd: null,
    depositPercent: 20,
    quota: 0, // giữ key cho BE, nhãn hiển thị đổi
    soldPreorder: 0,
    cancelPolicy: { feePercent: 0, untilDate: null },
    priceLock: true,
    perVariantAllocations: [], // vẫn giữ cho BE nhưng KHÔNG hiển thị UI
  },
});

/* ============================ Form sản phẩm (chỉ SỬA) ============================ */
function ProductForm({ open, onClose, onSaved, initial }) {
  const token = localStorage.getItem("token");
  const [saving, setSaving] = useState(false);
  const [model, setModel] = useState(initial || emptyProduct());

  useEffect(() => {
    if (open) setModel(initial ? JSON.parse(JSON.stringify(initial)) : emptyProduct());
  }, [open, initial]);

  const set = (patch) => setModel((m) => ({ ...m, ...patch }));

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (!model?._id) {
      alert("Chỉ cho phép SỬA sản phẩm hiện có.");
      return;
    }
    setSaving(true);
    try {
      await apiPut(`/products/${model._id}`, token, model);
      onSaved?.();
      onClose?.();
    } catch (err) {
      alert("Lưu thất bại: " + (err?.message || err));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;
  const pre = model.preorder || {};

  return (
    <div className="cs-modal fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="cs-card bg-white w-full max-w-4xl rounded-2xl shadow-xl overflow-hidden">
        <div className="cs-card__header px-6 py-4 border-b flex items-center justify-between">
          <div className="text-lg font-semibold">Sửa sản phẩm</div>
          <Btn onClick={onClose}>Đóng</Btn>
        </div>
        <form
          onSubmit={handleSubmit}
          className="cs-card__body p-6 space-y-6 max-h-[80vh] overflow-auto"
        >
          <Input
            label="Tên sản phẩm"
            value={model.name}
            onChange={(e) => set({ name: e.target.value })}
            required
          />
          <Input
            label="Mô tả"
            value={model.description}
            onChange={(e) => set({ description: e.target.value })}
          />
          <NumberInput
            label="Giá cơ sở (VND)"
            value={model?.baseVariant?.price ?? 0}
            onChange={(e) =>
              set({
                baseVariant: {
                  ...(model.baseVariant || {}),
                  price: Number(e.target.value || 0),
                },
              })
            }
          />

          <div className="cs-preorder grid grid-cols-1 md:grid-cols-2 gap-4 p-3 rounded-xl border">
            <Switch
              checked={!!pre.enabled}
              onChange={(v) => set({ preorder: { ...pre, enabled: v } })}
              label="Bật đặt trước (Coming Soon)"
            />

            <NumberInput
              label="Tỷ lệ cọc (%)"
              value={pre.depositPercent ?? 20}
              onChange={(e) =>
                set({ preorder: { ...pre, depositPercent: Number(e.target.value || 0) } })
              }
            />

            <NumberInput
              label="Giới hạn đặt trước (tổng)"
              value={pre.quota ?? 0}
              onChange={(e) => set({ preorder: { ...pre, quota: Number(e.target.value || 0) } })}
            />
            <Input
              type="datetime-local"
              label="Mở đặt trước từ"
              value={fmtDateInput(pre.windowStart)}
              onChange={(e) =>
                set({ preorder: { ...pre, windowStart: toDateOrNull(e.target.value) } })
              }
            />
            <Input
              type="datetime-local"
              label="Đóng đặt trước vào"
              value={fmtDateInput(pre.windowEnd)}
              onChange={(e) =>
                set({ preorder: { ...pre, windowEnd: toDateOrNull(e.target.value) } })
              }
            />
            <Input
              type="date"
              label="Dự kiến bắt đầu có hàng"
              value={fmtDateInput(pre.expectedHarvestStart)?.slice(0, 10)}
              onChange={(e) =>
                set({
                  preorder: { ...pre, expectedHarvestStart: toDateOrNull(e.target.value) },
                })
              }
            />
            <Input
              type="date"
              label="Dự kiến kết thúc mùa"
              value={fmtDateInput(pre.expectedHarvestEnd)?.slice(0, 10)}
              onChange={(e) =>
                set({
                  preorder: { ...pre, expectedHarvestEnd: toDateOrNull(e.target.value) },
                })
              }
            />
          </div>

          {/* ĐÃ BỎ HOÀN TOÀN khối phân bổ theo biến thể */}

          <div className="cs-actions flex items-center justify-end gap-3">
            <Btn type="button" className="bg-white" onClick={onClose}>
              Hủy
            </Btn>
            <Btn type="submit" className="bg-blue-600 text-white disabled:opacity-60" disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu"}
            </Btn>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ============================== Trang Admin ============================== */
export default function ComingSoonAdmin() {
  const token = localStorage.getItem("token");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      // Lấy danh sách sản phẩm có preorder.enabled = true
      const data = await apiGet(`/products`, token, { preorder: "true", limit: 100 });
      const list = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      setItems(list);
    } catch (err) {
      setError(err?.message || "Không tải được danh sách Coming Soon.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="cs-admin p-4 md:p-6">
      <div className="cs-header flex items-center justify-between mb-4">
        <div className="text-2xl font-semibold">Coming Soon – Quản trị (Preorder)</div>
      </div>

      {error && (
        <div className="cs-alert mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div>Đang tải...</div>
      ) : (
        <table className="cs-table min-w-full text-sm border rounded-2xl overflow-hidden">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left p-3">Sản phẩm</th>
              <th className="text-left p-3">Trạng thái</th>
              <th className="text-left p-3">Thời gian mở</th>
              <th className="text-left p-3">Giới hạn</th>
              <th className="text-right p-3">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {items?.length ? (
              items.map((it) => {
                const pre = it?.preorder || {};
                const ws = pre?.windowStart ? new Date(pre.windowStart) : null;
                const we = pre?.windowEnd ? new Date(pre.windowEnd) : null;
                const fmt = (d) =>
                  d
                    ? `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1)
                        .toString()
                        .padStart(2, "0")}/${d.getFullYear()}`
                    : "-";
                return (
                  <tr key={it._id} className="border-t">
                    <td className="p-3">{it.name}</td>
                    <td className="p-3">
                      {pre?.enabled ? <Chip tone="green">Đang mở</Chip> : <Chip>Đang tắt</Chip>}
                    </td>
                    <td className="p-3">
                      {fmt(ws)} → {fmt(we)}
                    </td>
                    <td className="p-3">
                      {pre?.soldPreorder ?? 0} / {pre?.quota ?? 0}
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <Btn
                        onClick={() => {
                          setEditing(it);
                          setShowForm(true);
                        }}
                        className="bg-amber-500 text-white"
                      >
                        Sửa
                      </Btn>
                      <Btn
                        onClick={async () => {
                          if (!confirm("Bạn chắc chắn muốn xóa sản phẩm này?")) return;
                          try {
                            await apiDelete(`/products/${it._id}`, token);
                            load();
                          } catch (e) {
                            alert("Xóa thất bại: " + (e?.message || e));
                          }
                        }}
                        className="bg-red-600 text-white"
                      >
                        Xóa
                      </Btn>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-500">
                  Chưa có sản phẩm Coming Soon.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {/* Form chỉ để SỬA (không thêm mới) */}
      <ProductForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onSaved={load}
        initial={editing}
      />
    </div>
  );
}
