import { FaList } from 'react-icons/fa';
import { useState } from 'react';

export default function CategoryDropdown() {
    const [open, setOpen] = useState(false);
    const handleToggle = () => {
        if (window.innerWidth < 640) {
            setOpen(!open);
        }
    };

    const handleMouseEnter = () => {
        if (window.innerWidth >= 640) {
            setOpen(true);
        }
    };

    const handleMouseLeave = () => {
        if (window.innerWidth >= 640) {
            setOpen(false);
        }
    };


    return (
        <div

            className="w-full sm:inline-block sm:w-auto sm:relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <button
                className="bg-green-800 hover:bg-green-700 text-white font-medium py-2 px-4 sm:py-3 sm:px-6 rounded-lg flex items-center justify-center sm:justify-start space-x-2 cursor-pointer w-full text-sm sm:text-base"
                onClick={handleToggle}
            >
                <FaList className="text-lg sm:text-xl" />
                <span className="hidden sm:inline">DANH MỤC SẢN PHẨM</span>
                <span className="inline sm:hidden">DANH MỤC</span>
            </button>
            <ul
                className={`
                    mt-2 w-full bg-white border rounded-md shadow-lg z-10 text-gray-800 text-sm sm:text-base
                    ${open ? 'block' : 'hidden'} 
                    sm:absolute sm:left-0 sm:right-auto sm:w-60
                `}
            >
                <li className="px-4 py-2 hover:bg-green-100 cursor-pointer flex items-center space-x-2">
                    <span className="text-lg">🍎</span> <span>Trái cây</span>
                </li>
                <li className="px-4 py-2 hover:bg-green-100 cursor-pointer flex items-center space-x-2">
                    <span className="text-lg">🥬</span> <span>Rau củ</span>
                </li>
                <li className="px-4 py-2 hover:bg-green-100 cursor-pointer flex items-center space-x-2">
                    <span className="text-lg">🥜</span> <span>Các loại hạt</span>
                </li>
                <li className="px-4 py-2 hover:bg-green-100 cursor-pointer flex items-center space-x-2">
                    <span className="text-lg">🍹</span> <span>Nước ép</span>
                </li>
            </ul>
        </div>
    );
}