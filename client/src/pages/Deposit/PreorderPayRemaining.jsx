// src/pages/PreorderPayRemaining.jsx
import React, { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export default function PreorderPayRemaining() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("Đang tạo phiên thanh toán phần còn lại…");

  useEffect(() => {
    const run = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) throw new Error("Bạn chưa đăng nhập");

        const preorderId = window.location.pathname.split("/").pop(); // /pay/remaining/:preorderId
        if (!preorderId) throw new Error("Thiếu preorderId");

        const res = await fetch(
          `${API_URL}/api/momo/create-payment-remaining/${preorderId}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Tạo thanh toán thất bại");

        setMsg(`Chuyển sang MoMo… (số tiền: ${Number(data.amount || 0).toLocaleString("vi-VN")}₫)`);
        window.location.href = data.payUrl;
      } catch (e) {
        setErr(e.message || "Lỗi không xác định");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h2>Thanh toán phần còn lại</h2>
      {loading && <p>{msg}</p>}
      {!loading && err && (
        <>
          <p style={{ color: "crimson" }}>⚠️ {err}</p>
          <button onClick={() => window.history.back()}>Quay lại</button>
        </>
      )}
    </div>
  );
}
