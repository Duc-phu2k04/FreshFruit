import React from "react";

const LocationFilter = ({ locations = [], selected, onChange }) => {
  // Tránh lỗi khi locations chưa được load đúng
  if (!Array.isArray(locations)) return null;

  return (
    <div className="flex flex-wrap gap-2 sm:gap-3 justify-center mt-2">
      {/* Tất cả khu vực */}
      <button
        type="button"
        onClick={() => onChange("")}
        className={`px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base rounded-full font-semibold transition-colors duration-300 ${
          !selected
            ? "bg-green-800 text-white"
            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
        }`}
      >
        Tất cả khu vực
      </button>

      {/* Danh sách khu vực */}
      {locations.map((loc) => (
        <button
          type="button"
          key={loc._id}
          onClick={() => onChange(loc._id)}
          className={`px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base rounded-full font-semibold transition-colors duration-300 ${
            selected === loc._id
              ? "bg-green-800 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          {loc.name}
        </button>
      ))}
    </div>
  );
};

export default LocationFilter;
