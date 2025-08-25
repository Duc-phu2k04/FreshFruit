// src/pages/ProfilePage.jsx
import "./ProfilePage.css";
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../../context/useAuth";
import ReviewButton from "./ReviewButton";

const API_URL = "http://localhost:3000"; // Đổi baseURL cho khớp backend

// ===== Helpers (log) =====
const log = (...args) => console.log("🏷️[Address]", ...args);
const logErr = (...args) => console.error("⛔[Address]", ...args);

// Dùng absolute URL để tránh lệ thuộc proxy Vite + fallback legacy
const PROVINCES_BASES = [
  "https://provinces.open-api.vn/api/v1",
  "https://provinces.open-api.vn/api",
];

// Chuẩn hoá code về chuỗi, và tạo các biến thể để thử (vd: "6" -> ["6","006"])
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
  const { user, updateUser } = useAuth();
  const token = localStorage.getItem("token");
  const userId = user?._id || null;

  // ===== ĐỊA CHỈ =====
  const HANOI_CODE = 1;
  const [districts, setDistricts] = useState([]);
  const [wards, setWards] = useState([]);
  const [editingWards, setEditingWards] = useState([]);

  // Tabs
  const [tab, setTab] = useState("profile");
  const [userInfo, setUserInfo] = useState({ username: "", email: "", defaultAddressId: null });
  const [isEditing, setIsEditing] = useState(false);

  const [addresses, setAddresses] = useState([]);
  const [orders, setOrders] = useState([]);
  const [preorders, setPreorders] = useState([]);
  const [preordersLoading, setPreordersLoading] = useState(true);

  const [vouchers, setVouchers] = useState({
    validVouchers: [],
    expiredVouchers: [],
    usedUpVouchers: [],
  });

  // ====== MoMo Preorder (FE gọi trực tiếp BE) ======
  const [payingId, setPayingId] = useState(null);     // để disable nút khi đang tạo link
  const [payingKind, setPayingKind] = useState(null); // 'deposit' | 'remaining'

  async function callMomo(url) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });

    // Đọc body 1 lần → parse JSON nếu có, nếu không thì giữ text để báo lỗi
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }

    if (!res.ok) {
      throw new Error(data?.message || "Tạo liên kết thanh toán thất bại");
    }
    if (!data?.payUrl) {
      throw new Error("Không nhận được payUrl từ server");
    }
    window.location.href = data.payUrl;
  }

  // ==== Post-payment refresh (polling sau khi quay về từ MoMo) ====
  const beginPostPaymentRefresh = async () => {
    const params = new URLSearchParams(window.location.search);
    const hasMomoParams =
      params.has("resultCode") || params.has("orderId") || params.has("partnerCode");

    // Có thể có marker do ta set trước khi rời trang
    const markerRaw = localStorage.getItem("preorderPaying");
    const marker = markerRaw ? (() => { try { return JSON.parse(markerRaw); } catch { return null; } })() : null;

    if (!hasMomoParams && !marker) return;

    // Poll 6 lần, mỗi 2s
    let tries = 0;
    const maxTries = 6;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    try {
      while (tries < maxTries) {
        tries += 1;
        await fetchPreorders(true); // true → quiet (không bật loading)
        // Nếu có marker, thử đọc trạng thái của đúng preorder
        if (marker?.id) {
          const p = preorders.find((x) => x._id === marker.id);
          if (p) {
            // Nếu đã đủ cọc hoặc status không còn "pending_payment" → coi như xong
            const paidEnough = Number(p.depositPaid || 0) >= Number(p.depositDue || 0);
            const statusChanged = p.status !== "pending_payment";
            if (paidEnough || statusChanged) break;
          }
        } else {
          // Không có marker (chỉ có query) → poll 1-2 lần là đủ
          if (tries >= 2) break;
        }
        await sleep(2000);
      }
    } catch (e) {
      console.warn("Polling preorder after payment error:", e);
    } finally {
      // Xoá marker & dọn URL
      localStorage.removeItem("preorderPaying");
      if (hasMomoParams) {
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, "", cleanUrl);
      }
    }
  };

  async function handlePayDeposit(preorderId) {
    try {
      // set marker trước khi điều hướng
      localStorage.setItem(
        "preorderPaying",
        JSON.stringify({ id: preorderId, kind: "deposit", ts: Date.now() })
      );
      setPayingId(preorderId);
      setPayingKind("deposit");
      await callMomo(`${API_URL}/api/momo-preorder/create-payment-deposit/${preorderId}`);
    } catch (err) {
      console.error("pay deposit error:", err);
      alert(err?.message || "Không thể tạo thanh toán cọc");
      localStorage.removeItem("preorderPaying");
    } finally {
      setPayingId(null);
      setPayingKind(null);
    }
  }

  async function handlePayRemaining(preorderId) {
    try {
      // set marker trước khi điều hướng
      localStorage.setItem(
        "preorderPaying",
        JSON.stringify({ id: preorderId, kind: "remaining", ts: Date.now() })
      );
      setPayingId(preorderId);
      setPayingKind("remaining");
      await callMomo(`${API_URL}/api/momo-preorder/create-payment-remaining/${preorderId}`);
    } catch (err) {
      console.error("pay remaining error:", err);
      alert(err?.message || "Không thể tạo thanh toán phần còn lại");
      localStorage.removeItem("preorderPaying");
    } finally {
      setPayingId(null);
      setPayingKind(null);
    }
  }

  // Lấy chuỗi địa chỉ mặc định hiện tại
  const defaultAddressString = (() => {
    if (!userInfo.defaultAddressId) return null;
    const addr = addresses.find((a) => a._id === userInfo.defaultAddressId);
    if (!addr) return null;
    return `${addr.fullName}, ${addr.phone}, ${addr.detail}, ${addr.ward}, ${addr.district}, ${addr.province}`;
  })();

  // Hàm lấy productId linh hoạt + log chi tiết
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

    if (!productId) {
      logErr("[getProductId] Không tìm được productId cho item:", item);
    } else {
      log("[getProductId] Tìm thấy productId:", productId);
    }
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
      if (!res.ok) {
        alert(data.message || "Xóa đơn hàng thất bại");
        return;
      }

      alert(data.message || "Đã xóa đơn hàng khỏi lịch sử");
      setOrders((prev) => prev.filter((o) => o._id !== orderId));
    } catch (err) {
      console.error(err);
      alert("Có lỗi xảy ra khi xóa đơn hàng");
    }
  };

  // NEW: Ẩn (xóa khỏi lịch sử) đơn đặt trước
  const hidePreorder = async (preorderId) => {
    if (!window.confirm("Bạn có chắc muốn xóa đơn đặt trước này khỏi lịch sử?")) return;

    try {
      const res = await fetch(`${API_URL}/api/preorders/${preorderId}/hide`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        alert(data?.message || "Xóa đơn đặt trước thất bại");
        return;
      }

      alert(data?.message || "Đã xóa đơn đặt trước khỏi lịch sử");
      setPreorders((prev) => prev.filter((p) => p._id !== preorderId));
    } catch (err) {
      console.error(err);
      alert("Có lỗi xảy ra khi xóa đơn đặt trước");
    }
  };

  // Trạng thái sửa/ thêm địa chỉ
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [editingAddressData, setEditingAddressData] = useState({
    fullName: "",
    phone: "",
    province: "",
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
    province: "",
    district: "",
    ward: "",
    detail: "",
    districtCode: "",
    wardCode: "",
  });

  // Axios instance
  const axiosAuth = axios.create({
    baseURL: API_URL,
    headers: { Authorization: `Bearer ${token}` },
  });

  // ===== useEffect chung =====
  useEffect(() => {
    if (!token || !userId) {
      console.warn("Token hoặc userId không tồn tại");
      return;
    }

    const fetchAll = async () => {
      try {
        await Promise.all([fetchUserInfo(), fetchAddresses(), fetchOrders(), fetchVouchers(), fetchPreorders()]);
        // Sau khi load dữ liệu lần đầu, kiểm tra xem có vừa quay về từ MoMo hay không để poll cập nhật
        beginPostPaymentRefresh();

        // 🔧 Dùng absolute URL (không qua proxy) + fallback + log chi tiết
        let loaded = false;
        for (const base of PROVINCES_BASES) {
          const url = `${base}/p/${HANOI_CODE}?depth=2`;
          log("Fetch districts of province:", { url });
          const res = await fetch(url);
          log("Fetch districts status:", res.status);
          if (res.ok) {
            const data = await res.json();
            const ds = (data.districts || []).map((d) => ({ ...d, code: String(d.code) }));
            setDistricts(ds);
            log("Loaded districts sample:", ds.slice(0, 3));
            loaded = true;
            break;
          } else {
            const text = await res.text().catch(() => "");
            logErr(`Load districts failed ${res.status}:`, text?.slice(0, 200));
          }
        }
        if (!loaded) throw new Error("Không tải được danh sách quận/huyện Hà Nội từ tất cả endpoints.");
      } catch (error) {
        logErr("Lỗi khi tải dữ liệu:", error);
      }
    };

    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, userId]);

  // ===== Lấy phường/xã theo quận/huyện =====
  const handleDistrictChange = async (districtCode, isEditing = false) => {
    const variants = codeVariants(districtCode);
    if (variants.length === 0) return;

    log("handleDistrictChange() start", { districtCode, variants, isEditing });

    let lastErr = null;
    for (const variant of variants) {
      for (const base of PROVINCES_BASES) {
        const url = `${base}/d/${variant}?depth=2`;
        log("→ Try URL:", url);
        try {
          const res = await fetch(url);
          log("   status:", res.status);
          if (!res.ok) {
            const txt = await res.text().catch(() => "");
            throw new Error(`status ${res.status} body: ${txt.slice(0, 200)}`);
          }
          const data = await res.json();
          log("   wards sample:", Array.isArray(data.wards) ? data.wards.slice(0, 3) : data);

          if (isEditing) setEditingWards(data.wards || []);
          else setWards(data.wards || []);
          return; // thành công → thoát hẳn
        } catch (e) {
          lastErr = e;
          logErr("   failed:", { variant, base, err: e?.message || e });
        }
      }
    }

    // Nếu tất cả variant đều fail:
    logErr("Lỗi khi tải phường/xã (tất cả biến thể thất bại)", lastErr?.message || lastErr);
    alert("Không tải được danh sách phường/xã cho quận đã chọn. Vui lòng thử lại.");
  };

  // ===== Vouchers =====
  const fetchVouchers = async () => {
    try {
      const res = await axios.get("/api/voucher/my-vouchers", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });

      log("📦 API voucher trả về:", res.data);

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
          hasReviewed: item.reviewData ? true : false,
        })),
      }));
      setOrders(processedOrders);
    } catch (err) {
      logErr("Lỗi lấy đơn hàng:", err.response?.data || err.message);
    }
  };

  // ===== PREORDERS =====
  const fetchPreorders = async (quiet = false) => {
    try {
      if (!quiet) setPreordersLoading(true);
      const res = await axiosAuth.get(`/api/preorders/mine`);
      const data = res.data;
      const listRaw = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
      // ❗ Không ẩn các đơn đã hủy để có thể hiển thị nút Xóa
      setPreorders(listRaw);
    } catch (err) {
      logErr("Lỗi lấy đơn đặt trước:", err.response?.data || err.message);
    } finally {
      if (!quiet) setPreordersLoading(false);
    }
  };

  // Hủy đơn đặt trước
  const cancelPreorder = async (id) => {
    if (!window.confirm("Bạn chắc chắn muốn hủy đơn đặt trước này?")) return;
    try {
      const res = await axiosAuth.patch(`/api/preorders/${id}/cancel`);
      const data = res.data;
      if (!res.status || (data && data.ok === false)) {
        throw new Error(data?.message || "Hủy đơn đặt trước thất bại");
      }
      alert(data?.message || "Đã hủy đơn đặt trước");
      // Reload list để vẫn hiện bản ghi (trạng thái 'cancelled') và có nút Xóa
      fetchPreorders(true);
    } catch (err) {
      logErr("Lỗi hủy đơn đặt trước:", err.response?.data || err.message);
      alert(err?.response?.data?.message || err?.message || "Không thể hủy đơn đặt trước");
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
      districtCode: addr.districtCode ? String(addr.districtCode) : "",
      wardCode: addr.wardCode ? String(addr.wardCode) : "",
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
      province: "",
      district: "",
      ward: "",
      detail: "",
      districtCode: "",
      wardCode: "",
    });
  };

  const saveEditAddress = () => {
    log("📝 [saveEditAddress] data:", editingAddressData);
    const { fullName, phone, district, ward, detail } = editingAddressData;
    if (!fullName || !phone || !district || !ward || !detail) {
      alert("Vui lòng điền đầy đủ thông tin địa chỉ");
      logErr("⚠️ [saveEditAddress] Thiếu trường:", {
        fullName: !!fullName,
        phone: !!phone,
        district: !!district,
        ward: !!ward,
        detail: !!detail,
      });
      return;
    }
    const payload = {
      ...editingAddressData,
      province: editingAddressData.province || "Hà Nội",
    };
    updateAddress(editingAddressId, payload);
    cancelEditAddress();
  };

  // --- XỬ LÝ THÊM ĐỊA CHỈ MỚI ---
  const saveNewAddress = () => {
    log("📝 [saveNewAddress] form:", newAddressForm);

    const { fullName, phone, district, ward, detail } = newAddressForm;
    if (!fullName || !phone || !district || !ward || !detail) {
      alert("Vui lòng điền đầy đủ thông tin địa chỉ");
      logErr("⚠️ [saveNewAddress] Thiếu trường:", {
        fullName: !!fullName,
        phone: !!phone,
        district: !!district,
        ward: !!ward,
        detail: !!detail,
      });
      return;
    }

    const payload = {
      ...newAddressForm,
      province: newAddressForm.province || "Hà Nội",
    };

    log("📤 [saveNewAddress] Submit payload:", payload);
    addAddress(payload);

    // Reset form
    setNewAddressForm({
      fullName: "",
      phone: "",
      province: "",
      district: "",
      ward: "",
      detail: "",
      districtCode: "",
      wardCode: "",
    });
    setShowAddForm(false);
  };

  // --- CHỌN ĐỊA CHỈ MẶC ĐỊNH ---
  const selectDefaultAddress = async (addressId) => {
    try {
      await axiosAuth.put(`/auth/users/${userId}`, {
        ...userInfo,
        defaultAddressId: addressId,
      });

      setUserInfo((prev) => ({ ...prev, defaultAddressId: addressId }));
      updateUser({
        ...user,
        defaultAddressId: addressId,
      });

      alert("Đã chọn địa chỉ mặc định thành công ✅");
    } catch (err) {
      logErr("Lỗi chọn địa chỉ mặc định:", err.response?.data || err.message);
      alert("Không thể chọn địa chỉ mặc định");
    }
  };

  // ===== Render =====
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

                {/* Province: cố định Hà Nội */}
                <input
                  type="text"
                  value="Hà Nội"
                  disabled
                  style={{ marginBottom: "6px", display: "block", width: "100%" }}
                />

                {/* District select */}
                <select
                  value={editingAddressData.districtCode || ""}
                  onChange={(e) => {
                    const code = String(e.target.value);
                    const selectedDistrict = districts.find((d) => String(d.code) === code);
                    log("Edit district select change:", { code, selectedDistrict });
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

                {/* Ward select */}
                <select
                  value={editingAddressData.wardCode || ""}
                  onChange={(e) => {
                    const code = String(e.target.value);
                    const selectedWard = editingWards.find((w) => String(w.code) === code);
                    log("Edit ward select change:", { code, selectedWard });
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

      {/* Form thêm địa chỉ mới */}
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

          {/* Province: cố định Hà Nội */}
          <input
            type="text"
            value="Hà Nội"
            disabled
            style={{ marginBottom: "6px", display: "block", width: "100%" }}
          />

          {/* District select */}
          <select
            value={newAddressForm.districtCode || ""}
            onChange={(e) => {
              const code = String(e.target.value);
              const selectedDistrict = districts.find((d) => String(d.code) === code);
              log("New district select change:", { code, selectedDistrict });
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

          {/* Ward select */}
          <select
            value={newAddressForm.wardCode || ""}
            onChange={(e) => {
              const code = String(e.target.value);
              const selectedWard = wards.find((w) => String(w.code) === code);
              log("New ward select change:", { code, selectedWard });
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
              <td className="order-id">{o.customId}</td>
              <td>{new Date(o.createdAt).toLocaleDateString("vi-VN")}</td>
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
              <td className="order-total">{o.total.toLocaleString("vi-VN")}₫</td>
              <td>
                <span className={`status-badge ${o.status}`}>{o.status}</span>
              </td>
              <td>
                {o.paymentStatus === "paid"
                  ? "Đã thanh toán"
                  : o.paymentStatus === "unpaid"
                  ? "Chưa thanh toán"
                  : "Thanh toán thất bại"}
              </td>
              <td>
                {o.paymentMethod === "cod"
                  ? "Thanh toán khi nhận hàng"
                  : o.paymentMethod.toUpperCase()}
              </td>
              <td>
                {o.shippingAddress
                  ? `${o.shippingAddress.fullName}, ${o.shippingAddress.phone}, ${o.shippingAddress.detail}, ${o.shippingAddress.ward}, ${o.shippingAddress.district}, ${o.shippingAddress.province}`
                  : "Không có"}
              </td>
              <td>
                {o.status === "pending" && (
                  <button className="btn-cancel" onClick={() => cancelOrder(o._id)}>
                    Hủy
                  </button>
                )}

                {o.status === "delivered" && (
                  <div className="order-actions">
                    {/* Review cho từng item */}
                    {o.items.map((item, index) => {
                      const orderId = o.customId || "";
                      const productId = getProductId(item);
                      const itemKey =
                        item?._id?.$oid ||
                        item?._id ||
                        `${orderId}-${productId || "noProductId"}-${index}`;

                      return (
                        <div key={itemKey} className="review-wrapper">
                          {orderId && productId ? (
                            <ReviewButton orderId={orderId} productId={productId} itemData={item} />
                          ) : (
                            <small style={{ opacity: 0.7, color: "red" }}>❌ Thiếu productId</small>
                          )}
                        </div>
                      );
                    })}
                    {/* Chỉ một nút Xóa duy nhất cho cả đơn */}
                    <button className="btn-delete-order" onClick={() => hideOrder(o._id)}>
                      Xóa đơn
                    </button>
                  </div>
                )}

                {o.status === "cancelled" && (
                  <div className="order-actions">
                    {/* Đơn đã hủy: chỉ một nút Xóa */}
                    <button className="btn-delete-order" onClick={() => hideOrder(o._id)}>
                      Xóa đơn
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // ====== UI “Đơn đặt trước” ======
  const StatusChip = ({ s }) => {
    const map = {
      pending_payment: { text: "Chờ thanh toán", bg: "#FEF3C7", color: "#92400E" },
      reserved: { text: "Đã giữ chỗ", bg: "#E0F2FE", color: "#075985" },
      awaiting_stock: { text: "Chờ hàng", bg: "#F3F4F6", color: "#374151" },
      ready_to_fulfill: { text: "Sẵn sàng giao", bg: "#DCFCE7", color: "#065F46" },
      payment_due: { text: "Đến hạn thanh toán", bg: "#FFE4E6", color: "#9F1239" },
      converted: { text: "Đã chuyển thành đơn", bg: "#EDE9FE", color: "#5B21B6" },
      cancelled: { text: "Đã hủy", bg: "#FEE2E2", color: "#991B1B" },
      refunded: { text: "Đã hoàn tiền", bg: "#E0F2F1", color: "#0F766E" },
      expired: { text: "Hết hạn", bg: "#EEE", color: "#555" },
      delivered: { text: "Đã giao", bg: "#E0E7FF", color: "#3730A3" }, // thêm để hiển thị đẹp hơn
    };
    const ui = map[s] || { text: s, bg: "#EEE", color: "#333" };
    return (
      <span style={{ background: ui.bg, color: ui.color, padding: "4px 8px", borderRadius: 8, fontSize: 12 }}>
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
                return (
                  <tr key={p._id}>
                    <td className="order-id">{p.customId || p._id?.slice(-6)}</td>
                    <td>
                      {p.createdAt
                        ? new Date(p.createdAt).toLocaleDateString("vi-VN")
                        : "—"}
                    </td>
                    <td>
                      <div className="product-item">
                        {p?.product?.name || "—"}{" "}
                        <span className="product-meta">
                          {label ? `(${label})` : ""} × {p.qty}
                        </span>
                      </div>
                    </td>
                    <td>
                      {Number(p.subtotal || 0).toLocaleString("vi-VN")}₫
                    </td>
                    <td>
                      {Number(p.depositPaid || 0).toLocaleString("vi-VN")}₫ /{" "}
                      {Number(p.remainingDue || 0).toLocaleString("vi-VN")}₫
                    </td>
                    <td>
                      <StatusChip s={p.status} />
                    </td>
                    <td className="address-cell">
                      {defaultAddressString || "Chưa chọn"}
                    </td>
                    <td className="actions-cell">
                      {/* Hành động theo trạng thái */}
                      {p.status === "pending_payment" && (
                        <div className="order-actions">
                          <button
                            className="btn"
                            onClick={() => handlePayDeposit(p._id)}
                            disabled={payingId === p._id && payingKind === "deposit"}
                            title="Thanh toán tiền cọc qua MoMo"
                          >
                            {payingId === p._id && payingKind === "deposit"
                              ? "Đang tạo link..."
                              : "Thanh toán cọc"}
                          </button>
                          <button
                            className="btn-cancel"
                            onClick={() => cancelPreorder(p._id)}
                            disabled={payingId === p._id}
                          >
                            Hủy
                          </button>
                        </div>
                      )}

                      {["ready_to_fulfill", "payment_due"].includes(p.status) && (
                        <div className="order-actions">
                          <button
                            className="btn"
                            onClick={() => handlePayRemaining(p._id)}
                            disabled={payingId === p._id && payingKind === "remaining"}
                            title="Thanh toán phần còn lại qua MoMo"
                          >
                            {payingId === p._id && payingKind === "remaining"
                              ? "Đang tạo link..."
                              : "Thanh toán còn lại"}
                          </button>
                          <button
                            className="btn-cancel"
                            onClick={() => cancelPreorder(p._id)}
                            disabled={payingId === p._id}
                          >
                            Hủy
                          </button>
                        </div>
                      )}

                      {["reserved", "awaiting_stock"].includes(p.status) && (
                        <div className="order-actions">
                          <button
                            className="btn-cancel"
                            onClick={() => cancelPreorder(p._id)}
                            disabled={payingId === p._id}
                          >
                            Hủy
                          </button>
                        </div>
                      )}

                      {/*Thêm nút XÓA cho delivered & cancelled  */}
                      {["delivered", "cancelled"].includes(p.status) && (
                        <div className="order-actions">
                          <button
                            className="btn-delete-order"
                            onClick={() => hidePreorder(p._id)}
                            title="Xóa đơn đặt trước khỏi lịch sử"
                          >
                            Xóa
                          </button>
                        </div>
                      )}

                      {["converted", "refunded", "expired"].includes(p.status) && (
                        <span style={{ opacity: 0.7 }}>—</span>
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
