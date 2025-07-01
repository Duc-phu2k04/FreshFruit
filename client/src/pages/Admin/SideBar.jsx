import React from 'react';
import { Link, useLocation } from 'react-router-dom';

// Import các icon cần thiết, bao gồm cả icon mới
import {
    HomeIcon,
    CubeIcon,
    TagIcon, // Icon mới cho Danh mục
    MapPinIcon, // Icon mới cho Vị trí
    ShoppingBagIcon,
    UsersIcon,
    StarIcon
} from '@heroicons/react/24/solid';

const Sidebar = () => {
    const location = useLocation();

    // Helper function để kiểm tra link có active không (giữ nguyên)
    const isLinkActive = (path) => {
        return location.pathname === path;
    };

    // Các lớp CSS của Tailwind (giữ nguyên)
    const linkClasses = "flex items-center px-4 py-3 text-gray-300 rounded-lg transition-colors duration-200";
    const activeLinkClasses = "bg-gray-700 text-white";
    const hoverClasses = "hover:bg-gray-700 hover:text-white";
    const iconClasses = "h-6 w-6 mr-3";

    return (
        <div className="flex h-screen flex-col justify-between bg-gray-800 text-white w-64 p-4 fixed">
            <div className="flex flex-col space-y-2">
                {/* Logo hoặc tên trang web */}
                <div className="text-center py-4">
                    <h2 className="text-2xl font-bold">Admin Panel</h2>
                </div>

                <nav>
                    <ul>
                        <li>
                            <Link
                                to="/admin"
                                className={`${linkClasses} ${isLinkActive('/admin') ? activeLinkClasses : hoverClasses}`}
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
                        {/* --- MỤC MỚI: QUẢN LÝ DANH MỤC --- */}
                        <li>
                            <Link
                                to="/admin/category"
                                className={`${linkClasses} ${isLinkActive('/admin/category') ? activeLinkClasses : hoverClasses}`}
                            >
                                <TagIcon className={iconClasses} />
                                Quản lý danh mục
                            </Link>
                        </li>
                        {/* --- MỤC MỚI: QUẢN LÝ VỊ TRÍ --- */}
                        <li>
                            <Link
                                to="/admin/locations"
                                className={`${linkClasses} ${isLinkActive('/admin/locations') ? activeLinkClasses : hoverClasses}`}
                            >
                                <MapPinIcon className={iconClasses} />
                                Quản lý vị trí
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
            {/* Footer của sidebar */}
        </div>
    );
};

export default Sidebar;