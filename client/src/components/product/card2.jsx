import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Navigation } from "swiper/modules";

import "swiper/css";
import "swiper/css/navigation";

const ProductCard2 = () => {
  const [latestProducts, setLatestProducts] = useState([]);
  const navigate = useNavigate();

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch("http://localhost:3000/api/product");
      if (!res.ok) throw new Error("Lỗi khi lấy danh sách sản phẩm");
      const data = await res.json();

      let productArray = [];
      if (Array.isArray(data)) {
        productArray = data;
      } else if (Array.isArray(data.products)) {
        productArray = data.products;
      } else if (Array.isArray(data.data)) {
        productArray = data.data;
      } else {
        console.error("❌ Dữ liệu trả về không phải mảng!");
      }

      // ✅ lấy 4 sản phẩm mới nhất
      const latest = [...new Map(productArray.map(p => [p._id, p])).values()]
        .slice(-4)
        .reverse();

      setLatestProducts(latest);
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

  if (!latestProducts.length) {
    return <p className="text-center text-gray-500">Đang tải sản phẩm...</p>;
  }

  return (
    <div className="relative w-full max-w-sm mx-auto">
      <Swiper
        direction="vertical"
        slidesPerView={1}
        loop={true}
        autoplay={{ delay: 2500, disableOnInteraction: false }}
        navigation={{
          nextEl: ".swiper-button-next-custom",
          prevEl: ".swiper-button-prev-custom",
        }}
        modules={[Autoplay, Navigation]}
        className="h-[300px]"
      >
        {latestProducts.map((product) => {
          const variantData = product.variants?.[0] || {};
          const price = variantData.price ?? 0;

          return (
            <SwiperSlide key={product._id}>
              <div
                className="flex flex-col bg-[#e7e9ec] rounded-xl shadow p-3 cursor-pointer hover:scale-[1.02] transition"
                onClick={() => handleViewDetail(product)}
              >
                <img
                  src={`http://localhost:3000${product.image}`}
                  alt={product.name}
                  className="w-full h-40 rounded-lg object-cover border-2 border-green-600"
                />
                <div className="flex flex-col items-start mt-2">
                  <h3 className="text-base sm:text-lg font-semibold mb-1 line-clamp-2">
                    {product.name}
                  </h3>
                  <p className="text-green-700 font-bold text-lg sm:text-xl mb-2">
                    {price.toLocaleString()}đ
                  </p>
                  <button
                    className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-3 py-1.5 rounded-full text-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewDetail(product);
                    }}
                  >
                    Mua Ngay
                  </button>
                </div>
              </div>
            </SwiperSlide>
          );
        })}
      </Swiper>

      {/* Nút điều hướng custom */}
      <div className="swiper-button-prev-custom absolute left-1/2 -translate-x-1/2 top-2 z-10 cursor-pointer bg-gray-800 text-white px-2 py-1 rounded-full text-xs">
        ↑
      </div>
      <div className="swiper-button-next-custom absolute left-1/2 -translate-x-1/2 bottom-2 z-10 cursor-pointer bg-gray-800 text-white px-2 py-1 rounded-full text-xs">
        ↓
      </div>
    </div>
  );
};

export default ProductCard2;
