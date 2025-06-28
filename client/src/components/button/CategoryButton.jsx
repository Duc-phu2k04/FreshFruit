import { FaList } from 'react-icons/fa';
import { useState } from 'react';

export default function CategoryDropdown() {
    const [open, setOpen] = useState(false);

    return (
        <div
            className="relative inline-block"
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
        >

            <button className="bg-green-800 hover:bg-green-700 text-white font-medium py-3 px-3.5 sm:px-6 rounded-lg flex items-center space-x-2 cursor-pointer">
                <FaList />
                <span>DANH MỤC SẢN PHẨM</span>
            </button>


            {open && (
                <ul className="absolute left-0 mt-2 w-56 sm:w-60 bg-white border rounded-md shadow-lg z-10 text-gray-800">
                    <li className="px-4 py-2 hover:bg-green-100 cursor-pointer">🍎 Trái cây</li>
                    <li className="px-4 py-2 hover:bg-green-100 cursor-pointer">🥬 Rau củ</li>
                    <li className="px-4 py-2 hover:bg-green-100 cursor-pointer">🥜 Các loại hạt</li>
                    <li className="px-4 py-2 hover:bg-green-100 cursor-pointer">🍹 Nước ép</li>
                </ul>
            )}
        </div>
    )
}