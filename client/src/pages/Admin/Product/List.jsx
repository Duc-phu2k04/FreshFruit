import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../../utils/axiosConfig';
import { PlusIcon, ArrowUpIcon, ArrowDownIcon, TrashIcon } from '@heroicons/react/24/outline';
import Loader from '../../../components/common/Loader';

export default function ProductList() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'ascending' });

    // Lấy danh sách sản phẩm
    const fetchProducts = async () => {
        try {
            setLoading(true);
            const res = await axiosInstance.get('/product');
            setProducts(res.data.data || res.data);
        } catch (err) {
            setError('Lỗi khi tải danh sách sản phẩm. Vui lòng thử lại.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, []);

    // Hàm xóa sản phẩm
    const handleDeleteProduct = async (productId) => {
        if (!window.confirm('Bạn có chắc muốn xóa sản phẩm này?')) return;
        try {
            await axiosInstance.delete(`/product/${productId}`);
            alert('🗑️ Xóa sản phẩm thành công');
            fetchProducts(); // load lại danh sách
        } catch (err) {
            console.error('Lỗi khi xóa sản phẩm:', err);
            alert('❌ Lỗi khi xóa sản phẩm');
        }
    };

    // Tìm kiếm + sắp xếp
    const sortedAndFilteredProducts = useMemo(() => {
        let data = [...products];

        if (searchTerm) {
            data = data.filter(product =>
                product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                product.category?.name.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        if (sortConfig.key) {
            data.sort((a, b) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

                if (sortConfig.key === 'category') {
                    aValue = a.category?.name || '';
                    bValue = b.category?.name || '';
                }
                if (sortConfig.key === 'price' || sortConfig.key === 'stock') {
                    aValue = Number(aValue);
                    bValue = Number(bValue);
                }

                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return data;
    }, [products, searchTerm, sortConfig]);

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return null;
        return sortConfig.direction === 'ascending'
            ? <ArrowUpIcon className="h-4 w-4 ml-1 inline" />
            : <ArrowDownIcon className="h-4 w-4 ml-1 inline" />;
    };

    const renderContent = () => {
        if (loading) return <div className="text-center p-10"><Loader /></div>;
        if (error) return <p className="text-center text-red-500">{error}</p>;
        if (sortedAndFilteredProducts.length === 0) return <p className="text-center text-gray-500">Không có sản phẩm.</p>;

        return (
            <div className="overflow-x-auto bg-white rounded-lg shadow">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                <button onClick={() => requestSort('name')} className="flex items-center">
                                    Tên sản phẩm {getSortIcon('name')}
                                </button>
                            </th>
                            <th className="px-4 py-3">Giá</th>
                            <th className="px-4 py-3">Ảnh</th>
                            <th className="px-4 py-3">Tồn kho</th>
                            <th className="px-4 py-3">Danh mục</th>
                            <th className="px-4 py-3 text-right">Hành động</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {sortedAndFilteredProducts.map(product => (
                            <tr key={product._id} className="hover:bg-gray-50">
                                <td className="px-4 py-4">{product.name}</td>
                                <td className="px-4 py-4">
                                    {product.baseVariant?.price
                                        ? product.baseVariant.price.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })
                                        : product.variants?.[0]?.price
                                            ? product.variants[0].price.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })
                                            : 'Không có giá'}
                                </td>
                                <td className="px-4 py-4">
                                    {product.image ? (
                                        <img
                                            src={product.image.startsWith("http") ? product.image : `http://localhost:3000${product.image}`}
                                            alt={product.name}
                                            className="h-10 w-10 object-cover rounded"
                                        />
                                    ) : "Không ảnh"}
                                </td>
                                <td className="px-4 py-4">
                                    {product.baseVariant?.stock ?? product.variants?.[0]?.stock ?? 'Không rõ'}
                                </td>
                                <td className="px-4 py-4">{product.category?.name ?? 'N/A'}</td>
                                <td className="px-4 py-4 text-right space-x-3">
                                    <Link
                                        to={`/admin/products/detail/${product._id}`}
                                        className="text-blue-600 hover:underline"
                                    >
                                        Xem
                                    </Link>
                                    <button
                                        onClick={() => handleDeleteProduct(product._id)}
                                        className="text-red-600 hover:underline flex items-center gap-1"
                                    >
                                        <TrashIcon className="h-4 w-4" /> Xóa
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <div className="container mx-auto p-4">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Quản lý sản phẩm</h1>
                <div className="flex items-center gap-4">
                    <input
                        type="text"
                        placeholder="Tìm kiếm..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="border px-4 py-2 rounded-lg"
                    />
                    <Link
                        to="/admin/products/add"
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        <PlusIcon className="h-5 w-5" />
                        Thêm sản phẩm
                    </Link>
                </div>
            </div>
            {renderContent()}
        </div>
    );
}
