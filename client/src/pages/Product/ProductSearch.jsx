import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';

const ListSanPham = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    const searchParams = new URLSearchParams(location.search);
    const searchQuery = searchParams.get('search') || '';
    const keyword = decodeURIComponent(searchQuery).toLowerCase();

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const res = await axios.get('http://localhost:3000/api/product');
                const allProducts = res.data;
                const filtered = allProducts.filter(product =>
                    product.name.toLowerCase().includes(keyword)
                );
                setProducts(filtered);
            } catch (err) {
                console.error('Lỗi khi fetch sản phẩm:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchProducts();
    }, [keyword]);


    const addToCart = (product) => {
        console.log('Thêm vào giỏ:', product);
    };

    const handleBuyNow = (product) => {
        console.log('Mua ngay:', product);
    };

    const handleViewDetail = (product) => {
        navigate(`/san-pham/${product._id}`)
    };

    return (
        <div className="w-full max-w-[1300px] mx-auto px-4 py-8 bg-white">
            {/* Banner */}
            <div className="w-full text-center mb-8 bg-[#E0F7EC]">
                <img
                    src="https://fujifruit.com.vn/wp-content/uploads/2023/10/1712.png"
                    alt="Sản phẩm FreshFruit"
                    className="w-full max-h-[400px] object-cover"
                />
            </div>

            {/* Tiêu đề & Bộ lọc */}
            <div className="flex flex-col items-center mb-8">
                <h1 className="text-3xl font-semibold text-center">
                    Kết quả cho: <span className="text-[#00613C]">{searchQuery}</span>
                </h1>
            </div>

            {/* Danh sách sản phẩm */}
            <div className="flex justify-center flex-wrap">
                {loading ? (
                    <p className="text-center text-gray-500">Đang tải dữ liệu...</p>
                ) : products.length === 0 ? (
                    <p className="text-center text-gray-500">Không tìm thấy sản phẩm nào phù hợp.</p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 w-full">
                        {products.map((product) => (
                            <motion.div
                                key={product._id}
                                className="bg-white rounded-2xl shadow-md overflow-hidden flex flex-col transition duration-300"
                                whileHover={{ scale: 1.05 }}
                                transition={{ duration: 0.3 }}
                            >
                                <img
                                    src={product.image}
                                    alt={product.name}
                                    className="w-full h-[200px] object-cover cursor-pointer"
                                    onClick={() => handleViewDetail(product)}
                                />
                                <div className="p-4 text-center">
                                    <h2 className="text-lg font-medium mb-2">{product.name}</h2>
                                    <p className="text-[#00613C] text-lg font-semibold mb-2">
                                        {product.price.toLocaleString()}đ
                                    </p>
                                    <p className="text-sm text-gray-600 mb-4">
                                        {product.description || "Trái cây sạch chất lượng cao."}
                                    </p>
                                    <div className="flex justify-center gap-2">
                                        <button
                                            className="px-4 py-2 bg-[#00613C] text-white rounded-md hover:bg-[#004d2e] transition"
                                            onClick={() => addToCart(product)}
                                        >
                                            Thêm vào giỏ
                                        </button>
                                        <button
                                            className="px-4 py-2 bg-[#FF6B35] text-white rounded-md hover:bg-[#cc552b] transition"
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

        </div>
    );
};

export default ListSanPham;
