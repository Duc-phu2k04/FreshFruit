// src/components/product/ProductCard2.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { computeExpiryInfo, fmtDate } from "../../utils/expiryHelpers";

const ProductCard2 = ({ product }) => {
  const navigate = useNavigate();

  const handleViewDetail = () => {
    navigate(`/san-pham/${product._id}`, { state: product });
  };

  if (!product) {
    return <p className="text-center text-gray-500">Đang tải sản phẩm...</p>;
  }

  // Ảnh: ưu tiên mảng images, sau đó field image (tự nối host nếu cần)
  const rawImg =
    product?.images?.[0]?.url ||
    product?.images?.[0] ||
    product?.image ||
    "";
  const imgSrc =
    typeof rawImg === "string" && (rawImg.startsWith("http://") || rawImg.startsWith("https://"))
      ? rawImg
      : `http://localhost:3000${rawImg}`;

  // Lấy info HSD/giá: ưu tiên _expiry từ BE, nếu không có thì compute từ helper
  const exp = product._expiry ?? computeExpiryInfo(product);
  const basePrice = Number(exp?.basePrice ?? 0);
  const finalPrice = Number(exp?.finalPrice ?? basePrice);
  const discountPercent = Number(exp?.discountPercent ?? 0);
  const daysLeft = exp?.daysLeft;
  const expireAt = exp?.expireAt;

  const showDiscount = discountPercent > 0 && finalPrice < basePrice;
  const showDaysLeft = Number.isFinite(daysLeft) && daysLeft >= 0;

  return (
    <div
      className="relative flex flex-col bg-[#e7e9ec] rounded-xl shadow p-3 cursor-pointer hover:scale-[1.02] transition"
      onClick={handleViewDetail}
    >
      {/* Badges */}
      {showDiscount && (
        <span className="absolute top-2 left-2 bg-red-600 text-white text-xs font-semibold px-2 py-1 rounded">
          -{discountPercent}%
        </span>
      )}
      {showDaysLeft && (
        <span className="absolute top-2 right-2 bg-yellow-500 text-white text-xs font-semibold px-2 py-1 rounded">
          Còn {daysLeft} ngày
        </span>
      )}

      {/* Ảnh */}
      <img
        src={imgSrc}
        alt={product.name}
        className="w-full h-40 rounded-lg object-cover border-2 border-green-600"
      />

      {/* Nội dung */}
      <div className="flex flex-col items-start mt-2">
        <h3 className="text-base sm:text-lg font-semibold mb-1 line-clamp-2">
          {product.name}
        </h3>

        {/* HSD */}
        {expireAt && (
          <p className="text-xs text-gray-500 mb-1">HSD: {fmtDate(expireAt)}</p>
        )}

        {/* Giá */}
        <div className="mb-2">
          <span className="text-green-700 font-bold text-lg sm:text-xl">
            {finalPrice.toLocaleString()}đ
          </span>
          {showDiscount && (
            <span className="text-gray-500 line-through text-sm ml-2">
              {basePrice.toLocaleString()}đ
            </span>
          )}
        </div>

        {/* Nút mua */}
        <button
          className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-3 py-1.5 rounded-full text-sm"
          onClick={(e) => {
            e.stopPropagation();
            handleViewDetail();
          }}
        >
          Mua Ngay
        </button>
      </div>
    </div>
  );
};

export default ProductCard2;
