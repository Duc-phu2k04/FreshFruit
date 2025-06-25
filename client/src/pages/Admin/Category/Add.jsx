import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../../utils/axiosConfig'; // Đảm bảo đường dẫn này đúng

const CategoryCreateForm = () => {
    const [formData, setFormData] = useState({
        name: '',
        description: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const navigate = useNavigate();

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prevData => ({
            ...prevData,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validation đơn giản
        if (!formData.name.trim()) {
            setError('Tên danh mục không được để trống.');
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            await axiosInstance.post('/category/add', formData); // Endpoint để tạo category
            setSuccess('Thêm danh mục thành công! Đang chuyển hướng...');

            // Xóa form và chuyển hướng sau 2 giây
            setTimeout(() => {
                navigate('/admin/category'); // Đường dẫn đến trang danh sách danh mục
            }, 2000);

        } catch (err) {
            setError(err.response?.data?.message || 'Có lỗi xảy ra. Vui lòng thử lại.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8">
            <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-lg">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">Thêm danh mục mới</h1>

                <form onSubmit={handleSubmit}>
                    {/* Thông báo lỗi */}
                    {error && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-4" role="alert">
                            <strong className="font-bold">Lỗi! </strong>
                            <span className="block sm:inline">{error}</span>
                        </div>
                    )}

                    {/* Thông báo thành công */}
                    {success && (
                        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg relative mb-4" role="alert">
                            <strong className="font-bold">Thành công! </strong>
                            <span className="block sm:inline">{success}</span>
                        </div>
                    )}

                    {/* Trường Tên danh mục */}
                    <div className="mb-6">
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                            Tên danh mục <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            className="block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Ví dụ: Đồ điện tử, Thời trang nam,..."
                            required
                        />
                    </div>

                    {/* Trường Mô tả */}
                    <div className="mb-6">
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                            Mô tả
                        </label>
                        <textarea
                            id="description"
                            name="description"
                            rows="4"
                            value={formData.description}
                            onChange={handleChange}
                            className="block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Mô tả ngắn về danh mục..."
                        ></textarea>
                    </div>

                    {/* Nút Submit */}
                    <div className="mt-8">
                        <button
                            type="submit"
                            disabled={loading || success} // Vô hiệu hóa nút khi đang tải hoặc đã thành công
                            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                        >
                            {loading ? 'Đang lưu...' : 'Thêm danh mục'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CategoryCreateForm;