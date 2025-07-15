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

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetch(`http://localhost:3000/api/product/${id}`);
        const data = await res.json();
        setProduct(data);

        const relatedRes = await fetch(`http://localhost:3000/api/product?category=${data.category._id}`);
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
    if (!comment || rating === 0) return;

    try {
      const token = localStorage.getItem("token");

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
      console.error("Lỗi khi gửi đánh giá:", err);
    }
  };

  const addToCartServer = async (product, e) => {
    if (!product || !product._id) {
      alert("Không tìm thấy sản phẩm hợp lệ để thêm vào giỏ.");
      return;
    }

    const img = e?.currentTarget?.closest(".product-actions")?.parentElement?.parentElement?.querySelector("img");
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

      const payload = { productId: product._id, quantity: 1 };

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
    } catch (error) {
      alert("Lỗi: " + error.message);
    }
  };

  const handleBuyNow = async (product, e) => {
    await addToCartServer(product, e);
    navigate("/gio-hang");
  };

  if (!product) return <p className="text-center mt-10">Đang tải dữ liệu sản phẩm...</p>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* Thông báo nổi */}
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
            {product.price.toLocaleString()}đ
          </p>
          <p className="mb-4">{product.description}</p>

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
              <div key={idx} className="bg-gray-100 p-4 rounded shadow-sm">
                <div className="flex justify-between mb-1">
                  <p className="font-semibold">{cmt.user?.username || "Người dùng ẩn danh"}</p>
                  <span className="text-sm text-gray-500">
                    {new Date(cmt.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex mb-2">
                  {[...Array(5)].map((_, i) => (
                    <FaStar
                      key={i}
                      size={16}
                      color={i < cmt.rating ? "#ffc107" : "#e4e5e9"}
                    />
                  ))}
                </div>
                <p>{cmt.comment}</p>
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
                {item.price.toLocaleString()}đ
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
