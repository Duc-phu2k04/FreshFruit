// src/components/slide/Productslide.jsx
import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/navigation";
import { Pagination, Autoplay, Navigation } from "swiper/modules";
import ProductCard from "../product/card";
import { computeExpiryInfo, fmtDate } from "../../utils/expiryHelpers";

/* ====================== Helpers giá & nhận diện combo ====================== */

// Chuẩn hoá số (nhận cả "120.000đ", "120,000", " 120000 ", v.v.)
function toNumberSafe(v) {
  if (v == null) return NaN;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[^\d.-]/g, ""); // bỏ đ, dấu phẩy, khoảng trắng…
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

// Giá ưu tiên cho combo/mix/sale/base (cover nhiều alias thường gặp)
function getPreferredPriceFront(p) {
  if (!p || typeof p !== "object") return 0;

  const candidatesRaw = [
    // ✅ Các field combo phổ biến nhất
    p?.comboPricing?.fixedPrice,       // ← thường gặp trong admin
    p?.combo?.finalPrice,
    p?.combo?.price,
    p?.combo?.fixedPrice,

    // Alias có thể có
    p?.comboPrice,
    p?.combo_price,
    p?.comboFinal,
    p?.combo_final,
    p?.comboFinalPrice,
    p?.combo_total,                    // tổng giá combo
    p?.combo?.totalPrice,
    p?.combo?.prices?.final,

    // Mix (nếu dữ liệu là mix nhưng UI coi là combo)
    p?.mix?.finalPrice,
    p?.mix?.price,
    p?.mix?.unitPrice,

    // Pricing chung
    p?.pricing?.salePrice,
    p?.pricing?.price,

    // Field phổ thông
    p?.salePrice,
    p?.price,

    // Mảng prices
    p?.prices?.combo,
    p?.prices?.final,
    p?.prices?.base,
  ];

  const candidates = candidatesRaw
    .map(toNumberSafe)
    .filter((n) => Number.isFinite(n) && n > 0);

  return candidates.length ? candidates[0] : 0;
}

// Chỉ true khi thực sự là combo
function isComboProduct(p) {
  if (!p || typeof p !== "object") return false;
  if (p.isCombo === true) return true;

  const type = (p.type || "").toString().toLowerCase();
  const category = (p.category || "").toString().toLowerCase();
  if (type === "combo" || category === "combo") return true;

  // Có object combo và có ít nhất 1 giá hợp lệ
  const anyComboPrice =
    [
      p?.comboPricing?.fixedPrice,
      p?.combo?.finalPrice,
      p?.combo?.price,
      p?.combo?.fixedPrice,
      p?.combo?.totalPrice,
    ]
      .map(toNumberSafe)
      .some((n) => Number.isFinite(n) && n > 0);

  return anyComboPrice;
}

/* ========================================================================== */

const ProductCarousel = () => {
  const [products, setProducts] = useState([]);
  const navigate = useNavigate();

  const fetchProducts = useCallback(async () => {
    try {
      // Loại Coming Soon: preorder=false
      const res = await fetch("http://localhost:3000/api/product?preorder=false");
      if (!res.ok) throw new Error("Lỗi khi lấy danh sách sản phẩm");
      const data = await res.json();

      let productArray = [];
      if (Array.isArray(data)) productArray = data;
      else if (Array.isArray(data.products)) productArray = data.products;
      else if (Array.isArray(data.data)) productArray = data.data;
      else console.error("Dữ liệu trả về không phải mảng!");

      setProducts(productArray);
    } catch (err) {
      console.error("Lỗi khi fetch sản phẩm:", err);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleViewDetail = (product) => {
    navigate(`/san-pham/${product._id}`, { state: product });
  };

  if (!Array.isArray(products) || products.length === 0) {
    return <p className="text-center text-gray-500">Không có sản phẩm để hiển thị.</p>;
  }

  return (
    <div className="w-full mx-auto">
      <Swiper
        spaceBetween={20}
        slidesPerView={1}
        pagination={{ clickable: true }}
        navigation={true}
        autoplay={{ delay: 3000, disableOnInteraction: false }}
        breakpoints={{
          640: { slidesPerView: 2, spaceBetween: 20 },
          1024: { slidesPerView: 3, spaceBetween: 30 },
          1280: { slidesPerView: 4, spaceBetween: 40 },
        }}
        loop={true}
        modules={[Pagination, Autoplay, Navigation]}
        className="mySwiper"
      >
        {products.map((product) => {
          // Ảnh
          const rawImg =
            product?.images?.[0]?.url ||
            product?.images?.[0] ||
            product?.image ||
            "";
          const img =
            typeof rawImg === "string" &&
            (rawImg.startsWith("http://") || rawImg.startsWith("https://"))
              ? rawImg
              : `http://localhost:3000${rawImg}`;

          // ✅ Giá ưu tiên từ DB (đặc biệt combo; xử lý cả chuỗi có ký tự tiền tệ)
          const preferredPrice = getPreferredPriceFront(product);

          // ✅ Tính HSD/giảm giá dựa trên preferredPrice
          const info = computeExpiryInfo(product, preferredPrice) || {};
          const {
            basePrice = 0,
            finalPrice = 0,
            discountPercent = 0,
            daysLeft,
            expireAt,
          } = info;

          // ✅ Hiển thị: nếu finalPrice không hợp lệ → dùng preferredPrice (DB)
          const showFinal =
            Number.isFinite(finalPrice) && finalPrice > 0 ? finalPrice : preferredPrice;
          const showBase =
            Number.isFinite(basePrice) && basePrice > 0 ? basePrice : showFinal;

          // ✅ Chỉ combo mới có badge
          const combo = isComboProduct(product);

          return (
            <SwiperSlide key={product._id} className="pb-12">
              <div
                className="relative cursor-pointer"
                onClick={() => handleViewDetail(product)}
              >
                {/* Badges overlay */}
                {discountPercent > 0 && (
                  <div className="absolute z-10 top-2 left-2 bg-red-600 text-white text-xs font-semibold px-2 py-1 rounded">
                    -{discountPercent}%
                  </div>
                )}
                {Number.isFinite(daysLeft) && (
                  <div className="absolute z-10 top-2 right-2 bg-yellow-500 text-white text-xs font-semibold px-2 py-1 rounded">
                    Còn {daysLeft} ngày
                  </div>
                )}
                {combo && (
                  <div className="absolute z-10 bottom-2 left-2 bg-emerald-600 text-white text-[10px] font-semibold px-2 py-1 rounded">
                    COMBO
                  </div>
                )}

                {/* Card */}
                <ProductCard
                  image={img}
                  title={product.name}
                  price={`${Number(showFinal).toLocaleString()}đ`}
                />

                {/* HSD + giá gạch */}
                <div className="px-2 -mt-10 mb-8">
                  {expireAt && (
                    <div className="text-xs text-gray-500">
                      HSD: {fmtDate(expireAt)}
                    </div>
                  )}
                  {Number(showBase) > Number(showFinal) && (
                    <div className="text-xs text-gray-400 line-through">
                      {Number(showBase).toLocaleString()}đ
                    </div>
                  )}
                </div>
              </div>
            </SwiperSlide>
          );
        })}
      </Swiper>
    </div>
  );
};

export default ProductCarousel;
