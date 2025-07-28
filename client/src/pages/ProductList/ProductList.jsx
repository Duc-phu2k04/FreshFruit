import React, { useEffect, useState, useCallback } from "react";
import "./ProductList.css";
import CategoryFilter from "../../components/button/CategoryFilter";
import LocationFilter from "../../components/button/LocationFilter";
import ViewNowButton from "../../components/button/ViewnowButton";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Pagination from "../../components/common/Pagination";
import { useAuth } from "../../context/AuthContext";

export default function ProductListPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedLocations, setSelectedLocations] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [successMessage, setSuccessMessage] = useState("");

  const productsPerPage = 12;
  const navigate = useNavigate();
  const { user } = useAuth();

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
      setProducts(data);
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

  const addToCartServer = async (product, e) => {
    if (!product || !product._id) return;
    const img = e?.currentTarget?.closest(".product-card")?.querySelector("img");
    if (img) {
      const flyImg = img.cloneNode(true);
      const rect = img.getBoundingClientRect();
      const targetX = window.innerWidth - 80;
      const targetY = 20;

      flyImg.style.position = "fixed";
      flyImg.style.left = `${rect.left}px`;
      flyImg.style.top = `${rect.top}px`;
      flyImg.style.width = `${rect.width}px`;
      flyImg.style.height = `${rect.height}px`;
      flyImg.style.zIndex = 9999;
      flyImg.style.transition = "all 0.8s ease-in-out";
      flyImg.style.borderRadius = "12px";

      document.body.appendChild(flyImg);

      requestAnimationFrame(() => {
        flyImg.style.left = `${targetX}px`;
        flyImg.style.top = `${targetY}px`;
        flyImg.style.width = "20px";
        flyImg.style.height = "20px";
        flyImg.style.opacity = "0.3";
      });

      setTimeout(() => flyImg.remove(), 900);
    }

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        alert("Bạn cần đăng nhập để thêm vào giỏ hàng.");
        return;
      }

      const res = await fetch("http://localhost:3000/api/cart/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ productId: product._id, quantity: 1 }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Lỗi khi thêm vào giỏ hàng");

      setSuccessMessage("Đã thêm vào giỏ hàng ✔️");
      setTimeout(() => setSuccessMessage(""), 2500);
    } catch (error) {
      console.error("Lỗi thêm vào giỏ hàng:", error.message);
      alert("Lỗi: " + error.message);
    }
  };

  const handleBuyNow = (product) => {
  const token = localStorage.getItem("token");
  if (!token) {
    alert("Bạn cần đăng nhập để mua sản phẩm.");
    return;
  }

  const cartData = {
    products: [
      {
        _id: product._id,
        nameProduct: product.name,
        quantity: 1,
        price: product.price,
      },
    ],
    sumPrice: product.price,
  };

  navigate("/checkout", { state: { cartData } });
};


  const handleViewDetail = (product) => {
    navigate(`/san-pham/${product._id}`, { state: product });
  };

  const indexOfLastProduct = currentPage * productsPerPage;
  const indexOfFirstProduct = indexOfLastProduct - productsPerPage;
  const currentProducts = products.slice(indexOfFirstProduct, indexOfLastProduct);

  return (
    <div className="product-page-wrapper bg-gray-50 pb-10 relative">
      {successMessage && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-green-600 text-white px-6 py-2 rounded-full shadow-lg">
          {successMessage}
        </div>
      )}

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
                {currentProducts.map((product) => (
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
                        {(product.baseVariant?.price ?? product.price ?? 0).toLocaleString()}đ
                      </p>
                      <p className="product-description line-clamp-2 text-sm text-gray-600">
                        {product.description || "Trái cây sạch chất lượng cao."}
                      </p>
                      <div className="product-actions">
                        <button
                          className="buy-button"
                          onClick={(e) => addToCartServer(product, e)}
                        >
                          Thêm vào giỏ
                        </button>
                        <button
                          className="buy-button orange"
                          onClick={(e) => handleBuyNow(product, e)}
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

          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(products.length / productsPerPage)}
            onPageChange={setCurrentPage}
          />

          <div className="cta-section mt-12 bg-white rounded-xl p-6 shadow-sm text-center">
            <h2 className="text-xl font-semibold text-green-700">
              Trái cây sạch, tốt cho sức khỏe mỗi ngày
            </h2>
            <p className="text-gray-600 mt-1">
              Chọn FreshFruit - Chất lượng & Niềm tin
            </p>
            <div className="mt-4">
              <ViewNowButton />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
