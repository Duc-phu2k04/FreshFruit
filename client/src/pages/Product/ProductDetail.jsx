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

  const handleSubmitComment = (e) => {
    e.preventDefault();
    if (!userName || !comment) return;

    const newComment = {
      name: userName,
      text: comment,
      rating,
      date: new Date().toLocaleString(),
    };

    setComments([newComment, ...comments]);
    setComment("");
    setUserName("");
    setRating(0);
  };

  if (!product) return <p>Đang tải...</p>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 bg-white rounded shadow">
      <img src={product.image} alt={product.name} className="w-full rounded mb-6" />
      <h1 className="text-3xl font-bold mb-2">{product.name}</h1>
      <p className="text-green-700 text-xl mb-4">{product.price.toLocaleString()}đ</p>
      <p className="text-gray-700 mb-6">{product.description || "Không có mô tả."}</p>

      {/* Đánh giá sao */}
      <div className="mb-6">
        <h3 className="font-semibold mb-1">Đánh giá sản phẩm:</h3>
        <div className="flex">
          {[...Array(5)].map((_, index) => {
            const current = index + 1;
            return (
              <FaStar
                key={current}
                size={24}
                className="cursor-pointer"
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
      <form onSubmit={handleSubmitComment} className="mb-6">
        <h3 className="font-semibold mb-2">Viết bình luận:</h3>
        <input
          type="text"
          placeholder="Tên của bạn"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          className="w-full mb-2 p-2 border rounded"
        />
        <textarea
          placeholder="Nội dung bình luận"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-full p-2 border rounded"
        />
        <button
          type="submit"
          className="mt-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          Gửi bình luận
        </button>
      </form>

      {/* Hiển thị bình luận */}
      <div>
        <h3 className="font-semibold mb-3">Bình luận:</h3>
        {comments.length === 0 ? (
          <p className="text-gray-500">Chưa có bình luận nào.</p>
        ) : (
          comments.map((cmt, idx) => (
            <div key={idx} className="mb-4 border-b pb-2">
              <p className="font-semibold">{cmt.name} - {cmt.date}</p>
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <FaStar
                    key={i}
                    size={16}
                    color={i < cmt.rating ? "#ffc107" : "#e4e5e9"}
                  />
                ))}
              </div>
              <p>{cmt.text}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
