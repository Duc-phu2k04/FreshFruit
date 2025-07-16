// src/components/admin/VoucherList.jsx
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../../utils/axiosConfig'; // Đảm bảo đường dẫn đúng
import {
    PlusCircleIcon, // Icon cho nút thêm mới
    TrashIcon,
    MagnifyingGlassIcon,
    ArrowUpIcon,
    ArrowDownIcon,
    TicketIcon // Icon cho tiêu đề trang
} from '@heroicons/react/24/outline';
import Loader from '../../../components/common/Loader';
import ConfirmationModal from '../../../components/common/ComfirmDialog';

// Helper function để định dạng ngày và giờ
const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
};

export default function VoucherList() {
    const [vouchers, setVouchers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
    const [showModal, setShowModal] = useState(false);
    const [selectedVoucher, setSelectedVoucher] = useState(null);
    const [modalMessage, setModalMessage] = useState('');
    const [modalAction, setModalAction] = useState(null); // 'deleteVoucher'

    // --- LẤY DỮ LIỆU VOUCHER ---
    const fetchVouchers = useCallback(async () => {
        try {
            setLoading(true);
            const res = await axiosInstance.get('/voucher'); // Gọi API lấy tất cả voucher
            setVouchers(res.data.data || res.data); // Giả sử API trả về data trong res.data.data hoặc trực tiếp res.data
        } catch (err) {
            setError('Lỗi khi tải danh sách voucher. Vui lòng kiểm tra quyền hoặc thử lại.');
            console.error('Lỗi khi tải voucher:', err);
            if (err.response && err.response.status === 403) {
                setError('Bạn không có quyền truy cập trang này. Vui lòng đăng nhập với tài khoản Admin.');
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchVouchers();
    }, [fetchVouchers]);

    // --- LOGIC TÌM KIẾM VÀ SẮP XẾP ---
    const sortedAndFilteredVouchers = useMemo(() => {
        let workableVouchers = [...vouchers];

        // Lọc theo searchTerm (mã code)
        if (searchTerm) {
            workableVouchers = workableVouchers.filter(voucher =>
                voucher.code?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Sắp xếp
        if (sortConfig.key) {
            workableVouchers.sort((a, b) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

                aValue = aValue === undefined || aValue === null ? '' : aValue;
                bValue = bValue === undefined || bValue === null ? '' : bValue;

                if (typeof aValue === 'string' && typeof bValue === 'string') {
                    aValue = aValue.toLowerCase();
                    bValue = bValue.toLowerCase();
                } else if (aValue instanceof Date && bValue instanceof Date) {
                    aValue = aValue.getTime();
                    bValue = bValue.getTime();
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

        return workableVouchers;
    }, [vouchers, searchTerm, sortConfig]);

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

    // --- HÀM XỬ LÝ XÓA VOUCHER ---
    const handleDeleteVoucher = async (voucher) => {
        setSelectedVoucher(voucher);
        setModalMessage(`Bạn có chắc chắn muốn xóa voucher "${voucher.code}" không? Hành động này không thể hoàn tác.`);
        setModalAction(() => async () => {
            try {
                await axiosInstance.delete(`/voucher/${voucher._id}`);
                setVouchers(prevVouchers => prevVouchers.filter(v => v._id !== voucher._id));
                alert(`Voucher "${voucher.code}" đã được xóa thành công.`);
            } catch (err) {
                setError('Lỗi khi xóa voucher. Vui lòng thử lại.');
                console.error(err);
            } finally {
                setShowModal(false);
                setSelectedVoucher(null);
                setModalAction(null);
            }
        });
        setShowModal(true);
    };

    // --- HIỂN THỊ NỘI DUNG ---
    const renderContent = () => {
        if (loading) {
            return <div className="text-center p-10"><Loader /></div>;
        }

        if (error) {
            return <p className="text-center text-red-500 bg-red-100 p-4 rounded-lg">{error}</p>;
        }

        if (sortedAndFilteredVouchers.length === 0 && searchTerm) {
            return <p className="text-center text-gray-500 bg-gray-100 p-4 rounded-lg">Không tìm thấy voucher nào khớp với tìm kiếm.</p>;
        }

        if (sortedAndFilteredVouchers.length === 0) {
            return <p className="text-center text-gray-500 bg-gray-100 p-4 rounded-lg">Chưa có voucher nào.</p>;
        }

        return (
            <div className="overflow-x-auto bg-white rounded-lg shadow">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/12">
                                <button onClick={() => requestSort('_id')} className="flex items-center">
                                    ID {getSortIcon('_id')}
                                </button>
                            </th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                                <button onClick={() => requestSort('code')} className="flex items-center">
                                    Mã Voucher {getSortIcon('code')}
                                </button>
                            </th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/12">
                                <button onClick={() => requestSort('discount')} className="flex items-center">
                                    Giảm giá (%) {getSortIcon('discount')}
                                </button>
                            </th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/12">
                                <button onClick={() => requestSort('quantity')} className="flex items-center">
                                    Số lượng {getSortIcon('quantity')}
                                </button>
                            </th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5">
                                <button onClick={() => requestSort('expiration')} className="flex items-center">
                                    Ngày hết hạn {getSortIcon('expiration')}
                                </button>
                            </th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/8">
                                Trạng thái
                            </th>
                            <th scope="col" className="relative px-4 py-3 text-right w-1/12">
                                <span className="sr-only">Hành động</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {sortedAndFilteredVouchers.map((voucher) => {
                            const isExpired = new Date(voucher.expiration) < new Date();
                            const expiresInMs = new Date(voucher.expiration).getTime() - new Date().getTime();
                            const daysRemaining = Math.ceil(expiresInMs / (1000 * 60 * 60 * 24));
                            const statusColorClass = isExpired ? 'bg-red-100 text-red-800' :
                                daysRemaining <= 7 ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-green-100 text-green-800';

                            return (
                                <tr key={voucher._id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 truncate" title={voucher._id}>
                                        {voucher._id.substring(0, 8)}...
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {voucher.code}
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {voucher.discount}%
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {voucher.quantity !== null ? voucher.quantity : 'Không giới hạn'}
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {formatDateTime(voucher.expiration)}
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColorClass}`}>
                                            {isExpired ? 'Hết hạn' :
                                                daysRemaining <= 0 ? 'Hết hạn hôm nay' : // Handle cases where daysRemaining is 0 but not yet expired
                                                    daysRemaining <= 7 ? `Còn ${daysRemaining} ngày` :
                                                        'Còn hạn'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button
                                            onClick={() => handleDeleteVoucher(voucher)}
                                            className="text-red-600 hover:text-red-900 flex items-center justify-end"
                                            title="Xóa voucher"
                                        >
                                            <TrashIcon className="h-5 w-5 mr-1" />
                                            Xóa
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-2">
                    <TicketIcon className="h-8 w-8 text-gray-700" />
                    Quản lý Voucher
                </h1>
                <div className="flex items-center gap-4 w-full md:w-auto">
                    {/* Ô tìm kiếm */}
                    <div className="relative w-full md:w-64">
                        <input
                            type="text"
                            placeholder="Tìm kiếm mã voucher..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block w-full px-4 py-2 pl-10 text-gray-700 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    </div>
                    {/* Nút thêm mới */}
                    <Link
                        to="/admin/vouchers/add"
                        className="flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                    >
                        <PlusCircleIcon className="h-5 w-5" />
                        <span>Thêm Voucher</span>
                    </Link>
                </div>
            </div>

            {renderContent()}

            {/* Confirmation Modal */}
            {showModal && selectedVoucher && (
                <ConfirmationModal
                    message={modalMessage}
                    onConfirm={modalAction}
                    onCancel={() => setShowModal(false)}
                />
            )}
        </div>
    );
}