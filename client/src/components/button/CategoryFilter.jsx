import React from "react";
import { FaList } from "react-icons/fa";

const CategoryFilter = ({ categories = [], selected = [], onChange }) => {
  const handleToggle = (id) => {
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  const handleClearAll = () => {
    onChange([]);
  };

  return (
    <div className="space-y-3">

      {/* Nút "Bỏ chọn tất cả" */}
      {selected.length > 0 && categories.length > 0 && (
        <button
          type="button"
          onClick={handleClearAll}
          className="text-sm text-green-700 hover:underline cursor-pointer"
        >
          Bỏ chọn tất cả
        </button>
      )}

      {/* Danh sách checkbox */}
      <div className="space-y-2">
        {categories.map((cat) => (
          <label
            key={cat._id}
            className="flex items-center gap-2 text-sm cursor-pointer"
          >
            <input
              type="checkbox"
              className="accent-green-700"
              checked={selected.includes(cat._id)}
              onChange={() => handleToggle(cat._id)}
            />
            <span>{cat.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
};

export default CategoryFilter;
