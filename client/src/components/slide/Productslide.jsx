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

const ProductCarousel = () => {
  const [products, setProducts] = useState([]);
  const navigate = useNavigate();

  const fetchProducts = useCallback(async () => {
    try {
      // Loại sản phẩm Coming Soon khỏi slider: preorder=false
      const res = await fetch("http://localhost:3000/api/product?preorder=false");
      if (!res.ok) throw new Error("Lỗi khi lấy danh sách sản phẩm");
      const data = await res.json();

      let productArray = [];
      if (Array.isArray(data)) productArray = data;
      else if (Array.isArray(data.products)) productArray = data.products;
      else if (Array.isArray(data.data)) productArray = data.data;
      else console.error(" Dữ liệu trả về không phải mảng!");

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
        autoplay={{
          delay: 3000,
          disableOnInteraction: false,
        }}
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
          // Ảnh: ưu tiên images[0] (có thể là {url} hoặc string), fallback product.image
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

          // Thông tin HSD/giảm giá từ helper mới
          const { basePrice, finalPrice, discountPercent, daysLeft, expireAt } =
            computeExpiryInfo(product);

          return (
            <SwiperSlide key={product._id} className="pb-12">
              <div
                className="relative cursor-pointer"
                onClick={() => handleViewDetail(product)}
              >
                {/* Badges overlay trên ảnh */}
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

                {/* Card chính */}
                <ProductCard
                  image={img}
                  title={product.name}
                  // Hiển thị giá sau giảm (nếu cận hạn). Old price sẽ hiển thị phía dưới.
                  price={`${finalPrice.toLocaleString()}đ`}
                />

                {/* HSD + giá gạch nếu có giảm */}
                <div className="px-2 -mt-10 mb-8">
                  {expireAt && (
                    <div className="text-xs text-gray-500">
                      HSD: {fmtDate(expireAt)}
                    </div>
                  )}
                  {finalPrice !== basePrice && (
                    <div className="text-xs text-gray-400 line-through">
                      {basePrice.toLocaleString()}đ
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
