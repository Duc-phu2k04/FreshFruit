import React from "react";
import { useNavigate } from "react-router-dom"; // ✅ Thêm import này

const ProductCard2 = ({ product }) => {
  const navigate = useNavigate();

  const handleViewDetail = () => {
    navigate(`/san-pham/${product._id}`, { state: product });
  };

  if (!product) {
    return <p className="text-center text-gray-500">Đang tải sản phẩm...</p>;
  }

  const variantData = product.variants?.[0] || {};
  const price = variantData.price ?? 0;

  return (
    <div
      className="flex flex-col bg-[#e7e9ec] rounded-xl shadow p-3 cursor-pointer hover:scale-[1.02] transition"
      onClick={handleViewDetail}
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