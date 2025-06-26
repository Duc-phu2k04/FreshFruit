import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../../utils/axiosConfig'; // Đảm bảo đường dẫn này đúng
import Loader from '../../../components/common/Loader'; // Sửa lại đường dẫn nếu cần

export default function AddProductForm() {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('');
    const [image, setImage] = useState(''); // Có thể là URL hình ảnh
    const [stock, setStock] = useState(0);
    const [category, setCategory] = useState(''); // ID của category được chọn
    const [location, setLocation] = useState(''); // ID của location được chọn

    const [categories, setCategories] = useState([]); // Danh sách categories từ API
    const [locations, setLocations] = useState([]); // Danh sách locations từ API

    const [loading, setLoading] = useState(true); // Loader cho việc fetch danh mục/địa điểm
    const [submitting, setSubmitting] = useState(false); // Loader cho việc submit form
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const navigate = useNavigate();

    // --- Fetch danh sách Categories và Locations khi component được mount ---
    useEffect(() => {
        const fetchDataForSelects = async () => {
            try {
                setLoading(true);
                const [categoriesRes, locationsRes] = await Promise.all([
                    axiosInstance.get('/category'), // Endpoint API cho categories
                    axiosInstance.get('/locations')   // Endpoint API cho locations
                ]);

                setCategories(categoriesRes.data.data || categoriesRes.data);
                setLocations(locationsRes.data.data || locationsRes.data);

                // Set giá trị mặc định nếu có dữ liệu
                if ((categoriesRes.data.data || categoriesRes.data).length > 0) {
                    setCategory((categoriesRes.data.data || categoriesRes.data)[0]._id);
                }
                if ((locationsRes.data.data || locationsRes.data).length > 0) {
                    setLocation((locationsRes.data.data || locationsRes.data)[0]._id);
                }

            } catch (err) {
                setError('Lỗi khi tải danh sách danh mục hoặc địa điểm. Vui lòng thử lại.');
                console.error('Lỗi fetch dependencies:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchDataForSelects();
    }, []); // Chạy một lần khi component mount

    // --- Hàm xử lý submit form ---
    const handleSubmit = async (e) => {
        e.preventDefault();

        // Reset thông báo
        setError('');
        setSuccessMessage('');

        // Basic Validation
        if (!name.trim() || !price || !category || !location) {
            setError('Vui lòng điền đầy đủ các trường bắt buộc (Tên, Giá, Danh mục, Nơi sản xuất).');
            return;
        }
        if (isNaN(price) || parseFloat(price) <= 0) {
            setError('Giá phải là một số dương.');
            return;
        }
        if (isNaN(stock) || parseInt(stock) < 0) {
            setError('Tồn kho phải là một số không âm.');
            return;
        }

        try {
            setSubmitting(true);
            const newProduct = {
                name,
                description,
                price: parseFloat(price), // Đảm bảo giá là số
                image,
                stock: parseInt(stock),   // Đảm bảo tồn kho là số nguyên
                category,                 // ID của category
                location                  // ID của location
            };

            await axiosInstance.post('/product/add', newProduct); // Gửi dữ liệu sản phẩm mới

            setSuccessMessage('Thêm sản phẩm mới thành công!');
            // Reset form sau khi thêm thành công
            setName('');
            setDescription('');
            setPrice('');
            setImage('');
            setStock(0);
            // Giữ nguyên category/location đã chọn hoặc reset về mặc định
            if (categories.length > 0) setCategory(categories[0]._id);
            if (locations.length > 0) setLocation(locations[0]._id);

            // Chuyển hướng về trang danh sách sau một thời gian
            setTimeout(() => {
                navigate('/admin/products');
            }, 1500);

        } catch (err) {
            setError(err.response?.data?.message || 'Có lỗi xảy ra khi thêm sản phẩm.');
            console.error('Lỗi khi thêm sản phẩm:', err);
        } finally {
            setSubmitting(false);
        }
    };

    // --- Hiển thị Loader khi đang fetch categories/locations ---
    if (loading) {
        return (
            <div className="container mx-auto p-4 md:p-6 lg:p-8 text-center">
                <Loader />
                <p className="text-gray-600 mt-2">Đang tải dữ liệu cần thiết...</p>
            </div>
        );
    }

    // --- Hiển thị lỗi nếu không tải được categories/locations ---
    if (error && !submitting) {
        return (
            <div className="container mx-auto p-4 md:p-6 lg:p-8">
                <p className="text-center text-red-700 bg-red-100 border border-red-400 rounded p-3 mb-4">
                    {error}
                    <button onClick={() => navigate('/admin/products')} className="ml-4 text-blue-600 hover:underline">Quay lại danh sách</button>
                </p>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">Thêm Sản phẩm Mới</h1>

            {submitting && ( // Loader khi đang submit form
                <div className="text-center p-4">
                    <Loader />
                    <p className="text-gray-600 mt-2">Đang thêm sản phẩm...</p>
                </div>
            )}

            {error && submitting && ( // Lỗi khi submit form
                <p className="text-center text-red-700 bg-red-100 border border-red-400 rounded p-3 mb-4">
                    {error}
                </p>
            )}

            {successMessage && (
                <p className="text-center text-green-700 bg-green-100 border border-green-400 rounded p-3 mb-4">
                    {successMessage}
                </p>
            )}

            {/* Chỉ hiển thị form khi không đang submit và dữ liệu đã load xong */}
            {!submitting && (
                <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md max-w-lg mx-auto">
                    {/* Trường Tên */}
                    <div className="mb-4">
                        <label htmlFor="name" className="block text-gray-700 text-sm font-bold mb-2">
                            Tên Sản phẩm: <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:ring-2 focus:ring-blue-500"
                            placeholder="Nhập tên sản phẩm"
                            required
                        />
                    </div>

                    {/* Trường Mô tả */}
                    <div className="mb-4">
                        <label htmlFor="description" className="block text-gray-700 text-sm font-bold mb-2">
                            Mô tả:
                        </label>
                        <textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:ring-2 focus:ring-blue-500"
                            placeholder="Mô tả chi tiết sản phẩm"
                            rows="3"
                        ></textarea>
                    </div>

                    {/* Trường Giá */}
                    <div className="mb-4">
                        <label htmlFor="price" className="block text-gray-700 text-sm font-bold mb-2">
                            Giá: <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="number"
                            id="price"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:ring-2 focus:ring-blue-500"
                            placeholder="Nhập giá sản phẩm"
                            min="0"
                            step="0.01"
                            required
                        />
                    </div>

                    {/* Trường URL Hình ảnh */}
                    <div className="mb-4">
                        <label htmlFor="image" className="block text-gray-700 text-sm font-bold mb-2">
                            URL Hình ảnh:
                        </label>
                        <input
                            type="text"
                            id="image"
                            value={image}
                            onChange={(e) => setImage(e.target.value)}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:ring-2 focus:ring-blue-500"
                            placeholder="Dán URL hình ảnh sản phẩm"
                        />
                    </div>

                    {/* Trường Tồn kho */}
                    <div className="mb-4">
                        <label htmlFor="stock" className="block text-gray-700 text-sm font-bold mb-2">
                            Tồn kho:
                        </label>
                        <input
                            type="number"
                            id="stock"
                            value={stock}
                            onChange={(e) => setStock(e.target.value)}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:ring-2 focus:ring-blue-500"
                            min="0"
                            required
                        />
                    </div>

                    {/* Select cho Category */}
                    <div className="mb-4">
                        <label htmlFor="category" className="block text-gray-700 text-sm font-bold mb-2">
                            Danh mục: <span className="text-red-500">*</span>
                        </label>
                        <select
                            id="category"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:ring-2 focus:ring-blue-500"
                            required
                            disabled={categories.length === 0} // Disable nếu không có category nào
                        >
                            {categories.length > 0 ? (
                                categories.map((cat) => (
                                    <option key={cat._id} value={cat._id}>
                                        {cat.name}
                                    </option>
                                ))
                            ) : (
                                <option value="">Không có danh mục nào để chọn</option>
                            )}
                        </select>
                        {categories.length === 0 && !loading && (
                            <p className="text-sm text-red-500 mt-1">Vui lòng thêm danh mục trước.</p>
                        )}
                    </div>

                    {/* Select cho Location */}
                    <div className="mb-6">
                        <label htmlFor="location" className="block text-gray-700 text-sm font-bold mb-2">
                            Nơi sản xuất: <span className="text-red-500">*</span>
                        </label>
                        <select
                            id="location"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:ring-2 focus:ring-blue-500"
                            required
                            disabled={locations.length === 0} // Disable nếu không có location nào
                        >
                            {locations.length > 0 ? (
                                locations.map((loc) => (
                                    <option key={loc._id} value={loc._id}>
                                        {loc.name}
                                    </option>
                                ))
                            ) : (
                                <option value="">Không có địa điểm nào để chọn</option>
                            )}
                        </select>
                        {locations.length === 0 && !loading && (
                            <p className="text-sm text-red-500 mt-1">Vui lòng thêm địa điểm trước.</p>
                        )}
                    </div>

                    {/* Nút Submit và Hủy */}
                    <div className="flex items-center justify-between">
                        <button
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition-colors"
                            disabled={submitting || categories.length === 0 || locations.length === 0} // Disable khi đang submit hoặc không có dữ liệu
                        >
                            Thêm Sản phẩm
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate('/admin/products')}
                            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition-colors"
                            disabled={submitting}
                        >
                            Hủy
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}