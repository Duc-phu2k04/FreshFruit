import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axiosInstance from '../../../utils/axiosConfig'; // Đảm bảo đường dẫn này đúng
import Loader from '../../../components/common/Loader'; // Sửa lại đường dẫn nếu cần

export default function EditLocationForm() {
    const [name, setName] = useState('');
    const [type, setType] = useState(''); // Ban đầu không có giá trị mặc định, sẽ được điền từ API
    const [loading, setLoading] = useState(true); // Bắt đầu với loading true vì cần tải dữ liệu
    const [submitting, setSubmitting] = useState(false); // Trạng thái riêng cho việc gửi form
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const navigate = useNavigate();
    const { id } = useParams(); // Lấy ID từ URL (ví dụ: /admin/locations/edit/:id)

    // --- Tải dữ liệu location hiện có khi component được mount ---
    useEffect(() => {
        const fetchLocationData = async () => {
            try {
                setLoading(true);
                const res = await axiosInstance.get(`/locations/${id}`); // Lấy dữ liệu của location theo ID
                const locationData = res.data.data || res.data; // Đảm bảo lấy đúng data
                setName(locationData.name);
                setType(locationData.type);
            } catch (err) {
                setError('Không thể tải dữ liệu vị trí. Vui lòng thử lại hoặc kiểm tra ID.');
                console.error('Lỗi khi tải dữ liệu vị trí:', err);
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchLocationData();
        } else {
            setError('ID vị trí không hợp lệ.');
            setLoading(false);
        }
    }, [id]); // Chạy lại khi ID thay đổi

    // --- Xử lý khi người dùng submit form ---
    const handleSubmit = async (e) => {
        e.preventDefault();

        setError('');
        setSuccessMessage('');

        if (!name.trim()) {
            setError('Tên vị trí không được để trống.');
            return;
        }
        if (!type) {
            setError('Loại vị trí không được để trống.');
            return;
        }

        try {
            setSubmitting(true); // Bắt đầu hiển thị loader cho quá trình submit
            await axiosInstance.put(`/locations/${id}`, { name, type }); // Gửi yêu cầu PUT/PATCH
            // Tùy theo API của bạn, có thể là PATCH hoặc PUT
            // Nếu API chỉ cập nhật các trường được gửi, dùng PATCH.
            // Nếu API yêu cầu toàn bộ đối tượng, dùng PUT.

            setSuccessMessage('Cập nhật vị trí thành công!');

            // Chuyển hướng người dùng về trang danh sách sau một khoảng thời gian
            setTimeout(() => {
                navigate('/admin/locations');
            }, 1500);

        } catch (err) {
            setError(err.response?.data?.message || 'Có lỗi xảy ra khi cập nhật vị trí.');
            console.error('Lỗi khi cập nhật vị trí:', err);
        } finally {
            setSubmitting(false); // Ẩn loader
        }
    };

    if (loading) {
        return (
            <div className="container mx-auto p-4 md:p-6 lg:p-8 text-center">
                <Loader />
                <p className="text-gray-600 mt-2">Đang tải thông tin vị trí...</p>
            </div>
        );
    }

    if (error && !submitting) { // Hiển thị lỗi tải dữ liệu nếu có, không phải lỗi submit
        return (
            <div className="container mx-auto p-4 md:p-6 lg:p-8">
                <p className="text-center text-red-700 bg-red-100 border border-red-400 rounded p-3 mb-4">
                    {error}
                    <button onClick={() => navigate('/admin/locations')} className="ml-4 text-blue-600 hover:underline">Quay lại danh sách</button>
                </p>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">Sửa Vị trí</h1>

            {submitting && ( // Loader cho quá trình submit
                <div className="text-center p-4">
                    <Loader />
                    <p className="text-gray-600 mt-2">Đang cập nhật vị trí...</p>
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

            {!submitting && ( // Chỉ hiển thị form khi không đang submit
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
                            Cập nhật Vị trí
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate('/admin/locations')}
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