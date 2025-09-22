import React, { useMemo, useState } from "react";
import { useCart } from "../../context/CartContext";

/**
 * MixBuilder
 * - Hiển thị danh sách trái cây để thêm vào mixDraft (giỏ Mix tạm)
 * - Hỗ trợ bán theo cái (price) và theo kg (pricePerKg + weightGram)
 *
 * Props (tuỳ chọn):
 *  - candidates: Array | { data: Array }
 *  - weightOptions: number[] gram (default [250, 500, 1000])
 *  - showSearch: boolean (default true)
 *  - onChange(prev => next): callback tương thích luồng cũ (không bắt buộc)
 */
export default function MixBuilder({
  candidates,
  weightOptions = [250, 500, 1000],
  showSearch = true,
  onChange,
}) {
  const {
    mixDraft,
    mixDraftAddItem,
    mixDraftRemoveItem,
  } = useCart();

  const list = useMemo(
    () => (Array.isArray(candidates) ? candidates : candidates?.data || []),
    [candidates]
  );

  const [search, setSearch] = useState("");
  const [weightPick, setWeightPick] = useState({}); // { [productId]: weightGram }

  const filtered = useMemo(() => {
    if (!search.trim()) return list;
    const s = search.toLowerCase();
    return list.filter((p) => (p?.name || "").toLowerCase().includes(s));
  }, [list, search]);

  // Tìm 1 dòng trong draft theo productId + weightGram (0 cho theo cái)
  const findDraftLine = (productId, weightGram) =>
    (mixDraft?.items || []).find((x) => {
      if (x.productId !== productId) return false;
      return Number(x.weightGram || 0) === Number(weightGram || 0);
    });

  const formatPrice = (n) => (Number(n) || 0).toLocaleString("vi-VN") + "₫";

  // Cập nhật qty kiểu "đặt lại": xoá dòng cũ rồi add qty mới (nếu > 0)
  const setDraftQty = (product, qty, weightGram) => {
    const q = Math.max(0, Number(qty || 0));
    const current = findDraftLine(product._id, weightGram);

    if (current) mixDraftRemoveItem(current);
    if (q > 0) mixDraftAddItem(product, { qty: q, weightGram });

    // Giữ tương thích luồng cũ (nếu ai còn truyền onChange)
    if (typeof onChange === "function") {
      const isPerKg = !!product.pricePerKg && !product.price;
      onChange((prev = []) => {
        const rest = prev.filter(
          (x) =>
            x.productId !== product._id ||
            (isPerKg && Number(x.weightGram || 0) !== Number(weightGram || 0))
        );
        return q > 0
          ? [
              ...rest,
              {
                productId: product._id,
                qty: q,
                ...(isPerKg ? { weightGram } : {}),
              },
            ]
          : rest;
      });
    }
  };

  return (
    <div className="space-y-4">
      {showSearch && (
        <div className="flex items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm trái cây..."
            className="w-full md:w-80 rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <div className="text-sm text-gray-500">{filtered.length} sản phẩm</div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((p) => {
          const isPerKg = !!p.pricePerKg && !p.price;
          const selectedWeight =
            weightPick[p._id] ?? (isPerKg ? weightOptions[0] : 0);

          const currentLine = findDraftLine(
            p._id,
            isPerKg ? selectedWeight : 0
          );
          const currentQty = currentLine?.qty || 0;

          return (
            <div
              key={p._id}
              className="p-3 rounded-xl border bg-white shadow-sm hover:shadow transition"
            >
              <div className="flex items-start gap-3">
                <img
                  src={p.thumbnail || p.image || p.images?.[0] || "/noimg.png"}
                  alt={p.name}
                  className="w-16 h-16 rounded-lg object-cover border"
                />
                <div className="min-w-0">
                  <div className="font-semibold line-clamp-2">{p.name}</div>
                  {!isPerKg ? (
                    <div className="text-sm text-gray-600 mt-0.5">
                      {formatPrice(p.price)}{" "}
                      <span className="text-gray-400">/ cái</span>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600 mt-0.5">
                      {formatPrice(p.pricePerKg)}{" "}
                      <span className="text-gray-400">/ kg</span>
                    </div>
                  )}
                </div>
              </div>

              {isPerKg ? (
                <div className="mt-3 space-y-2">
                  <div className="text-xs text-gray-500">Chọn trọng lượng</div>
                  <div className="flex flex-wrap gap-2">
                    {weightOptions.map((g) => (
                      <button
                        key={g}
                        onClick={() =>
                          setWeightPick((prev) => ({ ...prev, [p._id]: g }))
                        }
                        className={`px-3 py-1 rounded-full border text-sm
                          ${
                            selectedWeight === g
                              ? "bg-emerald-50 border-emerald-400 text-emerald-700"
                              : "bg-white hover:bg-gray-50"
                          }`}
                      >
                        {g}g
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      className="px-3 py-1 rounded-lg border hover:bg-gray-50"
                      onClick={() =>
                        setDraftQty(
                          p,
                          Math.max(0, currentQty - 1),
                          selectedWeight
                        )
                      }
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={0}
                      value={currentQty}
                      onChange={(e) =>
                        setDraftQty(
                          p,
                          Number(e.target.value || 0),
                          selectedWeight
                        )
                      }
                      className="w-20 rounded-lg border px-2 py-1 text-center"
                    />
                    <button
                      className="px-3 py-1 rounded-lg border hover:bg-gray-50"
                      onClick={() =>
                        setDraftQty(p, currentQty + 1, selectedWeight)
                      }
                    >
                      +
                    </button>
                  </div>

                  <div className="text-xs text-gray-500">
                    Đang chọn: {selectedWeight}g × {currentQty} gói
                  </div>
                </div>
              ) : (
                <div className="mt-3">
                  <div className="flex items-center gap-2">
                    <button
                      className="px-3 py-1 rounded-lg border hover:bg-gray-50"
                      onClick={() => setDraftQty(p, Math.max(0, currentQty - 1))}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={0}
                      value={currentQty}
                      onChange={(e) => setDraftQty(p, Number(e.target.value || 0))}
                      className="w-20 rounded-lg border px-2 py-1 text-center"
                    />
                    <button
                      className="px-3 py-1 rounded-lg border hover:bg-gray-50"
                      onClick={() => setDraftQty(p, currentQty + 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
