// src/components/product/ProductList.jsx
import React, { useState, useEffect } from "react";
import ProductCard2 from "./card2.jsx";

/* ---------- Helpers ---------- */

// Khử dấu để so chuỗi "nội địa" / "nhap khau" v.v.
function normalizeVN(str = "") {
  return str
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Nhận diện combo chắc chắn (bao phủ nhiều schema phổ biến)
function isComboProduct(p) {
  if (!p || typeof p !== "object") return false;
  if (p.isCombo === true) return true;
  const type = (p.type || "").toString().toLowerCase();
  const category = (p.category || "").toString().toLowerCase();
  if (type === "combo" || category === "combo") return true;

  const candidates = [
    p?.comboPricing?.fixedPrice,
    p?.combo?.finalPrice,
    p?.combo?.price,
    p?.combo?.fixedPrice,
    p?.combo?.totalPrice,
  ]
    .map((v) => (v == null ? NaN : Number(String(v).replace(/[^\d.-]/g, ""))))
    .filter((n) => Number.isFinite(n) && n > 0);

  return candidates.length > 0;
}

const ProductList = ({ currentCategory }) => {
  const [products, setProducts] = useState([]);
  const normCat = normalizeVN(currentCategory);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        // Trường hợp COMBO: fetch sản phẩm thường rồi lọc combo tại FE
        if (normCat === "combo") {
          const res = await fetch("http://localhost:3000/api/product?preorder=false");
          const data = await res.json();
          const arr = Array.isArray(data)
            ? data
            : Array.isArray(data?.data)
            ? data.data
            : Array.isArray(data?.products)
            ? data.products
            : [];

          const combos = arr.filter(isComboProduct).slice(0, 4);
          setProducts(combos);
          return;
        }

        // Các tab khác (nội địa / nhập khẩu): thử endpoint category-name trước
        const catRes = await fetch(
          `http://localhost:3000/api/product/category-name/${encodeURIComponent(
            currentCategory
          )}?limit=4`
        );
        const catJson = await catRes.json();
        const fromCat = Array.isArray(catJson?.data) ? catJson.data : [];

        if (fromCat.length > 0) {
          setProducts(fromCat);
          return;
        }

        // Fallback: fetch toàn bộ rồi lọc theo tên danh mục (khử dấu)
        const res = await fetch("http://localhost:3000/api/product?preorder=false");
        const data = await res.json();
        const all = Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data?.products)
          ? data.products
          : [];

        const filtered = all
          .filter((p) => {
            const catName =
              p?.category?.name ||
              p?.categoryName ||
              p?.category ||
              "";
            return normalizeVN(catName).includes(normCat);
          })
          .slice(0, 4);

        setProducts(filtered);
      } catch (err) {
        console.error("Lỗi khi tải sản phẩm bộ sưu tập:", err);
        setProducts([]);
      }
    };

    if (currentCategory) fetchProducts();
  }, [currentCategory, normCat]);

  if (!products.length) {
    return (
      <div className="p-4 max-w-7xl mx-auto text-sm text-gray-500">
        Không có sản phẩm để hiển thị.
      </div>
    );
  }

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 sm:gap-8">
        {products.map((product) => (
          <ProductCard2 key={product._id} product={product} />
        ))}
      </div>
    </div>
  );
};

export default ProductList;
