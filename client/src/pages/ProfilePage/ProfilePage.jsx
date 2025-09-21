// src/pages/ProfilePage.jsx
import "./ProfilePage.css";
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useAuth } from "../../context/useAuth";
import ReviewButton from "./ReviewButton";
import { useNavigate } from "react-router-dom";

const API_URL = "http://localhost:3000";

const logErr = (...args) => console.error("⛔[Address]", ...args);

const PROVINCES_BASES = [
  "https://provinces.open-api.vn/api/v1",
  "https://provinces.open-api.vn/api",
];

const codeVariants = (code) => {
  const s = String(code ?? "").trim();
  if (!s) return [];
  const arr = [s];
  if (/^\d+$/.test(s)) {
    const p3 = s.padStart(3, "0");
    if (!arr.includes(p3)) arr.push(p3);
  }
  return arr;
};

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const token = localStorage.getItem("token");
  const userId = user?._id || null;

  const HANOI_CODE = 1;
  const [districts, setDistricts] = useState([]);
  const [wards, setWards] = useState([]);
  const [editingWards, setEditingWards] = useState([]);

  const [tab, setTab] = useState("profile");
  const [userInfo, setUserInfo] = useState({ username: "", email: "", defaultAddressId: null });
  const [isEditing, setIsEditing] = useState(false);

  const [addresses, setAddresses] = useState([]);
  const [orders, setOrders] = useState([]);
  const [preorders, setPreorders] = useState([]);
  the: {};
  const [preordersLoading, setPreordersLoading] = useState(true);

  const [vouchers, setVouchers] = useState({
    validVouchers: [],
    expiredVouchers: [],
    usedUpVouchers: [],
  });

  const [payingId, setPayingId] = useState(null);
  const [payingKind, setPayingKind] = useState(null);

  // ===== Helpers chung =====
  const fmtMoney = (n) => Number(n || 0).toLocaleString("vi-VN") + "₫";

  const imgSrcGeneric = (raw) => {
    const s =
      (typeof raw === "string" && raw) ||
      raw?.url ||
      raw?.src ||
      "";
    if (!s) return "";
    if (/^https?:\/\//i.test(s)) return s;
    return `http://localhost:3000${s}`;
  };

  // ===== Helpers format địa chỉ =====
  const nameFromCode = (list, code) => {
    if (!code) return "";
    const s = String(code);
    const hit = list.find((x) => String(x.code) === s);
    return hit?.name || "";
  };

  const formatAddress = (addr) => {
    if (!addr) return "";
    const fullName = addr.fullName || addr.name || "";
    const phone = addr.phone || addr.phoneNumber || "";
    const detail = addr.detail || addr.address || addr.street || "";
    const ward =
      addr.ward ||
      addr.wardName ||
      nameFromCode(wards, addr.wardCode || addr.ward_code) ||
      "";
    const district =
      addr.district ||
      addr.districtName ||
      nameFromCode(districts, addr.districtCode || addr.district_code) ||
      "";
    const province = addr.province || addr.provinceName || "Hà Nội";
    return [fullName, phone, detail, ward, district, province].filter(Boolean).join(", ");
  };

  // ===== Default Address =====
  const defaultAddress = useMemo(() => {
    if (!addresses || addresses.length === 0) return null;
    if (userInfo.defaultAddressId) {
      const byId = addresses.find((a) => String(a._id) === String(userInfo.defaultAddressId));
      if (byId) return byId;
    }
    const byFlag = addresses.find((a) => a.isDefault === true);
    if (byFlag) return byFlag;
    return addresses[0] || null;
  }, [addresses, userInfo.defaultAddressId]);

  const defaultAddressString = formatAddress(defaultAddress);

  // ===== Payment helpers =====
  async function callMomo(url) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { message: text }; }

    if (!res.ok) throw new Error(data?.message || "Tạo liên kết thanh toán thất bại");
    if (!data?.payUrl) throw new Error("Không nhận được payUrl từ server");
    window.location.href = data.payUrl;
  }

  const beginPostPaymentRefresh = async () => {
    const params = new URLSearchParams(window.location.search);
    const hasMomoParams =
      params.has("resultCode") || params.has("orderId") || params.has("partnerCode");

    the: {
      const markerRaw = localStorage.getItem("preorderPaying");
      const marker = markerRaw ? (() => { try { return JSON.parse(markerRaw); } catch { return null; } })() : null;

      if (!hasMomoParams && !marker) break the;

      let tries = 0;
      const maxTries = 6;
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

      try {
        while (tries < maxTries) {
          tries += 1;
          await fetchPreorders(true);
          if (marker?.id) {
            const fresh = await axiosAuth.get(`/api/preorders/mine`).then(r => r.data).catch(() => null);
            const list = Array.isArray(fresh?.items) ? fresh.items : (Array.isArray(fresh) ? fresh : []);
            const p = list.find((x) => x._id === marker.id);
            if (p) {
              const paidEnough = Number(p.depositPaid || 0) >= Number(p.depositDue || 0);
              const statusChanged = p.status !== "pending_payment";
              if (paidEnough || statusChanged) break;
            }
          } else {
            if (tries >= 2) break;
          }
          await sleep(2000);
        }
      } catch (e) {
        console.warn("Polling preorder after payment error:", e);
      } finally {
        localStorage.removeItem("preorderPaying");
        if (hasMomoParams) {
          const cleanUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, "", cleanUrl);
        }
      }
    }
  };

  async function handlePayDeposit(preorderId) {
    try {
      localStorage.setItem("preorderPaying", JSON.stringify({ id: preorderId, kind: "deposit", ts: Date.now() }));
      setPayingId(preorderId);
      setPayingKind("deposit");
      await callMomo(`${API_URL}/api/momo-preorder/create-payment-deposit/${preorderId}`);
    } catch (err) {
      alert(err?.message || "Không thể tạo thanh toán cọc");
      localStorage.removeItem("preorderPaying");
    } finally {
      setPayingId(null);
      setPayingKind(null);
    }
  }

  async function handlePayRemaining(preorderId) {
    try {
      localStorage.setItem("preorderPaying", JSON.stringify({ id: preorderId, kind: "remaining", ts: Date.now() }));
      setPayingId(preorderId);
      setPayingKind("remaining");
      await callMomo(`${API_URL}/api/momo-preorder/create-payment-remaining/${preorderId}`);
    } catch (err) {
      alert(err?.message || "Không thể tạo thanh toán phần còn lại");
      localStorage.removeItem("preorderPaying");
    } finally {
      setPayingId(null);
      setPayingKind(null);
    }
  }

  const getProductId = (item) => {
    if (!item) return "";
    let productId = "";

    if (item.product && typeof item.product === "object") {
      productId =
        item.product.$oid ||
        item.product._id?.$oid ||
        item.product._id ||
        item.product.id ||
        "";
    } else if (typeof item.product === "string") {
      productId = item.product;
    }

    if (!productId) {
      productId =
        item.productId ||
        item.product_id ||
        item.productID ||
        item.pid ||
        item.variant?.productId ||
        "";
    }

    if (!productId) logErr("[getProductId] Không tìm được productId cho item:", item);
    return productId;
  };

  const hideOrder = async (orderId) => {
    if (!window.confirm("Bạn có chắc muốn xóa đơn hàng này khỏi lịch sử?")) return;
    try {
      const res = await fetch(`${API_URL}/api/orders/${orderId}/hide`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) return alert(data.message || "Xóa đơn hàng thất bại");
      alert(data.message || "Đã xóa đơn hàng khỏi lịch sử");
      setOrders((prev) => prev.filter((o) => o._id !== orderId));
    } catch {
      alert("Có lỗi xảy ra khi xóa đơn hàng");
    }
  };

  const hidePreorder = async (preorderId) => {
    if (!window.confirm("Bạn có chắc muốn xóa đơn đặt trước này khỏi lịch sử?")) return;
    try {
      const res = await fetch(`${API_URL}/api/preorders/${preorderId}/hide`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) return alert(data?.message || "Xóa đơn đặt trước thất bại");
      alert(data?.message || "Đã xóa đơn đặt trước khỏi lịch sử");
      setPreorders((prev) => prev.filter((p) => p._id !== preorderId));
    } catch {
      alert("Có lỗi xảy ra khi xóa đơn đặt trước");
    }
  };

  // ===== Address edit/new =====
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [editingAddressData, setEditingAddressData] = useState({
    fullName: "",
    phone: "",
    province: "Hà Nội",
    district: "",
    ward: "",
    detail: "",
    districtCode: "",
    wardCode: "",
  });

  const [showAddForm, setShowAddForm] = useState(false);
  const [newAddressForm, setNewAddressForm] = useState({
    fullName: "",
    phone: "",
    province: "Hà Nội",
    district: "",
    ward: "",
    detail: "",
    districtCode: "",
    wardCode: "",
  });

  const axiosAuth = axios.create({
    baseURL: API_URL,
    headers: { Authorization: `Bearer ${token}` },
  });

  useEffect(() => {
    if (!token || !userId) return;

    const fetchAll = async () => {
      try {
        await Promise.all([fetchUserInfo(), fetchAddresses(), fetchOrders(), fetchVouchers(), fetchPreorders()]);
        beginPostPaymentRefresh();

        let loaded = false;
        for (const base of PROVINCES_BASES) {
          const url = `${base}/p/${HANOI_CODE}?depth=2`;
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            const ds = (data.districts || []).map((d) => ({ ...d, code: String(d.code) }));
            setDistricts(ds);
            loaded = true;
            break;
          } else {
            await res.text().catch(() => "");
          }
        }
        if (!loaded) throw new Error("Không tải được danh sách quận/huyện.");
      } catch (error) {
        logErr("Lỗi khi tải dữ liệu:", error);
      }
    };

    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, userId]);

  const handleDistrictChange = async (districtCode, isEditing = false) => {
    const variants = codeVariants(districtCode);
    if (variants.length === 0) return;

    let lastErr = null;
    for (const variant of variants) {
      for (const base of PROVINCES_BASES) {
        const url = `${base}/d/${variant}?depth=2`;
        try {
          const res = await fetch(url);
          if (!res.ok) {
            const txt = await res.text().catch(() => "");
            throw new Error(`status ${res.status} body: ${txt.slice(0, 200)}`);
          }
          const data = await res.json();
          if (isEditing) setEditingWards(data.wards || []);
          else setWards(data.wards || []);
          return;
        } catch (e) {
          lastErr = e;
        }
      }
    }
    logErr("Lỗi khi tải phường/xã", lastErr?.message || lastErr);
    alert("Không tải được danh sách phường/xã. Vui lòng thử lại.");
  };

  // ===== Vouchers =====
  const fetchVouchers = async () => {
    try {
      const res = await axios.get("/api/voucher/my-vouchers", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });

      const apiData = res.data.data || {};
      const formattedData = {
        validVouchers: apiData.validVouchers || apiData.valid || [],
        expiredVouchers: apiData.expiredVouchers || apiData.expired || [],
        usedUpVouchers: apiData.usedUpVouchers || apiData.used || [],
      };
      setVouchers(formattedData);
    } catch (error) {
      logErr("Lỗi khi lấy voucher:", error);
    }
  };

  // ===== User =====
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
      logErr("Lỗi lấy thông tin user:", err.response?.data || err.message);
    }
  };

  const updateUserInfo = async () => {
    try {
      await axiosAuth.put(`/auth/users/${userId}`, userInfo);
      alert("Cập nhật thành công");
      setIsEditing(false);
      fetchUserInfo();

      updateUser({
        ...user,
        username: userInfo.username,
        email: userInfo.email,
        defaultAddressId: userInfo.defaultAddressId,
      });
    } catch (err) {
      logErr("Lỗi cập nhật user:", err.response?.data || err.message);
    }
  };

  // ===== Address CRUD =====
  const fetchAddresses = async () => {
    try {
      const res = await axiosAuth.get(`/api/address`);
      setAddresses(res.data);
    } catch (err) {
      logErr("Lỗi lấy địa chỉ:", err.response?.data || err.message);
    }
  };

  const addAddress = async (newAddressObj) => {
    try {
      await axiosAuth.post(`/api/address`, { ...newAddressObj, user: userId, isDefault: false });
      fetchAddresses();
    } catch (err) {
      logErr("Lỗi thêm địa chỉ:", err.response?.data || err.message);
    }
  };

  const updateAddress = async (id, updated) => {
    try {
      await axiosAuth.put(`/api/address/${id}`, updated);
      fetchAddresses();
    } catch (err) {
      logErr("Lỗi cập nhật địa chỉ:", err.response?.data || err.message);
    }
  };

  const deleteAddress = async (id) => {
    if (!window.confirm("Xóa địa chỉ này?")) return;
    try {
      await axiosAuth.delete(`/api/address/${id}`);

      if (userInfo.defaultAddressId === id) {
        setUserInfo((prev) => ({ ...prev, defaultAddressId: null }));
        await axiosAuth.put(`/auth/users/${userId}`, { ...userInfo, defaultAddressId: null });
      }
      fetchAddresses();
    } catch (err) {
      logErr("Lỗi xóa địa chỉ:", err.response?.data || err.message);
    }
  };

  const selectDefaultAddress = async (addressId) => {
    try {
      await axiosAuth.put(`/auth/users/${userId}`, {
        ...userInfo,
        defaultAddressId: addressId,
      });
      setUserInfo((prev) => ({ ...prev, defaultAddressId: addressId })); 
      updateUser({ ...user, defaultAddressId: addressId });
      alert("Đã chọn địa chỉ mặc định thành công ✅");
    } catch (err) {
      logErr("Lỗi chọn địa chỉ mặc định:", err.response?.data || err.message);
      alert("Không thể chọn địa chỉ mặc định");
    }
  };

  // ===== Orders =====
  const cancelOrder = async (id) => {
    if (!window.confirm("Hủy đơn hàng này?")) return;
    try {
      await axiosAuth.delete(`/api/orders/${id}`);
      fetchOrders();
    } catch (err) {
      logErr("Lỗi hủy đơn:", err.response?.data || err.message);
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await axiosAuth.get(`/api/orders/user`);
      const ordersData = res.data;

      const processedOrders = ordersData.map((order) => ({
        ...order,
        items: order.items.map((item) => ({
          ...item,
          hasReviewed: !!item.reviewData,
        })),
      }));
      setOrders(processedOrders);
    } catch (err) {
      logErr("Lỗi lấy đơn hàng:", err.response?.data || err.message);
    }
  };

  // ===== Preorders =====
  const fetchPreorders = async (quiet = false) => {
    try {
      if (!quiet) setPreordersLoading(true);
      const res = await axiosAuth.get(`/api/preorders/mine`);
      const data = res.data;
      const listRaw = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
      setPreorders(listRaw);
    } catch (err) {
      logErr("Lỗi lấy đơn đặt trước:", err.response?.data || err.message);
    } finally {
      if (!quiet) setPreordersLoading(false);
    }
  };

  // ===== Address helpers (bổ sung) =====
  const startEditAddress = (addr) => {
    setEditingAddressId(addr._id);
    setEditingAddressData({
      fullName: addr.fullName || "",
      phone: addr.phone || "",
      province: addr.province || "Hà Nội",
      district: addr.district || "",
      ward: addr.ward || "",
      detail: addr.detail || "",
      districtCode: addr.districtCode || "",
      wardCode: addr.wardCode || "",
    });
    if (addr.districtCode) {
      handleDistrictChange(String(addr.districtCode), true);
    }
  };

  const cancelEditAddress = () => {
    setEditingAddressId(null);
    setEditingAddressData({
      fullName: "",
      phone: "",
      province: "Hà Nội",
      district: "",
      ward: "",
      detail: "",
      districtCode: "",
      wardCode: "",
    });
    setEditingWards([]);
  };

  const saveEditAddress = async () => {
    if (!editingAddressId) return;
    const payload = {
      ...editingAddressData,
      province: "Hà Nội",
    };
    if (!payload.fullName || !payload.phone || !payload.district || !payload.ward || !payload.detail) {
      alert("Vui lòng điền đầy đủ thông tin địa chỉ.");
      return;
    }
    await updateAddress(editingAddressId, payload);
    cancelEditAddress();
  };

  const saveNewAddress = async () => {
    const payload = {
      ...newAddressForm,
      province: "Hà Nội",
    };
    if (!payload.fullName || !payload.phone || !payload.district || !payload.ward || !payload.detail) {
      alert("Vui lòng điền đầy đủ thông tin địa chỉ.");
      return;
    }
    await addAddress(payload);
    setNewAddressForm({
      fullName: "",
      phone: "",
      province: "Hà Nội",
      district: "",
      ward: "",
      detail: "",
      districtCode: "",
      wardCode: "",
    });
    setWards([]);
    setShowAddForm(false);
  };

  /* ---------- UI helpers for return status ---------- */
  const RETURN_LABEL = {
    return_requested: "Đã gửi yêu cầu",
    return_approved: "Đã duyệt yêu cầu",
    return_awaiting_pickup: "Chờ lấy hàng",
    return_picked_up: "Đã lấy hàng",
    return_in_transit: "Đang hoàn về",
    return_received: "Đã nhận lại",
    refund_issued: "Đã hoàn tiền",
    return_rejected: "Bị từ chối",
  };

  // ====== Helpers để NHẬN DIỆN & HIỂN THỊ GIỎ MIX trong đơn hàng ======
  const isMixOrderItem = (it) => {
    return (
      it?.type === "mix" ||
      it?.isMix === true ||
      Array.isArray(it?.mixItems) ||
      Array.isArray(it?.mix?.items) ||
      it?.snapshot?.type === "mix" ||
      Array.isArray(it?.snapshot?.mixItems) ||
      (Array.isArray(it?.snapshot?.items) && it?.snapshot?.title?.toLowerCase?.().includes("mix"))
    );
  };

  const getMixDisplayName = (it) =>
    it?.displayName ||
    it?.name ||
    it?.title ||
    it?.snapshot?.title ||
    it?.snapshot?.name ||
    "Giỏ Mix";

  const getMixItems = (it) => {
    return (
      it?.mixItems ||
      it?.mix?.items ||
      it?.snapshot?.mixItems ||
      (it?.snapshot?.items && Array.isArray(it?.snapshot?.items) ? it.snapshot.items : []) ||
      []
    );
  };

  const getMixItemName = (m) => m?.name || m?.productName || "Sản phẩm";

  // ====== Renders ======
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
          {defaultAddressString || "Chưa chọn địa chỉ"}
        </div>
      ) : (
        <select
          value={userInfo.defaultAddressId || ""}
          onChange={(e) => setUserInfo({ ...userInfo, defaultAddressId: e.target.value })}
        >
          <option value="">-- Chọn địa chỉ mặc định --</option>
          {addresses.map((addr) => (
            <option key={addr._id} value={addr._id}>
              {formatAddress(addr)}
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
                  value="Hà Nội"
                  disabled
                  style={{ marginBottom: "6px", display: "block", width: "100%" }}
                />
                <select
                  value={editingAddressData.districtCode || ""}
                  onChange={(e) => {
                    const code = String(e.target.value);
                    const selectedDistrict = districts.find((d) => String(d.code) === code);
                    setEditingAddressData({
                      ...editingAddressData,
                      district: selectedDistrict?.name || "",
                      districtCode: code,
                      ward: "",
                      wardCode: "",
                    });
                    handleDistrictChange(code, true);
                  }}
                  style={{ marginBottom: "6px", display: "block", width: "100%" }}
                >
                  <option value="">-- Chọn Quận/Huyện --</option>
                  {districts.map((d) => (
                    <option key={d.code} value={String(d.code)}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <select
                  value={editingAddressData.wardCode || ""}
                  onChange={(e) => {
                    const code = String(e.target.value);
                    const selectedWard = editingWards.find((w) => String(w.code) === code);
                    setEditingAddressData({
                      ...editingAddressData,
                      ward: selectedWard?.name || "",
                      wardCode: selectedWard ? String(selectedWard.code) : "",
                    });
                  }}
                  style={{ marginBottom: "6px", display: "block", width: "100%" }}
                >
                  <option value="">-- Chọn Phường/Xã --</option>
                  {editingWards.map((w) => (
                    <option key={w.code} value={String(w.code)}>
                      {w.name}
                    </option>
                  ))}
                </select>
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
                    {String(userInfo.defaultAddressId) === String(addr._id) ? (
                      <span className="default-label">(Mặc định)</span>
                    ) : (
                      <button
                        onClick={() => selectDefaultAddress(addr._id)}
                        className="btn-default-select"
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
        <div
          style={{
            marginTop: "12px",
            border: "1px solid #ccc",
            padding: "12px",
            borderRadius: "6px",
          }}
        >
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
            value="Hà Nội"
            disabled
            style={{ marginBottom: "6px", display: "block", width: "100%" }}
          />
          <select
            value={newAddressForm.districtCode || ""}
            onChange={(e) => {
              const code = String(e.target.value);
              const selectedDistrict = districts.find((d) => String(d.code) === code);
              setNewAddressForm({
                ...newAddressForm,
                district: selectedDistrict?.name || "",
                districtCode: code,
                ward: "",
                wardCode: "",
              });
              handleDistrictChange(code, false);
            }}
            style={{ marginBottom: "6px", display: "block", width: "100%" }}
          >
            <option value="">-- Chọn Quận/Huyện --</option>
            {districts.map((d) => (
              <option key={d.code} value={String(d.code)}>
                {d.name}
              </option>
            ))}
          </select>
          <select
            value={newAddressForm.wardCode || ""}
            onChange={(e) => {
              const code = String(e.target.value);
              const selectedWard = wards.find((w) => String(w.code) === code);
              setNewAddressForm({
                ...newAddressForm,
                ward: selectedWard?.name || "",
                wardCode: selectedWard ? String(selectedWard.code) : "",
              });
            }}
            style={{ marginBottom: "6px", display: "block", width: "100%" }}
          >
            <option value="">-- Chọn Phường/Xã --</option>
            {wards.map((w) => (
              <option key={w.code} value={String(w.code)}>
                {w.name}
              </option>
            ))}
          </select>
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
            <th>Phí ship</th>
            <th>Tổng tiền</th>
            <th>Trạng thái</th>
            <th>Thanh toán</th>
            <th>Phương thức</th>
            <th>Địa chỉ chi tiết</th>
            <th>Hành động</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            const rf = o.returnFlow || o.return || o.returnRequest || null;
            const returnRequested = !!(rf?.isOpen || rf?.status || rf?.timeline?.requestedAt);

            const mainBadgeClass = returnRequested ? "returning" : o.status;
            const mainBadgeText = returnRequested ? "Đổi/Trả" : o.status;

            const addressString = formatAddress(o.shippingAddress || o.address) || "Không có";

            return (
              <tr key={o._id}>
                <td className="order-id">{o.customId}</td>
                <td>{new Date(o.createdAt).toLocaleDateString("vi-VN")}</td>
                <td>
                  {o.items.map((it, idx) => {
                    // --- Hiển thị GIỎ MIX: chỉ tên + số lượng, KHÔNG icon, KHÔNG giá ---
                    if (isMixOrderItem(it)) {
                      const mixTitle = getMixDisplayName(it);
                      const mixQty = Number(it.quantity || it.qty || 1);
                      const mixList = getMixItems(it);

                      return (
                        <div key={`mix_${idx}`} className="product-item mix-block">
                          <div className="mix-header">
                            <strong>{mixTitle}</strong>{" "}
                            <span className="product-meta">× {mixQty}</span>
                          </div>

                          <div className="mix-lines">
                            {mixList.length === 0 ? (
                              <div className="product-meta">Không có chi tiết sản phẩm</div>
                            ) : (
                              mixList.map((m, i) => (
                                <div key={`mixline_${idx}_${i}`} className="mix-line">
                                  <span className="mix-line-name">
                                    {getMixItemName(m)}
                                  </span>
                                  {Number(m?.qty) ? (
                                    <span className="mix-line-qty"> × {m.qty}</span>
                                  ) : null}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    }

                    // --- Mặc định: combo/lẻ như cũ ---
                    const isCombo = it?.isCombo === true || !!it?.combo || it?.product?.isCombo;
                    const v = it?.variant || it?.variantInfo || {};
                    const weight = v?.weight || v?.attributes?.weight || "";
                    const ripeness = v?.ripeness || v?.attributes?.ripeness || "";
                    const variantText = isCombo
                      ? "Combo"
                      : `(${weight || "—"}, ${ripeness || "—"})`;

                    return (
                      <div key={idx} className="product-item">
                        {it.productName || it?.product?.name || "Sản phẩm"}{" "}
                        <span className="product-meta">
                          {variantText} × {Number(it.quantity || 0)}
                        </span>
                      </div>
                    );
                  })}
                </td>

                <td>{fmtMoney(o.shippingFee)}</td>

                <td className="order-total">
                  {fmtMoney(
                    o.total ??
                      (Number(o.subtotal || 0) - Number(o.discount || 0) + Number(o.shippingFee || 0))
                  )}
                </td>

                <td>
                  <span className={`status-badge ${mainBadgeClass}`}>{mainBadgeText}</span>
                </td>
                <td>
                  {o.paymentStatus === "paid"
                    ? "Đã thanh toán"
                    : o.paymentStatus === "unpaid"
                    ? "Chưa thanh toán"
                    : "Thanh toán thất bại"}
                </td>
                <td>{o.paymentMethod === "cod" ? "Thanh toán khi nhận hàng" : String(o.paymentMethod || "").toUpperCase()}</td>
                <td>{addressString}</td>
                <td>
                  {o.status === "pending" && (
                    <button className="btn-cancel" onClick={() => cancelOrder(o._id)}>
                      Hủy
                    </button>
                  )}

                  {o.status === "delivered" && (
                    <div className="order-actions">
                      {o.items.map((item, index) => {
                        const orderId = o.customId || "";
                        const productId = getProductId(item);
                        const itemKey =
                          item?._id?.$oid || item?._id || `${orderId}-${productId || "noProductId"}-${index}`;
                        // Không bắt review cho mục MIX (thường không có productId), vẫn an toàn với mục thường
                        return (
                          <div key={itemKey} className="review-wrapper">
                            {orderId && productId ? (
                              <ReviewButton orderId={orderId} productId={productId} itemData={item} />
                            ) : null}
                          </div>
                        );
                      })}

                      {!returnRequested ? (
                        <button
                          className="btn"
                          onClick={() =>
                            navigate(`/order-return/${o._id}`, {
                              state: {
                                orderId: o._id,
                                customId: o.customId,
                                items: o.items.map((it) => ({
                                  productName: it.productName || it?.product?.name || getMixDisplayName(it),
                                  variant: it.variant || null,
                                  quantity: it.quantity,
                                  productId: getProductId(it),
                                  isMix: isMixOrderItem(it),
                                  mixItems: isMixOrderItem(it) ? getMixItems(it) : undefined,
                                })),
                                defaultPhone: o?.shippingAddress?.phone || "",
                              },
                            })
                          }
                          title="Gửi yêu cầu đổi/trả cho đơn này"
                        >
                          Yêu cầu đổi/trả
                        </button>
                      ) : null}

                      <button className="btn-delete-order" onClick={() => hideOrder(o._id)}>
                        Xóa đơn
                      </button>
                    </div>
                  )}

                  {o.status === "cancelled" && (
                    <div className="order-actions">
                      <button className="btn-delete-order" onClick={() => hideOrder(o._id)}>
                        Xóa
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const StatusChip = ({ s, isReturnRequested }) => {
    if (isReturnRequested) {
      const ui = { text: "Đổi/Trả", bg: "#EDE9FE", color: "#5B21B6" };
      return (
        <span className="status-chip" style={{ background: ui.bg, color: ui.color }}>
          {ui.text}
        </span>
      );
    }
    const map = {
      pending_payment: { text: "Chờ thanh toán", bg: "#FEF3C7", color: "#92400E" },
      confirmed: { text: "Đã xác nhận đơn hàng", bg: "#DCFCE7", color: "#065F46" },
      shipping: { text: "Đang giao hàng", bg: "#E0F2FE", color: "#075985" },
      delivered: { text: "Đã giao hàng", bg: "#D1FAE5", color: "#065F46" },
      cancelled: { text: "Đã hủy", bg: "#FEE2E2", color: "#991B1B" },
    };
    const ui = map[s] || { text: s, bg: "#EEE", color: "#333" };
    return (
      <span className="status-chip" style={{ background: ui.bg, color: ui.color }}>
        {ui.text}
      </span>
    );
  };

  const renderPreorders = () => {
    return (
      <div className="order-history">
        <h2>Đơn đặt trước</h2>

        {preordersLoading ? (
          <div>Đang tải...</div>
        ) : preorders.length === 0 ? (
          <div style={{ padding: 16, background: "#F9FAFB", borderRadius: 12 }}>
            Chưa có đơn đặt trước nào. <a href="/coming-soon">Khám phá hàng sắp về →</a>
          </div>
        ) : (
          <table className="order-table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Ngày tạo</th>
                <th>Sản phẩm</th>
                <th>Tạm tính</th>
                <th>Đã trả / Còn lại</th>
                <th>Trạng thái</th>
                <th className="address-col">Địa chỉ</th>
                <th className="actions-col">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {preorders.map((p) => {
                const label =
                  p?.variant?.label ||
                  [p?.variant?.attributes?.weight, p?.variant?.attributes?.ripeness]
                    .filter(Boolean)
                    .join(" · ");

                const canUserCancel =
                  !["shipping", "delivered", "cancelled"].includes(p.status);
                const canPayRemaining =
                  ["confirmed", "shipping"].includes(p.status) &&
                  Number(p.remainingDue || 0) > 0;

                const returnRequested = !!(p?.returnFlow?.isOpen || p?.returnFlow?.status || p?.returnFlow?.createdAt);

                return (
                  <tr key={p._id}>
                    <td className="order-id">{p.customId || p._id?.slice(-6)}</td>
                    <td>{p.createdAt ? new Date(p.createdAt).toLocaleDateString("vi-VN") : "—"}</td>
                    <td>
                      <div className="product-item">
                        {p?.product?.name || "—"}{" "}
                        <span className="product-meta">
                          {label ? `(${label})` : ""} × {p.qty}
                        </span>
                      </div>
                    </td>
                    <td>{fmtMoney(p.subtotal)}</td>
                    <td>
                      {fmtMoney(p.depositPaid)} / {fmtMoney(p.remainingDue)}
                    </td>
                    <td>
                      <StatusChip s={p.status} isReturnRequested={returnRequested} />
                    </td>
                    <td className="address-cell">{defaultAddressString || "Chưa chọn"}</td>
                    <td className="actions-cell">
                      {p.status === "pending_payment" && (
                        <div className="order-actions">
                          <button
                            className="btn"
                            onClick={() => handlePayDeposit(p._id)}
                            disabled={payingId === p._id && payingKind === "deposit"}
                          >
                            {payingId === p._id && payingKind === "deposit" ? "Đang tạo link..." : "Thanh toán cọc"}
                          </button>

                          {canUserCancel && (
                            <button
                              className="btn-cancel"
                              onClick={() => hidePreorder(p._id)}
                              disabled={payingId === p._id}
                            >
                              Hủy
                            </button>
                          )}
                        </div>
                      )}

                      {p.status === "confirmed" && (
                        <div className="order-actions">
                          {canPayRemaining && (
                            <button
                              className="btn"
                              onClick={() => handlePayRemaining(p._id)}
                              disabled={payingId === p._id && payingKind === "remaining"}
                            >
                              {payingId === p._id && payingKind === "remaining" ? "Đang tạo link..." : "Thanh toán còn lại"}
                            </button>
                          )}

                          {canUserCancel && (
                            <button
                              className="btn-cancel"
                              onClick={() => hidePreorder(p._id)}
                              disabled={payingId === p._id}
                            >
                              Hủy
                            </button>
                          )}
                        </div>
                      )}

                      {p.status === "shipping" && (
                        <div className="order-actions">
                          {canPayRemaining && (
                            <button
                              className="btn"
                              onClick={() => handlePayRemaining(p._id)}
                              disabled={payingId === p._id && payingKind === "remaining"}
                            >
                              {payingId === p._id && payingKind === "remaining" ? "Đang tạo link..." : "Thanh toán còn lại"}
                            </button>
                          )}
                        </div>
                      )}

                      {p.status === "delivered" && (
                        <div className="order-actions" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {!returnRequested && (
                            <button
                              className="btn return-btn"
                              onClick={() =>
                                navigate(`/return-request/${p._id}`, {
                                  state: {
                                    preorderId: p._id,
                                    productName: p?.product?.name || "",
                                    variantLabel: label || "",
                                    qty: p.qty,
                                    defaultPhone: defaultAddress?.phone || "",
                                  },
                                })
                              }
                            >
                              Yêu cầu đổi/trả
                            </button>
                          )}

                          <button
                            className="btn-delete-order"
                            onClick={() => hidePreorder(p._id)}
                            disabled={returnRequested}
                          >
                            Xóa
                          </button>
                        </div>
                      )}

                      {p.status === "cancelled" && (
                        <div className="order-actions">
                          <button className="btn-delete-order" onClick={() => hidePreorder(p._id)}>
                            Xóa
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    );
  };

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
              <span className="voucher-section-count">{list.length} voucher</span>
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
                    <button onClick={() => copyCode(v.code)} className="copy-button">
                      📋 Copy
                    </button>
                  </div>
                  <span className="voucher-quantity">Số lượng: {v.quantity ?? 1}</span>
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
        <button className={tab === "preorders" ? "active" : ""} onClick={() => setTab("preorders")}>
          Đơn đặt trước
        </button>
        <button className={tab === "vouchers" ? "active" : ""} onClick={() => setTab("vouchers")}>
          Mã giảm giá
        </button>
      </nav>

      <div className="tab-content">
        {tab === "profile" && renderProfile()}
        {tab === "addresses" && renderAddresses()}
        {tab === "orders" && renderOrders()}
        {tab === "preorders" && renderPreorders()}
        {tab === "vouchers" && renderVouchers()}
      </div>
    </div>
  );
}
