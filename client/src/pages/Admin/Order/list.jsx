// src/pages/Admin/Order/list.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import "./list.css";

const API_URL = "http://localhost:3000";

const toVND = (n) => Number(n || 0).toLocaleString("vi-VN") + "₫";
const fmtKg = (grams) => {
  const g = Number(grams || 0);
  if (g <= 0) return "";
  const kg = g / 1000;
  // 1kg, 2kg hiển thị gọn "1kg" — số lẻ thì hiển thị tối đa 2 chữ số thập phân
  const isInt = Math.abs(kg - Math.round(kg)) < 1e-9;
  return `${isInt ? Math.round(kg) : kg.toFixed(2)}kg`;
};

const STATUS_FLOW = ["pending", "confirmed", "shipping", "delivered", "cancelled"];
const STATUS_LABEL = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  shipping: "Đang giao",
  delivered: "Đã giao",
  cancelled: "Đã huỷ",
};

// Địa chỉ rút gọn + đầy đủ (tooltip)
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

// Xác định xem đơn có yêu cầu đổi/trả không
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

// Key ổn định cho item sản phẩm
const makeItemKey = (orderKey, it, idx) => {
  const p = it?.product || it?.productId || it?.id || "";
  const vId = it?.variantId || it?.variant?._id || "";
  const w = it?.variant?.weight || "";
  const r = it?.variant?.ripeness || "";
  const t = it?.type || (it?.isMix ? "mix" : it?.isCombo ? "combo" : "variant");
  return it?._id || `${orderKey}__${t}__${p}__${vId}__${w}__${r}__${idx}`;
};

// Key cho item con bên trong combo
const makeComboChildKey = (parentKey, child, cIdx) => {
  const pid = child?.productId || child?.id || "";
  return `${parentKey}__c_${pid}__${cIdx}`;
};

// Key cho item con bên trong mix
const makeMixChildKey = (parentKey, child, mIdx) => {
  const pid = child?.productId || child?.id || "";
  const grams = child?.weightGram || 0;
  return `${parentKey}__m_${pid}_${grams}__${mIdx}`;
};

// Hiển thị badge nho nhỏ
const Badge = ({ children, tone = "neutral" }) => (
  <span className={`ao-badge ao-badge--${tone}`}>{children}</span>
);

export default function AdminOrderPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

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

  // Bổ sung search trong các item con của mix
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

      const byItemsName = (o.items || []).some((it) =>
        (it.productName || "").toLowerCase().includes(q)
      );

      const byMixChildren =
        (o.items || []).some((it) => {
          const isMix = it?.isMix || it?.type === "mix" || Array.isArray(it?.mix?.items);
          if (!isMix) return false;
          const children = Array.isArray(it?.mix?.items) ? it.mix.items : [];
          return children.some((m) =>
            (m.productName || m.name || "").toLowerCase().includes(q)
          );
        });

      return byCode || byUser || byAddr || byItemsName || byMixChildren;
    });
  }, [orders, searchTerm]);

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
                            const title = combo.title || it.productName || "Combo";
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
                                      return (
                                        <li key={cKey} className="ao-combo-chip">
                                          <span className="ao-combo-chip__name">
                                            {c.productName || c.name || c.productId || "SP"}
                                          </span>
                                          {c.qty ? (
                                            <span className="ao-combo-chip__qty">×{c.qty}</span>
                                          ) : null}
                                        </li>
                                      );
                                    })}
                                  </ul>
                                )}
                              </div>
                            );
                          }

                          // ---- MIX ----
                          const isMix = it?.isMix || it?.type === "mix" || Array.isArray(it?.mix?.items);
                          if (isMix) {
                            const title = it.productName || "Giỏ Mix";
                            const children = Array.isArray(it?.mix?.items) ? it.mix.items : [];

                            return (
                              <div key={itemKey} className="ao-product ao-product--mix">
                                <div className="ao-product-head">
                                  <Badge tone="warning">MIX</Badge>
                                  <span className="ao-product-name ao-product-name--mix">{title}</span>
                                  {it.quantity ? (
                                    <span className="ao-product-qty">× {it.quantity}</span>
                                  ) : null}
                                </div>

                                {children.length > 0 && (
                                  <ul className="ao-combo-list ao-combo-list--inline">
                                    {children.slice(0, 6).map((m, mIdx) => {
                                      const mKey = makeMixChildKey(itemKey, m, mIdx);
                                      const name = m.productName || m.name || m.productId || "SP";
                                      const qty = Number(m.qty || 0);
                                      const w = Number(m.weightGram || 0);
                                      const pieceStr = w > 0 ? `${fmtKg(w)} ×${qty}` : `×${qty}`;
                                      return (
                                        <li key={mKey} className="ao-combo-chip">
                                          <span className="ao-combo-chip__name">{name}</span>
                                          <span className="ao-combo-chip__qty"> {pieceStr}</span>
                                        </li>
                                      );
                                    })}
                                    {children.length > 6 && (
                                      <li className="ao-combo-chip">+{children.length - 6} sp</li>
                                    )}
                                  </ul>
                                )}
                              </div>
                            );
                          }

                          // ---- Sản phẩm đơn ----
                          return (
                            <div key={itemKey} className="ao-product">
                              <span className="ao-product-name">{it.productName}</span>
                              <span className="ao-product-variant">
                                {it?.variant?.weight || it?.variant?.ripeness
                                  ? ` (${[it.variant.weight, it.variant.ripeness].filter(Boolean).join(", ")})`
                                  : ""}{" "}
                                {it.quantity ? `× ${it.quantity}` : ""}
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

                        {canCancel && (
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
                            {next !== order.status ? `Chuyển ➜ ${STATUS_LABEL[next] || next}` : "Đã hoàn tất"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Hàng chi tiết */}
                  {expandedOrderId === order._id && (
                    <tr className="ao-tr-detail" key={`${rowKey}__detail`}>
                      {/* tăng colSpan lên 8 vì có cột Địa chỉ */}
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

                            {/* Danh sách sản phẩm/combos/mix với style rõ ràng */}
                            <ul className="ao-detail-list">
                              {(order.items || []).map((it, idx) => {
                                const itemKey = `detail_${makeItemKey(rowKey, it, idx)}`;

                                // ---- COMBO ----
                                if (it?.isCombo || it?.type === "combo" || it?.combo) {
                                  const combo = it.combo || {};
                                  const title = combo.title || it.productName || "Combo";
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
                                            return (
                                              <li key={cKey} className="ao-combo-item">
                                                <span className="ao-combo-item__dot" />
                                                <span className="ao-combo-item__name">
                                                  {c.productName || c.name || c.productId || "Sản phẩm"}
                                                </span>
                                                {c.qty ? (
                                                  <span className="ao-combo-item__qty">× {c.qty}</span>
                                                ) : null}
                                              </li>
                                            );
                                          })}
                                        </ul>
                                      )}
                                    </li>
                                  );
                                }

                                // ---- MIX ----
                                const isMix = it?.isMix || it?.type === "mix" || Array.isArray(it?.mix?.items);
                                if (isMix) {
                                  const title = it.productName || "Giỏ Mix";
                                  const children = Array.isArray(it?.mix?.items) ? it.mix.items : [];

                                  return (
                                    <li key={itemKey} className="ao-detail-item ao-detail-item--mix">
                                      <div className="ao-detail-line">
                                        <Badge tone="warning">MIX</Badge>
                                        <span className="ao-detail-name ao-detail-name--mix">{title}</span>
                                        {it.quantity ? (
                                          <span className="ao-detail-qty">× {it.quantity}</span>
                                        ) : null}
                                        {/* Giá 1 hộp (đơn giá mix) */}
                                        <span className="ao-detail-price">{toVND(it.price)}</span>
                                      </div>

                                      {children.length > 0 && (
                                        <ul className="ao-combo-items ao-mix-items">
                                          {children.map((m, mIdx) => {
                                            const mKey = makeMixChildKey(itemKey, m, mIdx);
                                            const name = m.productName || m.name || m.productId || "Sản phẩm";
                                            const qtyPerBox = Number(m.qty || 0);
                                            const w = Number(m.weightGram || 0);
                                            const piece =
                                              w > 0
                                                ? `${fmtKg(w)} × ${qtyPerBox} (mỗi hộp)`
                                                : `× ${qtyPerBox} (mỗi hộp)`;
                                            return (
                                              <li key={mKey} className="ao-combo-item ao-mix-item">
                                                <span className="ao-combo-item__dot" />
                                                <span className="ao-combo-item__name">{name}</span>
                                                <span className="ao-combo-item__qty">{piece}</span>
                                              </li>
                                            );
                                          })}
                                        </ul>
                                      )}
                                    </li>
                                  );
                                }

                                // ---- Sản phẩm đơn ----
                                return (
                                  <li key={itemKey} className="ao-detail-item">
                                    <div className="ao-detail-line">
                                      <span className="ao-detail-name">{it.productName}</span>
                                      <span className="ao-detail-variant">
                                        {it?.variant?.weight || it?.variant?.ripeness
                                          ? ` (${[it.variant.weight, it.variant.ripeness].filter(Boolean).join(", ")})`
                                          : ""}
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
