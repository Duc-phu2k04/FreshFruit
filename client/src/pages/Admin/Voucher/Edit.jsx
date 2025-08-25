import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axiosInstance from '../../../utils/axiosConfig';
import { TicketIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';

export default function EditVoucherForm() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        code: '',
        discount: '',
        expiresInDays: '',
        quantity: ''
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // 🔹 Lấy dữ liệu voucher hiện tại
    useEffect(() => {
        axiosInstance.get(`/voucher/${id}`)
            .then(res => {
                const v = res.data;
                const daysLeft = v.expiration
                    ? Math.ceil((new Date(v.expiration) - new Date()) / (1000 * 60 * 60 * 24))
                    : '';

                setFormData({
                    code: v.code || '',
                    discount: v.discount || '',
                    expiresInDays: daysLeft > 0 ? daysLeft : 0,
                    quantity: v.quantity ?? ''
                });
            })
            .catch(err => {
                console.error(err);
                setError('Không thể tải dữ liệu voucher');
            })
            .finally(() => setLoading(false));
    }, [id]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        setSuccessMessage('');

        if (!formData.code || !formData.discount || !formData.expiresInDays) {
            setError('Vui lòng điền đầy đủ các trường bắt buộc.');
            setSaving(false);
            return;
        }
        if (formData.discount < 1 || formData.discount > 100) {
            setError('Mức giảm giá phải từ 1 đến 100.');
            setSaving(false);
            return;
        }
        if (formData.expiresInDays < 1) {
            setError('Số ngày có hiệu lực phải lớn hơn 0.');
            setSaving(false);
            return;
        }
        if (formData.quantity !== '' && formData.quantity < 1) {
            setError('Số lượng phải là số dương hoặc để trống.');
            setSaving(false);
            return;
        }

        try {
            const dataToSend = {
                code: formData.code,
                discount: Number(formData.discount),
                expiresInDays: Number(formData.expiresInDays),
                quantity: formData.quantity === '' ? null : Number(formData.quantity)
            };

            await axiosInstance.put(`/voucher/${id}`, dataToSend);
            setSuccessMessage('Cập nhật voucher thành công!');
            setTimeout(() => navigate('/admin/vouchers'), 1500);
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || 'Cập nhật thất bại.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <p className="text-center mt-4">Đang tải dữ liệu...</p>;

    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-2">
                    <TicketIcon className="h-8 w-8 text-gray-700" />
                    Sửa Voucher
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
                        <label htmlFor="code" className="block text-sm font-medium text-gray-700">
                            Mã Voucher <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            id="code"
                            name="code"
                            value={formData.code}
                            onChange={handleChange}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="discount" className="block text-sm font-medium text-gray-700">
                            Giảm giá (%) <span className="text-red-500">*</span>
                        </label>
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
                        <label htmlFor="expiresInDays" className="block text-sm font-medium text-gray-700">
                            Số ngày còn hiệu lực <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="number"
                            id="expiresInDays"
                            name="expiresInDays"
                            value={formData.expiresInDays}
                            onChange={handleChange}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            min="1"
                            required
                        />
                        <p className="mt-1 text-xs text-gray-500">Số ngày tính từ hôm nay đến khi voucher hết hạn.</p>
                    </div>
                    <div>
                        <label htmlFor="quantity" className="block text-sm font-medium text-gray-700">
                            Số lượng (Để trống nếu không giới hạn)
                        </label>
                        <input
                            type="number"
                            id="quantity"
                            name="quantity"
                            value={formData.quantity}
                            onChange={handleChange}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            min="0"
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        disabled={saving}
                    >
                        {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </button>
                </form>
            </div>
        </div>
    );
}
