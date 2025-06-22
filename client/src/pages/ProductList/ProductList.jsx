import React, { useEffect, useState } from "react";
import "./ProductList.css";
import CategoryFilter from "../../components/button/CategoryFilter";
import ViewNowButton from "../../components/button/ViewnowButton";
import { motion } from "framer-motion";
import { useCart } from "../../context/CartContext";
import { useNavigate } from "react-router-dom";
import Pagination from "../../components/common/Pagination";

const baseProducts = [
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

// Dữ liệu giả để test nhiều sản phẩm và phân trang. Khi có dữ liệu thật, hãy thay thế fakeData bằng fetch từ API.
const fakeData = Array.from({ length: 36 }, (_, i) => {
  const base = baseProducts[i % baseProducts.length];
  return {
    ...base,
    _id: `${i + 1}`,
  };
});

export default function ProductListPage() {
  const [products, setProducts] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const productsPerPage = 12; // 3 hàng x 4 cột = 12 sản phẩm mỗi trang

  const { addToCart } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    //  Dùng fakeData tạm thời cho đến khi có API thật
    setProducts(fakeData);

    //  Nếu có API thật, thay bằng đoạn này:
    // fetch("http://localhost:5000/api/products")
    //   .then(res => res.json())
    //   .then(data => setProducts(data))
    //   .catch(error => console.error("Lỗi khi fetch sản phẩm:", error));
  }, []);

  const handleBuyNow = (product) => {
    addToCart(product);
    navigate("/gio-hang");
  };

  const handleViewDetail = (product) => {
    navigate(`/san-pham/${product._id}`, { state: product });
  };

  const indexOfLastProduct = currentPage * productsPerPage;
  const indexOfFirstProduct = indexOfLastProduct - productsPerPage;
  const currentProducts = products.slice(indexOfFirstProduct, indexOfLastProduct);

  return (
    <div className="product-page-wrapper">
      <div className="product-banner">
        <img
          src="https://fujifruit.com.vn/wp-content/uploads/2023/10/1712.png"
          alt="Sản phẩm FreshFruit"
          className="product-banner-img"
        />
      </div>

      <div className="product-header">
        <div>
          <h1 className="title">
            Sản Phẩm <span className="highlight">FreshFruit</span>
          </h1>
        </div>
        <CategoryFilter />
      </div>

      <div className="product-grid-container">
        {currentProducts.length === 0 ? (
          <p className="text-center text-gray-500">Chưa có sản phẩm nào.</p>
        ) : (
          <motion.div
            key={currentPage} // 🔑 để Framer Motion nhận biết khi chuyển trang
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
          </motion.div>
        )}
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={Math.ceil(products.length / productsPerPage)}
        onPageChange={setCurrentPage}
      />

      <div className="cta-section">
        <h2 className="cta-title">Trái cây sạch, tốt cho sức khỏe mỗi ngày</h2>
        <p className="cta-sub">Chọn FreshFruit - Chất lượng & Niềm tin</p>
        <ViewNowButton />
      </div>
    </div>
  );
}
