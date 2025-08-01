// ✅ ProductDetail.jsx (có hiển thị tồn kho theo biến thể)

import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FaStar } from "react-icons/fa";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState([]);
  const [successMessage, setSuccessMessage] = useState("");

  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [selectedWeight, setSelectedWeight] = useState("");
  const [selectedRipeness, setSelectedRipeness] = useState("");

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetch(`http://localhost:3000/api/product/${id}`);
        const data = await res.json();
        setProduct(data);

        const relatedRes = await fetch(
          `http://localhost:3000/api/product?category=${data.category._id}`
        );
        const related = await relatedRes.json();
        const filtered = related.filter((item) => item._id !== id);
        setRelatedProducts(filtered);
      } catch (err) {
        console.error("Lỗi khi lấy sản phẩm:", err);
      }
    };

    setProduct(null);
    fetchProduct();
    fetchComments();
  }, [id]);

  const fetchComments = async () => {
    try {
      const res = await fetch(`http://localhost:3000/api/review/${id}`);
      const data = await res.json();
      setComments(data);
    } catch (err) {
      console.error("Lỗi khi lấy đánh giá:", err);
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!comment || rating === 0) {
      alert("Vui lòng nhập đánh giá và chọn số sao.");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      alert("Bạn cần đăng nhập để gửi đánh giá.");
      return;
    }

    try {
      const res = await fetch(`http://localhost:3000/api/review/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productId: id,
          rating,
          comment,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Gửi đánh giá thất bại");

      await fetchComments();
      setComment("");
      setRating(0);
    } catch (err) {
      console.error("Lỗi khi gửi đánh giá:", err.message);
      alert("Lỗi: " + err.message);
    }
  };

  const addToCartServer = async (product, e) => {
    if (!product || !product._id) {
      alert("Không tìm thấy sản phẩm hợp lệ để thêm vào giỏ.");
      return;
    }

    if (!selectedQuantity || !selectedWeight || !selectedRipeness) {
      alert("Vui lòng chọn đầy đủ Số lượng, Khối lượng và Tình trạng.");
      return;
    }

    const img =
      e?.currentTarget?.closest(".product-actions")?.parentElement?.parentElement?.querySelector("img");
    if (img) {
      const flyImg = img.cloneNode(true);
      const rect = img.getBoundingClientRect();
      const targetX = window.innerWidth - 80;
      const targetY = 20;

      flyImg.style.position = "fixed";
      flyImg.style.left = `${rect.left}px`;
      flyImg.style.top = `${rect.top}px`;
      flyImg.style.width = `${rect.width}px`;
      flyImg.style.height = `${rect.height}px`;
      flyImg.style.zIndex = 9999;
      flyImg.style.transition = "all 0.8s ease-in-out";
      flyImg.style.borderRadius = "12px";

      document.body.appendChild(flyImg);

      requestAnimationFrame(() => {
        flyImg.style.left = `${targetX}px`;
        flyImg.style.top = `${targetY}px`;
        flyImg.style.width = "20px";
        flyImg.style.height = "20px";
        flyImg.style.opacity = "0.3";
      });

      setTimeout(() => flyImg.remove(), 900);
    }

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        alert("Bạn cần đăng nhập để thêm vào giỏ hàng.");
        return;
      }

      const payload = {
        productId: product._id,
        quantity: parseInt(selectedQuantity),
        weight: selectedWeight,
        ripeness: selectedRipeness,
      };

      const res = await fetch("http://localhost:3000/api/cart/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Lỗi khi thêm vào giỏ hàng");

      setSuccessMessage("Đã thêm vào giỏ hàng ✔️");
      setTimeout(() => setSuccessMessage(""), 2500);

      setSelectedWeight("");
      setSelectedQuantity(1);
      setSelectedRipeness("");
    } catch (error) {
      alert("Lỗi: " + error.message);
    }
  };

  const handleBuyNow = async (product, e) => {
    if (!selectedQuantity || !selectedWeight || !selectedRipeness) {
      alert("Vui lòng chọn đầy đủ Số lượng, Khối lượng và Tình trạng.");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      alert("Bạn cần đăng nhập để mua sản phẩm.");
      return;
    }

    const cartData = {
      products: [
        {
          _id: product._id,
          nameProduct: product.name,
          quantity: parseInt(selectedQuantity),
          price: product.price,
          weight: selectedWeight,
          ripeness: selectedRipeness,
        },
      ],
      sumPrice: product.price * parseInt(selectedQuantity),
    };

    navigate("/checkout", { state: { cartData } });
  };

  if (!product)
    return <p className="text-center mt-10">Đang tải dữ liệu sản phẩm...</p>;

  // ✅ Tìm biến thể phù hợp với lựa chọn để hiển thị tồn kho
  const selectedVariant = product.variants?.find(
    (v) => v.weight === selectedWeight && v.ripeness === selectedRipeness
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {successMessage && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-green-600 text-white px-6 py-2 rounded-full shadow-lg">
          {successMessage}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-8 bg-white p-6 rounded shadow">
        <img src={product.image} alt={product.name} className="w-full rounded-lg shadow" />
        <div>
          <h1 className="text-4xl font-bold mb-3">{product.name}</h1>
          <p className="text-green-700 text-2xl font-semibold mb-4">
            {product.price ? `${product.price.toLocaleString()}đ` : "Giá: Đang cập nhật"}
          </p>
          <p className="mb-4">{product.description}</p>

          {/* ✅ Hiển thị tồn kho */}
          <p className="mb-2 text-sm text-gray-600">
            Tồn kho: {selectedVariant?.inventory ?? product.inventory ?? "Đang cập nhật"}
          </p>

          <div className="mb-4">
            <label className="block font-medium mb-1">Khối lượng:</label>
            <select
              value={selectedWeight}
              onChange={(e) => setSelectedWeight(e.target.value)}
              className="border rounded px-3 py-2 w-full"
            >
              <option value="">-- Chọn khối lượng --</option>
              {product.weightOptions?.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="block font-medium mb-1">Số lượng:</label>
            <input
              type="number"
              min={1}
              value={selectedQuantity}
              onChange={(e) => setSelectedQuantity(e.target.value)}
              className="border rounded px-3 py-2 w-full"
              placeholder="Nhập số lượng"
            />
          </div>

          <div className="mb-4">
            <label className="block font-medium mb-1">Tình trạng:</label>
            <select
              value={selectedRipeness}
              onChange={(e) => setSelectedRipeness(e.target.value)}
              className="border rounded px-3 py-2 w-full"
            >
              <option value="">-- Chọn tình trạng --</option>
              <option value="Xanh">Xanh</option>
              <option value="Chín vừa">Chín vừa</option>
              <option value="Chín">Chín</option>
            </select>
          </div>

          <div className="flex gap-3 mb-4 product-actions">
            <button
              className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600"
              onClick={(e) => addToCartServer(product, e)}
            >
              Thêm vào giỏ
            </button>
            <button
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
              onClick={(e) => handleBuyNow(product, e)}
            >
              Mua ngay
            </button>
          </div>

          <div className="mb-6">
            <h3 className="font-semibold mb-2">Đánh giá sản phẩm:</h3>
            <div className="flex">
              {[...Array(5)].map((_, i) => {
                const current = i + 1;
                return (
                  <FaStar
                    key={current}
                    size={28}
                    color={current <= (hover || rating) ? "#ffc107" : "#e4e5e9"}
                    onClick={() => setRating(current)}
                    onMouseEnter={() => setHover(current)}
                    onMouseLeave={() => setHover(0)}
                    className="cursor-pointer"
                  />
                );
              })}
            </div>
          </div>

          <form onSubmit={handleSubmitComment}>
            <textarea
              placeholder="Nội dung đánh giá"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full p-3 border rounded"
              rows={4}
            ></textarea>
            <button
              type="submit"
              className="mt-3 bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700"
            >
              Gửi đánh giá
            </button>
          </form>
        </div>
      </div>

      <div className="mt-10">
        <h3 className="text-2xl font-semibold mb-4">Đánh giá của khách hàng:</h3>
        {comments.length === 0 ? (
          <p className="text-gray-500">Chưa có đánh giá nào.</p>
        ) : (
          <div className="space-y-6">
            {comments.map((cmt, idx) => (
              <div
                key={idx}
                className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition duration-300"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-full bg-blue-600 text-white flex items-center justify-center text-lg font-bold shadow-sm">
                      {cmt.user?.username?.charAt(0).toUpperCase() || "?"}
                    </div>
                    <div>
                      <p className="text-base font-semibold">
                        {cmt.user?.username || "Người dùng ẩn danh"}
                      </p>
                      <p className="text-sm text-gray-400">
                        {new Date(cmt.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <FaStar
                        key={i}
                        size={18}
                        color={i < cmt.rating ? "#facc15" : "#e5e7eb"}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-gray-700 leading-relaxed">{cmt.comment}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-12">
        <h3 className="text-2xl font-semibold mb-4">Sản phẩm liên quan:</h3>
        <div className="grid md:grid-cols-4 gap-6">
          {relatedProducts.map((item) => (
            <div
              key={item._id}
              className="border rounded p-4 cursor-pointer hover:shadow"
              onClick={() => navigate(`/san-pham/${item._id}`)}
            >
              <img src={item.image} alt={item.name} className="w-full h-40 object-cover rounded" />
              <h4 className="mt-2 font-semibold text-lg">{item.name}</h4>
              <p className="text-green-700 font-semibold">
                {item.price ? `${item.price.toLocaleString()}đ` : "Giá: Đang cập nhật"}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
