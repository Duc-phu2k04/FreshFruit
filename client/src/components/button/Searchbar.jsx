import React, { useState, useEffect, useRef } from 'react';
import { FiSearch } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axiosConfig';

const SearchBar = () => {
    const [query, setQuery] = useState('');
    const [products, setProducts] = useState([]);
    const [results, setResults] = useState([]);
    const wrapperRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const res = await axiosInstance.get('/product');
                const productList =
                    Array.isArray(res.data)
                        ? res.data
                        : Array.isArray(res.data.data)
                            ? res.data.data
                            : [];

                setProducts(productList);
            } catch (error) {
                console.error('Lỗi khi lấy danh sách sản phẩm:', error);
            }
        };
        fetchProducts();
    }, []);

    useEffect(() => {
        if (query.trim() === '') {
            setResults([]);
            return;
        }

        const filtered = products.filter(product =>
            product.name?.toLowerCase().includes(query.toLowerCase())
        );
        setResults(filtered);
    }, [query, products]);

    const handleSelect = (product) => {
        console.log("👉 Chuyển đến chi tiết:", product._id);
        setQuery('');
        setResults([]);
        navigate(`/san-pham/${product._id}`);
        setTimeout(() => setResults([]), 0);

    };

    const handleSearch = () => {
        const trimmedQuery = query.trim();
        if (trimmedQuery) {
            setResults([]);
            navigate(`/product?search=${encodeURIComponent(trimmedQuery)}`);
        }
    };

    return (
        <div
            ref={wrapperRef}
            className="flex items-center w-full max-w-md mx-auto sm:p-0 relative z-20"
        >
            <input
                type="text"
                placeholder="Tìm kiếm ..."
                className="bg-gray-200 rounded-full px-4 py-2 w-full focus:outline-none mr-3 text-sm sm:text-base lg:w-[350px]"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        handleSearch();
                    }
                }}
            />
            <button
                onClick={handleSearch}
                className="bg-orange-500 text-white rounded-full px-4 py-[11px] cursor-pointer flex-shrink-0"
            >
                <FiSearch size={18} />
            </button>

            {results.length > 0 && (
                <ul className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded shadow z-50 max-h-60 overflow-y-auto">
                    {results.map((product) => (
                        <li
                            key={product._id}
                            className="flex items-center px-4 py-2 hover:bg-gray-100 cursor-pointer gap-3"
                            onClick={() => handleSelect(product)}
                        >
                            <img
                                src={`http://localhost:3000${product.image}`} // Nếu đã là link đầy đủ thì dùng: product.image
                                alt={product.name}
                                className="w-10 h-10 object-cover rounded-md border border-gray-200 flex-shrink-0"
                            />
                            <span className="text-sm text-gray-800 truncate max-w-[200px]">
                                {product.name}
                            </span>
                        </li>
                    ))}
                </ul>

            )}
        </div>
    );
};

export default SearchBar;
