// src/pages/ProductList/ProductList.jsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import "./ProductList.css";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Pagination from "../../components/common/Pagination";

// Helpers hạn sử dụng
import { computeExpiryInfo, fmtDate } from "../../utils/expiryHelpers";

/* ================================
   Small UI Components (Checkbox)
   ================================ */

/**
 * Checkbox item
 * props:
 *  - id, label, checked, onChange
 */
function FFCheckboxItem({ id, label, checked, onChange, count }) {
  return (
    <label
      className={[
        "ff-filter-item",
        "ff-checkbox-item",
        checked ? "is-checked" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      htmlFor={id}
    >
      <input
        id={id}
        type="checkbox"
        className="ff-checkbox"
        checked={checked}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      <span className="ff-checkbox-label">
        {label}
        {Number.isFinite(count) && (
          <span className="ff-checkbox-count">({count})</span>
        )}
      </span>
    </label>
  );
}

/**
 * Checkbox Group Filter
 * props:
 *  - title: string
 *  - items: [{ _id, name, count? }]
 *  - selected: string[] (ids)
 *  - onChange: (ids: string[]) => void
 *  - blockKey: string (for stable htmlFor/id)
 */
function FFCheckboxGroup({
  title,
  items = [],
  selected = [],
  onChange,
  blockKey = "group",
  enableSearch = true,
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const k = (q || "").trim().toLowerCase();
    if (!k) return items;
    return items.filter((it) =>
      String(it?.name || "").toLowerCase().includes(k)
    );
  }, [items, q]);

  const isAllChecked =
    Array.isArray(selected) &&
    selected.length > 0 &&
    filtered.every((it) => selected.includes(String(it?._id)));

  const toggleAll = () => {
    if (isAllChecked) {
      const remain = (selected || []).filter(
        (id) => !filtered.some((it) => String(it?._id) === String(id))
      );
      onChange?.(remain);
    } else {
      const merged = new Set([...(selected || [])]);
      filtered.forEach((it) => merged.add(String(it?._id)));
      onChange?.(Array.from(merged));
    }
  };

  const clearAll = () => onChange?.([]);

  return (
    <div className="ff-filter-card">
      <div className="ff-filter-card__header">
        <h3 className="ff-filter-title">{title}</h3>

        <div className="ff-filter-actions">
          <button
            type="button"
            className="ff-btn ff-btn--soft"
            onClick={toggleAll}
          >
            {isAllChecked ? "Bỏ chọn tất cả" : "Chọn tất cả"}
          </button>
          <button
            type="button"
            className="ff-btn ff-btn--link"
            onClick={clearAll}
          >
            Xóa chọn
          </button>
        </div>
      </div>

      {enableSearch && (
        <div className="ff-filter-search">
          <input
            className="ff-input"
            placeholder="Tìm..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      )}

      <div className="ff-filter-list">
        {filtered.length === 0 ? (
          <div className="ff-filter-empty">Không có mục phù hợp</div>
        ) : (
          filtered.map((it, idx) => {
            const id = `${blockKey}-${it?._id || idx}`;
            const checked = (selected || []).includes(String(it?._id));
            return (
              <FFCheckboxItem
                key={id}
                id={id}
                label={it?.name || "Không tên"}
                checked={checked}
                count={it?.count}
                onChange={(isOn) => {
                  if (isOn) {
                    onChange?.([...(selected || []), String(it?._id)]);
                  } else {
                    onChange?.(
                      (selected || []).filter((x) => String(x) !== String(it?._id))
                    );
                  }
                }}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

export default function ProductListPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedLocations, setSelectedLocations] = useState([]);

  // Bộ lọc client-side
  const [discountOnly, setDiscountOnly] = useState(false);
  const [comboFilter, setComboFilter] = useState("all"); // all | only | exclude

  const [currentPage, setCurrentPage] = useState(1);
  const productsPerPage = 12;
  const navigate = useNavigate();

  const fetchFilters = useCallback(async () => {
    try {
      const [catRes, locRes] = await Promise.all([
        fetch("http://localhost:3000/api/category"),
        fetch("http://localhost:3000/api/locations"),
      ]);
      const cats = await catRes.json();
      const locs = await locRes.json();

      // Chuẩn hóa: đảm bảo có _id & name
      setCategories(
        Array.isArray(cats)
          ? cats.map((c) => ({ _id: c?._id || c?.id || c?.value, name: c?.name || c?.label || "" }))
          : []
      );
      setLocations(
        Array.isArray(locs)
          ? locs.map((l) => ({ _id: l?._id || l?.id || l?.value, name: l?.name || l?.label || "" }))
          : []
      );
    } catch (err) {
      console.error("Lỗi khi lấy danh mục hoặc khu vực:", err);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      // Luôn loại sản phẩm Coming Soon khỏi trang list thường
      let url = "http://localhost:3000/api/product";
      const params = [];

      if (selectedCategories.length) {
        params.push(`category=${selectedCategories.join(",")}`);
      }
      if (selectedLocations.length) {
        params.push(`location=${selectedLocations.join(",")}`);
      }
      params.push("preorder=false");

      if (params.length) url += `?${params.join("&")}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error("Lỗi khi lấy danh sách sản phẩm");
      const data = await res.json();

      let productArray = [];
      if (Array.isArray(data)) productArray = data;
      else if (Array.isArray(data.products)) productArray = data.products;
      else if (Array.isArray(data.data)) productArray = data.data;
      else console.error("❌ Dữ liệu trả về không phải mảng!");

      setProducts(productArray);
      setCurrentPage(1);
    } catch (err) {
      console.error("Lỗi khi fetch sản phẩm:", err);
    }
  }, [selectedCategories, selectedLocations]);

  useEffect(() => {
    fetchFilters();
  }, [fetchFilters]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleViewDetail = (product) => {
    navigate(`/san-pham/${product._id}`, { state: product });
  };

  // ----- Utils an toàn để đọc dữ liệu không đồng nhất -----
  const asNumber = (v, def = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  };

  const isComboProduct = (p) => {
    const t = typeof p?.type === "string" ? p.type.toLowerCase() : p?.type;
    return Boolean(p?.isCombo || t === "combo");
  };

  // Tồn kho hiển thị cho combo
  const getComboStock = (p) => {
    const candidates = [
      p?.comboInventory?.stock, // chuẩn mới
      p?.comboStock,            // fallback
      p?.stock,                 // trộn chung
      p?.inventory?.stock,      // fallback khác
      p?.inventory,             // inventory là số
      p?.available,             // fallback
    ];
    for (const c of candidates) {
      const n = asNumber(c, NaN);
      if (Number.isFinite(n)) return Math.max(0, n);
    }
    return 0;
  };

  // Giá hiển thị cho combo
  const getComboPrice = (p, fallback) => {
    const fixed = p?.comboPricing?.fixedPrice;
    const base = asNumber(fallback, 0);
    if (Number.isFinite(asNumber(fixed, NaN))) return asNumber(fixed, base);
    return base; // nếu mode discount tổng, FE vẫn lấy base để hiển thị
  };

  // Lọc client-side: combo + cận hạn
  const filteredProducts = useMemo(() => {
    let list = Array.isArray(products) ? products.slice() : [];

    if (comboFilter === "only") {
      list = list.filter((p) => isComboProduct(p));
    } else if (comboFilter === "exclude") {
      list = list.filter((p) => !isComboProduct(p));
    }

    if (discountOnly) {
      list = list.filter((p) => {
        const exp = computeExpiryInfo(p);
        return Boolean(exp?.isNearExpiry) && Number(exp?.discountPercent || 0) > 0;
      });
    }

    return list;
  }, [products, discountOnly, comboFilter]);

  // Phân trang
  const indexOfLastProduct = currentPage * productsPerPage;
  const indexOfFirstProduct = indexOfLastProduct - productsPerPage;
  const currentProducts = Array.isArray(filteredProducts)
    ? filteredProducts.slice(indexOfFirstProduct, indexOfLastProduct)
    : [];

  return (
    <div className="product-page product-page-wrapper bg-gray-50 pb-10 relative">
      <div className="product-banner">
        <img
          src="https://fujifruit.com.vn/wp-content/uploads/2023/10/1712.png"
          alt="Sản phẩm FreshFruit"
          className="product-banner__img product-banner-img"
        />
      </div>

      <div className="product-layout grid grid-cols-1 md:grid-cols-[300px_1fr] gap-6 mt-6 px-4 sm:px-8">
        {/* ==== FILTER PANEL (Checkbox) ==== */}
        <aside className="filter-panel ff-panel bg-white border rounded-2xl p-5 h-fit sticky top-4 shadow-md">
          {/* DANH MỤC */}
          <div className="filter-group filter-group--category ff-block ff-block--category">
            <FFCheckboxGroup
              title="Danh mục"
              items={categories}
              selected={selectedCategories}
              onChange={(vals) => {
                setSelectedCategories(vals);
                setCurrentPage(1);
              }}
              blockKey="cat"
              enableSearch
            />
          </div>

          <hr className="ff-divider" />

          {/* KHU VỰC */}
          <div className="filter-group filter-group--location ff-block ff-block--location">
            <FFCheckboxGroup
              title="Khu vực"
              items={locations}
              selected={selectedLocations}
              onChange={(vals) => {
                setSelectedLocations(vals);
                setCurrentPage(1);
              }}
              blockKey="loc"
              enableSearch
            />
          </div>

          <hr className="ff-divider" />

          {/* CẬN HẠN (giảm giá) */}
          <div className="filter-group filter-group--discount ff-block ff-block--discount">
            <div className="ff-filter-card">
              <div className="ff-filter-card__header">
                <h3 className="ff-filter-title">Khuyến mãi</h3>
              </div>
              <label className="ff-switch-line">
                <input
                  type="checkbox"
                  className="ff-switch"
                  checked={discountOnly}
                  onChange={(e) => {
                    setDiscountOnly(e.target.checked);
                    setCurrentPage(1);
                  }}
                />
                <span className="ff-switch-label">
                  Sản phẩm giảm giá (cận hạn)
                </span>
              </label>
            </div>
          </div>

          <hr className="ff-divider" />

          {/* Combo */}
          <div className="filter-group filter-group--combo ff-block ff-block--combo">
            <div className="ff-filter-card">
              <div className="ff-filter-card__header">
                <h3 className="ff-filter-title">Loại sản phẩm</h3>
              </div>
              <select
                className="ff-select w-full"
                value={comboFilter}
                onChange={(e) => {
                  setComboFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="all">Tất cả</option>
                <option value="only">Chỉ Combo</option>
                <option value="exclude">Ẩn Combo</option>
              </select>
            </div>
          </div>
        </aside>

        {/* ==== MAIN ==== */}
        <main className="product-main">
          <h1 className="product-title text-2xl font-bold mb-4">
            Sản Phẩm <span className="text-green-700">FreshFruit</span>
          </h1>

          <div className="product-grid-container">
            {currentProducts.length === 0 ? (
              <p className="product-grid product-grid--empty text-center text-gray-500 mt-10">
                {discountOnly
                  ? "Không có sản phẩm đang giảm giá."
                  : comboFilter === "only"
                  ? "Không có Combo phù hợp."
                  : comboFilter === "exclude"
                  ? "Không có sản phẩm thường phù hợp."
                  : "Không tìm thấy sản phẩm phù hợp."}
              </p>
            ) : (
              <motion.div
                key={currentPage}
                className="product-grid product-grid--4-cols product-grid-4-cols"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                {currentProducts.map((product) => {
                  const isCombo =
                    (typeof product?.type === "string"
                      ? product.type.toLowerCase()
                      : product?.type) === "combo" || product?.isCombo;

                  // Giá hiển thị
                  const variantData = product?.variants?.[0] || {};
                  const basePrice =
                    variantData?.price ??
                    product?.displayVariant?.price ??
                    product?.baseVariant?.price ??
                    product?.price ??
                    0;

                  const comboPrice = isCombo ? getComboPrice(product, basePrice) : null;

                  // Tồn kho hiển thị
                  const normalStock = Number(variantData?.stock ?? 0) || 0;
                  const comboStock = isCombo ? getComboStock(product) : null;

                  // Cận hạn
                  const exp = computeExpiryInfo(product);
                  const isNearExpiry = Boolean(exp?.isNearExpiry);
                  const discountPercent = Number(exp?.discountPercent || 0) || 0;
                  const hasDiscount = isNearExpiry && discountPercent > 0;

                  const rawPrice = isCombo ? comboPrice : basePrice;
                  const finalPrice =
                    Number(hasDiscount ? exp?.finalPrice ?? rawPrice : rawPrice) || 0;

                  const daysLeft = hasDiscount ? exp?.daysLeft ?? null : null;
                  const expiryStr = hasDiscount ? fmtDate(exp?.expireAt) : null;

                  const cardClass = [
                    "product-card",
                    isCombo ? "product-card--combo is-combo" : "product-card--normal",
                    hasDiscount ? "is-discounted" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <motion.div
                      key={product._id}
                      className={cardClass}
                      data-is-combo={isCombo ? "1" : "0"}
                      data-stock={isCombo ? comboStock : normalStock}
                      whileHover={{ scale: 1.05 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="product-card__media relative">
                        {hasDiscount && (
                          <span className="product-card__badge product-card__badge--discount absolute left-2 top-2 text-xs font-semibold px-2 py-1 rounded">
                            Cận hạn -{discountPercent}%
                          </span>
                        )}
                        {isCombo && (
                          <span className="product-card__badge product-card__badge--combo absolute right-2 top-2 text-[10px] font-semibold px-2 py-1 rounded">
                            COMBO
                          </span>
                        )}

                        {/* ĐÃ BỎ HOÀN TOÀN NÚT "THÊM VÀO MIX"  */}
                        <img
                          src={`http://localhost:3000${product.image}`}
                          alt={product.name}
                          className="product-card__image product-image cursor-pointer"
                          onClick={() => handleViewDetail(product)}
                        />
                      </div>

                      <div className="product-card__info product-info">
                        {hasDiscount && (
                          <div className="product-card__sale product-sale">Sản phẩm giảm giá</div>
                        )}

                        <h2 className="product-card__name product-name">{product.name}</h2>

                        {hasDiscount ? (
                          <div className="product-card__price-row flex items-baseline gap-2">
                            <span className="product-card__price--strike line-through text-gray-400">
                              {Number(rawPrice || 0).toLocaleString("vi-VN")}đ
                            </span>
                            <span className="product-card__price product-price font-semibold text-red-600">
                              {Number(finalPrice || 0).toLocaleString("vi-VN")}đ
                            </span>
                          </div>
                        ) : (
                          <p className="product-card__price product-price">
                            {Number(finalPrice || 0).toLocaleString("vi-VN")}đ
                          </p>
                        )}

                        {/* Hạn sử dụng — chỉ hiển thị khi cận hạn có giảm giá */}
                        {hasDiscount && expiryStr && (
                          <p className="product-card__expiry text-xs text-gray-600 mt-1">
                            Ngày hết hạn: {expiryStr}
                            {Number.isFinite(daysLeft) && daysLeft >= 0 && (
                              <span className="ml-2 italic">(còn {daysLeft} ngày)</span>
                            )}
                          </p>
                        )}

                        <p className="product-card__desc product-description line-clamp-2 text-sm text-gray-600 mt-1">
                          {product.description || "Trái cây sạch chất lượng cao."}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil((filteredProducts?.length || 0) / productsPerPage)}
            onPageChange={setCurrentPage}
          />
        </main>
      </div>
    </div>
  );
}
