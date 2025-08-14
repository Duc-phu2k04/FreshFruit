// src/components/ReviewButton.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import "./ReviewButton.css";

// Component hiển thị sao, có thể dùng để chọn hoặc chỉ hiển thị
const StarRating = ({ rating = 0, outOf = 5, interactive = false, onChange }) => {
  const [hovered, setHovered] = useState(0);
  const safeRating = Math.max(0, Math.min(outOf, Number(rating) || 0));

  return (
    <span className="review-stars" title={`${safeRating}/${outOf}`}>
      {Array.from({ length: outOf }).map((_, i) => {
        const starIndex = i + 1;
        const filled = interactive ? starIndex <= (hovered || safeRating) : starIndex <= safeRating;

        return (
          <span
            key={i}
            className={`star ${filled ? "filled" : "empty"} ${interactive ? "interactive" : ""}`}
            onClick={interactive ? () => onChange(starIndex) : undefined}
            onMouseEnter={interactive ? () => setHovered(starIndex) : undefined}
            onMouseLeave={interactive ? () => setHovered(0) : undefined}
          >
            ★
          </span>
        );
      })}
    </span>
  );
};

const ReviewButton = ({ productId, orderId, itemData }) => {
  const [loading, setLoading] = useState(true);
  const [reviewStatus, setReviewStatus] = useState({ canReview: false, hasReviewed: false });
  const [reviewData, setReviewData] = useState({ rating: 0, comment: "" });
  const [showForm, setShowForm] = useState(false);
  const [existingRating, setExistingRating] = useState(0);

  useEffect(() => {
    const checkReview = async () => {
      if (!orderId || !productId) {
        setReviewStatus({ canReview: false, hasReviewed: false });
        setLoading(false);
        return;
      }

      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(`/api/review/can-review/${orderId}/${productId}`, {
          headers: { Authorization: `Bearer ${token}` },
          withCredentials: true,
        });

        const canReview = res.data?.data?.canReview ?? false;
        const hasReviewed = res.data?.data?.hasReviewed ?? false;
        const rating = res.data?.data?.rating ?? itemData?.rating ?? 0;

        setExistingRating(rating);
        setReviewStatus({ canReview, hasReviewed });
      } catch (err) {
        setReviewStatus({ canReview: false, hasReviewed: false });
        setExistingRating(0);
      } finally {
        setLoading(false);
      }
    };

    checkReview();
  }, [orderId, productId, itemData]);

  const handleStarClick = (star) => setReviewData((prev) => ({ ...prev, rating: star }));
  const handleInputChange = (e) => setReviewData((prev) => ({ ...prev, comment: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reviewData.rating) return alert("Vui lòng chọn số sao!");

    try {
      const token = localStorage.getItem("token");
      await axios.post("/api/review/add", { orderId, productId, ...reviewData }, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setReviewStatus({ canReview: false, hasReviewed: true });
      setExistingRating(reviewData.rating);
      setShowForm(false);
      setReviewData({ rating: 0, comment: "" });
      alert("Đánh giá thành công!");
    } catch (err) {
      alert(err.response?.data?.message || "Có lỗi xảy ra!");
    }
  };

  if (loading) return <span>Đang kiểm tra...</span>;

  // Nếu đã đánh giá → hiển thị sao
  if (reviewStatus.hasReviewed) {
    return <StarRating rating={existingRating} />;
  }

  // Nếu chưa đánh giá → hiện nút ReviewButton
  return (
    <div className="review-wrapper" key={`${orderId || "noOrder"}-${productId || "noProduct"}`}>
      {reviewStatus.canReview && !showForm && (
        <button className="btn-review" onClick={() => setShowForm(true)}>
          Đánh giá
        </button>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="review-form">
          <div className="stars">
            <StarRating
              rating={reviewData.rating}
              interactive
              onChange={handleStarClick}
            />
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
