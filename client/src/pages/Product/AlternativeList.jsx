// src/components/product/AlternativeList.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "../../utils/axiosConfig"; // <- giữ nguyên theo project của bạn
import ProductCard from "../../components/product/card";

/**
 * AlternativeList
 * Hiển thị gợi ý sản phẩm thay thế khi một sản phẩm hết hàng
 *
 * Props:
 * - productId: string (bắt buộc)
 * - title?: string = "Gợi ý thay thế"
 * - limit?: number = 8 (BE hiện chưa dùng, nhưng có thể dùng cho FE lọc)
 * - className?: string
 * - showCount?: boolean = true  (hiển thị số lượng tìm thấy)
 * - skeletonCount?: number = 4  (số skeleton khi loading)
 */
export default function AlternativeList({
  productId,
  title = "Gợi ý thay thế",
  limit = 8,
  className = "",
  showCount = true,
  skeletonCount = 4,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(Boolean(productId));
  const [error, setError] = useState("");
  const abortRef = useRef(null);

  const safeSet = (fn) => {
    if (!abortRef.current || !abortRef.current.signal.aborted) fn();
  };

  useEffect(() => {
    if (!productId) return;
    setLoading(true);
    setError("");
    abortRef.current?.abort?.();
    abortRef.current = new AbortController();

    (async () => {
      try {
        // BE (controller) trả { data: [...] }
        const { data } = await axios.get(`/products/${productId}/alternatives`, {
          signal: abortRef.current.signal,
          // params: { limit } // (nếu sau này bạn support limit ở BE, mở dòng này)
        });
        const list = Array.isArray(data?.data) ? data.data : [];
        safeSet(() => setItems(list));
      } catch (err) {
        if (err?.name === "CanceledError" || err?.code === "ERR_CANCELED") return;
        safeSet(() => setError(err?.response?.data?.message || "Không tải được gợi ý thay thế"));
      } finally {
        safeSet(() => setLoading(false));
      }
    })();

    return () => {
      abortRef.current?.abort?.();
    };
  }, [productId, limit]);

  // Lấy n item đầu (phòng khi BE trả nhiều)
  const sliced = useMemo(() => {
    if (!Array.isArray(items)) return [];
    return items.slice(0, limit);
  }, [items, limit]);

  // Skeleton item cho đẹp
  const Skeleton = () => (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm animate-pulse">
      <div className="aspect-[4/3] w-full rounded-xl bg-gray-100" />
      <div className="mt-3 h-4 w-2/3 rounded bg-gray-100" />
      <div className="mt-2 h-4 w-1/3 rounded bg-gray-100" />
    </div>
  );

  // Retry button
  const Retry = () => (
    <button
      onClick={() => {
        // Triggers useEffect
        setItems([]);
        setError("");
        setLoading(true);
      }}
      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
    >
      Thử lại
    </button>
  );

  // Không render nếu không có productId
  if (!productId) return null;

  // Empty state (khi hết loading & không lỗi & không có items)
  const Empty = () => (
    <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-gray-500">
      Hiện chưa có gợi ý thay thế phù hợp.
    </div>
  );

  return (
    <section className={`alt-products mt-8 ${className}`}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {showCount && !loading && !error && (
          <span className="text-sm text-gray-500">{sliced.length} sản phẩm</span>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <Skeleton key={i} />
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          <span>{error}</span>
          <Retry />
        </div>
      )}

      {/* Data */}
      {!loading && !error && (
        <>
          {sliced.length === 0 ? (
            <Empty />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {sliced.map((p) => {
                // Map ảnh
                const image =
                  p.image ||
                  (Array.isArray(p.images) && p.images[0] && (p.images[0].url || p.images[0])) ||
                  "";

                // Map thông tin giá/HSD từ _expiry (được service gắn sẵn)
                const expiry = p._expiry || {};
                const basePrice = Number(expiry.basePrice || 0) || undefined;
                const finalPrice = Number(expiry.finalPrice || 0) || undefined;
                const discountPercent =
                  Number(expiry.discountPercent || p.discountPercent || 0) || undefined;
                const daysLeft = Number.isFinite(Number(expiry.daysLeft))
                  ? Number(expiry.daysLeft)
                  : undefined;
                const expireAt = expiry.expireAt || p.expireAt || undefined;

                // Badge combo/thùng
                const isCombo = !!p.isCombo;
                const unitType = Array.isArray(p.packagingOptions) && p.packagingOptions.length > 0
                  ? "box"
                  : undefined;

                return (
                  <ProductCard
                    key={p._id}
                    image={image}
                    title={p.name}
                    // Nếu card1 hỗ trợ 2 chế độ: (base/final) hoặc price
                    basePrice={basePrice}
                    finalPrice={finalPrice}
                    discountPercent={discountPercent}
                    daysLeft={daysLeft}
                    expireAt={expireAt}
                    isCombo={isCombo}
                    unitType={unitType}
                    // Fallback: nếu card1 của bạn cần 'price' khi không có base/final
                    price={!basePrice && !finalPrice ? p?.baseVariant?.price : undefined}
                  />
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
