// src/components/admin/VoucherList.jsx
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axiosInstance from '../../../utils/axiosConfig';
import {
    PlusCircleIcon,
    TrashIcon,
    MagnifyingGlassIcon,
    ArrowUpIcon,
    ArrowDownIcon,
    TicketIcon,
    UsersIcon,
    UserPlusIcon
} from '@heroicons/react/24/outline';
import Loader from '../../../components/common/Loader';
import ConfirmationModal from '../../../components/common/ComfirmDialog';

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
    const [modalAction, setModalAction] = useState(null);

    // State cho gán thủ công
    const [assignModalOpen, setAssignModalOpen] = useState(false);
    const [users, setUsers] = useState([]);
    const [selectedUserIds, setSelectedUserIds] = useState([]);

    const navigate = useNavigate();

    const fetchVouchers = useCallback(async () => {
        try {
            setLoading(true);
            const res = await axiosInstance.get('/voucher');
            setVouchers(res.data.data || res.data);
        } catch (err) {
            setError('Lỗi khi tải danh sách voucher.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchVouchers();
    }, [fetchVouchers]);

    const sortedAndFilteredVouchers = useMemo(() => {
        let workableVouchers = [...vouchers];
        if (searchTerm) {
            workableVouchers = workableVouchers.filter(voucher =>
                voucher.code?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        if (sortConfig.key) {
            workableVouchers.sort((a, b) => {
                let aValue = a[sortConfig.key] ?? '';
                let bValue = b[sortConfig.key] ?? '';
                if (typeof aValue === 'string') aValue = aValue.toLowerCase();
                if (typeof bValue === 'string') bValue = bValue.toLowerCase();
                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return workableVouchers;
    }, [vouchers, searchTerm, sortConfig]);

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

    const handleDeleteVoucher = async (voucher) => {
        setSelectedVoucher(voucher);
        setModalMessage(`Bạn có chắc chắn muốn xóa voucher "${voucher.code}" không?`);
        setModalAction(() => async () => {
            try {
                await axiosInstance.delete(`/voucher/${voucher._id}`);
                setVouchers(prev => prev.filter(v => v._id !== voucher._id));
                alert(`Voucher "${voucher.code}" đã được xóa.`);
            } catch (err) {
                setError('Lỗi khi xóa voucher.');
                console.error(err);
            } finally {
                setShowModal(false);
                setSelectedVoucher(null);
                setModalAction(null);
            }
        });
        setShowModal(true);
    };

    // ==== GÁN THỦ CÔNG ====
    const handleOpenAssign = async (voucher) => {
        setSelectedVoucher(voucher);
        setSelectedUserIds([]);

        try {
            // Lấy token từ localStorage (hoặc nơi bạn đang lưu)
            const token = localStorage.getItem('token');
            if (!token) {
                alert('Bạn chưa đăng nhập hoặc phiên làm việc đã hết hạn.');
                return;
            }

            // Gọi API lấy danh sách user (yêu cầu admin)
            const res = await axiosInstance.get('http://localhost:3000/auth/users', {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });



            // Lưu danh sách user
            setUsers(res.data.data || res.data);
            setAssignModalOpen(true);

        } catch (err) {
            console.error('Lỗi khi tải user:', err);
            alert('Không thể tải danh sách người dùng.');
        }
    };


    const toggleUserSelect = (id) => {
        setSelectedUserIds(prev =>
            prev.includes(id) ? prev.filter(uid => uid !== id) : [...prev, id]
        );
    };

    const handleAssign = async () => {
        if (!selectedUserIds.length) {
            alert('Vui lòng chọn ít nhất một người dùng.');
            return;
        }
        try {
            await axiosInstance.post(`/voucher/${selectedVoucher._id}/assign`, {
                userIds: selectedUserIds
            });
            alert('Gán voucher thành công!');
            setAssignModalOpen(false);
            fetchVouchers();
        } catch (err) {
            console.error('Lỗi khi gán voucher:', err);
            alert('Gán thất bại.');
        }
    };
    // ======================

    const renderContent = () => {
        if (loading) return <div className="text-center p-10"><Loader /></div>;
        if (error) return <p className="text-center text-red-500">{error}</p>;
        if (sortedAndFilteredVouchers.length === 0) return <p className="text-center text-gray-500">Không có voucher nào.</p>;

        return (
            <div className="overflow-x-auto bg-white rounded-lg shadow">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3">Mã Voucher</th>
                            <th className="px-4 py-3">Giảm giá (%)</th>
                            <th className="px-4 py-3">Số lượng</th>
                            <th className="px-4 py-3">Ngày hết hạn</th>
                            <th className="px-4 py-3">Người dùng đã gán</th>
                            <th className="px-4 py-3">Trạng thái</th>
                            <th className="px-4 py-3 text-right">Hành động</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedAndFilteredVouchers.map(voucher => {
                            const isExpired = new Date(voucher.expiration) < new Date();
                            const userCount = voucher.assignedUsersCount ?? (voucher.users?.length || 0);
                            return (
                                <tr key={voucher._id} className="hover:bg-gray-50">
                                    <td className="px-4 py-4">{voucher.code}</td>
                                    <td className="px-4 py-4">{voucher.discount}%</td>
                                    <td className="px-4 py-4">{voucher.quantity ?? 'Không giới hạn'}</td>
                                    <td className="px-4 py-4">{formatDateTime(voucher.expiration)}</td>
                                    <td
                                        className="px-4 py-4 text-blue-600 cursor-pointer hover:underline flex items-center gap-1"
                                        onClick={() => navigate(`/admin/vouchers/${voucher._id}/users`)}
                                    >
                                        <UsersIcon className="h-4 w-4" />
                                        {userCount}
                                    </td>
                                    <td className="px-4 py-4">
                                        {isExpired
                                            ? <span className="bg-red-100 text-red-800 px-2 py-1 rounded">Hết hạn</span>
                                            : <span className="bg-green-100 text-green-800 px-2 py-1 rounded">Còn hạn</span>
                                        }
                                    </td>
                                    <td className="px-4 py-4 text-right flex gap-2 justify-end">
                                        <button
                                            onClick={() => handleOpenAssign(voucher)}
                                            className="text-blue-600 hover:text-blue-900 flex items-center"
                                        >
                                            <UserPlusIcon className="h-5 w-5 mr-1" /> Gán
                                        </button>
                                        <button
                                            onClick={() => navigate(`/admin/vouchers/edit/${voucher._id}`)}
                                            className="text-green-600 hover:text-green-900 flex items-center"
                                        >
                                            ✏️ <span className="ml-1">Sửa</span>
                                        </button>
                                        <button
                                            onClick={() => handleDeleteVoucher(voucher)}
                                            className="text-red-600 hover:text-red-900 flex items-center"
                                        >
                                            <TrashIcon className="h-5 w-5 mr-1" /> Xóa
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
        <div className="container mx-auto p-4">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <TicketIcon className="h-8 w-8" /> Quản lý Voucher
                </h1>
                <div className="flex gap-4">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Tìm kiếm..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="px-4 py-2 pl-10 border rounded-lg"
                        />
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    </div>
                    <Link
                        to="/admin/vouchers/add"
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        <PlusCircleIcon className="h-5 w-5" /> Thêm Voucher
                    </Link>
                </div>
            </div>
            {renderContent()}

            {/* Modal xác nhận xóa */}
            {showModal && selectedVoucher && (
                <ConfirmationModal
                    message={modalMessage}
                    onConfirm={modalAction}
                    onCancel={() => setShowModal(false)}
                />
            )}

            {/* Modal gán thủ công */}
            {assignModalOpen && selectedVoucher && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg max-w-lg w-full">
                        <h2 className="text-xl font-bold mb-4">
                            Gán voucher: {selectedVoucher.code}
                        </h2>
                        <div className="max-h-60 overflow-y-auto border p-2 rounded">
                            {users.map(user => (
                                <label key={user._id} className="flex items-center gap-2 mb-2">
                                    <input
                                        type="checkbox"
                                        checked={selectedUserIds.includes(user._id)}
                                        onChange={() => toggleUserSelect(user._id)}
                                    />
                                    <span>{user.fullName || user.username} ({user.email})</span>
                                </label>
                            ))}
                        </div>
                        <div className="mt-4 flex justify-end gap-3">
                            <button
                                onClick={() => setAssignModalOpen(false)}
                                className="px-4 py-2 border rounded-lg"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleAssign}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg"
                            >
                                Xác nhận
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
