import React, { useEffect, useState } from "react";
import axios from "axios";

export default function AdminOrderPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    try {
      const res = await axios.get("http://localhost:3000/api/orders/all", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      setOrders(res.data);
    } catch (err) {
      console.error("Lỗi khi lấy đơn hàng:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
  try {
    await axios.put(`http://localhost:3000/api/orders/${orderId}/status`, {
      status: newStatus,
    }, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });
    fetchOrders(); // refresh lại danh sách đơn hàng
  } catch (err) {
    console.error("Lỗi cập nhật trạng thái:", err);
  }
};


  useEffect(() => {
    fetchOrders();
  }, []);

  if (loading) return <div className="text-center mt-10">Đang tải...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Quản lý Đơn Hàng</h1>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">Người đặt</th>
              <th className="p-3 text-left">Sản phẩm</th>
              <th className="p-3 text-left">Tổng tiền</th>
              <th className="p-3 text-left">Trạng thái</th>
              <th className="p-3">Cập nhật</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(order => (
              <tr key={order._id} className="border-t">
                <td className="p-3">{order.user?.username || "Không rõ"}</td>
                <td className="p-3">
                  <ul className="list-disc pl-5">
                    {order.items.map((item, index) => (
                      <li key={index}>
                        {item.productName} ({item.variant?.weight} / {item.variant?.ripeness}) x{item.quantity}
                      </li>
                    ))}
                  </ul>
                </td>
                <td className="p-3">{order.total?.toLocaleString()}₫</td>
                <td className="p-3">
                  <select
                    value={order.status}
                    onChange={(e) => handleStatusChange(order._id, e.target.value)}
                    className="border rounded px-2 py-1"
                  >
                    <option value="pending">Chờ xác nhận</option>
                    <option value="confirmed">Đã xác nhận</option>
                    <option value="shipped">Đang giao</option>
                    <option value="delivered">Đã giao</option>
                    <option value="cancelled">Đã hủy</option>
                  </select>
                </td>
                <td className="p-3 text-center">✔</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
