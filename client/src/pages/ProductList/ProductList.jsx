import React, { useEffect, useState, useCallback } from "react";
import "./ProductList.css";
import CategoryFilter from "../../components/button/CategoryFilter";
import LocationFilter from "../../components/button/LocationFilter";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Pagination from "../../components/common/Pagination";

export default function ProductListPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedLocations, setSelectedLocations] = useState([]);
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
      let url = "http://localhost:3000/api/product";
      const params = [];
      if (selectedCategories.length)
        params.push(`category=${selectedCategories.join(",")}`);
      if (selectedLocations.length)
        params.push(`location=${selectedLocations.join(",")}`);
      if (params.length) url += `?${params.join("&")}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error("Lỗi khi lấy danh sách sản phẩm");
      const data = await res.json();

      console.log("📌 API products response:", data);

      let productArray = [];
      if (Array.isArray(data)) {
        productArray = data;
      } else if (Array.isArray(data.products)) {
        productArray = data.products;
      } else if (Array.isArray(data.data)) {
        productArray = data.data;
      } else {
        console.error("❌ Dữ liệu trả về không phải mảng!");
      }

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

  const indexOfLastProduct = currentPage * productsPerPage;
  const indexOfFirstProduct = indexOfLastProduct - productsPerPage;
  const currentProducts = Array.isArray(products)
    ? products.slice(indexOfFirstProduct, indexOfLastProduct)
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
        </aside>

        <main>
          <h1 className="text-2xl font-bold mb-4">
            Sản Phẩm <span className="text-green-700">FreshFruit</span>
          </h1>

          <div className="product-grid-container">
            {currentProducts.length === 0 ? (
              <p className="text-center text-gray-500 mt-10">
                Không tìm thấy sản phẩm phù hợp.
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
                  // --- Lấy variant đầu tiên để hiển thị stock và price ---
                  const variantData = product.variants?.[0] || {};
                  const price = variantData.price ?? 0;
                  const stock = variantData.stock ?? 0;

                  return (
                    <motion.div
                      key={product._id}
                      className="product-card"
                      whileHover={{ scale: 1.05 }}
                      transition={{ duration: 0.3 }}
                    >
                      <img
                        src={`http://localhost:3000${product.image}`}
                        alt={product.name}
                        className="product-image cursor-pointer"
                        onClick={() => handleViewDetail(product)}
                      />
                      <div className="product-info">
                        <h2 className="product-name">{product.name}</h2>
                        <p className="product-price">
                          {price.toLocaleString()}đ
                        </p>
                        <p className="text-sm text-gray-500">
                          Tồn kho: {stock > 0 ? stock : "Hết hàng"}
                        </p>
                        <p className="product-description line-clamp-2 text-sm text-gray-600">
                          {product.description ||
                            "Trái cây sạch chất lượng cao."}
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
            totalPages={Math.ceil(products.length / productsPerPage)}
            onPageChange={setCurrentPage}
          />
        </main>
      </div>
    </div>
  );
}
