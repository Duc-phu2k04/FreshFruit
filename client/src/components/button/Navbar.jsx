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
        <nav>
            <ul className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-8 md:justify-center">
                {menuItems.map((item, idx) => (

                    <li key={idx}>
                        <Link
                            to={item.path}
                            className="block text-gray-700 font-medium hover:text-green-700 hover:scale-105 transition-all duration-200 py-2"
                        >
                            {item.name}
                        </Link>
                    </li>
                ))}
            </ul>
        </nav>
    );
}