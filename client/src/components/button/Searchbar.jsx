import React, { useState, useEffect, useRef } from 'react';
import { FiSearch } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

const SearchBar = ({ products = [] }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const wrapperRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        if (query.trim() === '') {
            setResults([]);
            return;
        }

        const filtered = products.filter(product =>
            product.name.toLowerCase().includes(query.toLowerCase())
        );
        setResults(filtered);
    }, [query, products]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setResults([]);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleSelect = (product) => {
        setQuery('');
        setResults([]);
        navigate(`/product/${product.id}`);
    };

    const handleSearch = () => {
        const trimmedQuery = query.trim();
        if (trimmedQuery) {
            setResults([]);
            navigate(`/products?search=${encodeURIComponent(trimmedQuery)}`);
        }
    };

    return (
        <div
            ref={wrapperRef}
            className="flex items-center w-full max-w-md mx-auto p-4 sm:p-0 relative"
        >
            <input
                type="text"
                placeholder="Tìm kiếm ..."
                className="bg-gray-200 rounded-full px-4 py-2 w-full focus:outline-none mr-3 text-sm sm:text-base sm:w-90 sm:px-4 sm:py-2"
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
                <ul className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded shadow z-10 max-h-60 overflow-y-auto">
                    {results.map((product) => (
                        <li
                            key={product.id}
                            className="px-4 py-2 text-sm hover:bg-gray-100 cursor-pointer"
                            onClick={() => handleSelect(product)}
                        >
                            {product.name}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default SearchBar;
