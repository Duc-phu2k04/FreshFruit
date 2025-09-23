// src/pages/Homepage/CartPage.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { computeExpiryInfo, fmtDate } from "../../utils/expiryHelpers";
import axiosInstance from "../../utils/axiosConfig"; // ✅ dùng axiosInstance để tự động gắn token/cookie
import styles from "./CartPage.module.css"; // ✅ CSS module

export default function CartPage() {
  // ====== Server-cart items ======
  const [items, setItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [comboQuotes, setComboQuotes] = useState({}); // { [productId]: {subtotal, total, discountPercent} }
  const navigate = useNavigate();

  /* ---------------- Helpers ---------------- */
  // Ảnh cho product từ server
  const imgSrc = (p) => {
    const raw = p?.images?.[0]?.url || p?.images?.[0] || p?.image || "";
    if (typeof raw === "string" && /^https?:\/\//i.test(raw)) return raw;
    return `http://localhost:3000${raw || ""}`;
  };

  const variantLabel = (v) => {
    const w = v?.attributes?.weight || v?.weight || "";
    const r = v?.attributes?.ripeness || v?.ripeness || "";
    if (w && /thùng|crate|box/i.test(w)) return w; // “Thùng 10kg”
    if (w && r) return `${w} / ${r}`;
    if (w) return w;
    if (r) return r;
    return "Biến thể";
  };

  // Chuẩn hoá variantId rỗng cho combo để không vỡ API REST hiện tại
  const normVId = (vId) => (vId == null || vId === "" ? "combo" : vId);

  /** Giá cho 1 item thường (ưu tiên _expiry từ server đã tính theo biến thể) */
  const getPricingForRegularItem = (item) => {
    if (!item?.product) {
      return { basePrice: 0, finalPrice: 0, discountPercent: 0, expireAt: null, daysLeft: null };
    }
    if (item?._expiry) {
      const basePrice =
        Number(item._expiry.basePrice ?? item.variant?.price ?? item.product?.baseVariant?.price ?? 0) || 0;
      const finalPrice =
        Number(item._expiry.finalPrice ?? item.variant?.price ?? basePrice) || 0;
      return {
        basePrice,
        finalPrice,
        discountPercent: Number(item._expiry.discountPercent || 0),
        expireAt: item._expiry.expireAt || null,
        daysLeft: typeof item._expiry.daysLeft === "number" ? item._expiry.daysLeft : null,
      };
    }
    // Fallback an toàn FE
    const vPrice = Number(item?.variant?.price ?? 0);
    const projectedProduct = {
      ...item.product,
      variants: [{ price: vPrice }],
      baseVariant: { price: vPrice },
    };
    const info = computeExpiryInfo(projectedProduct);
    return {
      basePrice: Number(info.basePrice ?? vPrice),
      finalPrice: Number(info.finalPrice ?? vPrice),
      discountPercent: Number(info.discountPercent ?? 0),
      expireAt: info.expireAt || null,
      daysLeft: typeof info.daysLeft === "number" ? info.daysLeft : null,
    };
  };

  /** Giá cho 1 item combo (ưu tiên comboQuotes từ API, fallback fields trong product) */
  const getPricingForComboItem = (item) => {
    const pid = item?.product?._id;
    const q = (pid && comboQuotes[pid]) || {};
    const subtotal = Number(q.subtotal ?? item?.product?.comboPrice ?? 0) || 0;
    const total = Number(q.total ?? subtotal) || 0;
    const dcFromQuote = Number(q.discountPercent || 0);
    const dcFromProduct = Number(item?.product?.comboDiscountPercent || 0);
    const dc = total < subtotal ? (dcFromQuote || dcFromProduct) : 0;

    return {
      basePrice: subtotal,
      finalPrice: total,
      discountPercent: dc,
      expireAt: null,
      daysLeft: null,
    };
  };

  /** Dispatcher giá cho mọi loại item server-cart */
  const getPricingForItem = (item) => {
    if (item?.product?.isCombo) return getPricingForComboItem(item);
    return getPricingForRegularItem(item);
  };

  /* === TỒN KHO ĐỒNG BỘ BOX/LOOSE – helper FE === */
  const parseKgFromLabel = (label = "") => {
    const s = String(label || "").toLowerCase().replace(",", ".").replace(/\s+/g, "");
    const m = s.match(/([\d.]+)kg/);
    if (m && Number.isFinite(Number(m[1]))) return Number(m[1]);
    const m2 = s.match(/([\d.]+)/);
    if (m2 && Number.isFinite(Number(m2[1]))) return Number(m2[1]);
    return NaN;
  };

  const isBoxVariant = (variant) => {
    if (!variant) return false;
    if (variant?.kind === "box") return true;
    if (Number(variant?.attributes?.boxWeightKg || 0) > 0) return true;
    const w = String(variant?.attributes?.weight || "").toLowerCase();
    if (/thùng|crate|box/.test(w)) return true;
    return false;
  };

  const computeTotalLooseKg = (product) => {
    const variants = Array.isArray(product?.variants) ? product.variants : [];
    let totalKg = 0;
    for (const v of variants) {
      if (isBoxVariant(v)) continue; // chỉ cộng hàng lẻ
      const wKg = parseKgFromLabel(v?.attributes?.weight || "");
      const unitKg = Number.isFinite(wKg) && wKg > 0 ? wKg : 1;
      const stock = Number(v?.stock || 0);
      totalKg += unitKg * Math.max(0, stock);
    }
    // tránh số lẻ dài
    return Math.max(0, Math.floor(totalKg * 1000) / 1000);
  };

  const kgPerBox = (variant) => {
    const metaKg = Number(variant?.attributes?.boxWeightKg || 0);
    if (metaKg > 0) return metaKg;
    const fromLabel = parseKgFromLabel(variant?.attributes?.weight || "");
    if (Number.isFinite(fromLabel) && fromLabel > 0) return fromLabel;
    return 1;
  };

  const effectiveStockForVariant = (product, variant) => {
    if (!variant) return 0;
    // Hàng lẻ: dùng tồn kho sẵn của biến thể
    if (!isBoxVariant(variant)) {
      return Math.max(0, Number(variant?.stock || 0));
    }
    // Thùng: tính dựa trên tổng kg lẻ
    const totalLooseKg = computeTotalLooseKg(product);
    const perBox = kgPerBox(variant);
    const derivedBoxes = Math.floor(Math.max(0, totalLooseKg) / Math.max(1e-9, perBox));
    const stored = Number(variant?.stock || 0);
    return stored > 0 ? Math.min(derivedBoxes, stored) : derivedBoxes;
  };

  const getEffectiveStockForItem = (item) => {
    try {
      if (!item?.product) return 0;
      if (item.product.isCombo) {
        const s =
          Number(item?.product?.comboInventory?.stock) ||
          Number(item?.product?.comboStock) ||
          0;
        return Math.max(0, s);
      }
      return effectiveStockForVariant(item.product, item.variant);
    } catch {
      return Number(item?.variant?.stock || 0);
    }
  };

  /* ---------------- Data ---------------- */
  const fetchCart = async () => {
    try {
      console.log("🛒 [CartPage] Fetching cart...");
      const { data } = await axiosInstance.get("/cart");
      console.log("🛒 [CartPage] Raw cart data:", data);
      const arr = Array.isArray(data?.items) ? data.items : [];
      // 🔒 lọc bẩn: bỏ item thiếu product/_id để tránh crash
      const clean = arr.filter((it) => it && it.product && it.product._id);
      console.log("🛒 [CartPage] Clean cart items:", clean.length, "items");
      setItems(clean);

      // Giữ các item đã tick nếu vẫn còn (chuẩn hoá variantId cho combo)
      setSelectedItems((prev) => {
        const prevSafe = Array.isArray(prev) ? prev : [];
        const next = clean
          .filter((it) =>
            prevSafe.find(
              (sel) =>
                sel.productId === it.product._id &&
                normVId(sel.variantId) === normVId(it.variantId)
            )
          )
          .map((it) => ({ productId: it.product._id, variantId: normVId(it.variantId) }));
        return next;
      });
    } catch (err) {
      console.error("Lỗi khi tải giỏ hàng:", err?.response?.data || err.message);
      setItems([]);
      setSelectedItems([]);
    }
  };

  useEffect(() => {
    fetchCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lấy combo quote cho tất cả item combo trong giỏ
  useEffect(() => {
    const combos = items.filter((it) => it?.product?.isCombo);
    if (!combos.length) return;

    let isCancelled = false;

    (async () => {
      const results = await Promise.all(
        combos.map(async (it) => {
          try {
            const { data: json } = await axiosInstance.post("/product/combo-quote", {
              comboProductId: it.product._id,
            });
            const q = json?.data || json || {};
            return [
              it.product._id,
              {
                subtotal: Number(q.subtotal || 0),
                total: Number(q.total || 0),
                discountPercent: Number(q.discountPercent || 0),
              },
            ];
          } catch {
            // Fallback — không có quote
            return [
              it.product._id,
              {
                subtotal: Number(it?.product?.comboPrice || 0),
                total: Number(it?.product?.comboPrice || 0),
                discountPercent: Number(it?.product?.comboDiscountPercent || 0),
              },
            ];
          }
        })
      );

      if (!isCancelled) {
        setComboQuotes((prev) => {
          const next = { ...prev };
          for (const [pid, q] of results) next[pid] = q;
          return next;
        });
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [items]);

  /* ---------------- Actions (server items) ---------------- */
  const updateQuantity = async (productId, variantId, quantity) => {
    try {
      const it = items.find(
        (x) =>
          x?.product &&
          String(x.product._id) === String(productId) &&
          String(normVId(x.variantId)) === String(normVId(variantId))
      );
      if (!it) return;
      const eff = getEffectiveStockForItem(it);
      if (eff <= 0) {
        alert("Sản phẩm đã hết hàng.");
        return;
      }
      const q = Math.max(1, Math.min(Number(quantity || 1), eff));

      // Thử PUT trước (giữ nguyên hành vi cũ), nếu không hỗ trợ thì fallback POST
      try {
        await axiosInstance.put("/cart/update", {
          productId,
          variantId: normVId(variantId),
          quantity: q,
        });
      } catch (e) {
        const code = e?.response?.status;
        if (code === 404 || code === 405) {
          await axiosInstance.post("/cart/update", {
            productId,
            variantId: normVId(variantId),
            quantity: q,
          });
        } else {
          throw e;
        }
      }

      fetchCart();
    } catch (err) {
      console.error("Lỗi khi cập nhật số lượng:", err?.response?.data || err.message);
    }
  };

  const removeItem = async (productId, variantId) => {
    try {
      await axiosInstance.delete(
        `/cart/${productId}/${encodeURIComponent(normVId(variantId))}`
      );
      fetchCart();
    } catch (err) {
      console.error("Lỗi khi xoá sản phẩm:", err?.response?.data || err.message);
    }
  };

  // Giữ function (có thể dùng nơi khác), nhưng KHÔNG render UI đổi biến thể trong giỏ

  /* ---------------- Select helpers (server items) ---------------- */
  const serverItems = useMemo(
    () => (Array.isArray(items) ? items.filter((it) => it?.product?._id) : []),
    [items]
  );

  const isSelected = (productId, variantId) =>
    selectedItems.some(
      (s) => s.productId === productId && normVId(s.variantId) === normVId(variantId)
    );

  const toggleSelectItem = (productId, variantId) => {
    setSelectedItems((prev) => {
      const exists = prev.some(
        (s) => s.productId === productId && normVId(s.variantId) === normVId(variantId)
      );
      return exists
        ? prev.filter(
            (s) => !(s.productId === productId && normVId(s.variantId) === normVId(variantId))
          )
        : [...prev, { productId, variantId: normVId(variantId) }];
    });
  };

  const toggleSelectAll = () => {
    const all = serverItems.map((it) => ({
      productId: it.product._id,
      variantId: normVId(it.variantId),
    }));
    setSelectedItems((prev) => (prev.length === serverItems.length ? [] : all));
  };

  const removeSelected = async () => {
    for (const it of selectedItems) {
      // eslint-disable-next-line no-await-in-loop
      await removeItem(it.productId, it.variantId);
    }
    setSelectedItems([]);
  };

  /* ---------------- Totals & Checkout ---------------- */
  const total = useMemo(() => {
    // Chỉ tính server items đã chọn
    return serverItems.reduce((sum, it) => {
      if (!it?.product || !isSelected(it.product._id, it.variantId)) return sum;
      const { finalPrice } = getPricingForItem(it);
      return sum + finalPrice * Number(it.quantity || 0);
    }, 0);
  }, [serverItems, selectedItems, comboQuotes]);

  const handleCheckout = () => {
    const selectedData = serverItems.filter((it) => isSelected(it.product._id, it.variantId));
    navigate("/checkout", {
      state: {
        selectedItems: selectedData.map((it) => {
          const pricing = getPricingForItem(it);
          const eff = getEffectiveStockForItem(it);
          const clampedQty = Math.min(it.quantity, eff || it.quantity);

          return {
            productId: it.product._id,
            variantId: it.product.isCombo ? null : it.variantId,
            quantity: clampedQty,
            product: {
              _id: it.product._id,
              name: it.product.name,
              image: imgSrc(it.product),
              isCombo: !!it.product.isCombo,
            },
            variant: it.product.isCombo ? undefined : it.variant,
            pricing,
          };
        }),
      },
    });
  };

  /* ---------------- Render ---------------- */
  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Giỏ hàng của bạn</h1>
        
      </div>

      {/* ===== SERVER CART ITEMS ===== */}
      {serverItems.length === 0 ? (
        <p className={styles.subtle}>Không có sản phẩm từ kho hiện tại.</p>
      ) : (
        <>
          {/* Toolbar chọn tất cả */}
          <div className={styles.toolbar}>
            <input
              type="checkbox"
              checked={selectedItems.length === serverItems.length && serverItems.length > 0}
              onChange={toggleSelectAll}
              className={styles.checkbox}
            />
            <span className={styles.subtle}>
              Chọn tất cả ({selectedItems.length}/{serverItems.length})
            </span>
            <button onClick={removeSelected} className={styles.remove}>
              Xoá sản phẩm đã chọn
            </button>
          </div>

          {/* List */}
          <div className={styles.list}>
            {serverItems.map((it) => {
              const key = `${it.product._id}-${normVId(it.variantId)}`;
              const { basePrice, finalPrice, discountPercent, expireAt, daysLeft } =
                getPricingForItem(it);

              const effectiveStock = getEffectiveStockForItem(it);
              const outOfStock = effectiveStock <= 0;

              return (
                <div
                  key={key}
                  className={`${styles.row} ${outOfStock ? styles.rowOOS : ""}`}
                >
                  {/* Select */}
                  <input
                    type="checkbox"
                    checked={isSelected(it.product._id, it.variantId)}
                    onChange={() => toggleSelectItem(it.product._id, it.variantId)}
                    className={styles.checkbox}
                    disabled={outOfStock}
                  />

                  {/* Image */}
                  <img
                    src={imgSrc(it.product)}
                    alt={it.product.name}
                    className={styles.thumb}
                  />

                  {/* Info */}
                  <div className={styles.info}>
                    <h3
                      className={styles.name}
                      onClick={() => navigate(`/san-pham/${it.product._id}`)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && navigate(`/san-pham/${it.product._id}`)}
                    >
                      {it.product.name}
                    </h3>

                    {/* Badge & HSD */}
                    <div className={styles.meta}>
                      {it.product.isCombo && (
                        <span className={`${styles.badge} ${styles.badgeSuccess}`}>Combo</span>
                      )}
                      {!it.product.isCombo && expireAt && (
                        <span className={`${styles.badge} ${styles.badgeMuted}`}>
                          HSD: {fmtDate(expireAt)}
                        </span>
                      )}
                      {!it.product.isCombo &&
                        Number.isFinite(daysLeft) &&
                        daysLeft >= 0 && (
                          <span className={`${styles.badge} ${styles.badgeWarning}`}>
                            Còn {daysLeft} ngày
                          </span>
                        )}
                    </div>

                    {/* Biến thể — CHỈ HIỂN THỊ, KHÔNG CHO CHỌN */}
                    {!it.product.isCombo && (
                      <div className={styles.variantRow}>
                        <span className={styles.subtle} style={{ minWidth: 72 }}>Biến thể:</span>
                        <span className={`${styles.badge} ${styles.badgeMuted}`}>
                          {variantLabel(it.variant)}
                        </span>
                        
                      </div>
                    )}

                    {/* Tồn kho hiệu dụng */}
                    <div className={outOfStock ? styles.stockDanger : styles.stockLine}>
                      Còn lại: <b>{effectiveStock}</b>
                      {it.product.isCombo ? " combo" : ""} {outOfStock && "— Hết hàng"}
                    </div>

                    {/* Xem thành phần combo */}
                    {it.product.isCombo && (
                      <div style={{ marginTop: 4 }}>
                        <button
                          onClick={() => navigate(`/san-pham/${it.product._id}`)}
                          className={styles.helperLink}
                        >
                          Xem thành phần combo
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Price (áp dụng cận hạn; combo dùng quote) */}
                  <div className={styles.priceBlock}>
                    <div className={styles.priceFinal}>
                      {finalPrice.toLocaleString("vi-VN")}đ
                    </div>
                    {discountPercent > 0 && finalPrice < basePrice && (
                      <div className={styles.priceBase}>
                        {basePrice.toLocaleString("vi-VN")}đ
                      </div>
                    )}
                  </div>

                  {/* Quantity */}
                  <div className={styles.qty}>
                    <button
                      onClick={() =>
                        updateQuantity(it.product._id, it.variantId, it.quantity - 1)
                      }
                      disabled={it.quantity <= 1 || outOfStock}
                      className={styles.qtyBtn}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      value={Math.min(it.quantity, Math.max(1, effectiveStock) || 1)}
                      min={1}
                      max={Math.max(1, effectiveStock)}
                      onChange={(e) => {
                        const val = Number(e.target.value || 1);
                        const clamped = Math.max(1, Math.min(val, Math.max(1, effectiveStock)));
                        updateQuantity(it.product._id, it.variantId, clamped);
                      }}
                      className={styles.qtyInput}
                      disabled={outOfStock}
                    />
                    <button
                      onClick={() =>
                        updateQuantity(it.product._id, it.variantId, it.quantity + 1)
                      }
                      disabled={outOfStock || it.quantity >= effectiveStock}
                      className={styles.qtyBtn}
                    >
                      +
                    </button>
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => removeItem(it.product._id, it.variantId)}
                    className={styles.remove}
                  >
                    Xoá
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ===== Footer (tổng & checkout) ===== */}
      <div className={styles.footer}>
        <div className={styles.total}>
          Tổng: <span>{total.toLocaleString("vi-VN")}đ</span>
        </div>
        <button
          className={styles.orderBtn}
          disabled={
            selectedItems.length === 0 ||
            serverItems.some(
              (it) =>
                isSelected(it.product._id, it.variantId) &&
                getEffectiveStockForItem(it) < 1
            )
          }
          onClick={handleCheckout}
        >
          Đặt hàng
        </button>
      </div>
    </div>
  );
}
