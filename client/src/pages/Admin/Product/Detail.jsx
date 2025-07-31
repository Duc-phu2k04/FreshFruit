import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axiosInstance from "../../../utils/axiosConfig";

export default function Detail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProduct();
  }, [id]);

  const fetchProduct = async () => {
    try {
      const res = await axiosInstance.get(`/product/${id}`);
      setProduct(res.data);
    } catch (err) {
      console.error("Lỗi khi lấy sản phẩm:", err);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Cập nhật thông tin chung sản phẩm
  const handleSaveGeneral = async () => {
    try {
      await axiosInstance.put(`/product/${id}`, {
        name: product.name,
        description: product.description,
        image: product.image
      });
      alert("✅ Cập nhật thông tin sản phẩm thành công");
      fetchProduct();
    } catch (err) {
      console.error("Lỗi cập nhật thông tin chung:", err);
      alert("❌ Lỗi khi cập nhật thông tin sản phẩm");
    }
  };

  // ✅ Cập nhật BaseVariant hoặc Variant
  const handleSaveVariant = async (variantId, updatedData) => {
    try {
      if (updatedData.isBase) {
        await axiosInstance.put(`/product/${id}`, {
          baseVariant: {
            ...product.baseVariant,
            price: updatedData.price,
            stock: updatedData.stock
          }
        });
      } else {
        await axiosInstance.put(`/product/${id}/variant/${variantId}`, updatedData);
      }
      alert("✅ Cập nhật thành công");
      fetchProduct();
    } catch (err) {
      console.error("Lỗi cập nhật:", err);
      alert("❌ Lỗi khi cập nhật");
    }
  };

  // ✅ Xóa BaseVariant
  const handleDeleteBaseVariant = async () => {
    if (!window.confirm("Bạn có chắc muốn xóa BaseVariant này?")) return;
    try {
      await axiosInstance.put(`/product/${id}`, { baseVariant: null });
      alert("🗑️ Xóa BaseVariant thành công");
      fetchProduct();
    } catch (err) {
      console.error("Lỗi xóa BaseVariant:", err);
      alert("❌ Lỗi khi xóa BaseVariant");
    }
  };

  // ✅ Xóa Variant
  const handleDeleteVariant = async (variantId) => {
    if (!window.confirm("Bạn có chắc muốn xóa biến thể này?")) return;
    try {
      await axiosInstance.delete(`/product/${id}/variant/${variantId}`);
      alert("🗑️ Xóa biến thể thành công");
      fetchProduct();
    } catch (err) {
      console.error("Lỗi xóa biến thể:", err);
      alert("❌ Lỗi khi xóa biến thể");
    }
  };

  if (loading) return <p>Đang tải...</p>;
  if (!product) return <p>Không tìm thấy sản phẩm</p>;

  return (
    <div className="max-w-5xl mx-auto p-6 bg-white shadow rounded-lg">
      {/* Nút quay lại */}
      <button
        onClick={() => navigate(-1)}
        className="mb-4 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
      >
        ⬅ Quay lại
      </button>

      {/* Form thông tin chung */}
      <h2 className="text-xl font-bold mb-2">Thông tin chung</h2>
      <div className="space-y-2 mb-4">
        <input
          type="text"
          value={product.name}
          onChange={(e) => setProduct({ ...product, name: e.target.value })}
          className="border px-3 py-1 w-full"
          placeholder="Tên sản phẩm"
        />
        <textarea
          value={product.description}
          onChange={(e) => setProduct({ ...product, description: e.target.value })}
          className="border px-3 py-1 w-full"
          placeholder="Mô tả sản phẩm"
        />
        <input
          type="text"
          value={product.image}
          onChange={(e) => setProduct({ ...product, image: e.target.value })}
          className="border px-3 py-1 w-full"
          placeholder="URL ảnh"
        />
        <button
          onClick={handleSaveGeneral}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          💾 Lưu thông tin chung
        </button>
      </div>

      {/* Base Variant */}
      {product.baseVariant && (
        <>
          <h2 className="text-xl font-semibold mt-6 mb-2">Base Variant</h2>
          <div className="border p-4 rounded mb-4 flex items-center space-x-4">
            <span>{product.baseVariant.attributes.weight} - {product.baseVariant.attributes.ripeness}</span>
            <input
              type="number"
              min={0}
              value={product.baseVariant.price}
              onChange={(e) =>
                setProduct({
                  ...product,
                  baseVariant: {
                    ...product.baseVariant,
                    price: Number(e.target.value)
                  }
                })
              }
              className="border px-2 py-1 w-24"
            />
            <input
              type="number"
              min={0}
              value={product.baseVariant.stock}
              onChange={(e) =>
                setProduct({
                  ...product,
                  baseVariant: {
                    ...product.baseVariant,
                    stock: Number(e.target.value)
                  }
                })
              }
              className="border px-2 py-1 w-20"
            />
            <button
              className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
              onClick={() =>
                handleSaveVariant(null, {
                  price: product.baseVariant.price,
                  stock: product.baseVariant.stock,
                  isBase: true
                })
              }
            >
              Lưu
            </button>
            <button
              className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
              onClick={handleDeleteBaseVariant}
            >
              Xóa
            </button>
          </div>
        </>
      )}

      {/* Variants */}
      <h2 className="text-xl font-semibold mt-6 mb-2">Danh sách biến thể</h2>
      <table className="w-full border">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2">Khối lượng</th>
            <th className="border p-2">Tình trạng</th>
            <th className="border p-2">Giá</th>
            <th className="border p-2">Tồn kho</th>
            <th className="border p-2">Hành động</th>
          </tr>
        </thead>
        <tbody>
          {product.variants.map((v) => (
            <tr key={v._id}>
              <td className="border p-2">{v.attributes.weight}</td>
              <td className="border p-2">{v.attributes.ripeness}</td>
              <td className="border p-2">
                <input
                  type="number"
                  min={0}
                  value={v.price}
                  onChange={(e) =>
                    setProduct((prev) => ({
                      ...prev,
                      variants: prev.variants.map((item) =>
                        item._id === v._id
                          ? { ...item, price: Number(e.target.value) }
                          : item
                      )
                    }))
                  }
                  className="border px-2 py-1 w-24"
                />
              </td>
              <td className="border p-2">
                <input
                  type="number"
                  min={0}
                  value={v.stock}
                  onChange={(e) =>
                    setProduct((prev) => ({
                      ...prev,
                      variants: prev.variants.map((item) =>
                        item._id === v._id
                          ? { ...item, stock: Number(e.target.value) }
                          : item
                      )
                    }))
                  }
                  className="border px-2 py-1 w-20"
                />
              </td>
              <td className="border p-2 space-x-2">
                <button
                  className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
                  onClick={() =>
                    handleSaveVariant(v._id, { price: v.price, stock: v.stock })
                  }
                >
                  Lưu
                </button>
                <button
                  className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                  onClick={() => handleDeleteVariant(v._id)}
                >
                  Xóa
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
