// src/pages/ProfilePage.jsx
import "./ProfilePage.css";
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../../context/useAuth";
import ReviewButton from "./ReviewButton";

const API_URL = "http://localhost:3000"; // Đổi baseURL cho khớp backend

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const token = localStorage.getItem("token");
  const userId = user?._id || null;

  const [tab, setTab] = useState("profile");
  // Thêm defaultAddressId vào userInfo để lưu id địa chỉ mặc định
  const [userInfo, setUserInfo] = useState({ username: "", email: "", defaultAddressId: null });
  const [isEditing, setIsEditing] = useState(false);

  const [addresses, setAddresses] = useState([]);
  const [orders, setOrders] = useState([]);
  const [vouchers, setVouchers] = useState({
    validVouchers: [],
    expiredVouchers: [],
    usedUpVouchers: [],
  });

  // Quản lý trạng thái sửa địa chỉ
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [editingAddressData, setEditingAddressData] = useState({
    fullName: "",
    phone: "",
    province: "",
    district: "",
    ward: "",
    detail: "",
  });

  // Quản lý trạng thái thêm địa chỉ mới
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAddressForm, setNewAddressForm] = useState({
    fullName: "",
    phone: "",
    province: "",
    district: "",
    ward: "",
    detail: "",
  });

  // Khởi tạo axios instance với header Authorization
  const axiosAuth = axios.create({
    baseURL: API_URL,
    headers: { Authorization: `Bearer ${token}` },
  });

  useEffect(() => {
    if (!token || !userId) {
      console.warn("Token hoặc userId không tồn tại");
      return;
    }

    const fetchAll = async () => {
      try {
        await Promise.all([
          fetchUserInfo(),
          fetchAddresses(),
          fetchOrders(),
          fetchVouchers(),
        ]);
      } catch (error) {
        console.error("Lỗi khi tải dữ liệu:", error);
      }
    };

    fetchAll();
  }, [token, userId]);


  const fetchVouchers = async () => {
    try {
      const res = await axios.get("/api/voucher/my-vouchers", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      console.log("📦 API voucher trả về:", res.data);

      const apiData = res.data.data || {};

      // Chuẩn hóa key để luôn khớp với renderVouchers
      const formattedData = {
        validVouchers: apiData.validVouchers || apiData.valid || [],
        expiredVouchers: apiData.expiredVouchers || apiData.expired || [],
        usedUpVouchers: apiData.usedUpVouchers || apiData.used || [],
      };

      setVouchers(formattedData);
    } catch (error) {
      console.error("Lỗi khi lấy voucher:", error);
    }
  };




  // Lấy thông tin user (bao gồm defaultAddressId)
  const fetchUserInfo = async () => {
    try {
      const res = await axiosAuth.get(`/auth/users/${userId}`);
      setUserInfo({
        username: res.data.username || "",
        email: res.data.email || "",
        defaultAddressId: res.data.defaultAddressId || null,
      });
      setIsEditing(false);
    } catch (err) {
      console.error("Lỗi lấy thông tin user:", err.response?.data || err.message);
    }
  };

  // Cập nhật thông tin user (kèm defaultAddressId)
  const updateUserInfo = async () => {
    try {
      await axiosAuth.put(`/auth/users/${userId}`, userInfo);
      alert("Cập nhật thành công");
      setIsEditing(false);
      fetchUserInfo();

      // Cập nhật thông tin user trong context
      updateUser({
        ...user,
        username: userInfo.username,
        email: userInfo.email,
        defaultAddressId: userInfo.defaultAddressId,
      });
    } catch (err) {
      console.error("Lỗi cập nhật user:", err.response?.data || err.message);
    }
  };

  // Lấy danh sách địa chỉ
  const fetchAddresses = async () => {
    try {
      const res = await axiosAuth.get(`/api/address`);
      setAddresses(res.data);
    } catch (err) {
      console.error("Lỗi lấy địa chỉ:", err.response?.data || err.message);
    }
  };

  // Thêm địa chỉ mới
  const addAddress = async (newAddressObj) => {
    try {
      // Gửi userId kèm theo cho backend
      await axiosAuth.post(`/api/address`, { ...newAddressObj, user: userId, isDefault: false });
      fetchAddresses();
    } catch (err) {
      console.error("Lỗi thêm địa chỉ:", err.response?.data || err.message);
    }
  };

  // Cập nhật địa chỉ
  const updateAddress = async (id, updated) => {
    try {
      await axiosAuth.put(`/api/address/${id}`, updated);
      fetchAddresses();
    } catch (err) {
      console.error("Lỗi cập nhật địa chỉ:", err.response?.data || err.message);
    }
  };

  // Xóa địa chỉ
  const deleteAddress = async (id) => {
    if (!window.confirm("Xóa địa chỉ này?")) return;
    try {
      await axiosAuth.delete(`/api/address/${id}`);

      // Nếu địa chỉ xóa là địa chỉ mặc định thì clear defaultAddressId
      if (userInfo.defaultAddressId === id) {
        setUserInfo((prev) => ({ ...prev, defaultAddressId: null }));
        // Gửi update defaultAddressId về backend luôn
        await axiosAuth.put(`/api/auth/users/${userId}`, { ...userInfo, defaultAddressId: null });
      }
      fetchAddresses();
    } catch (err) {
      console.error("Lỗi xóa địa chỉ:", err.response?.data || err.message);
    }
  };

  // Lấy lịch sử đơn hàng user
  const fetchOrders = async () => {
    try {
      const res = await axiosAuth.get(`/api/orders/user`);
      const ordersData = res.data;

      // Gắn trạng thái đánh giá cho từng item
      const processedOrders = ordersData.map((order) => ({
        ...order,
        items: order.items.map((item) => ({
          ...item,
          hasReviewed: item.reviewData ? true : false, // reviewData lấy từ backend
        })),
      }));

      setOrders(processedOrders);

    } catch (err) {
      console.error("Lỗi lấy đơn hàng:", err.response?.data || err.message);
    }
  };

  // Hủy đơn hàng
  const cancelOrder = async (id) => {
    if (!window.confirm("Hủy đơn hàng này?")) return;
    try {
      await axiosAuth.delete(`/api/orders/${id}`);
      fetchOrders();
    } catch (err) {
      console.error("Lỗi hủy đơn:", err.response?.data || err.message);
    }
  };



  // --- XỬ LÝ SỬA ĐỊA CHỈ ---

  const startEditAddress = (addr) => {
    setEditingAddressId(addr._id);
    setEditingAddressData({
      fullName: addr.fullName || "",
      phone: addr.phone || "",
      province: addr.province || "",
      district: addr.district || "",
      ward: addr.ward || "",
      detail: addr.detail || "",
    });
  };

  const cancelEditAddress = () => {
    setEditingAddressId(null);
    setEditingAddressData({
      fullName: "",
      phone: "",
      province: "",
      district: "",
      ward: "",
      detail: "",
    });
  };

  const saveEditAddress = () => {
    const { fullName, phone, province, district, ward, detail } = editingAddressData;
    if (!fullName || !phone || !province || !district || !ward || !detail) {
      alert("Vui lòng điền đầy đủ thông tin địa chỉ");
      return;
    }
    updateAddress(editingAddressId, editingAddressData);
    cancelEditAddress();
  };

  // --- XỬ LÝ THÊM ĐỊA CHỈ MỚI ---

  const saveNewAddress = () => {
    const { fullName, phone, province, district, ward, detail } = newAddressForm;
    if (!fullName || !phone || !province || !district || !ward || !detail) {
      alert("Vui lòng điền đầy đủ thông tin địa chỉ");
      return;
    }
    addAddress(newAddressForm);
    setNewAddressForm({
      fullName: "",
      phone: "",
      province: "",
      district: "",
      ward: "",
      detail: "",
    });
    setShowAddForm(false);
  };

  // Chọn địa chỉ mặc định
  const selectDefaultAddress = async (id) => {
    const updatedUserInfo = { ...userInfo, defaultAddressId: id };
    setUserInfo(updatedUserInfo);
    try {
      await axiosAuth.put(`/auth/users/${userId}`, updatedUserInfo);
      // Sau khi cập nhật backend thành công, lấy lại thông tin user mới nhất
      await fetchUserInfo();
    } catch (err) {
      console.error("Lỗi cập nhật địa chỉ mặc định:", err.response?.data || err.message);
    }
  };


  // --- Render UI ---

  const renderProfile = () => (
    <div className="profile-section">
      <h2>Thông tin cá nhân</h2>

      <label>Tên hiển thị</label>
      <input
        value={userInfo.username}
        onChange={(e) => setUserInfo({ ...userInfo, username: e.target.value })}
        readOnly={!isEditing}
        style={{ backgroundColor: isEditing ? "white" : "#eee" }}
        placeholder="Tên hiển thị"
      />

      <label>Email</label>
      <input
        value={userInfo.email}
        onChange={(e) => setUserInfo({ ...userInfo, email: e.target.value })}
        readOnly={!isEditing}
        style={{ backgroundColor: isEditing ? "white" : "#eee" }}
        placeholder="Email"
      />

      <label>Địa chỉ mặc định</label>
      {!isEditing ? (
        <div className="default-address" style={{ marginBottom: "12px" }}>
          {userInfo.defaultAddressId
            ? (() => {
              const addr = addresses.find((a) => a._id === userInfo.defaultAddressId);
              if (!addr) return "Chưa chọn địa chỉ";
              return `${addr.fullName}, ${addr.phone}, ${addr.detail}, ${addr.ward}, ${addr.district}, ${addr.province}`;
            })()
            : "Chưa chọn địa chỉ"}
        </div>
      ) : (
        <select
          value={userInfo.defaultAddressId || ""}
          onChange={(e) => setUserInfo({ ...userInfo, defaultAddressId: e.target.value })}
        >
          <option value="">-- Chọn địa chỉ mặc định --</option>
          {addresses.map((addr) => (
            <option key={addr._id} value={addr._id}>
              {`${addr.fullName}, ${addr.phone}, ${addr.detail}, ${addr.ward}, ${addr.district}, ${addr.province}`}
            </option>
          ))}
        </select>
      )}

      {!isEditing ? (
        <button onClick={() => setIsEditing(true)}>Sửa</button>
      ) : (
        <>
          <button onClick={updateUserInfo}>Cập nhật</button>
          <button
            onClick={() => {
              setIsEditing(false);
              fetchUserInfo();
            }}
          >
            Hủy
          </button>
        </>
      )}
    </div>
  );

  const renderAddresses = () => (
    <div className="profile-section">
      <h2>Quản lý địa chỉ</h2>
      <ul style={{ listStyle: "none", paddingLeft: 0 }}>
        {addresses.map((addr) => (
          <li
            key={addr._id}
            style={{
              marginBottom: "12px",
              padding: "8px",
              border: "1px solid #ccc",
              borderRadius: "6px",
            }}
          >
            {editingAddressId === addr._id ? (
              <>
                <input
                  type="text"
                  placeholder="Họ và tên"
                  value={editingAddressData.fullName}
                  onChange={(e) =>
                    setEditingAddressData({ ...editingAddressData, fullName: e.target.value })
                  }
                  style={{ marginBottom: "6px", display: "block", width: "100%" }}
                />
                <input
                  type="text"
                  placeholder="Số điện thoại"
                  value={editingAddressData.phone}
                  onChange={(e) =>
                    setEditingAddressData({ ...editingAddressData, phone: e.target.value })
                  }
                  style={{ marginBottom: "6px", display: "block", width: "100%" }}
                />
                <input
                  type="text"
                  placeholder="Tỉnh/Thành phố"
                  value={editingAddressData.province}
                  onChange={(e) =>
                    setEditingAddressData({ ...editingAddressData, province: e.target.value })
                  }
                  style={{ marginBottom: "6px", display: "block", width: "100%" }}
                />
                <input
                  type="text"
                  placeholder="Quận/Huyện"
                  value={editingAddressData.district}
                  onChange={(e) =>
                    setEditingAddressData({ ...editingAddressData, district: e.target.value })
                  }
                  style={{ marginBottom: "6px", display: "block", width: "100%" }}
                />
                <input
                  type="text"
                  placeholder="Phường/Xã"
                  value={editingAddressData.ward}
                  onChange={(e) =>
                    setEditingAddressData({ ...editingAddressData, ward: e.target.value })
                  }
                  style={{ marginBottom: "6px", display: "block", width: "100%" }}
                />
                <input
                  type="text"
                  placeholder="Địa chỉ chi tiết"
                  value={editingAddressData.detail}
                  onChange={(e) =>
                    setEditingAddressData({ ...editingAddressData, detail: e.target.value })
                  }
                  style={{ marginBottom: "6px", display: "block", width: "100%" }}
                />
                <button onClick={saveEditAddress}>Lưu</button>
                <button onClick={cancelEditAddress} style={{ marginLeft: "8px" }}>
                  Hủy
                </button>
              </>
            ) : (
              <>
                <div>
                  <strong>{addr.fullName}</strong> - {addr.phone}
                </div>
                <div>
                  {addr.detail}, {addr.ward}, {addr.district}, {addr.province}
                </div>
                <div className="address-actions">
                  <div className="default-select-wrapper">
                    {userInfo.defaultAddressId === addr._id ? (
                      <span className="default-label">(Mặc định)</span>
                    ) : (
                      <button
                        onClick={() => selectDefaultAddress(addr._id)}
                        className="btn-default-select"
                        title="Chọn làm mặc định"
                      >
                        Chọn làm mặc định
                      </button>
                    )}
                  </div>

                  <button onClick={() => startEditAddress(addr)} className="btn-edit">
                    Sửa
                  </button>
                  <button onClick={() => deleteAddress(addr._id)} className="btn-delete">
                    Xóa
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>

      {showAddForm ? (
        <div style={{ marginTop: "12px", border: "1px solid #ccc", padding: "12px", borderRadius: "6px" }}>
          <input
            type="text"
            placeholder="Họ và tên"
            value={newAddressForm.fullName}
            onChange={(e) => setNewAddressForm({ ...newAddressForm, fullName: e.target.value })}
            style={{ marginBottom: "6px", display: "block", width: "100%" }}
          />
          <input
            type="text"
            placeholder="Số điện thoại"
            value={newAddressForm.phone}
            onChange={(e) => setNewAddressForm({ ...newAddressForm, phone: e.target.value })}
            style={{ marginBottom: "6px", display: "block", width: "100%" }}
          />
          <input
            type="text"
            placeholder="Tỉnh/Thành phố"
            value={newAddressForm.province}
            onChange={(e) => setNewAddressForm({ ...newAddressForm, province: e.target.value })}
            style={{ marginBottom: "6px", display: "block", width: "100%" }}
          />
          <input
            type="text"
            placeholder="Quận/Huyện"
            value={newAddressForm.district}
            onChange={(e) => setNewAddressForm({ ...newAddressForm, district: e.target.value })}
            style={{ marginBottom: "6px", display: "block", width: "100%" }}
          />
          <input
            type="text"
            placeholder="Phường/Xã"
            value={newAddressForm.ward}
            onChange={(e) => setNewAddressForm({ ...newAddressForm, ward: e.target.value })}
            style={{ marginBottom: "6px", display: "block", width: "100%" }}
          />
          <input
            type="text"
            placeholder="Địa chỉ chi tiết"
            value={newAddressForm.detail}
            onChange={(e) => setNewAddressForm({ ...newAddressForm, detail: e.target.value })}
            style={{ marginBottom: "6px", display: "block", width: "100%" }}
          />
          <button onClick={saveNewAddress}>Thêm địa chỉ</button>
          <button onClick={() => setShowAddForm(false)} style={{ marginLeft: "8px" }}>
            Hủy
          </button>
        </div>
      ) : (
        <button onClick={() => setShowAddForm(true)} style={{ marginTop: "12px" }}>
          Thêm địa chỉ
        </button>
      )}
    </div>
  );

const renderOrders = () => (
  <div className="order-history">
    <h2>Lịch sử đơn hàng</h2>
    <table className="order-table">
      <thead>
        <tr>
          <th>Mã đơn</th>
          <th>Ngày đặt</th>
          <th>Sản phẩm</th>
          <th>Tổng tiền</th>
          <th>Trạng thái</th>
          <th>Thanh toán</th>
          <th>Phương thức</th>
          <th>Địa chỉ chi tiết</th>
          <th>Hành động</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((o) => (
          <tr key={o._id}>
            {/* Mã đơn */}
            <td className="order-id">{o.customId}</td>

            {/* Ngày đặt */}
            <td>{new Date(o.createdAt).toLocaleDateString("vi-VN")}</td>

            {/* Sản phẩm */}
            <td>
              {o.items.map((it, idx) => (
                <div key={idx} className="product-item">
                  {it.productName}{" "}
                  <span className="product-meta">
                    ({it.variant.weight}, {it.variant.ripeness}) × {it.quantity}
                  </span>
                </div>
              ))}
            </td>

            {/* Tổng tiền */}
            <td className="order-total">
              {o.total.toLocaleString("vi-VN")}₫
            </td>

            {/* Trạng thái đơn */}
            <td>
              <span
                className={`status-badge ${
                  o.status === "pending"
                    ? "pending"
                    : o.status === "confirmed"
                    ? "confirmed"
                    : o.status === "shipping"
                    ? "shipping"
                    : o.status === "delivered"
                    ? "delivered"
                    : "cancelled"
                }`}
              >
                {o.status === "pending"
                  ? "Đang xử lý"
                  : o.status === "confirmed"
                  ? "Đã xác nhận"
                  : o.status === "shipping"
                  ? "Đang vận chuyển"
                  : o.status === "delivered"
                  ? "Đã giao"
                  : "Đã hủy"}
              </span>
            </td>

            {/* Trạng thái thanh toán */}
            <td>
              {o.paymentStatus === "paid"
                ? "Đã thanh toán"
                : o.paymentStatus === "unpaid"
                ? "Chưa thanh toán"
                : "Thanh toán thất bại"}
            </td>

            {/* Phương thức */}
            <td>
              {o.paymentMethod === "cod"
                ? "Thanh toán khi nhận hàng"
                : o.paymentMethod.toUpperCase()}
            </td>

            {/* Địa chỉ */}
            <td>
              {o.shippingAddress
                ? `${o.shippingAddress.fullName}, ${o.shippingAddress.phone}, ${o.shippingAddress.detail}, ${o.shippingAddress.ward}, ${o.shippingAddress.district}, ${o.shippingAddress.province}`
                : "Không có"}
            </td>

            {/* Hành động: Hủy + Đánh giá */}
            <td>
              {/* Nút Hủy chỉ cho đơn pending */}
              {o.status === "pending" && (
                <button
                  className="btn-cancel"
                  onClick={() => cancelOrder(o._id)}
                >
                  Hủy
                </button>
              )}

              {/* Nút đánh giá chỉ cho đơn đã giao & đã thanh toán */}
              {o.status === "delivered" && o.paymentStatus === "paid" && (
                <div style={{ marginTop: "6px" }}>
                  {o.items.map((item) => {
                    // Lấy productId linh hoạt
                    const productId =
                      item.product?.$oid || // MongoDB ObjectId gốc
                      item.product?._id?.$oid || // Nếu product là object chứa _id.$oid
                      item.product?._id || // Nếu product là object chứa _id (string)
                      item.product || // Nếu product là string id
                      "";

                    return (
                      <ReviewButton
                        key={item._id?.$oid || item._id || Math.random()}
                        orderId={o.customId}
                        productId={productId}
                      />
                    );
                  })}
                </div>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);





  const renderVouchers = () => (
    <div className="voucher-container">
      <h2 className="voucher-title">Voucher của tôi</h2>
      {["validVouchers", "expiredVouchers", "usedUpVouchers"].map((key) => {
        const titleMap = {
          validVouchers: "✅ Khả dụng",
          expiredVouchers: "⏳ Hết hạn",
          usedUpVouchers: "🚫 Hết lượt",
        };
        const list = vouchers[key] || [];

        const copyCode = (code) => {
          navigator.clipboard.writeText(code).then(() => {
            alert(`Đã copy mã ${code}`);
          });
        };

        return (
          <div key={key} className="voucher-section">
            <h3 className="voucher-section-header">
              <span className="voucher-section-title">{titleMap[key]}</span>
              <span className="voucher-section-count">
                {list.length} voucher
              </span>
            </h3>
            {list.length === 0 ? (
              <p className="voucher-empty">Không có voucher</p>
            ) : (
              list.map((v) => (
                <div key={v.code} className="voucher-card">
                  <div className="voucher-header">
                    <strong className="voucher-code">{v.code}</strong>
                    <p className="voucher-discount">Giảm {v.discount}%</p>
                    {v.expiration && (
                      <p className="voucher-expiration">
                        HSD: {new Date(v.expiration).toLocaleDateString()}
                      </p>
                    )}
                    <button
                      onClick={() => copyCode(v.code)}
                      className="copy-button"
                    >
                      📋 Copy
                    </button>
                  </div>
                  <span className="voucher-quantity">
                    Số lượng: {v.quantity ?? 1} {/* Số lượng rõ chữ và đặt dưới nút copy */}
                  </span>

                </div>
              ))
            )}
          </div>
        );
      })}
    </div>
  );


  return (
    <div className="profile-page">
      <h1>Trang cá nhân</h1>
      <nav>
        <button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}>
          Thông tin cá nhân
        </button>
        <button className={tab === "addresses" ? "active" : ""} onClick={() => setTab("addresses")}>
          Địa chỉ
        </button>
        <button className={tab === "orders" ? "active" : ""} onClick={() => setTab("orders")}>
          Lịch sử đơn hàng
        </button>
        <button className={tab === "vouchers" ? "active" : ""} onClick={() => setTab("vouchers")}>
          Mã giảm giá
        </button>

      </nav>

      <div className="tab-content">
        {tab === "profile" && renderProfile()}
        {tab === "addresses" && renderAddresses()}
        {tab === "orders" && renderOrders()}
        {tab === "vouchers" && renderVouchers()}

      </div>
    </div>
  );
}
