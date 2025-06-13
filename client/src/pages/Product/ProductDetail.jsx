import React from "react";
import { useParams } from "react-router-dom";

// Dữ liệu mẫu, thực tế nên lấy từ API hoặc props
const sampleProducts = [
  {
    id: "1",
    name: "Táo Mỹ",
    image: "https://via.placeholder.com/300x200?text=Táo+Mỹ",
    price: 50000,
    description: "Táo Mỹ tươi ngon, nhập khẩu chính ngạch.",
    quantity: 100,
  },
  {
    id: "2",
    name: "Cam Úc",
    image: "https://via.placeholder.com/300x200?text=Cam+Úc",
    price: 70000,
    description: "Cam Úc mọng nước, vị ngọt thanh.",
    quantity: 50,
  },
];

const ProductDetail = () => {
  const { id } = useParams();
  const product = sampleProducts.find((p) => p.id === id);

  if (!product) return <div className="text-center mt-10">Không tìm thấy sản phẩm</div>;

  return (
    <div className="max-w-3xl mx-auto mt-10 p-6 bg-white rounded shadow flex flex-col md:flex-row gap-8">
      <img src={product.image} alt={product.name} className="w-72 h-48 object-cover rounded" />
      <div className="flex-1">
        <h2 className="text-2xl font-bold mb-2">{product.name}</h2>
        <p className="text-xl text-green-600 font-semibold mb-2">{product.price.toLocaleString()} đ</p>
        <p className="mb-4">{product.description}</p>
        <div className="mb-4">Số lượng còn lại: {product.quantity}</div>
        <button className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 font-semibold">
          Mua hàng
        </button>
      </div>
    </div>
  );
};

export default ProductDetail;
