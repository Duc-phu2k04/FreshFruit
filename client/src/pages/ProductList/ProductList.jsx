import React, { useEffect, useState } from "react";
import "./ProductList.css";
import CategoryFilter from "../../components/button/CategoryFilter";
import ViewNowButton from "../../components/button/ViewnowButton";
import { motion } from "framer-motion";
import { useCart } from "../../context/CartContext";
import { useNavigate } from "react-router-dom";

// Fake data tạm thời - sẽ được thay thế bằng API call tới MongoDB sau này
const fakeData = [
  {
    _id: "1",
    name: "Táo đỏ Mỹ",
    image:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQcxRKzsmVjdAfylJUpuZsGt8DvjNAuf_FxFQ&s",
    price: 35000,
    description: "Táo đỏ nhập khẩu từ Mỹ, giòn ngọt, giàu dinh dưỡng.",
  },
  {
    _id: "2",
    name: "Chuối tiêu chín",
    image:
      "https://media.vneconomy.vn/images/upload/2021/04/21/lam-dep-b-15393264483772087274308.jpg",
    price: 12000,
    description: "Chuối chín cây, thơm ngon, tốt cho hệ tiêu hóa.",
  },
  {
    _id: "3",
    name: "Cam sành Hà Giang",
    image:
      "https://imgcdn.tapchicongthuong.vn/thumb/w_1920/tcct-media/22/12/28/cam-sanh-ha-giang-10.jpg",
    price: 20000,
    description: "Cam sành tươi ngon từ Hà Giang, nhiều vitamin C.",
  },
  {
    _id: "4",
    name: "Cam sành",
    price: 48000,
    image:
      "https://imgcdn.tapchicongthuong.vn/thumb/w_1920/tcct-media/22/12/28/cam-sanh-ha-giang-10.jpg",
    description: "Cam sành vỏ dày, mọng nước, hương vị đặc trưng.",
  },
];

export default function ProductListPage() {
  const [products, setProducts] = useState([]);
  const { addToCart } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    // 
    // fetch("http://localhost:5000/api/products")
    //   .then(res => res.json())
    //   .then(data => setProducts(data))
    //   .catch(error => console.error("Lỗi khi fetch sản phẩm:", error));

    setProducts(fakeData); // Tạm thời sử dụng dữ liệu giả
  }, []);

  const handleBuyNow = (product) => {
    addToCart(product);
    navigate("/gio-hang");
  };

  const handleViewDetail = (product) => {
    navigate(`/san-pham/${product._id}`, { state: product });
  };

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

      {/* Tiêu đề & Bộ lọc */}
      <div className="product-header">
        <div>
          <h1 className="title">
            Sản Phẩm <span className="highlight">FreshFruit</span>
          </h1>
        </div>
        <CategoryFilter />
      </div>

      {/* Danh sách sản phẩm */}
      <div className="product-grid-container">
        {products.length === 0 ? (
          <p className="text-center text-gray-500">Chưa có sản phẩm nào.</p>
        ) : (
          <div className="product-grid">
            {products.map((product) => (
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
                  <div
                    style={{
                      display: "flex",
                      gap: "0.5rem",
                      justifyContent: "center",
                    }}
                  >
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
          </div>
        )}
      </div>

      {/* Call to Action */}
      <div className="cta-section">
        <h2 className="cta-title">Trái cây sạch, tốt cho sức khỏe mỗi ngày</h2>
        <p className="cta-sub">Chọn FreshFruit - Chất lượng & Niềm tin</p>
        <ViewNowButton />
      </div>
    </div>
  );
}
