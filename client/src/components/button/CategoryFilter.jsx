import React, { useState } from 'react';

const categories = ['Best seller', 'Hộp quà', 'Giỏ hoa quả', 'Hoa quả'];

const CategoryFilter = () => {
    const [activeCategory, setActiveCategory] = useState('Best seller');

    return (
        <div className="flex gap-3">
            {categories.map((category) => (
                <button
                    key={category}
                    onClick={() => setActiveCategory(category)}
                    className={`px-4 py-2 rounded-full font-semibold transition-colors duration-300
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
