import React from "react";
import { useParams } from "react-router-dom";

// Dữ liệu mẫu, thực tế nên lấy từ API hoặc props
const sampleProducts = [
  {
    id: "1",
    name: "Táo Mỹ",
    image: "https://via.placeholder.com/400x280?text=Táo+Mỹ",
    price: 50000,
    description: "Táo Mỹ tươi ngon, nhập khẩu chính ngạch, giàu vitamin và tốt cho sức khỏe.",
    quantity: 100,
    category: "Trái cây nhập khẩu",
  },
  {
    id: "2",
    name: "Cam Úc",
    image: "https://via.placeholder.com/400x280?text=Cam+Úc",
    price: 70000,
    description: "Cam Úc mọng nước, vị ngọt thanh, bổ sung vitamin C tự nhiên.",
    quantity: 50,
    category: "Trái cây nhập khẩu",
  },
  {
    id: "3",
    name: "Nho Mỹ",
    image: "https://via.placeholder.com/400x280?text=Nho+Mỹ",
    price: 90000,
    description: "Nho Mỹ tươi sạch, vị ngọt đậm, giàu chất chống oxy hóa.",
    quantity: 30,
    category: "Trái cây nhập khẩu",
  },
];

const ProductDetail = () => {
  const { id } = useParams();
  const product = sampleProducts.find((p) => p.id === id);

  // Lọc sản phẩm liên quan (cùng category, khác id)
  const relatedProducts = sampleProducts.filter(
    (p) => p.category === product?.category && p.id !== id
  );

  if (!product)
    return (
      <div className="text-center mt-20 text-xl text-red-500 font-semibold">
        Không tìm thấy sản phẩm
      </div>
    );

  return (
    <div className="max-w-4xl mx-auto mt-10 p-6 bg-white rounded-2xl shadow-xl">
      <div className="flex flex-col md:flex-row gap-10">
        <div className="flex-shrink-0">
          <img
            src={product.image}
            alt={product.name}
            className="w-96 h-64 object-cover rounded-xl border-2 border-gray-200 shadow"
          />
        </div>
        <div className="flex-1 flex flex-col justify-between">
          <div>
            <h2 className="text-3xl font-extrabold mb-2 text-gray-800">{product.name}</h2>
            <div className="text-2xl text-green-600 font-bold mb-4">
              {product.price.toLocaleString()} đ
            </div>
            <p className="mb-4 text-gray-700">{product.description}</p>
            <div className="mb-6 text-gray-500">
              <span className="font-semibold">Số lượng còn lại:</span> {product.quantity}
            </div>
          </div>
          <div className="flex gap-4">
            <button className="bg-blue-600 hover:bg-blue-700 transition text-white px-6 py-2 rounded-lg font-semibold shadow">
              Mua ngay
            </button>
            <button className="bg-orange-500 hover:bg-orange-600 transition text-white px-6 py-2 rounded-lg font-semibold shadow">
              Thêm vào giỏ hàng
            </button>
          </div>
        </div>
      </div>

      {/* Sản phẩm liên quan */}
      {relatedProducts.length > 0 && (
        <div className="mt-12">
          <h3 className="text-xl font-bold mb-4 text-gray-800">Sản phẩm liên quan</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {relatedProducts.map((item) => (
              <div
                key={item.id}
                className="bg-gray-50 rounded-xl p-4 shadow hover:shadow-lg transition flex flex-col items-center"
              >
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-40 h-28 object-cover rounded mb-2"
                />
                <div className="font-semibold text-lg text-gray-700 mb-1">{item.name}</div>
                <div className="text-green-600 font-bold mb-2">
                  {item.price.toLocaleString()} đ
                </div>
                <button
                  className="mt-auto bg-blue-500 hover:bg-blue-600 text-white px-4 py-1 rounded font-medium text-sm"
                  // onClick={() => ...}
                >
                  Xem chi tiết
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductDetail;
