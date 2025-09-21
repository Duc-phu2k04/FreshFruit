// src/components/product/card1.jsx
import React from "react";
import { computeExpiryInfo, fmtDate } from "../../utils/expiryHelpers";

/* =========================================================
 * Helper: chọn giá ưu tiên phía FE (ưu tiên combo/mix → sale → base)
 * Dùng khi có product để tính đúng final/base/discount cho combo.
 * ======================================================= */
function getPreferredPriceFront(p) {
  if (!p || typeof p !== "object") return 0;

  const candidates = [
    p?.combo?.finalPrice,
    p?.combo?.price,
    p?.combo?.fixedPrice,
    p?.mix?.finalPrice,
    p?.mix?.price,
    p?.mix?.unitPrice,
    p?.pricing?.salePrice,
    p?.pricing?.price,
    p?.salePrice,
    p?.price,
    p?.prices?.base,
  ]
    .map((v) => (v == null ? NaN : Number(v)))
    .filter((v) => Number.isFinite(v) && v >= 0);

  return candidates.length ? candidates[0] : 0;
}

/**
 * ProductCard1 – dùng cho lưới sản phẩm (ProductList, bộ sưu tập)
 *
 * Cách dùng 1 (khuyên dùng):
 *   <ProductCard product={product} />
 *    - Tự tính expireAt, daysLeft, discountNearExpiry, finalPrice/basePrice từ helper
 *
 * Cách dùng 2 (giữ tương thích cũ):
 *   <ProductCard image title price basePrice finalPrice discountPercent daysLeft expireAt />
 */
const ProductCard = ({
  product,          // optional: object sản phẩm đầy đủ -> helper sẽ tính
  image,
  title,
  price,            // fallback khi chưa truyền basePrice/finalPrice
  basePrice,
  finalPrice,
  discountPercent,
  daysLeft,
  expireAt,
}) => {
  // Ảnh: ưu tiên images[0] ({url} hoặc string), fallback image prop
  const rawImg =
    product?.images?.[0]?.url ||
    product?.images?.[0] ||
    product?.image ||
    image ||
    "";

  const isAbsolute =
    typeof rawImg === "string" &&
    (rawImg.startsWith("http://") || rawImg.startsWith("https://"));

  const imgSrc = isAbsolute ? rawImg : `http://localhost:3000${rawImg}`;

  const displayTitle = product?.name || product?.title || title || "";

  // Nhận biết combo để hiển thị badge
  const isCombo =
    !!product?.combo || product?.type === "combo" || product?.category === "combo";

  // Nếu có product → tính theo helper + giá ưu tiên; nếu không → dùng props cũ
  let cExpireAt, cDaysLeft, cDiscountPercent, cFinalPrice, cBasePrice;

  if (product) {
    const preferred = getPreferredPriceFront(product);
    const info = computeExpiryInfo(product, preferred) || {};
    cExpireAt = info.expireAt;
    cDaysLeft = info.daysLeft;
    cDiscountPercent = info.discountPercent;
    cFinalPrice = info.finalPrice;
    cBasePrice = info.basePrice;
  } else {
    cExpireAt = expireAt;
    cDaysLeft = daysLeft;
    cDiscountPercent = discountPercent;
    cFinalPrice = finalPrice;
    cBasePrice = basePrice;
  }

  const hasComputedPrice =
    Number.isFinite(cBasePrice) && Number.isFinite(cFinalPrice) && cBasePrice > 0;

  const showDiscount =
    hasComputedPrice && cFinalPrice < cBasePrice && (cDiscountPercent ?? 0) > 0;

  // Fallback hiển thị: nếu không có computed final → dùng prop price
  const displayFinal = hasComputedPrice
    ? `${Number(cFinalPrice).toLocaleString()}đ`
    : (price ?? "");

  const displayBase = hasComputedPrice ? `${Number(cBasePrice).toLocaleString()}đ` : null;

  const showDaysLeft = Number.isFinite(cDaysLeft) && cDaysLeft >= 0;

  // Subtitle nhẹ cho combo (không thêm prop mới, tự suy ra từ product)
  const comboSubtitle =
    isCombo
      ? product?.combo?.label ||
        product?.combo?.name ||
        product?.subtitle ||
        "Combo ưu đãi"
      : null;

  return (
    <div className="relative bg-[#f5f7fd] rounded-xl shadow-md text-center ml-[10px] overflow-hidden">
      {/* Badges */}
      <div className="absolute top-2 left-2 flex flex-col gap-2 z-10">
        {showDiscount && (
          <span className="bg-red-600 text-white text-xs font-semibold px-2 py-1 rounded">
            -{cDiscountPercent}%
          </span>
        )}
        {isCombo && (
          <span className="bg-emerald-600 text-white text-[10px] font-semibold px-2 py-1 rounded">
            COMBO
          </span>
        )}
      </div>

      {showDaysLeft && (
        <div className="absolute top-2 right-2 z-10">
          <span className="bg-yellow-500 text-white text-xs font-semibold px-2 py-1 rounded">
            Còn {cDaysLeft} ngày
          </span>
        </div>
      )}

      {/* Ảnh */}
      <img
        src={imgSrc}
        alt={displayTitle}
        className="rounded-lg w-full h-80 object-cover mb-4"
        loading="lazy"
      />

      {/* Tiêu đề */}
      <h3 className="text-[18px] font-medium mb-1 px-3 line-clamp-2">
        {displayTitle}
      </h3>

      {/* Subtitle combo (nếu có) */}
      {comboSubtitle && (
        <div className="text-[12px] text-emerald-700 mb-1 px-3 line-clamp-1">
          {comboSubtitle}
        </div>
      )}

      {/* HSD */}
      {cExpireAt && (
        <div className="text-xs text-gray-500 mb-1">
          HSD: {fmtDate(cExpireAt)}
        </div>
      )}

      {/* Giá */}
      <div className="mb-2">
        <span className="text-[#025492] font-bold text-[20px]">
          {displayFinal}
        </span>
        {showDiscount && (
          <span className="text-gray-400 line-through text-sm ml-2">
            {displayBase}
          </span>
        )}
      </div>

      {/* Rating (placeholder) */}
      <div className="text-yellow-400 text-lg pb-3">
        {"★".repeat(5)}
      </div>
    </div>
  );
};

export default ProductCard;
