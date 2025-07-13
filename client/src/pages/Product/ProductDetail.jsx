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
  const [userName, setUserName] = useState("");
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

  // Lấy bình luận từ server
  useEffect(() => {
    const fetchComments = async () => {
      try {
        const res = await fetch(`http://localhost:3000/api/product/${id}/comments`);
        const data = await res.json();
        setComments(data);
      } catch (err) {
        console.error("Lỗi khi lấy bình luận:", err);
      }
    };

    fetchComments();
  }, [id]);

  // Gửi bình luận
  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!userName || !comment) return;

    const newComment = {
      name: userName,
      text: comment,
      rating,
      date: new Date().toISOString(),
    };

    try {
      const res = await fetch(`http://localhost:3000/api/product/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newComment),
      });

      if (!res.ok) throw new Error("Gửi bình luận thất bại");

      const savedComment = await res.json();
      setComments([savedComment, ...comments]);
      setComment("");
      setUserName("");
      setRating(0);
    } catch (err) {
      console.error("Lỗi khi gửi bình luận:", err);
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

          {/* Form bình luận */}
          <form onSubmit={handleSubmitComment}>
            <h3 className="font-semibold text-lg mb-2">Viết bình luận:</h3>
            <input
              type="text"
              placeholder="Tên của bạn"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full mb-3 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <textarea
              placeholder="Nội dung bình luận"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              rows={4}
            ></textarea>
            <button
              type="submit"
              className="mt-3 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition"
            >
              Gửi bình luận
            </button>
          </form>
        </div>
      </div>

      {/* Hiển thị bình luận */}
      <div className="mt-10">
        <h3 className="text-2xl font-semibold mb-4">Bình luận của khách hàng:</h3>
        {comments.length === 0 ? (
          <p className="text-gray-500">Chưa có bình luận nào.</p>
        ) : (
          <div className="space-y-6">
            {comments.map((cmt, idx) => (
              <div key={idx} className="bg-gray-100 p-4 rounded-lg shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-gray-800">{cmt.name}</p>
                  <span className="text-sm text-gray-500">{new Date(cmt.date).toLocaleString()}</span>
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
                <p className="text-gray-700">{cmt.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
