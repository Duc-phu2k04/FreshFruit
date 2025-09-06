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

  //  Bộ lọc “chỉ sản phẩm giảm giá (cận hạn)”
  const [discountOnly, setDiscountOnly] = useState(false);

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

  //  Áp bộ lọc “giảm giá” ở client (trước khi phân trang)
  const filteredProducts = useMemo(() => {
    if (!discountOnly) return products;
    return (products || []).filter((p) => {
      const exp = computeExpiryInfo(p);
      return Boolean(exp?.isNearExpiry) && Number(exp?.discountPercent || 0) > 0;
    });
  }, [products, discountOnly]);

  // Phân trang dựa trên danh sách đã lọc
  const indexOfLastProduct = currentPage * productsPerPage;
  const indexOfFirstProduct = indexOfLastProduct - productsPerPage;
  const currentProducts = Array.isArray(filteredProducts)
    ? filteredProducts.slice(indexOfFirstProduct, indexOfLastProduct)
    : [];

  return (
    <div className="product-page-wrapper bg-gray-50 pb-10 relative">
      <div className="product-banner">
        <img
          src="https://fujifruit.com.vn/wp-content/uploads/2023/10/1712.png"
          alt="Sản phẩm FreshFruit"
          className="product-banner-img"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6 mt-6 px-4 sm:px-8">
        <aside className="bg-white border rounded-xl p-5 h-fit sticky top-4 shadow-md">
          <CategoryFilter
            categories={categories}
            selected={selectedCategories}
            onChange={setSelectedCategories}
          />
          <hr className="my-5 border-gray-300" />
          <LocationFilter
            locations={locations}
            selected={selectedLocations}
            onChange={setSelectedLocations}
          />
          <hr className="my-5 border-gray-300" />
          {/*  Bộ lọc: chỉ hiển thị sản phẩm đang giảm giá (cận hạn) */}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={discountOnly}
              onChange={(e) => {
                setDiscountOnly(e.target.checked);
                setCurrentPage(1);
              }}
            />
            <b className="font-semibold"> Sản phẩm giảm giá (cận hạn)</b>
          </label>
        </aside>

        <main>
          <h1 className="text-2xl font-bold mb-4">
            Sản Phẩm <span className="text-green-700">FreshFruit</span>
          </h1>

          <div className="product-grid-container">
            {currentProducts.length === 0 ? (
              <p className="text-center text-gray-500 mt-10">
                {discountOnly
                  ? "Không có sản phẩm đang giảm giá."
                  : "Không tìm thấy sản phẩm phù hợp."}
              </p>
            ) : (
              <motion.div
                key={currentPage}
                className="product-grid product-grid-4-cols"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                {currentProducts.map((product) => {
                  // Fallback giá/stock từ biến thể đầu
                  const variantData = product.variants?.[0] || {};
                  const fallbackPrice =
                    variantData.price ??
                    product?.displayVariant?.price ??
                    product?.baseVariant?.price ??
                    0;
                  const stock = variantData.stock ?? 0;

                  // Tính HSD & giảm cận hạn từ helper
                  const exp = computeExpiryInfo(product);
                  const isNearExpiry = Boolean(exp?.isNearExpiry);
                  const discountPercent = Number(exp?.discountPercent || 0);
                  const hasDiscount = isNearExpiry && discountPercent > 0;

                  // Giá hiển thị
                  const finalPrice = hasDiscount
                    ? Number(exp.finalPrice ?? fallbackPrice)
                    : Number(fallbackPrice);

                  // Expiry strings (chỉ dùng khi hasDiscount)
                  const daysLeft = hasDiscount ? exp.daysLeft ?? null : null;
                  const expiryStr = hasDiscount ? fmtDate(exp.expireAt) : null;

                  const cardClass = `product-card ${hasDiscount ? "is-discounted" : ""}`;

                  return (
                    <motion.div
                      key={product._id}
                      className={cardClass}
                      whileHover={{ scale: 1.05 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="relative">
                        {hasDiscount && (
                          <span className="absolute left-2 top-2 bg-amber-500 text-white text-xs font-semibold px-2 py-1 rounded">
                            Cận hạn -{discountPercent}%
                          </span>
                        )}
                        <img
                          src={`http://localhost:3000${product.image}`}
                          alt={product.name}
                          className="product-image cursor-pointer"
                          onClick={() => handleViewDetail(product)}
                        />
                      </div>

                      <div className="product-info">
                        {/*  Mục để CSS: “sản phẩm giảm giá” */}
                        {hasDiscount && (
                          <div className="product-sale">Sản phẩm giảm giá</div>
                        )}

                        <h2 className="product-name">{product.name}</h2>

                        {hasDiscount ? (
                          <div className="flex items-baseline gap-2">
                            <span className="line-through text-gray-400">
                              {Number(fallbackPrice).toLocaleString("vi-VN")}đ
                            </span>
                            <span className="product-price font-semibold text-red-600">
                              {Number(finalPrice).toLocaleString("vi-VN")}đ
                            </span>
                          </div>
                        ) : (
                          <p className="product-price">
                            {Number(finalPrice).toLocaleString("vi-VN")}đ
                          </p>
                        )}

                        <p className="text-sm text-gray-500">
                          Tồn kho: {stock > 0 ? stock : "Hết hàng"}
                        </p>

                        {/* Hạn sử dụng — chỉ hiển thị khi cận hạn có giảm giá */}
                        {hasDiscount && expiryStr && (
                          <p className="text-xs text-gray-600 mt-1">
                            Ngày hết hạn: {expiryStr}
                            {Number.isFinite(daysLeft) && daysLeft >= 0 && (
                              <span className="ml-2 italic">
                                (còn {daysLeft} ngày)
                              </span>
                            )}
                          </p>
                        )}

                        <p className="product-description line-clamp-2 text-sm text-gray-600 mt-1">
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
