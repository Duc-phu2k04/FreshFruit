import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../../utils/axiosConfig';

// Import các icon cần thiết
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

// Import component Loader (tùy chọn, bạn có thể thay bằng text)
import Loader from '../../../components/common/Loader'; // Sửa lại đường dẫn nếu cần

export default function CategoryList() {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    // --- DATA FETCHING ---
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                setLoading(true);
                const res = await axiosInstance.get('/category');
                // Giả sử API trả về mảng trong res.data hoặc res.data.data
                setCategories(res.data.data || res.data);
            } catch (err) {
                setError('Lỗi khi tải danh mục. Vui lòng thử lại.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchCategories();
    }, []);

    // --- DELETE HANDLER ---
    const handleDelete = async (categoryId) => {
        // Hỏi xác nhận trước khi xóa
        if (window.confirm('Bạn có chắc chắn muốn xóa danh mục này không? Hành động này không thể hoàn tác.')) {
            try {
                await axiosInstance.delete(`/category/${categoryId}`);
                // Xóa danh mục khỏi state để cập nhật UI ngay lập tức
                setCategories(prevCategories => prevCategories.filter(category => category._id !== categoryId));
                // Có thể thêm thông báo thành công ở đây
            } catch (err) {
                setError('Xóa danh mục thất bại.');
                console.error(err);
            }
        }
    };

    // --- SEARCH LOGIC ---
    const filteredCategories = useMemo(() =>
        categories.filter(category =>
            category.name.toLowerCase().includes(searchTerm.toLowerCase())
        ), [categories, searchTerm]
    );

    // --- RENDER LOGIC ---
    const renderContent = () => {
        if (loading) {
            return <div className="text-center p-10"><Loader /></div>;
        }

        if (error) {
            return <p className="text-center text-red-500 bg-red-100 p-4 rounded-lg">{error}</p>;
        }

        if (filteredCategories.length === 0) {
            return <p className="text-center text-gray-500 bg-gray-100 p-4 rounded-lg">Không tìm thấy danh mục nào.</p>;
        }

        return (
            <div className="overflow-x-auto bg-white rounded-lg shadow">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tên danh mục</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mô tả</th>
                            <th scope="col" className="relative px-6 py-3">
                                <span className="sr-only">Hành động</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredCategories.map((category) => (
                            <tr key={category._id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">{category.name}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-500">{category.description || 'Không có mô tả'}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <div className="flex items-center justify-end space-x-4">
                                        <Link to={`/admin/category/edit/${category._id}`} className="text-indigo-600 hover:text-indigo-900 flex items-center">
                                            <PencilIcon className="h-5 w-5 mr-1" />
                                            Sửa
                                        </Link>
                                        <button onClick={() => handleDelete(category._id)} className="text-red-600 hover:text-red-900 flex items-center">
                                            <TrashIcon className="h-5 w-5 mr-1" />
                                            Xóa
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Quản lý danh mục</h1>
                <div className="flex items-center gap-4 w-full md:w-auto">
                    {/* Ô tìm kiếm */}
                    <input
                        type="text"
                        placeholder="Tìm kiếm theo tên..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="block w-full md:w-64 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {/* Nút thêm mới */}
                    <Link
                        to="/admin/category/add" // Đường dẫn đến trang tạo danh mục mới
                        className="flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                    >
                        <PlusIcon className="h-5 w-5" />
                        <span>Thêm mới</span>
                    </Link>
                </div>
            </div>

            {renderContent()}
        </div>
    );
}