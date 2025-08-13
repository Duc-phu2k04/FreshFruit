// src/components/ReviewButton.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import "./ReviewButton.css";

const ReviewButton = ({ productId, orderId }) => {
  const [loading, setLoading] = useState(true);
  const [reviewStatus, setReviewStatus] = useState({
    canReview: false,
    hasReviewed: false
  });
  const [reviewData, setReviewData] = useState({ rating: 0, comment: "" });
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const checkReview = async () => {
      if (!orderId || !productId) {
        setReviewStatus({ canReview: false, hasReviewed: false });
        setLoading(false);
        return;
      }

      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(
          `/api/review/can-review/${orderId}/${productId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            withCredentials: true,
          }
        );

        setReviewStatus({
          canReview: res.data.data.canReview,
          hasReviewed: res.data.data.hasReviewed,
        });
      } catch (err) {
        console.error("Lỗi kiểm tra quyền đánh giá:", err);
        setReviewStatus({ canReview: false, hasReviewed: false });
      } finally {
        setLoading(false);
      }
    };

    checkReview();
  }, [orderId, productId]);

  const handleStarClick = (star) => {
    setReviewData((prev) => ({ ...prev, rating: star }));
  };

  const handleInputChange = (e) => {
    setReviewData((prev) => ({ ...prev, comment: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reviewData.rating) {
      alert("Vui lòng chọn số sao!");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await axios.post(
        "/api/review/add",
        {
          orderId,
          productId,
          rating: reviewData.rating,
          comment: reviewData.comment,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setReviewStatus({ canReview: false, hasReviewed: true });
      setShowForm(false);
      setReviewData({ rating: 0, comment: "" });
      alert("Đánh giá thành công!");
    } catch (err) {
      console.error("Lỗi khi gửi đánh giá:", err);
      alert(err.response?.data?.message || "Có lỗi xảy ra!");
    }
  };

  if (loading) return <span>Đang kiểm tra...</span>;
  if (reviewStatus.hasReviewed) return <span className="review-done">Đã đánh giá</span>;

  return (
    <div className="review-wrapper" key={`${orderId}-${productId}`}>
      {reviewStatus.canReview && !showForm && (
        <button className="btn-review" onClick={() => setShowForm(true)}>
          Đánh giá
        </button>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="review-form">
          <div className="stars">
            {[1, 2, 3, 4, 5].map((star) => (
              <span
                key={star}
                className={`star ${star <= reviewData.rating ? "selected" : ""}`}
                onClick={() => handleStarClick(star)}
              >
                ★
              </span>
            ))}
          </div>
          <input
            type="text"
            placeholder="Viết bình luận..."
            value={reviewData.comment}
            onChange={handleInputChange}
            required
            className="review-input"
          />
          <div className="review-actions">
            <button type="submit" className="btn-submit">Gửi</button>
            <button type="button" className="btn-cancel" onClick={() => setShowForm(false)}>Hủy</button>
          </div>
        </form>
      )}
    </div>
  );
};

export default ReviewButton;
