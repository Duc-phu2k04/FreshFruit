import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../../utils/axiosConfig'; // Đảm bảo đường dẫn này đúng
import Loader from '../../../components/common/Loader'; // Sửa lại đường dẫn nếu cần

export default function AddLocationForm() {
    const [name, setName] = useState('');
    const [type, setType] = useState('country'); // Mặc định là 'country'
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const navigate = useNavigate(); // Hook để chuyển hướng sau khi thêm thành công

    const handleSubmit = async (e) => {
        e.preventDefault(); // Ngăn chặn hành vi submit mặc định của form

        // Reset thông báo lỗi/thành công
        setError('');
        setSuccessMessage('');

        // Kiểm tra dữ liệu đầu vào
        if (!name.trim()) {
            setError('Tên vị trí không được để trống.');
            return;
        }

        if (!type) {
            setError('Loại vị trí không được để trống.');
            return;
        }

        try {
            setLoading(true); // Bắt đầu hiển thị loader
            const response = await axiosInstance.post('/locations', { name, type }); // Gửi dữ liệu lên API

            setSuccessMessage('Thêm vị trí mới thành công!');
            setName(''); // Xóa trường tên sau khi thêm thành công
            setType('country'); // Đặt lại loại về mặc định

            // Tùy chọn: Chuyển hướng người dùng về trang danh sách sau một khoảng thời gian
            setTimeout(() => {
                navigate('/admin/locations'); // Điều hướng về trang danh sách locations
            }, 1500);

        } catch (err) {
            setError(err.response?.data?.message || 'Có lỗi xảy ra khi thêm vị trí.');
            console.error('Lỗi khi thêm vị trí:', err);
        } finally {
            setLoading(false); // Ẩn loader
        }
    };

    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">Thêm Vị trí Mới</h1>

            {loading && (
                <div className="text-center p-4">
                    <Loader />
                    <p className="text-gray-600 mt-2">Đang thêm vị trí...</p>
                </div>
            )}

            {error && (
                <p className="text-center text-red-700 bg-red-100 border border-red-400 rounded p-3 mb-4">
                    {error}
                </p>
            )}

            {successMessage && (
                <p className="text-center text-green-700 bg-green-100 border border-green-400 rounded p-3 mb-4">
                    {successMessage}
                </p>
            )}

            {!loading && ( // Chỉ hiển thị form khi không loading
                <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md max-w-md mx-auto">
                    <div className="mb-4">
                        <label htmlFor="name" className="block text-gray-700 text-sm font-bold mb-2">
                            Tên Vị trí:
                        </label>
                        <input
                            type="text"
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:ring-2 focus:ring-blue-500"
                            placeholder="Nhập tên quốc gia hoặc thành phố"
                            required
                        />
                    </div>

                    <div className="mb-6">
                        <label htmlFor="type" className="block text-gray-700 text-sm font-bold mb-2">
                            Loại Vị trí:
                        </label>
                        <select
                            id="type"
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                            className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:ring-2 focus:ring-blue-500"
                            required
                        >
                            <option value="country">Quốc gia</option>
                            <option value="province">Tỉnh/Thành phố</option>
                        </select>
                    </div>

                    <div className="flex items-center justify-between">
                        <button
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition-colors"
                        >
                            Thêm Vị trí
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate('/admin/locations')} // Quay lại trang danh sách
                            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition-colors"
                        >
                            Hủy
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}