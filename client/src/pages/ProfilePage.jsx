import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const token = localStorage.getItem("token");
  const userId = user?._id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState({
    fullName: "",
    email: "",
    phone: "",
    address: "",
    orders: [],
  });

  const fetchProfile = async () => {
    try {
      const res = await fetch(`http://localhost:3000/auth/users/${userId}`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.status === 401) return logout();
      const data = await res.json();
      setProfile({
        fullName: data.fullName || "",
        email: data.email || "",
        phone: data.phone || "",
        address: data.address || "",
        orders: data.orders || [],
      });
    } catch (err) {
      console.error("Fetch profile error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token && userId) fetchProfile();
  }, [token, userId, logout]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`http://localhost:3000/auth/users/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fullName: profile.fullName,
          email: profile.email,
          phone: profile.phone,
          address: profile.address,
        }),
      });
      if (!res.ok) throw new Error("Failed to save profile");
      await fetchProfile();
      setEditing(false);
    } catch (err) {
      console.error("Save profile error:", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loader border-4 border-t-4 border-green-500 rounded-full w-8 h-8 animate-spin"></div>
      </div>
    );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-5xl mx-auto p-6 grid gap-8"
    >
      <div className="bg-white shadow-xl rounded-2xl p-8 relative border border-gray-200">
        <h2 className="text-2xl font-semibold mb-6 text-green-700">Thông tin người dùng</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Họ và tên</label>
            <input
              className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-50"
              value={profile.fullName}
              disabled={!editing}
              onChange={(e) =>
                setProfile((p) => ({ ...p, fullName: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Số điện thoại</label>
            <input
              className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-50"
              value={profile.phone}
              disabled={!editing}
              onChange={(e) =>
                setProfile((p) => ({ ...p, phone: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Email</label>
            <input
              className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-50"
              value={profile.email}
              disabled={!editing}
              onChange={(e) =>
                setProfile((p) => ({ ...p, email: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Địa chỉ giao hàng</label>
            <input
              className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-50"
              value={profile.address}
              disabled={!editing}
              onChange={(e) =>
                setProfile((p) => ({ ...p, address: e.target.value }))
              }
            />
          </div>
        </div>

        <div className="absolute top-6 right-6 flex gap-3">
          <Link
            to="/thanh-toan"
            className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 transition"
          >
            Phương thức thanh toán
          </Link>
          {editing ? (
            <button
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
          ) : (
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
              onClick={() => setEditing(true)}
            >
              Cập nhật
            </button>
          )}
        </div>
      </div>

      {profile.orders && (
        <div className="bg-white shadow-xl rounded-2xl p-8 border border-gray-200">
          <h2 className="text-2xl font-semibold mb-6 text-green-700">Lịch sử đơn hàng</h2>
          {profile.orders.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-green-100">
                  <tr className="text-left">
                    <th className="py-3 px-4 border-b">Mã đơn</th>
                    <th className="py-3 px-4 border-b">Ngày</th>
                    <th className="py-3 px-4 border-b">Tổng</th>
                    <th className="py-3 px-4 border-b">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.orders.map((o) => (
                    <tr key={o._id} className="hover:bg-gray-50 transition">
                      <td className="py-3 px-4 border-b">{o._id}</td>
                      <td className="py-3 px-4 border-b">
                        {new Date(o.createdAt).toLocaleDateString("vi-VN")}
                      </td>
                      <td className="py-3 px-4 border-b">
                        {o.total.toLocaleString("vi-VN")} đ
                      </td>
                      <td className="py-3 px-4 border-b capitalize">{o.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center py-6 text-gray-500">Chưa có đơn hàng.</p>
          )}
        </div>
      )}
    </motion.div>
  );
}
