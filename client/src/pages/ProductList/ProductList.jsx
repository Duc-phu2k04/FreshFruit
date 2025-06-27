import React, { useEffect, useState, useCallback } from "react";
import "./ProductList.css";
import CategoryFilter from "../../components/button/CategoryFilter";
import LocationFilter from "../../components/button/LocationFilter";
import ViewNowButton from "../../components/button/ViewnowButton";
import { motion } from "framer-motion";
import { useCart } from "../../context/CartContext";
import { useNavigate } from "react-router-dom";
import Pagination from "../../components/common/Pagination";

export default function ProductListPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const productsPerPage = 12;

  const { addToCart } = useCart();
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
      if (selectedCategory) params.push(`category=${selectedCategory}`);
      if (selectedLocation) params.push(`location=${selectedLocation}`);
      if (params.length) url += `?${params.join("&")}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error("Lỗi khi lấy danh sách sản phẩm");
      setProducts(await res.json());
      setCurrentPage(1); // reset về trang đầu mỗi khi filter đổi
    } catch (err) {
      console.error("Lỗi khi fetch sản phẩm:", err);
    }
  }, [selectedCategory, selectedLocation]);

 
  useEffect(() => {
    fetchFilters();
  }, [fetchFilters]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  
  const handleBuyNow = (product) => {
    addToCart(product);
    navigate("/gio-hang");
  };

  const handleViewDetail = (product) => {
    navigate(`/san-pham/${product._id}`, { state: product });
  };

 
  const indexOfLastProduct = currentPage * productsPerPage;
  const indexOfFirstProduct = indexOfLastProduct - productsPerPage;
  const currentProducts = products.slice(
    indexOfFirstProduct,
    indexOfLastProduct
  );

  
  return (
    <div className="product-page-wrapper">
      {/* Banner */}
      <div className="product-banner">
        <img
          src="https://fujifruit.com.vn/wp-content/uploads/2023/10/1712.png"
          alt="Sản phẩm FreshFruit"
          className="product-banner-img"
        />
      </div>

      {/* Header + Filters */}
      <div className="product-header">
        <h1 className="title">
          Sản Phẩm <span className="highlight">FreshFruit</span>
        </h1>
              <div className="filter-bar flex flex-col gap-4 items-center mt-4">
              <CategoryFilter
                categories={categories}
                selected={selectedCategory}
                onChange={setSelectedCategory}
              />
              <LocationFilter
                locations={locations}
                selected={selectedLocation}
                onChange={setSelectedLocation}
              />
            </div>
      </div>

      {/* Product grid */}
      <div className="product-grid-container">
        {currentProducts.length === 0 ? (
          <p className="text-center text-gray-500">Chưa có sản phẩm nào.</p>
        ) : (
          <motion.div
            key={currentPage}
            className="product-grid product-grid-4-cols"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {currentProducts.map((product) => (
              <motion.div
                key={product._id}
                className="product-card"
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.3 }}
              >
                <img
                  src={product.image}
                  alt={product.name}
                  className="product-image"
                  onClick={() => handleViewDetail(product)}
                />
                <div className="product-info">
                  <h2 className="product-name">{product.name}</h2>
                  <p className="product-price">
                    {product.price.toLocaleString()}đ
                  </p>
                  <p className="product-description">
                    {product.description || "Trái cây sạch chất lượng cao."}
                  </p>
                  <div className="product-actions">
                    <button
                      className="buy-button"
                      onClick={() => addToCart(product)}
                    >
                      Thêm vào giỏ
                    </button>
                    <button
                      className="buy-button orange"
                      onClick={() => handleBuyNow(product)}
                    >
                      Mua ngay
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={Math.ceil(products.length / productsPerPage)}
        onPageChange={setCurrentPage}
      />

      {/* CTA */}
      <div className="cta-section">
        <h2 className="cta-title">Trái cây sạch, tốt cho sức khỏe mỗi ngày</h2>
        <p className="cta-sub">Chọn FreshFruit - Chất lượng & Niềm tin</p>
        <ViewNowButton />
      </div>
    </div>
  );
}
