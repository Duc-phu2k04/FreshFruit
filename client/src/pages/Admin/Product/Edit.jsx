import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axiosInstance from '../../../utils/axiosConfig'; // Đảm bảo đường dẫn này đúng
import Loader from '../../../components/common/Loader'; // Sửa lại đường dẫn nếu cần

export default function EditProductForm() {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('');
    const [image, setImage] = useState('');
    const [stock, setStock] = useState(0);
    const [category, setCategory] = useState(''); // ID của category được chọn
    const [location, setLocation] = useState(''); // ID của location được chọn

    const [categories, setCategories] = useState([]); // Danh sách categories từ API
    const [locations, setLocations] = useState([]); // Danh sách locations từ API

    const [loadingInitialData, setLoadingInitialData] = useState(true); // Loader cho việc tải dữ liệu ban đầu (sản phẩm, danh mục, địa điểm)
    const [submitting, setSubmitting] = useState(false); // Loader cho việc gửi form
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const navigate = useNavigate();
    const { id } = useParams(); // Lấy ID sản phẩm từ URL (ví dụ: /admin/products/edit/:id)

    // --- Tải dữ liệu sản phẩm, danh mục và địa điểm khi component được mount ---
    useEffect(() => {
        const fetchAllData = async () => {
            try {
                setLoadingInitialData(true);
                // Fetch đồng thời sản phẩm, danh mục và địa điểm
                const [productRes, categoriesRes, locationsRes] = await Promise.all([
                    axiosInstance.get(`/product/${id}`), // Lấy chi tiết sản phẩm theo ID
                    axiosInstance.get('/category'),    // Lấy danh sách categories
                    axiosInstance.get('/locations')      // Lấy danh sách locations
                ]);

                // Set data cho sản phẩm
                const productData = productRes.data.data || productRes.data;
                setName(productData.name || '');
                setDescription(productData.description || '');
                setPrice(productData.price || '');
                setImage(productData.image || '');
                setStock(productData.stock || 0);
                // Đảm bảo ID category/location tồn tại và được chọn
                setCategory(productData.category?._id || '');
                setLocation(productData.location?._id || '');

                // Set data cho danh mục và địa điểm
                setCategories(categoriesRes.data.data || categoriesRes.data);
                setLocations(locationsRes.data.data || locationsRes.data);

                // Nếu sản phẩm có category/location nhưng không có trong danh sách fetched, đặt mặc định
                // (Trường hợp này ít xảy ra nếu dữ liệu đồng bộ)
                if (productData.category && !(categoriesRes.data.data || categoriesRes.data).some(c => c._id === productData.category._id)) {
                    setCategory(''); // Đặt rỗng hoặc chọn mặc định khác nếu category không tìm thấy
                }
                if (productData.location && !(locationsRes.data.data || locationsRes.data).some(l => l._id === productData.location._id)) {
                    setLocation(''); // Đặt rỗng hoặc chọn mặc định khác nếu location không tìm thấy
                }


            } catch (err) {
                setError('Lỗi khi tải dữ liệu sản phẩm, danh mục hoặc địa điểm. Vui lòng thử lại.');
                console.error('Lỗi fetch dữ liệu chỉnh sửa:', err);
            } finally {
                setLoadingInitialData(false);
            }
        };

        if (id) {
            fetchAllData();
        } else {
            setError('ID sản phẩm không hợp lệ.');
            setLoadingInitialData(false);
        }
    }, [id]); // Chạy lại khi ID thay đổi

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
            const updatedProduct = {
                name,
                description,
                price: parseFloat(price),
                image,
                stock: parseInt(stock),
                category, // Gửi ID của category
                location  // Gửi ID của location
            };

            // Gửi yêu cầu PUT hoặc PATCH để cập nhật sản phẩm
            // Sử dụng PUT nếu API yêu cầu toàn bộ đối tượng để cập nhật.
            // Sử dụng PATCH nếu API chỉ cập nhật các trường được gửi.
            await axiosInstance.put(`/product/${id}`, updatedProduct);

            setSuccessMessage('Cập nhật sản phẩm thành công!');

            // Chuyển hướng về trang danh sách sau một thời gian
            setTimeout(() => {
                navigate('/admin/products');
            }, 1500);

        } catch (err) {
            setError(err.response?.data?.message || 'Có lỗi xảy ra khi cập nhật sản phẩm.');
            console.error('Lỗi khi cập nhật sản phẩm:', err);
        } finally {
            setSubmitting(false);
        }
    };

    // --- Hiển thị Loader khi đang tải dữ liệu ban đầu ---
    if (loadingInitialData) {
        return (
            <div className="container mx-auto p-4 md:p-6 lg:p-8 text-center">
                <Loader />
                <p className="text-gray-600 mt-2">Đang tải thông tin sản phẩm và các danh sách...</p>
            </div>
        );
    }

    // --- Hiển thị lỗi nếu không tải được dữ liệu ban đầu ---
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
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">Sửa Sản phẩm</h1>

            {submitting && ( // Loader khi đang submit form
                <div className="text-center p-4">
                    <Loader />
                    <p className="text-gray-600 mt-2">Đang cập nhật sản phẩm...</p>
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
                        {image && (
                            <div className="mt-2">
                                <img src={image} alt="Xem trước" className="h-24 w-24 object-cover rounded-md" />
                            </div>
                        )}
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
                        {categories.length === 0 && !loadingInitialData && (
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
                        {locations.length === 0 && !loadingInitialData && (
                            <p className="text-sm text-red-500 mt-1">Vui lòng thêm địa điểm trước.</p>
                        )}
                    </div>

                    {/* Nút Submit và Hủy */}
                    <div className="flex items-center justify-between">
                        <button
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition-colors"
                            disabled={submitting || categories.length === 0 || locations.length === 0} // Disable khi đang submit hoặc thiếu dữ liệu
                        >
                            Cập nhật Sản phẩm
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