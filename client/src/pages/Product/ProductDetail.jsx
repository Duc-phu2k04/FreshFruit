import React, { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { FaStar } from "react-icons/fa";

export default function ProductDetail() {
  const { id } = useParams();
  const location = useLocation();

  const [product, setProduct] = useState(location.state || null);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState([]);

  // Lấy chi tiết sản phẩm
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetch(`http://localhost:3000/api/product/${id}`);
        const data = await res.json();
        setProduct(data);
      } catch (err) {
        console.error("Lỗi khi lấy chi tiết sản phẩm:", err);
      }
    };

    if (!product) fetchProduct();
  }, [id, product]);

  // Lấy đánh giá
  const fetchComments = async () => {
    try {
      const res = await fetch(`http://localhost:3000/api/review/${id}`);
      const data = await res.json();
      setComments(data);
    } catch (err) {
      console.error("Lỗi khi lấy đánh giá:", err);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [id]);

  // Gửi đánh giá
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
      console.log("Kết quả gửi đánh giá:", result);

      if (!res.ok) throw new Error(result.message || "Gửi đánh giá thất bại");

      await fetchComments();

      setComment("");
      setRating(0);
    } catch (err) {
      console.error("Lỗi khi gửi đánh giá:", err);
    }
  };

  if (!product) return <p className="text-center mt-10">Đang tải dữ liệu sản phẩm...</p>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 bg-white rounded shadow-lg mt-6">
      <div className="grid md:grid-cols-2 gap-8">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-auto object-cover rounded-lg shadow-md"
        />

        <div>
          <h1 className="text-4xl font-bold mb-3">{product.name}</h1>
          <p className="text-green-700 text-2xl font-semibold mb-4">
            {product.price.toLocaleString()}đ
          </p>
          <p className="text-gray-700 mb-6 leading-relaxed">
            {product.description || "Không có mô tả cho sản phẩm này."}
          </p>

          {/* Đánh giá sao */}
          <div className="mb-6">
            <h3 className="font-semibold text-lg mb-1">Đánh giá sản phẩm:</h3>
            <div className="flex">
              {[...Array(5)].map((_, index) => {
                const current = index + 1;
                return (
                  <FaStar
                    key={current}
                    size={28}
                    className="cursor-pointer transition-transform transform hover:scale-110"
                    color={current <= (hover || rating) ? "#ffc107" : "#e4e5e9"}
                    onClick={() => setRating(current)}
                    onMouseEnter={() => setHover(current)}
                    onMouseLeave={() => setHover(0)}
                  />
                );
              })}
            </div>
          </div>

          {/* Form đánh giá */}
          <form onSubmit={handleSubmitComment}>
            <h3 className="font-semibold text-lg mb-2">Viết đánh giá:</h3>
            <textarea
              placeholder="Nội dung đánh giá"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              rows={4}
            ></textarea>
            <button
              type="submit"
              className="mt-3 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition"
            >
              Gửi đánh giá
            </button>
          </form>
        </div>
      </div>

      {/* Hiển thị đánh giá */}
      <div className="mt-10">
        <h3 className="text-2xl font-semibold mb-4">Đánh giá của khách hàng:</h3>
        {comments.length === 0 ? (
          <p className="text-gray-500">Chưa có đánh giá nào.</p>
        ) : (
          <div className="space-y-6">
            {comments.map((cmt, idx) => (
              <div key={idx} className="bg-gray-100 p-4 rounded-lg shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-gray-800">
                    {cmt.user?.username || "Người dùng ẩn danh"}
                  </p>
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
                <p className="text-gray-700">{cmt.comment}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
