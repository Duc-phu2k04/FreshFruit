import React, { useState, useEffect } from "react"; // ✅ Thêm React import
import ProductCard2 from "./card2.jsx";

const ProductList = ({ currentCategory }) => {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    const fetchProductsByCategory = async () => {
      try {
        const res = await fetch(`http://localhost:3000/api/product/category-name/${currentCategory}?limit=4`);
        const data = await res.json();
        setProducts(data.data || []);
      } catch (error) {
        console.error("Lỗi khi fetch sản phẩm theo danh mục:", error);
        setProducts([]);
      }
    };

    if (currentCategory) {
      fetchProductsByCategory();
    }
  }, [currentCategory]);

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <div className="grid grid-cols-2 gap-6 sm:gap-8">
        {products.map(product => (
          <ProductCard2 key={product._id} product={product} />
        ))}
      </div>
    </div>
  );
};

export default ProductList;