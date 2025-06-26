import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

const ProductDetail = () => {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [newReview, setNewReview] = useState({ star: 5, comment: "" });
  const [loading, setLoading] = useState(true);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // Lấy chi tiết sản phẩm
  useEffect(() => {
    async function fetchProduct() {
      try {
        const res = await fetch(`http://localhost:3000/api/product/${id}`);
        if (!res.ok) throw new Error("Không tìm thấy sản phẩm");
        const data = await res.json();
        setProduct(data);

        // Lấy sản phẩm liên quan (theo category)
        const relatedRes = await fetch(
          `http://localhost:3000/api/product?category=${encodeURIComponent(data.category)}`
        );
        if (relatedRes.ok) {
          const relatedData = await relatedRes.json();
          setRelatedProducts(relatedData.filter((p) => p._id !== id));
        }
      } catch (error) {
        console.error(error);
        setProduct(null);
      } finally {
        setLoading(false);
      }
    }
    fetchProduct();
  }, [id]);

  // Lấy đánh giá sản phẩm
  useEffect(() => {
    async function fetchReviews() {
      try {
        const res = await fetch(`http://localhost:3000/api/reviews?productId=${id}`);
        if (res.ok) {
          const data = await res.json();
          setReviews(data);
        }
      } catch (error) {
        console.error("Lỗi khi lấy đánh giá:", error);
      }
    }
    fetchReviews();
  }, [id]);

  const handleReviewChange = (e) => {
    const { name, value } = e.target;
    setNewReview((prev) => ({ ...prev, [name]: value }));
  };

  const handleStarChange = (star) => {
    setNewReview((prev) => ({ ...prev, star }));
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!newReview.comment.trim()) return alert("Vui lòng nhập bình luận");
    setReviewSubmitting(true);
    try {
      const res = await fetch("http://localhost:3000/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: id, ...newReview }),
      });
      if (res.ok) {
        const createdReview = await res.json();
        setReviews((prev) => [createdReview, ...prev]);
        setNewReview({ star: 5, comment: "" });
      } else {
        alert("Gửi đánh giá thất bại");
      }
    } catch (error) {
      alert("Lỗi khi gửi đánh giá");
    } finally {
      setReviewSubmitting(false);
    }
  };

  if (loading) return <div className="text-center mt-20">Đang tải sản phẩm...</div>;
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

      {/* Phần đánh giá */}
      <div className="mt-12">
        <h3 className="text-2xl font-bold mb-4">Đánh giá sản phẩm</h3>

        {/* Form thêm đánh giá */}
        <form onSubmit={handleSubmitReview} className="mb-8">
          <label className="block mb-2 font-semibold">Chọn số sao:</label>
          <div className="flex gap-2 mb-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => handleStarChange(star)}
                className={`text-yellow-400 text-3xl ${
                  newReview.star >= star ? "opacity-100" : "opacity-40"
                }`}
              >
                ★
              </button>
            ))}
          </div>
          <textarea
            name="comment"
            value={newReview.comment}
            onChange={handleReviewChange}
            placeholder="Viết bình luận của bạn..."
            className="w-full p-3 border rounded mb-4"
            rows={4}
            required
          />
          <button
            type="submit"
            disabled={reviewSubmitting}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded font-semibold"
          >
            {reviewSubmitting ? "Đang gửi..." : "Gửi đánh giá"}
          </button>
        </form>

        {/* Danh sách đánh giá */}
        {reviews.length === 0 ? (
          <p>Chưa có đánh giá nào.</p>
        ) : (
          <ul className="space-y-6">
            {reviews.map((rev) => (
              <li key={rev._id} className="border-b pb-4">
                <div className="flex items-center mb-1">
                  <div className="text-yellow-400 text-xl">
                    {'★'.repeat(rev.star) + '☆'.repeat(5 - rev.star)}
                  </div>
                </div>
                <p className="text-gray-700">{rev.comment}</p>
                <p className="text-gray-400 text-sm mt-1">
                  {new Date(rev.createdAt).toLocaleDateString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Sản phẩm liên quan */}
      {relatedProducts.length > 0 && (
        <div className="mt-12">
          <h3 className="text-xl font-bold mb-4 text-gray-800">Sản phẩm liên quan</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {relatedProducts.map((item) => (
              <div
                key={item._id}
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
                  // onClick={() => navigate(`/san-pham/${item._id}`)} // nếu muốn chuyển trang
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
