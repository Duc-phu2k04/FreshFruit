import React, { useEffect, useState } from "react";
import axios from "axios";

export default function AdminOrderPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState(null);

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

  const statusFlow = ["pending", "confirmed", "shipping", "delivered", "cancelled"];

  const getNextStatus = (currentStatus) => {
    const currentIndex = statusFlow.indexOf(currentStatus);
    if (currentIndex === -1 || currentIndex === statusFlow.length - 1) return currentStatus;
    return statusFlow[currentIndex + 1];
  };

  const handleStatusNext = async (orderId, currentStatus) => {
    const newStatus = getNextStatus(currentStatus);
    try {
      await axios.put(
        `http://localhost:3000/api/orders/${orderId}/status`,
        { status: newStatus },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      fetchOrders();
    } catch (err) {
      console.error("Lỗi cập nhật trạng thái:", err);
    }
  };

  const handleCancelOrder = async (orderId) => {
    try {
      await axios.delete(`http://localhost:3000/api/orders/${orderId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      fetchOrders();
    } catch (err) {
      console.error("Lỗi huỷ đơn:", err);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  if (loading) return <div className="text-center mt-10">Đang tải...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Quản lý Đơn Hàng</h1>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-3">Người đặt</th>
              <th className="p-3">Sản phẩm</th>
              <th className="p-3">Tổng</th>
              <th className="p-3">Trạng thái</th>
              <th className="p-3">Thanh toán</th>
              <th className="p-3">Phương thức</th>
              <th className="p-3 text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <React.Fragment key={order._id}>
                <tr className="border-t">
                  <td className="p-3">{order.user?.username || "Không rõ"}</td>
                  <td className="p-3">
                    {order.items.map((item) => item.productName).join(", ")}
                  </td>
                  <td className="p-3 font-medium">{order.total?.toLocaleString()}₫</td>
                  <td className="p-3 capitalize">{order.status}</td>
                  <td className="p-3">
                    {order.paymentStatus === "paid" && <span className="text-green-600 font-semibold">Đã thanh toán</span>}
                    {order.paymentStatus === "unpaid" && <span className="text-yellow-600 font-semibold">Chưa thanh toán</span>}
                    {order.paymentStatus === "failed" && <span className="text-red-600 font-semibold">Thất bại</span>}
                  </td>
                  <td className="p-3 uppercase">{order.paymentMethod === 'momo' ? 'MOMO' : 'COD'}</td>
                  <td className="p-3 text-center space-x-2">
                    <button
                      onClick={() =>
                        setExpandedOrderId(order._id === expandedOrderId ? null : order._id)
                      }
                      className="px-3 py-1 border border-blue-500 text-blue-600 rounded hover:bg-blue-50"
                    >
                      {order._id === expandedOrderId ? "Ẩn chi tiết" : "Xem chi tiết"}
                    </button>
                    {["pending", "failed"].includes(order.status) && (
                      <button
                        onClick={() => handleCancelOrder(order._id)}
                        className="px-3 py-1 border border-red-500 text-red-600 rounded hover:bg-red-50"
                      >
                        Huỷ
                      </button>
                    )}
                    {order.status !== "cancelled" && order.status !== "delivered" && (
                      <button
                        onClick={() => handleStatusNext(order._id, order.status)}
                        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                      >
                        {getNextStatus(order.status) !== order.status
                          ? "Chuyển ➜ " + getNextStatus(order.status)
                          : "Đã hoàn tất"}
                      </button>
                    )}
                  </td>
                </tr>

                {expandedOrderId === order._id && (
                  <tr>
                    <td colSpan={7} className="bg-gray-50 p-4">
                      <div>
                        <h2 className="font-semibold mb-2">Chi tiết đơn hàng</h2>
                        <p><strong>Mã đơn:</strong> {order.customId}</p>
                        <p><strong>Người nhận:</strong> {order.shippingAddress?.fullName} - {order.shippingAddress?.phone}</p>
                        <p><strong>Địa chỉ:</strong> {order.shippingAddress?.detail}, {order.shippingAddress?.ward}, {order.shippingAddress?.district}, {order.shippingAddress?.province}</p>
                        <p className="mt-2 font-semibold">Sản phẩm:</p>
                        <ul className="list-disc pl-6">
                          {order.items.map((item, index) => (
                            <li key={index}>
                              {item.productName} - ({item.variant.weight} / {item.variant.ripeness}) x{item.quantity} - {item.price.toLocaleString()}₫
                            </li>
                          ))}
                        </ul>
                        {order.voucher && (
                          <p className="mt-2"><strong>Mã giảm giá:</strong> {order.voucher.code}</p>
                        )}
                        <p className="mt-2"><strong>Ngày đặt:</strong> {new Date(order.createdAt).toLocaleString()}</p>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
