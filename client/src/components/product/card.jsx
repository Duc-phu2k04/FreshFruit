// src/components/product/card1.jsx
import React from "react";
import { computeExpiryInfo, fmtDate } from "../../utils/expiryHelpers";

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
  // Lấy dữ liệu hiển thị cơ bản (ưu tiên từ product nếu có)
  const imgSrc =
    product?.images?.[0]?.url ||
    product?.images?.[0] ||
    product?.image ||
    image;

  const displayTitle =
    product?.name || product?.title || title || "";

  // Tính toán HSD/giá theo helper nếu có product, nếu không dùng props cũ
  const {
    expireAt: cExpireAt,
    daysLeft: cDaysLeft,
    discountPercent: cDiscountPercent,
    finalPrice: cFinalPrice,
    basePrice: cBasePrice,
  } = product ? computeExpiryInfo(product) : {
    expireAt,
    daysLeft,
    discountPercent,
    finalPrice,
    basePrice,
  };

  const hasComputedPrice =
    typeof cBasePrice === "number" && typeof cFinalPrice === "number" && cBasePrice > 0;

  const showDiscount =
    hasComputedPrice && cFinalPrice < cBasePrice && (cDiscountPercent ?? 0) > 0;

  const displayFinal = hasComputedPrice
    ? `${cFinalPrice.toLocaleString()}đ`
    : (price ?? "");

  const displayBase = hasComputedPrice ? `${cBasePrice.toLocaleString()}đ` : null;

  const showDaysLeft = Number.isFinite(cDaysLeft) && cDaysLeft >= 0;

  return (
    <div className="relative bg-[#f5f7fd] rounded-xl shadow-md text-center ml-[10px] overflow-hidden">
      {/* Badges */}
      <div className="absolute top-2 left-2 flex flex-col gap-2 z-10">
        {showDiscount && (
          <span className="bg-red-600 text-white text-xs font-semibold px-2 py-1 rounded">
            -{cDiscountPercent}%
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
      />

      {/* Tiêu đề */}
      <h3 className="text-[18px] font-medium mb-1 px-3 line-clamp-2">
        {displayTitle}
      </h3>

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
