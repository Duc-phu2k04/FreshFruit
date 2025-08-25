import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "./PreorderSuccess.css"; // ✅ import CSS

export default function PreorderSuccess() {
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const resultCode = params.get("resultCode");
  const message = params.get("message");

  const ok = String(resultCode) === "0";

  return (
    <div className="success-container">
      <h2 className="title">Kết quả thanh toán</h2>
      {ok ? (
        <p className="success-message">✅ Thanh toán thành công</p>
      ) : (
        <p className="error-message">
          ❌ Thanh toán không thành công{message ? `: ${message}` : ""}
        </p>
      )}
      <div className="button-wrap">
        <button
          className="back-button"
          onClick={() => navigate("/thong-tin")}
        >
          Về “Đơn đặt trước” của tôi
        </button>
      </div>
    </div>
  );
}
