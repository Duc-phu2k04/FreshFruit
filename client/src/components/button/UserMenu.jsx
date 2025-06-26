import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const UserMenu = () => {
  const [showMenu, setShowMenu] = useState(false);
  const user = JSON.parse(localStorage.getItem("user"));
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/dang-nhap");
  };

  if (!user) {
    return (
      <div className="text-sm text-right">
        <Link to="/dang-nhap" className="text-blue-600 hover:underline mr-2">
          Đăng nhập
        </Link>
        <Link to="/dang-ky" className="text-blue-600 hover:underline">
          Đăng ký
        </Link>
      </div>
    );
  }

  return (
    <div className="relative text-sm text-right">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="font-semibold text-green-700 hover:underline"
      >
        👤 {user.username} ▾
      </button>

      {showMenu && (
        <div className="absolute right-0 mt-2 bg-white border rounded shadow-md text-black z-50 min-w-[160px]">
          <Link
            to="/thong-tin"
            className="block px-4 py-2 hover:bg-gray-100"
            onClick={() => setShowMenu(false)}
          >
            Thông tin cá nhân
          </Link>

          {user.role === "admin" && (
            <Link
              to="/admin"
              className="block px-4 py-2 hover:bg-gray-100"
              onClick={() => setShowMenu(false)}
            >
              Trang quản trị
            </Link>
          )}

          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-2 hover:bg-gray-100"
          >
            Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
};

export default UserMenu;
