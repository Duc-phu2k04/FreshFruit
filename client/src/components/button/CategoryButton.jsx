import { FaPhoneAlt } from 'react-icons/fa';
import { useState } from 'react';

export default function ContactDropdown() {
    const [open, setOpen] = useState(false);

    return (
        <div className="relative inline-block">
            {/* Nút bấm */}
            <button
                onClick={() => setOpen(!open)}
                className="bg-green-800 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg flex items-center space-x-2 cursor-pointer"
            >
                <FaPhoneAlt />
                <span>LIÊN HỆ</span>
            </button>

            {/* Menu xổ xuống */}
            {open && (
                <ul className="absolute left-0 mt-2 w-80 bg-white border rounded-md shadow-lg z-10 text-gray-800">
                    <li className="px-4 py-2 border-b font-semibold">📧 Gmail:</li>
                    <li className="px-6 py-1">- manhptph32121@.fpt.edu.vn</li>
                    <li className="px-6 py-1">- phundph31644@.fpt.edu.vn</li>
                    <li className="px-6 py-1 border-b">- vulvph31594@.fpt.edu.vn</li>

                    <li className="px-4 py-2 border-b font-semibold">📞 SĐT:</li>
                    <li className="px-6 py-1">- 0812560603</li>
                    <li className="px-6 py-1">- 0857596781</li>
                    <li className="px-6 py-1 border-b">- 0947557223</li>

                    <li className="px-4 py-2 font-semibold">👥 Thành viên:</li>
                    <li className="px-6 py-1">- Phạm Thành Mạnh <span className="text-gray-500">PH32121</span></li>
                    <li className="px-6 py-1">- Nguyễn Đức Phú <span className="text-gray-500">PH31644</span></li>
                    <li className="px-6 py-1">- Liễu Văn Vũ <span className="text-gray-500">PH31594</span></li>
                </ul>
            )}
        </div>
    );
}
