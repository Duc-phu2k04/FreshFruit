import React from 'react';
import { Link, useLocation } from 'react-router-dom';

// Import các icon cần thiết, bao gồm cả icon mới
import {
    HomeIcon,
    CubeIcon,
    TagIcon, // Icon cho Danh mục
    MapPinIcon, // Icon cho Vị trí
    ShoppingBagIcon,
    UsersIcon,
    StarIcon,
    TicketIcon, // Icon mới cho Vouchers
    TruckIcon,
    ArrowLeftOnRectangleIcon
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
                        {/* --- MỤC: QUẢN LÝ DANH MỤC --- */}
                        <li>
                            <Link
                                to="/admin/category"
                                className={`${linkClasses} ${isLinkActive('/admin/category') ? activeLinkClasses : hoverClasses}`}
                            >
                                <TagIcon className={iconClasses} />
                                Quản lý danh mục
                            </Link>
                        </li>
                        {/* --- MỤC: QUẢN LÝ VỊ TRÍ --- */}
                        <li>
                            <Link
                                to="/admin/locations"
                                className={`${linkClasses} ${isLinkActive('/admin/locations') ? activeLinkClasses : hoverClasses}`}
                            >
                                <MapPinIcon className={iconClasses} />
                                Quản lý vị trí
                            </Link>
                        </li>
                        {/* --- MỤC: QUẢN LÝ ĐỊA CHỈ NHẬN HÀNG --- */}
                        <li>
                            <Link
                                to="/admin/address"
                                className={`${linkClasses} ${isLinkActive('/admin/address') ? activeLinkClasses : hoverClasses}`}
                            >
                                <TruckIcon className={iconClasses} />
                                Quản lý địa chỉ
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
                        {/* --- MỤC MỚI: QUẢN LÝ VOUCHERS --- */}
                        <li>
                            <Link
                                to="/admin/vouchers"
                                className={`${linkClasses} ${isLinkActive('/admin/vouchers') ? activeLinkClasses : hoverClasses}`}
                            >
                                <TicketIcon className={iconClasses} />
                                Quản lý Voucher
                            </Link>
                        </li>
                    </ul>
                </nav>
            </div>

            {/* Footer của sidebar: Homepage */}
            <div className="flex flex-col space-y-2 mb-4">
                <hr className="border-gray-700 my-2" />
                {/* Link quay lại trang Homepage */}
                <Link
                    to="/" // Đường dẫn đến trang chủ của ứng dụng (không phải admin)
                    className={`${linkClasses} ${hoverClasses}`}
                >
                    <ArrowLeftOnRectangleIcon className={iconClasses} />
                    Quay lại Homepage
                </Link>
            </div>
        </div>
    );
};

export default Sidebar;