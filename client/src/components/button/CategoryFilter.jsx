import React from "react";

const CategoryFilter = ({ categories = [], selected, onChange }) => {
  return (
    <div className="flex flex-wrap gap-2 sm:gap-3 justify-center">
      <button
        onClick={() => onChange("")}
        className={`px-3 py-1.5 text-sm sm:px-4 sm:py-2 sm:text-base rounded-full font-semibold transition-colors duration-300 ${
          !selected
            ? "bg-green-800 text-white"
            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
        }`}
      >
        Tất cả sản phẩm
      </button>

      {categories.map((cat) => (
        <button
          key={cat._id}
          onClick={() => onChange(cat._id)}
          className={`px-3 py-1.5 text-sm sm:px-4 sm:py-2 sm:text-base rounded-full font-semibold transition-colors duration-300 ${
            selected === cat._id
              ? "bg-green-800 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
};

export default CategoryFilter;
