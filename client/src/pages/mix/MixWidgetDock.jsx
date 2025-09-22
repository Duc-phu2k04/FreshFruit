// client/src/pages/mix/MixWidgetDock.jsx
import React, { useEffect, useMemo, useState } from "react";
import MixWidget from "./MixWidget";
import { useCart } from "../../context/CartContext";

const LS_KEY = "mix_widget_open_v1";

export default function MixWidgetDock() {
  const { mixDraft, computeMixDraftTotal } = useCart();
  const [open, setOpen] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw === "true") return true;
      if (raw === "false") return false;
      // mặc định: mở nếu đã có item, ngược lại thu nhỏ
      return Array.isArray(mixDraft?.items) && mixDraft.items.length > 0;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, String(open)); } catch { /* empty */ }
  }, [open]);

  const count = Number(mixDraft?.items?.length || 0);
  const total = useMemo(
    () => computeMixDraftTotal(mixDraft?.items || []),
    [mixDraft, computeMixDraftTotal]
  );

  const fmt = (n) => (Number(n) || 0).toLocaleString("vi-VN") + "₫";

  if (!open) {
    // Nút tròn (FAB) khi thu nhỏ
    return (
      <button
        onClick={() => setOpen(true)}
        className="relative w-14 h-14 rounded-full bg-emerald-600 text-white shadow-xl flex items-center justify-center hover:bg-emerald-700 transition-colors"
        title={count ? `Giỏ Mix: ${count} món • ${fmt(total)}` : "Giỏ Mix"}
      >
        <span className="text-2xl">🧺</span>
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-[11px] font-semibold flex items-center justify-center">
            {count}
          </span>
        )}
      </button>
    );
  }

  // Khung widget khi đang mở
  return (
    <div className="rounded-2xl shadow-2xl border bg-white w-[360px] max-w-[90vw] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-white/70 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="text-xl">🧺</span>
          <div className="font-semibold">Giỏ Mix</div>
          {count > 0 && (
            <span className="text-xs text-gray-600">({count} món • {fmt(total)})</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOpen(false)}
            className="text-gray-500 hover:text-gray-800 text-sm px-2 py-1 rounded-md hover:bg-gray-100"
            title="Thu nhỏ"
          >
            Thu nhỏ
          </button>
        </div>
      </div>

      {/* Body: widget gốc */}
      <div className="p-3">
        <MixWidget />
      </div>
    </div>
  );
}
