import React from 'react';
import { Link, useLocation } from 'react-router-dom';

// Import các icon cần thiết từ Heroicons (style 'solid' cho sắc nét)
import {
    HomeIcon,
    CubeIcon,
    ShoppingBagIcon,
    UsersIcon,
    StarIcon
} from '@heroicons/react/24/solid';

const Sidebar = () => {
    const location = useLocation();

    // Helper function để kiểm tra link có active không
    const isLinkActive = (path) => {
        return location.pathname === path;
    };

    const linkClasses = "flex items-center px-4 py-3 text-gray-300 rounded-lg transition-colors duration-200";
    const activeLinkClasses = "bg-gray-700 text-white";
    const hoverClasses = "hover:bg-gray-700 hover:text-white";
    const iconClasses = "h-6 w-6 mr-3";

    return (
        <div className="flex h-screen flex-col justify-between bg-gray-800 text-white w-64 p-4">
            <div className="flex flex-col space-y-2">
                {/* Logo hoặc tên trang web có thể đặt ở đây */}
                <div className="text-center py-4">
                    <h2 className="text-2xl font-bold">Admin Panel</h2>
                </div>

                <nav>
                    <ul>
                        <li>
                            <Link
                                to="/dashboard"
                                className={`${linkClasses} ${isLinkActive('/dashboard') ? activeLinkClasses : hoverClasses}`}
                            >
                                <HomeIcon className={iconClasses} />
                                Tổng quan
                            </Link>
                        </li>
                        <li>
                            <Link
                                to="/admin/products"
                                className={`${linkClasses} ${isLinkActive('/admin/products') ? activeLinkClasses : hoverClasses}`}
                            >
                                <CubeIcon className={iconClasses} />
                                Quản lý sản phẩm
                            </Link>
                        </li>
                        <li>
                            <Link
                                to="/admin/orders"
                                className={`${linkClasses} ${isLinkActive('/admin/orders') ? activeLinkClasses : hoverClasses}`}
                            >
                                <ShoppingBagIcon className={iconClasses} />
                                Quản lý đơn hàng
                            </Link>
                        </li>
                        <li>
                            <Link
                                to="/admin/users"
                                className={`${linkClasses} ${isLinkActive('/admin/users') ? activeLinkClasses : hoverClasses}`}
                            >
                                <UsersIcon className={iconClasses} />
                                Quản lý người dùng
                            </Link>
                        </li>
                        <li>
                            <Link
                                to="/admin/reviews"
                                className={`${linkClasses} ${isLinkActive('/admin/reviews') ? activeLinkClasses : hoverClasses}`}
                            >
                                <StarIcon className={iconClasses} />
                                Quản lý bình luận
                            </Link>
                        </li>
                    </ul>
                </nav>
            </div>
            {/* Có thể thêm phần footer cho sidebar ở đây, ví dụ: thông tin người dùng đang đăng nhập */}
        </div>
    );
};

export default Sidebar;