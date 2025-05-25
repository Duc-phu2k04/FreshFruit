import React from 'react';
import { FiSearch } from 'react-icons/fi';

const SearchBar = () => {
    return (
        <div className="flex items-center">
            <input
                type="text"
                placeholder="Tìm kiếm ..."
                className="bg-gray-200 rounded-full px-4 py-2 w-90 focus:outline-none mr-3"
            />
            <button className="bg-orange-500 text-white rounded-full px-4 py-[11px] cursor-pointer">
                <FiSearch size={[18]} />
            </button>
        </div>
    );
};

export default SearchBar;
