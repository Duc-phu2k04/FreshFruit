import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../../utils/axiosConfig'; // Đảm bảo đường dẫn này đúng
import { PlusIcon, PencilIcon, TrashIcon, ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/outline'; // Import icons
import Loader from '../../../components/common/Loader'; // Sửa lại đường dẫn nếu cần

export default function ProductList() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    // Mặc định sắp xếp theo ngày tạo giảm dần hoặc theo tên
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'ascending' });

    // --- LẤY DỮ LIỆU SẢN PHẨM ---
    useEffect(() => {
        const fetchProducts = async () => {
            try {
                setLoading(true);
                // Đảm bảo API của bạn populate category và location nếu muốn hiển thị tên
                const res = await axiosInstance.get('/product');
                setProducts(res.data.data || res.data);
            } catch (err) {
                setError('Lỗi khi tải danh sách sản phẩm. Vui lòng thử lại.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchProducts();
    }, []);

    // --- HÀM XỬ LÝ XÓA SẢN PHẨM ---
    const handleDelete = async (productId) => {
        if (window.confirm('Bạn có chắc chắn muốn xóa sản phẩm này không?')) {
            try {
                await axiosInstance.delete(`/product/${productId}`);
                setProducts(prevProducts => prevProducts.filter(product => product._id !== productId));
                alert('Sản phẩm đã được xóa thành công!');
            } catch (err) {
                setError('Xóa sản phẩm thất bại.');
                console.error(err);
            }
        }
    };

    // --- LOGIC TÌM KIẾM VÀ SẮP XẾP ---
    const sortedAndFilteredProducts = useMemo(() => {
        let workableProducts = [...products];

        // 1. Lọc theo searchTerm (chỉ tìm kiếm theo tên sản phẩm và tên danh mục cho gọn)
        if (searchTerm) {
            workableProducts = workableProducts.filter(product =>
                product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                product.category?.name.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // 2. Sắp xếp
        if (sortConfig.key) {
            workableProducts.sort((a, b) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

                // Xử lý sắp xếp cho trường category.name
                if (sortConfig.key === 'category') {
                    aValue = a.category?.name || '';
                    bValue = b.category?.name || '';
                }

                // Chuyển đổi sang số để so sánh đúng cho price và stock
                if (sortConfig.key === 'price' || sortConfig.key === 'stock') {
                    aValue = Number(aValue);
                    bValue = Number(bValue);
                }


                if (aValue < bValue) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }

        return workableProducts;
    }, [products, searchTerm, sortConfig]);

    // --- HÀM XỬ LÝ SẮP XẾP ---
    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return null;
        if (sortConfig.direction === 'ascending') {
            return <ArrowUpIcon className="h-4 w-4 ml-1 inline" />;
        }
        return <ArrowDownIcon className="h-4 w-4 ml-1 inline" />;
    };

    // --- LOGIC HIỂN THỊ NỘI DUNG ---
    const renderContent = () => {
        if (loading) {
            return <div className="text-center p-10"><Loader /></div>;
        }

        if (error) {
            return <p className="text-center text-red-500 bg-red-100 p-4 rounded-lg">{error}</p>;
        }

        if (sortedAndFilteredProducts.length === 0 && searchTerm) {
            return <p className="text-center text-gray-500 bg-gray-100 p-4 rounded-lg">Không tìm thấy sản phẩm nào khớp với tìm kiếm.</p>;
        }

        if (sortedAndFilteredProducts.length === 0) {
            return <p className="text-center text-gray-500 bg-gray-100 p-4 rounded-lg">Chưa có sản phẩm nào.</p>;
        }

        return (
            <div className="overflow-x-auto bg-white rounded-lg shadow">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
                                <button onClick={() => requestSort('name')} className="flex items-center">
                                    Tên Sản phẩm {getSortIcon('name')}
                                </button>
                            </th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                                <button onClick={() => requestSort('price')} className="flex items-center">
                                    Giá {getSortIcon('price')}
                                </button>
                            </th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/12">Ảnh</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/12">
                                <button onClick={() => requestSort('stock')} className="flex items-center">
                                    Tồn kho {getSortIcon('stock')}
                                </button>
                            </th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                                <button onClick={() => requestSort('category')} className="flex items-center">
                                    Danh mục {getSortIcon('category')}
                                </button>
                            </th>
                            <th scope="col" className="relative px-4 py-3 text-right w-1/6">
                                <span className="sr-only">Hành động</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {sortedAndFilteredProducts.map((product) => (
                            <tr key={product._id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">{product.name}</div>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {product.price.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {product.image ? (
                                        <img src={`http://localhost:3000${product.image}`} alt={product.name} className="h-10 w-10 object-cover rounded-md" />
                                    ) : (
                                        <span className="text-gray-400">Không ảnh</span>
                                    )}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{product.stock}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {product.category ? product.category.name : 'N/A'}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <div className="flex items-center justify-end space-x-4">
                                        <Link to={`/admin/products/edit/${product._id}`} className="text-indigo-600 hover:text-indigo-900 flex items-center">
                                            <PencilIcon className="h-5 w-5 mr-1" />
                                            Sửa
                                        </Link>
                                        <button onClick={() => handleDelete(product._id)} className="text-red-600 hover:text-red-900 flex items-center">
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
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Quản lý Sản phẩm</h1>
                <div className="flex items-center gap-4 w-full md:w-auto">
                    {/* Ô tìm kiếm */}
                    <input
                        type="text"
                        placeholder="Tìm kiếm sản phẩm theo tên hoặc danh mục..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="block w-full md:w-64 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {/* Nút thêm mới */}
                    <Link
                        to="/admin/products/add" // Đường dẫn đến trang tạo sản phẩm mới
                        className="flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                    >
                        <PlusIcon className="h-5 w-5" />
                        <span>Thêm sản phẩm</span>
                    </Link>
                </div>
            </div>

            {renderContent()}
        </div>
    );
}