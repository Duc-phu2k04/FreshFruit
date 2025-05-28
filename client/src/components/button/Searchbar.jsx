import React from 'react';
import { FiSearch } from 'react-icons/fi';

const SearchBar = () => {
    return (
        <div className="flex items-center w-full max-w-md mx-auto p-4 sm:p-0">
            <input
                type="text"
                placeholder="Tìm kiếm ..."
                className="bg-gray-200 rounded-full px-4 py-2 w-full focus:outline-none mr-3 text-sm sm:text-base sm:w-90 sm:px-4 sm:py-2"
            />
            <button className="bg-orange-500 text-white rounded-full px-4 py-[11px] cursor-pointer flex-shrink-0">
                <FiSearch size={18} />
            </button>
        </div>
    );
};

export default SearchBar;