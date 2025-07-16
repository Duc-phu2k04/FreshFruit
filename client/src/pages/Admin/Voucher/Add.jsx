// src/components/admin/AddVoucherForm.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../../utils/axiosConfig'; // Đảm bảo đường dẫn đúng
import { TicketIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'; // Icon

export default function AddVoucherForm() {
    const [formData, setFormData] = useState({
        code: '',
        discount: '',
        expiration: '', // YYYY-MM-DDTHH:mm
        quantity: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const navigate = useNavigate();

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccessMessage('');

        // Basic validation
        if (!formData.code || !formData.discount || !formData.expiration) {
            setError('Vui lòng điền đầy đủ các trường bắt buộc.');
            setLoading(false);
            return;
        }
        if (formData.discount < 1 || formData.discount > 100) {
            setError('Mức giảm giá phải từ 1 đến 100.');
            setLoading(false);
            return;
        }
        if (formData.quantity !== '' && formData.quantity < 1) {
            setError('Số lượng phải là số dương hoặc để trống.');
            setLoading(false);
            return;
        }

        try {
            // Chuẩn bị dữ liệu gửi đi
            const dataToSend = {
                code: formData.code,
                discount: Number(formData.discount),
                expiration: new Date(formData.expiration).toISOString(), // Chuyển đổi sang ISO String
                quantity: formData.quantity === '' ? null : Number(formData.quantity) // Gửi null nếu trống
            };

            const res = await axiosInstance.post('/voucher', dataToSend);
            setSuccessMessage('Voucher đã được thêm thành công!');
            setFormData({ code: '', discount: '', expiration: '', quantity: '' }); // Reset form
        } catch (err) {
            console.error('Lỗi khi thêm voucher:', err);
            setError(err.response?.data?.message || 'Lỗi khi thêm voucher. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-2">
                    <TicketIcon className="h-8 w-8 text-gray-700" />
                    Thêm Voucher Mới
                </h1>
                <button
                    onClick={() => navigate('/admin/vouchers')}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 border border-gray-300 rounded-lg shadow-sm hover:bg-gray-300 transition-colors"
                >
                    <ArrowLeftIcon className="h-5 w-5" />
                    Quay lại danh sách
                </button>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md max-w-2xl mx-auto">
                {error && <p className="text-red-600 bg-red-100 p-3 rounded-md mb-4">{error}</p>}
                {successMessage && <p className="text-green-600 bg-green-100 p-3 rounded-md mb-4">{successMessage}</p>}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="code" className="block text-sm font-medium text-gray-700">Mã Voucher <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            id="code"
                            name="code"
                            value={formData.code}
                            onChange={handleChange}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            placeholder="Ví dụ: SALE2025, SUMMER10"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="discount" className="block text-sm font-medium text-gray-700">Giảm giá (%) <span className="text-red-500">*</span></label>
                        <input
                            type="number"
                            id="discount"
                            name="discount"
                            value={formData.discount}
                            onChange={handleChange}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            min="1"
                            max="100"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="expiration" className="block text-sm font-medium text-gray-700">Ngày & Giờ Hết hạn <span className="text-red-500">*</span></label>
                        <input
                            type="datetime-local"
                            id="expiration"
                            name="expiration"
                            value={formData.expiration}
                            onChange={handleChange}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            required
                        />
                        <p className="mt-1 text-xs text-gray-500">Chọn ngày và giờ hết hạn chính xác.</p>
                    </div>
                    <div>
                        <label htmlFor="quantity" className="block text-sm font-medium text-gray-700">Số lượng (Để trống nếu không giới hạn)</label>
                        <input
                            type="number"
                            id="quantity"
                            name="quantity"
                            value={formData.quantity}
                            onChange={handleChange}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            min="0" // Cho phép 0 nếu muốn tạo voucher không còn lượt sử dụng ngay
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        disabled={loading}
                    >
                        {loading ? 'Đang thêm...' : 'Thêm Voucher'}
                    </button>
                </form>
            </div>
        </div>
    );
}