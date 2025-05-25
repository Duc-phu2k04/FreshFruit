import { Link } from "react-router-dom";
export default function Navbar() {
    const menuItems = [
        { name: 'Trang chủ', path: '/' },
        { name: 'Sản phẩm', path: '/san-pham' },
        { name: 'Tin tức', path: '/tin-tuc' },
        { name: 'Về chúng tôi', path: '/ve-chung-toi' },
        { name: 'Nhượng quyền', path: '/nhuong-quyen' },
        { name: 'Hệ thống cửa hàng', path: '/he-thong-cua-hang' }
    ];

    return (
        <nav className="bg-white py-4">
            <ul className="flex justify-center space-x-8">
                {menuItems.map((item, idx) => (
                    <li key={idx} className="text-gray-700 font-medium text-base hover:text-green-700 hover:scale-110 transition-all duration-200 cursor-pointer">
                        <Link
                            to={item.path}
                            className="text-gray-700 font-medium hover:text-green-700 hover:scale-110 transition-all duration-200"
                        >
                            {item.name}
                        </Link>
                    </li>
                ))}
            </ul>
        </nav>
    );
}
