import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/navigation";
import { Pagination, Autoplay, Navigation } from "swiper/modules";
import ProductCard from "../product/card";

const ProductCarousel = () => {
  const [products, setProducts] = useState([]);
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
          640: {
            slidesPerView: 2,
            spaceBetween: 20,
          },
          1024: {
            slidesPerView: 3,
            spaceBetween: 30,
          },
          1280: {
            slidesPerView: 4,
            spaceBetween: 40,
          },
        }}
        loop={true}
        modules={[Pagination, Autoplay, Navigation]}
        className="mySwiper"
      >
        {products.map((product) => {
          const variantData = product.variants?.[0] || {};
          const price = variantData.price ?? 0;

          return (
            <SwiperSlide key={product._id} className="pb-12">
              <div
                className="cursor-pointer"
                onClick={() => handleViewDetail(product)}
              >
                <ProductCard
                  image={`http://localhost:3000${product.image}`}
                  title={product.name}
                  price={`${price.toLocaleString()}đ`}
                />
              </div>
            </SwiperSlide>
          );
        })}
      </Swiper>
    </div>
  );
};

export default ProductCarousel;
