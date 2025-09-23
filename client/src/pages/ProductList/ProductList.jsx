// src/pages/ProductList/ProductList.jsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import "./ProductList.css";
import CategoryFilter from "../../components/button/CategoryFilter";
import LocationFilter from "../../components/button/LocationFilter";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Pagination from "../../components/common/Pagination";

// Helpers hạn sử dụng
import { computeExpiryInfo, fmtDate } from "../../utils/expiryHelpers";

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
      setCategories(await catRes.json());
      setLocations(await locRes.json());
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

  // Lấy tồn kho hiển thị cho combo: ưu tiên comboInventory.stock, fallback các key khác
  const getComboStock = (p) => {
    // Các khả năng tên field có thể có từ BE
    const candidates = [
      p?.comboInventory?.stock,          // chuẩn mới
      p?.comboStock,                     // fallback
      p?.stock,                          // một số BE trộn vào stock chung
      p?.inventory?.stock,               // fallback khác
      p?.inventory,                      // đôi khi inventory là số
      p?.available,                      // fallback
    ];
    for (const c of candidates) {
      const n = asNumber(c, NaN);
      if (Number.isFinite(n)) return Math.max(0, n);
    }
    return 0;
  };

  // Lấy giá hiển thị cho combo
  const getComboPrice = (p, fallback) => {
    const fixed = p?.comboPricing?.fixedPrice;
    const discountMode = p?.comboPricing?.mode === "discount";
    const base = asNumber(fallback, 0);
    if (Number.isFinite(asNumber(fixed, NaN))) return asNumber(fixed, base);
    // nếu mode discount, không có fixed => cứ trả fallback (FE không triển khai discount tổng)
    return base;
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

  // Phân trang dựa trên danh sách đã lọc
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

      <div className="product-layout grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6 mt-6 px-4 sm:px-8">
        <aside className="filter-panel bg-white border rounded-xl p-5 h-fit sticky top-4 shadow-md">
          <div className="filter-group filter-group--category">
            <CategoryFilter
              categories={categories}
              selected={selectedCategories}
              onChange={(vals) => {
                setSelectedCategories(vals);
                setCurrentPage(1);
              }}
            />
          </div>

          <hr className="my-5 border-gray-300" />

          <div className="filter-group filter-group--location">
            <LocationFilter
              locations={locations}
              selected={selectedLocations}
              onChange={(vals) => {
                setSelectedLocations(vals);
                setCurrentPage(1);
              }}
            />
          </div>

          <hr className="my-5 border-gray-300" />

          {/* Bộ lọc: chỉ hiển thị sản phẩm đang giảm giá (cận hạn) */}
          <label className="filter-group filter-group--discount flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={discountOnly}
              onChange={(e) => {
                setDiscountOnly(e.target.checked);
                setCurrentPage(1);
              }}
            />
            <b className="font-semibold">Sản phẩm giảm giá (cận hạn)</b>
          </label>

          <hr className="my-5 border-gray-300" />

          {/* Bộ lọc Combo */}
          <div className="filter-group filter-group--combo">
            <label className="block text-sm font-semibold mb-2">Loại sản phẩm</label>
            <select
              className="filter-combo-select w-full border rounded-lg px-3 py-2 text-sm"
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
        </aside>

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
                  const isCombo = isComboProduct(product);

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
                  const normalStock = asNumber(variantData?.stock ?? 0, 0);
                  const comboStock = isCombo ? getComboStock(product) : null;

                  // Cận hạn
                  const exp = computeExpiryInfo(product);
                  const isNearExpiry = Boolean(exp?.isNearExpiry);
                  const discountPercent = asNumber(exp?.discountPercent || 0, 0);
                  const hasDiscount = isNearExpiry && discountPercent > 0;

                  const rawPrice = isCombo ? comboPrice : basePrice;
                  const finalPrice = asNumber(
                    hasDiscount ? (exp?.finalPrice ?? rawPrice) : rawPrice,
                    0
                  );

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
                          <span className="product-card__badge product-card__badge--discount absolute left-2 top-2 bg-amber-500 text-white text-xs font-semibold px-2 py-1 rounded">
                            Cận hạn -{discountPercent}%
                          </span>
                        )}
                        {isCombo && (
                          <span className="product-card__badge product-card__badge--combo absolute right-2 top-2 bg-emerald-600 text-white text-[10px] font-semibold px-2 py-1 rounded">
                            COMBO
                          </span>
                        )}
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
                              {asNumber(rawPrice, 0).toLocaleString("vi-VN")}đ
                            </span>
                            <span className="product-card__price product-price font-semibold text-red-600">
                              {asNumber(finalPrice, 0).toLocaleString("vi-VN")}đ
                            </span>
                          </div>
                        ) : (
                          <p className="product-card__price product-price">
                            {asNumber(finalPrice, 0).toLocaleString("vi-VN")}đ
                          </p>
                        )}

                        {/* <p className="product-card__stock text-sm text-gray-500">
                          {isCombo ? (
                            <>
                              Tồn kho combo:{" "}
                              {comboStock > 0 ? comboStock : <span className="text-red-600">Hết hàng</span>}
                            </>
                          ) : (
                            <>
                              Tồn kho:{" "}
                              {normalStock > 0 ? normalStock : <span className="text-red-600">Hết hàng</span>}
                            </>
                          )}
                        </p> */}

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
            totalPages={Math.ceil(filteredProducts.length / productsPerPage)}
            onPageChange={setCurrentPage}
          />
        </main>
      </div>
    </div>
  );
}
