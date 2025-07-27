import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { motion } from "framer-motion";

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const token = localStorage.getItem("token");
  const userId = user?._id;

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState({ username: "", email: "" });
  const [orders, setOrders] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({ username: "", email: "" });
  const [message, setMessage] = useState("");

  const fetchProfile = async () => {
    try {
      const res = await fetch(`http://localhost:3000/auth/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) return logout();
      const data = await res.json();
      setProfile({ username: data.username || "", email: data.email || "" });
      setEditData({ username: data.username || "", email: data.email || "" });
    } catch (err) {
      console.error("Fetch profile error:", err);
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await fetch(`http://localhost:3000/api/orders/user`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Không thể lấy đơn hàng.");
      const data = await res.json();
      setOrders(data);
    } catch (err) {
      console.error("Fetch orders error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = async (orderId) => {
    if (!window.confirm("Bạn có chắc muốn hủy đơn hàng này?")) return;
    try {
      const res = await fetch(`http://localhost:3000/api/orders/${orderId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Hủy đơn hàng thất bại.");
      fetchOrders();
    } catch (err) {
      alert(err.message);
    }
  };

  const updateProfile = async () => {
    try {
      const res = await fetch(`http://localhost:3000/auth/users/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Cập nhật thất bại");
      setMessage(" Cập nhật hồ sơ thành công");
      setEditMode(false);
      fetchProfile();
    } catch (err) {
      setMessage("" + err.message);
    }
  };

  useEffect(() => {
    if (token && userId) {
      fetchProfile();
      fetchOrders();
    }
  }, [token, userId]);

  const formatStatus = (status) => {
    switch (status) {
      case "pending":
        return "Chờ xác nhận";
      case "confirmed":
        return "Đã xác nhận";
      case "shipping":
        return "Đang giao";
      case "delivered":
        return "Đã giao";
      case "cancelled":
        return "Đã hủy";
      default:
        return status;
    }
  };

  if (loading)
    return <div className="text-center py-10 text-gray-500">Đang tải dữ liệu...</div>;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto p-6 grid gap-8"
    >
      {/* Hồ sơ người dùng */}
      <div className="bg-white shadow-xl rounded-2xl p-8 border border-gray-200">
        <h2 className="text-2xl font-bold text-green-700 border-b pb-2 mb-4">👤 Hồ sơ người dùng</h2>
        {message && <div className="mb-4 text-sm text-blue-700">{message}</div>}
        {editMode ? (
          <div className="grid gap-4">
            <input
              className="border p-2 rounded w-full"
              placeholder="Username"
              value={editData.username}
              onChange={(e) => setEditData({ ...editData, username: e.target.value })}
            />
            <input
              className="border p-2 rounded w-full"
              placeholder="Email"
              value={editData.email}
              onChange={(e) => setEditData({ ...editData, email: e.target.value })}
            />
            <div className="flex gap-2">
              <button
                onClick={updateProfile}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Lưu
              </button>
              <button
                onClick={() => setEditMode(false)}
                className="text-gray-500 hover:underline"
              >
                Hủy
              </button>
            </div>
          </div>
        ) : (
          <>
            <p><strong>Username:</strong> {profile.username}</p>
            <p><strong>Email:</strong> {profile.email}</p>
            <button
              onClick={() => setEditMode(true)}
              className="text-green-600 mt-3 hover:underline"
            >
              ✏️ Chỉnh sửa hồ sơ
            </button>
          </>
        )}
      </div>

      {/* Lịch sử đơn hàng */}
      <div className="bg-white shadow-xl rounded-2xl p-8 border border-gray-200">
        <h2 className="text-2xl font-bold text-green-700 border-b pb-2 mb-4">📦 Lịch sử đơn hàng</h2>
        {orders.length ? (
          <div className="space-y-6">
            {orders.map((order) => (
              <div key={order._id} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex justify-between flex-wrap gap-4">
                  <div>
                    <p><strong>Mã đơn:</strong> {order.customId || order._id}</p>
                    <p><strong>Ngày đặt:</strong> {new Date(order.createdAt).toLocaleDateString("vi-VN")}</p>
                    <p><strong>Trạng thái:</strong> {formatStatus(order.status)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-green-700 font-bold">
                      Tổng: {order.total.toLocaleString("vi-VN")}đ
                    </p>
                    {order.status === "pending" && (
                      <button
                        onClick={() => handleCancelOrder(order._id)}
                        className="text-red-600 mt-2 hover:underline"
                      >
                        Hủy đơn
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-3">
                  <h4 className="font-semibold mb-1">🛒 Sản phẩm:</h4>
                  <ul className="list-disc pl-6 text-sm">
                    {order.items.map((item) => (
                      <li key={item.product?._id || item.product}>
                        {item.product?.name || "Sản phẩm đã xoá"} – {item.quantity} x {item.price.toLocaleString("vi-VN")}đ
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">Chưa có đơn hàng nào.</p>
        )}
      </div>
    </motion.div>
  );
}
