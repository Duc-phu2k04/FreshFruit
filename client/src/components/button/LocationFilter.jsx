import React from "react";
import { FaMapMarkerAlt } from "react-icons/fa";

const LocationFilter = ({ locations = [], selected = [], onChange }) => {
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
      {/* Tiêu đề */}
      <div className="flex items-center gap-2 font-semibold text-base text-green-700">
        <FaMapMarkerAlt />
        <span>Khu vực</span>
      </div>

      {/* Nút "Bỏ chọn tất cả" */}
      {selected.length > 0 && locations.length > 0 && (
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
        {locations.map((loc) => (
          <label
            key={loc._id}
            className="flex items-center gap-2 text-sm cursor-pointer"
          >
            <input
              type="checkbox"
              className="accent-green-700"
              checked={selected.includes(loc._id)}
              onChange={() => handleToggle(loc._id)}
            />
            <span>{loc.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
};

export default LocationFilter;
