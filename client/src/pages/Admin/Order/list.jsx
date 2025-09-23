// src/pages/Admin/Order/list.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import "./list.css";

const API_URL = "http://localhost:4000";

const toVND = (n) => Number(n || 0).toLocaleString("vi-VN") + "₫";
const fmtKg = (grams) => {
  const g = Number(grams || 0);
  if (g <= 0) return "";
  const kg = g / 1000;
  const isInt = Math.abs(kg - Math.round(kg)) < 1e-9;
  return `${isInt ? Math.round(kg) : kg.toFixed(2)}kg`;
};

// ========== Helpers ==========
const pickText = (...xs) => {
  for (const x of xs) {
    const s = String(x ?? "").trim();
    if (s) return s;
  }
  return "";
};

// Lấy productId từ item hoặc item con combo (phủ nhiều khả năng field)
const getProductIdFrom = (it) => {
  if (!it) return "";
  if (typeof it.productId === "string") return it.productId;
  if (typeof it.product === "string") return it.product;
  if (it.product && typeof it.product._id === "string") return it.product._id;
  if (typeof it.id === "string" && it.id.length >= 8) return it.id; // đôi khi BE để id là _id sản phẩm
  return "";
};

// Lấy tên đã có sẵn trong item (nếu payload có)
const getInlineName = (it) =>
  pickText(
    it?.productName,
    it?.name,
    it?.title,
    it?.product?.name,
    it?.product?.title
  );

// Lấy độ chín/tình trạng
const getRipeness = (it) =>
  pickText(it?.variant?.ripeness, it?.ripeness, it?.condition, it?.state, it?.conditionLabel);

// Lấy nhãn cân nặng (không theo gram)
const getWeightLabel = (it) =>
  pickText(it?.variant?.weight, it?.weight, it?.weightLabel);

// “(Chín vừa, 1kg)”
const variantLabel = (it) => {
  const parts = [];
  const ripe = getRipeness(it);
  const wLabel = getWeightLabel(it);
  if (ripe) parts.push(ripe);
  if (wLabel) parts.push(wLabel);
  return parts.length ? ` (${parts.join(", ")})` : "";
};

// Tạo key ổn định cho item
const makeItemKey = (orderKey, it, idx) => {
  const p = it?.product || it?.productId || it?.id || "";
  const vId = it?.variantId || it?.variant?._id || "";
  const w = it?.variant?.weight || "";
  const r = it?.variant?.ripeness || "";
  const t = it?.type || (it?.isCombo ? "combo" : "variant");
  return it?._id || `${orderKey}__${t}__${p}__${vId}__${w}__${r}__${idx}`;
};

// Key cho item con trong combo
const makeComboChildKey = (parentKey, child, cIdx) => {
  const pid = child?.productId || child?.id || "";
  return `${parentKey}__c_${pid}__${cIdx}`;
};

// Badge nho nhỏ
const Badge = ({ children, tone = "neutral" }) => (
  <span className={`ao-badge ao-badge--${tone}`}>{children}</span>
);

const STATUS_FLOW = ["pending", "confirmed", "shipping", "delivered", "cancelled"];
const STATUS_LABEL = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  shipping: "Đang giao",
  delivered: "Đã giao",
  cancelled: "Đã huỷ",
};

// Địa chỉ rút gọn + đầy đủ
const formatAddress = (addr) => {
  if (!addr) return { short: "—", full: "" };
  const detail = addr.detail || addr.address || addr.addressLine || "";
  const ward = addr.ward || addr.wardName || "";
  const district = addr.district || addr.districtName || "";
  const province = addr.province || addr.provinceName || "";
  const full = [detail, ward, district, province].filter(Boolean).join(", ");
  const short = [detail, ward, district].filter(Boolean).join(", ") || province || "—";
  return { short, full };
};

// Có yêu cầu đổi/trả?
const hasReturnRequest = (order) => {
  const rf =
    order?.returnFlow ||
    order?.return ||
    order?.returnRequest ||
    order?.returnInfo ||
    order?.return_data ||
    null;

  if (!rf) return false;
  if (rf.isOpen) return true;
  if (typeof rf.status === "string" && rf.status.trim() !== "") return true;

  const tl = rf.timeline || {};
  return Boolean(rf.requestedAt || rf.createdAt || tl.requestedAt);
};

export default function AdminOrderPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Cache tên sản phẩm theo id để hiển thị khi payload không có name
  const [productNameCache, setProductNameCache] = useState({}); // { [id]: name }

  const fetchOrders = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/orders/all`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const data = Array.isArray(res.data) ? res.data : res.data?.orders || [];
      setOrders(data);
    } catch (err) {
      console.error("Lỗi khi lấy đơn hàng:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Sau khi có orders: gom tất cả productId (sản phẩm thường + con trong combo) để prefetch tên
  useEffect(() => {
    const ids = new Set();
    for (const o of orders || []) {
      for (const it of o?.items || []) {
        // item thường
        const id1 = getProductIdFrom(it);
        if (id1 && !getInlineName(it)) ids.add(id1);

        // item con combo
        const combo = it?.combo;
        if (it?.isCombo || it?.type === "combo" || combo) {
          const children = Array.isArray(combo?.items) ? combo.items : [];
          for (const c of children) {
            const id2 = getProductIdFrom(c);
            if (id2 && !getInlineName(c)) ids.add(id2);
          }
        }
      }
    }

    const need = [...ids].filter((id) => !productNameCache[id]);
    if (need.length === 0) return;

    (async () => {
      try {
        // Không giả định có API batch, gọi song song từng id và cache
        const reqs = need.map((id) =>
          axios
            .get(`${API_URL}/api/product/${id}`)
            .then((r) => ({ id, name: r?.data?.name || r?.data?.product?.name || "" }))
            .catch(() => ({ id, name: "" }))
        );
        const results = await Promise.all(reqs);
        const map = {};
        results.forEach(({ id, name }) => {
          if (id) map[id] = String(name || "").trim();
        });
        if (Object.keys(map).length) {
          setProductNameCache((prev) => ({ ...prev, ...map }));
        }
      } catch (e) {
        console.error("Prefetch tên sản phẩm lỗi:", e);
      }
    })();
  }, [orders, productNameCache]);

  // Lấy tên hiển thị cuối cùng (ưu tiên name trong item, sau đó tra cache theo id)
  const getDisplayName = (it) => {
    const inline = getInlineName(it);
    if (inline) return inline;
    const id = getProductIdFrom(it);
    if (id && productNameCache[id]) return productNameCache[id];
    return ""; // không fallback id/placeholder
  };

  const getNextStatus = (currentStatus) => {
    const i = STATUS_FLOW.indexOf(currentStatus);
    if (i === -1 || i >= STATUS_FLOW.length - 1) return currentStatus;
    return STATUS_FLOW[i + 1];
  };

  const handleStatusNext = async (orderId, currentStatus) => {
    const newStatus = getNextStatus(currentStatus);
    try {
      await axios.put(
        `${API_URL}/api/orders/${orderId}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );
      fetchOrders();
    } catch (err) {
      console.error("Lỗi cập nhật trạng thái:", err);
    }
  };

  const handleCancelOrder = async (orderId) => {
    try {
      await axios.delete(`${API_URL}/api/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      fetchOrders();
    } catch (err) {
      console.error("Lỗi huỷ đơn:", err);
    }
  };

  // Search (bỏ phần mix)
  const filteredOrders = useMemo(() => {
    const q = (searchTerm || "").toLowerCase().trim();
    if (!q) return orders;
    return orders.filter((o) => {
      const byCode = (o.customId || "").toLowerCase().includes(q);
      const byUser =
        (o.user?.username || "").toLowerCase().includes(q) ||
        (o.user?.email || "").toLowerCase().includes(q);

      const addr = formatAddress(o.shippingAddress);
      const byAddr = addr.full.toLowerCase().includes(q);

      const byItemsName = (o.items || []).some((it) => {
        if ((it?.isCombo || it?.type === "combo" || it?.combo) && Array.isArray(it?.combo?.items)) {
          // tìm theo tên con combo
          if (it.combo.items.some((c) => getDisplayName(c).toLowerCase().includes(q))) return true;
        }
        return getDisplayName(it).toLowerCase().includes(q);
      });

      return byCode || byUser || byAddr || byItemsName;
    });
  }, [orders, searchTerm, productNameCache]);

  if (loading) {
    return <div className="ao-wrap ao-loading">Đang tải...</div>;
  }

  return (
    <div className="ao-wrap">
      <div className="ao-header">
        <h1 className="ao-title">Quản lý Đơn Hàng</h1>
        <div className="ao-search">
          <input
            className="ao-input"
            type="text"
            placeholder="Tìm theo mã đơn, email, địa chỉ, tên sản phẩm..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="ao-table-wrap">
        <table className="ao-table">
          <thead>
            <tr>
              <th className="ao-th ao-th-user">Khách</th>
              <th className="ao-th ao-th-address">Địa chỉ</th>
              <th className="ao-th ao-th-products">Sản phẩm</th>
              <th className="ao-th ao-th-money">Tổng</th>
              <th className="ao-th ao-th-status">Trạng thái</th>
              <th className="ao-th ao-th-pay">Thanh toán</th>
              <th className="ao-th ao-th-method">Phương thức</th>
              <th className="ao-th ao-th-actions">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((order, orderIdx) => {
              const rowKey =
                (order?._id && String(order._id)) ||
                (order?.customId && String(order.customId)) ||
                `order-${orderIdx}`;

              const isReturning = hasReturnRequest(order);
              const next = getNextStatus(order.status);
              const canForward = order.status !== "cancelled" && order.status !== "delivered";
              const canCancel = ["pending", "failed"].includes(order.status);

              const statusText = isReturning ? "Đổi trả" : (STATUS_LABEL[order.status] || order.status);
              const statusClass = isReturning ? "returning" : order.status;

              const addr = formatAddress(order.shippingAddress);

              return (
                <React.Fragment key={rowKey}>
                  <tr className="ao-tr">
                    {/* Khách */}
                    <td className="ao-td ao-td-user">
                      <div className="ao-user">
                        <div className="ao-user-name">{order.user?.username || "—"}</div>
                        {order.user?.email && (
                          <div className="ao-user-email">{order.user.email}</div>
                        )}
                        <div className="ao-order-id">#{order.customId}</div>
                      </div>
                    </td>

                    {/* Địa chỉ */}
                    <td className="ao-td ao-td-address" title={addr.full}>
                      <div className="ao-address">{addr.short}</div>
                      {order.shippingAddress?.phone && (
                        <div className="ao-address-phone">📞 {order.shippingAddress.phone}</div>
                      )}
                    </td>

                    {/* Sản phẩm (tóm tắt) */}
                    <td className="ao-td ao-td-products">
                      <div className="ao-products">
                        {(order.items || []).map((it, idx) => {
                          const itemKey = makeItemKey(rowKey, it, idx);

                          // ---- COMBO ----
                          if (it?.isCombo || it?.type === "combo" || it?.combo) {
                            const combo = it.combo || {};
                            const title = pickText(combo.title, it.productName) || "Combo";
                            const children = Array.isArray(combo.items) ? combo.items : [];

                            return (
                              <div key={itemKey} className="ao-product ao-product--combo">
                                <div className="ao-product-head">
                                  <Badge tone="primary">COMBO</Badge>
                                  <span className="ao-product-name ao-product-name--combo">{title}</span>
                                  {it.quantity ? (
                                    <span className="ao-product-qty">× {it.quantity}</span>
                                  ) : null}
                                </div>

                                {children.length > 0 && (
                                  <ul className="ao-combo-list ao-combo-list--inline">
                                    {children.map((c, cIdx) => {
                                      const cKey = makeComboChildKey(itemKey, c, cIdx);
                                      const baseName = getDisplayName(c);
                                      const label = baseName ? baseName + variantLabel(c) : "";
                                      const qty = Number(c?.qty || 0);
                                      return (
                                        <li key={cKey} className="ao-combo-chip">
                                          <span className="ao-combo-chip__name">{label}</span>
                                          {qty ? (
                                            <span className="ao-combo-chip__qty">×{qty}</span>
                                          ) : null}
                                        </li>
                                      );
                                    })}
                                  </ul>
                                )}
                              </div>
                            );
                          }

                          // ---- Sản phẩm thường (không MIX) ----
                          const baseName = getDisplayName(it);
                          return (
                            <div key={itemKey} className="ao-product">
                              <span className="ao-product-name">{baseName}</span>
                              <span className="ao-product-variant">
                                {variantLabel(it)}
                                {it.quantity ? ` × ${it.quantity}` : ""}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </td>

                    {/* Tổng */}
                    <td className="ao-td ao-td-money">
                      <div className="ao-money">{toVND(order.total)}</div>
                    </td>

                    {/* Trạng thái */}
                    <td className="ao-td ao-td-status">
                      <span className={`ao-status ao-status--${statusClass}`}>
                        {statusText}
                      </span>
                    </td>

                    {/* Thanh toán */}
                    <td className="ao-td ao-td-pay">
                      <span
                        className={`ao-pay ao-pay--${order.paymentStatus}`}
                        title={order.paymentStatus}
                      >
                        {order.paymentStatus === "paid"
                          ? "Đã thanh toán"
                          : order.paymentStatus === "unpaid"
                          ? "Chưa thanh toán"
                          : "Thất bại"}
                      </span>
                    </td>

                    {/* Phương thức */}
                    <td className="ao-td ao-td-method">
                      <span className={`ao-method ao-method--${order.paymentMethod || "cod"}`}>
                        {(order.paymentMethod || "cod").toUpperCase()}
                      </span>
                    </td>

                    {/* Thao tác */}
                    <td className="ao-td ao-td-actions">
                      <div className="ao-actions">
                        <button
                          className="ao-btn ao-btn-outline"
                          onClick={() =>
                            setExpandedOrderId(expandedOrderId === order._id ? null : order._id)
                          }
                        >
                          {expandedOrderId === order._id ? "Ẩn chi tiết" : "Xem chi tiết"}
                        </button>

                        <Link
                          to={`/admin/orders/${order._id}/return`}
                          className="ao-btn ao-btn-return"
                          title="Quản lý yêu cầu đổi/trả"
                        >
                          Quản lý đổi/trả
                        </Link>

                        {["pending", "failed"].includes(order.status) && (
                          <button
                            className="ao-btn ao-btn-danger"
                            onClick={() => handleCancelOrder(order._id)}
                          >
                            Huỷ
                          </button>
                        )}

                        {canForward && (
                          <button
                            className="ao-btn ao-btn-primary"
                            onClick={() => handleStatusNext(order._id, order.status)}
                          >
                            {next !== order.status
                              ? `Chuyển ➜ ${STATUS_LABEL[next] || next}`
                              : "Đã hoàn tất"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Hàng chi tiết */}
                  {expandedOrderId === order._id && (
                    <tr className="ao-tr-detail" key={`${rowKey}__detail`}>
                      <td className="ao-td-detail" colSpan={8}>
                        <div className="ao-detail">
                          <div className="ao-detail-card">
                            <div className="ao-detail-card__title">Thông tin giao hàng</div>
                            <div className="ao-detail-row">
                              <span className="ao-detail-key">Người nhận</span>
                              <span className="ao-detail-val">
                                {order.shippingAddress?.fullName || "—"} — {order.shippingAddress?.phone || "—"}
                              </span>
                            </div>
                            <div className="ao-detail-row">
                              <span className="ao-detail-key">Địa chỉ</span>
                              <span className="ao-detail-val">{addr.full || "—"}</span>
                            </div>
                            <div className="ao-detail-row">
                              <span className="ao-detail-key">Ngày đặt</span>
                              <span className="ao-detail-val">
                                {order.createdAt ? new Date(order.createdAt).toLocaleString("vi-VN") : "—"}
                              </span>
                            </div>
                          </div>

                          <div className="ao-detail-card">
                            <div className="ao-detail-card__title">Sản phẩm</div>

                            <ul className="ao-detail-list">
                              {(order.items || []).map((it, idx) => {
                                const itemKey = `detail_${makeItemKey(rowKey, it, idx)}`;

                                // ---- COMBO ----
                                if (it?.isCombo || it?.type === "combo" || it?.combo) {
                                  const combo = it.combo || {};
                                  const title = pickText(combo.title, it.productName) || "Combo";
                                  const children = Array.isArray(combo.items) ? combo.items : [];

                                  return (
                                    <li key={itemKey} className="ao-detail-item ao-detail-item--combo">
                                      <div className="ao-detail-line">
                                        <Badge tone="primary">COMBO</Badge>
                                        <span className="ao-detail-name ao-detail-name--combo">{title}</span>
                                        {it.quantity ? (
                                          <span className="ao-detail-qty">× {it.quantity}</span>
                                        ) : null}
                                        <span className="ao-detail-price">{toVND(it.price)}</span>
                                      </div>

                                      {children.length > 0 && (
                                        <ul className="ao-combo-items">
                                          {children.map((c, cIdx) => {
                                            const cKey = makeComboChildKey(itemKey, c, cIdx);
                                            const baseName = getDisplayName(c);
                                            const label = baseName ? baseName + variantLabel(c) : "";
                                            const qty = Number(c?.qty || 0);
                                            return (
                                              <li key={cKey} className="ao-combo-item">
                                                <span className="ao-combo-item__dot" />
                                                <span className="ao-combo-item__name">{label}</span>
                                                {qty ? (
                                                  <span className="ao-combo-item__qty">× {qty}</span>
                                                ) : null}
                                              </li>
                                            );
                                          })}
                                        </ul>
                                      )}
                                    </li>
                                  );
                                }

                                // ---- Sản phẩm thường (không MIX) ----
                                const baseName = getDisplayName(it);
                                return (
                                  <li key={itemKey} className="ao-detail-item">
                                    <div className="ao-detail-line">
                                      <span className="ao-detail-name">{baseName}</span>
                                      <span className="ao-detail-variant">
                                        {variantLabel(it)}
                                      </span>
                                      <span className="ao-detail-qty">× {it.quantity}</span>
                                      <span className="ao-detail-price">{toVND(it.price)}</span>
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>

                            {order.voucher?.code && (
                              <div className="ao-detail-row ao-detail-row--muted">
                                <span className="ao-detail-key">Voucher</span>
                                <span className="ao-detail-val">
                                  <Badge tone="success">{order.voucher.code}</Badge>
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
