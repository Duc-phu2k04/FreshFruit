import React, { useState } from 'react';

const categories = ['Best seller', 'Hộp quà', 'Giỏ hoa quả', 'Hoa quả'];

const CategoryFilter = () => {
    const [activeCategory, setActiveCategory] = useState('Best seller');

    return (
        <div className="flex flex-wrap gap-2 sm:gap-3 justify-center">
            {categories.map((category) => (
                <button
                    key={category}
                    onClick={() => setActiveCategory(category)}
                    className={`px-3 py-1.5 text-sm sm:px-4 sm:py-2 sm:text-base rounded-full font-semibold transition-colors duration-300
                    ${activeCategory === category
                            ? 'bg-green-800 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
                `}
                >
                    {category}
                </button>
            ))}
        </div>
    );
};

export default CategoryFilter;