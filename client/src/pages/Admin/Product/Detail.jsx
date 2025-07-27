import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "../../../utils/axiosConfig";

export default function ProductDetailAdmin() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await axios.get(`/product/${id}`);
        setProduct(res.data);
      } catch (error) {
        console.error("Lỗi khi lấy sản phẩm:", error);
      }
    };

    fetchProduct();
  }, [id]);

  if (!product) return <p>Đang tải sản phẩm...</p>;

  return (
    <div className="p-4">
      <h2 className="text-2xl font-semibold mb-4">Chi tiết sản phẩm</h2>

      <div className="bg-white p-4 rounded shadow-md">
        <p><strong>Tên:</strong> {product.name}</p>
        <p><strong>Mô tả:</strong> {product.description}</p>
        <p><strong>Danh mục:</strong> {product.category?.name || "Không có"}</p>
        <p><strong>Địa điểm:</strong> {product.location?.name || "Không có"}</p>
        <p><strong>Giá gốc:</strong> {product.baseVariant?.price?.toLocaleString("vi-VN")}₫</p>
<p><strong>Tồn kho gốc:</strong> {product.baseVariant?.stock}</p>


        {product.image && (
          <img
            src={product.image}
            alt={product.name}
            className="w-40 mt-4 rounded"
          />
        )}
      </div>

      {product.variants && product.variants.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xl font-semibold mb-2">Các biến thể</h3>
          <table className="table-auto w-full mt-4 border-collapse border border-gray-300">
  <thead>
    <tr>
      <th className="border px-4 py-2">Phân loại</th>
      <th className="border px-4 py-2">Khối lượng</th>
      <th className="border px-4 py-2">Tình trạng</th>
      <th className="border px-4 py-2">Giá</th>
      <th className="border px-4 py-2">Tồn kho</th>
    </tr>
  </thead>
  <tbody>
    {product.variants.map((variant, index) => (
      <tr key={index}>
        <td className="border px-4 py-2">{variant.attributes?.grade}</td>
        <td className="border px-4 py-2">{variant.attributes?.weight}</td>
        <td className="border px-4 py-2">{variant.attributes?.ripeness}</td>
        <td className="border px-4 py-2">{variant.price?.toLocaleString("vi-VN")}₫</td>
        <td className="border px-4 py-2">{variant.stock}</td>
      </tr>
    ))}
  </tbody>
</table>

        </div>
      )}

      <div className="mt-6">
        <Link
          to="/admin/products"
          className="text-blue-600 hover:underline"
        >
          ← Quay lại danh sách
        </Link>
      </div>
    </div>
  );
}
