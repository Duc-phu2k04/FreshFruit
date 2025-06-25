import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axiosInstance from '../../../utils/axiosConfig';
import Loader from '../../../components/common/Loader'; // Tùy chọn, để hiển thị khi tải dữ liệu

const CategoryEditForm = () => {
    // Lấy ID từ URL, ví dụ: /admin/categories/edit/12345
    const { id } = useParams();
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        name: '',
        description: ''
    });

    const [loading, setLoading] = useState(false);      // Dùng cho lúc submit form
    const [pageLoading, setPageLoading] = useState(true); // Dùng cho lúc tải dữ liệu ban đầu
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    // Bрок 1: Tải dữ liệu danh mục cần sửa khi component được render
    useEffect(() => {
        const fetchCategory = async () => {
            try {
                const res = await axiosInstance.get(`/category/${id}`);
                const categoryData = res.data.data || res.data;
                setFormData({
                    name: categoryData.name,
                    description: categoryData.description || ''
                });
            } catch (err) {
                setError('Không thể tải dữ liệu danh mục.');
                console.error(err);
            } finally {
                setPageLoading(false);
            }
        };

        fetchCategory();
    }, [id]); // useEffect sẽ chạy lại nếu id thay đổi

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prevData => ({
            ...prevData,
            [name]: value
        }));
    };

    // Bрок 2: Gửi dữ liệu đã cập nhật lên server
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            setError('Tên danh mục không được để trống.');
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            // Sử dụng phương thức PUT để cập nhật
            await axiosInstance.put(`/category/${id}`, formData);
            setSuccess('Cập nhật danh mục thành công! Đang chuyển hướng...');

            setTimeout(() => {
                navigate('/admin/category');
            }, 2000);

        } catch (err) {
            setError(err.response?.data?.message || 'Có lỗi xảy ra khi cập nhật.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Hiển thị Loader trong khi tải dữ liệu ban đầu
    if (pageLoading) {
        return <div className="text-center p-10"><Loader /></div>;
    }

    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8">
            <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-lg">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">Chỉnh sửa danh mục</h1>

                <form onSubmit={handleSubmit}>
                    {error && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-4" role="alert">
                            <strong className="font-bold">Lỗi! </strong>
                            <span className="block sm:inline">{error}</span>
                        </div>
                    )}

                    {success && (
                        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg relative mb-4" role="alert">
                            <strong className="font-bold">Thành công! </strong>
                            <span className="block sm:inline">{success}</span>
                        </div>
                    )}

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
                            className="block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>

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
                            className="block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        ></textarea>
                    </div>

                    <div className="mt-8">
                        <button
                            type="submit"
                            disabled={loading || success}
                            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                        >
                            {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CategoryEditForm;