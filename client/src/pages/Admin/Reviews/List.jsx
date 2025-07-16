// src/components/admin/ReviewList.jsx (hoặc đường dẫn phù hợp trong dự án của bạn)
import React, { useEffect, useState, useMemo } from 'react';
import axiosInstance from '../../../utils/axiosConfig'; // Đảm bảo đường dẫn này đúng
import { TrashIcon, MagnifyingGlassIcon, ArrowUpIcon, ArrowDownIcon, UserCircleIcon, ChatBubbleLeftIcon } from '@heroicons/react/24/outline';
import Loader from '../../../components/common/Loader';
import ConfirmationModal from '../../../components/common/ComfirmDialog';

export default function ReviewList() {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
    const [showModal, setShowModal] = useState(false);
    const [selectedReview, setSelectedReview] = useState(null);
    const [modalMessage, setModalMessage] = useState('');
    const [modalAction, setModalAction] = useState(null); // 'deleteReview'

    // --- LẤY DỮ LIỆU BÌNH LUẬN ---
    useEffect(() => {
        const fetchReviews = async () => {
            try {
                setLoading(true);
                // Gọi API admin để lấy tất cả bình luận
                const res = await axiosInstance.get('/review/admin/all');
                setReviews(res.data.data || res.data);
            } catch (err) {
                setError('Lỗi khi tải danh sách bình luận. Vui lòng kiểm tra quyền hoặc thử lại.');
                console.error('Lỗi khi tải bình luận:', err);
                // Xử lý lỗi 403 Forbidden nếu không phải admin
                if (err.response && err.response.status === 403) {
                    setError('Bạn không có quyền truy cập trang này. Vui lòng đăng nhập với tài khoản Admin.');
                }
            } finally {
                setLoading(false);
            }
        };

        fetchReviews();
    }, []);

    // --- LOGIC TÌM KIẾM VÀ SẮP XẾP ---
    const sortedAndFilteredReviews = useMemo(() => {
        let workableReviews = [...reviews];

        // Lọc theo searchTerm (tìm kiếm theo tên người dùng, tên sản phẩm hoặc nội dung bình luận)
        if (searchTerm) {
            workableReviews = workableReviews.filter(review =>
                review.user?.username?.toLowerCase().includes(searchTerm.toLowerCase()) || // Giả sử user có trường 'username'
                review.product?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || // Giả sử product có trường 'name'
                review.comment?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Sắp xếp
        if (sortConfig.key) {
            workableReviews.sort((a, b) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

                // Xử lý trường hợp lồng nhau cho user.username hoặc product.name
                if (sortConfig.key === 'user.username') {
                    aValue = a.user?.username;
                    bValue = b.user?.username;
                } else if (sortConfig.key === 'product.name') {
                    aValue = a.product?.name;
                    bValue = b.product?.name;
                }

                aValue = aValue === undefined || aValue === null ? '' : aValue;
                bValue = bValue === undefined || bValue === null ? '' : bValue;

                if (typeof aValue === 'string' && typeof bValue === 'string') {
                    aValue = aValue.toLowerCase();
                    bValue = bValue.toLowerCase();
                } else if (typeof aValue === 'number' && typeof bValue === 'number') {
                    // So sánh số
                } else if (aValue instanceof Date && bValue instanceof Date) {
                    // So sánh ngày
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

        return workableReviews;
    }, [reviews, searchTerm, sortConfig]);

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

    // --- HÀM XỬ LÝ XÓA BÌNH LUẬN ---
    const handleDeleteReview = async (review) => {
        setSelectedReview(review);
        setModalMessage(`Bạn có chắc chắn muốn xóa bình luận này của "${review.user?.username || 'N/A'}" về sản phẩm "${review.product?.name || 'N/A'}" không?`);
        setModalAction(() => async () => {
            try {
                // Gọi API xóa bình luận
                await axiosInstance.delete(`/review/${review._id}`);
                setReviews(prevReviews => prevReviews.filter(r => r._id !== review._id));
                alert('Bình luận đã được xóa thành công!');
            } catch (err) {
                setError('Lỗi khi xóa bình luận. Vui lòng thử lại.');
                console.error(err);
            } finally {
                setShowModal(false);
                setSelectedReview(null);
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

        if (sortedAndFilteredReviews.length === 0 && searchTerm) {
            return <p className="text-center text-gray-500 bg-gray-100 p-4 rounded-lg">Không tìm thấy bình luận nào khớp với tìm kiếm.</p>;
        }

        if (sortedAndFilteredReviews.length === 0) {
            return <p className="text-center text-gray-500 bg-gray-100 p-4 rounded-lg">Chưa có bình luận nào.</p>;
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
                                <button onClick={() => requestSort('user.username')} className="flex items-center">
                                    Người dùng {getSortIcon('user.username')}
                                </button>
                            </th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                                <button onClick={() => requestSort('product.name')} className="flex items-center">
                                    Sản phẩm {getSortIcon('product.name')}
                                </button>
                            </th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/12">
                                <button onClick={() => requestSort('rating')} className="flex items-center">
                                    Đánh giá {getSortIcon('rating')}
                                </button>
                            </th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
                                <button onClick={() => requestSort('comment')} className="flex items-center">
                                    Nội dung {getSortIcon('comment')}
                                </button>
                            </th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/8">
                                <button onClick={() => requestSort('createdAt')} className="flex items-center">
                                    Ngày tạo {getSortIcon('createdAt')}
                                </button>
                            </th>
                            <th scope="col" className="relative px-4 py-3 text-right w-1/12">
                                <span className="sr-only">Hành động</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {sortedAndFilteredReviews.map((review) => (
                            <tr key={review._id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 truncate" title={review._id}>
                                    {review._id.substring(0, 8)}...
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {review.user?.username || 'Người dùng ẩn danh'}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {review.product?.name || 'Sản phẩm không rõ'}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <div className="flex items-center">
                                        {[...Array(5)].map((_, i) => (
                                            <svg
                                                key={i}
                                                className={`h-5 w-5 ${i < review.rating ? 'text-yellow-400' : 'text-gray-300'}`}
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                            >
                                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.538 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.783.57-1.838-.197-1.538-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.462a1 1 0 00.95-.69l1.07-3.292z" />
                                            </svg>
                                        ))}
                                    </div>
                                </td>
                                <td className="px-4 py-4 text-sm text-gray-700 max-w-xs overflow-hidden truncate" title={review.comment}>
                                    {review.comment}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {review.createdAt ? new Date(review.createdAt).toLocaleDateString('vi-VN') : 'N/A'}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button
                                        onClick={() => handleDeleteReview(review)}
                                        className="text-red-600 hover:text-red-900 flex items-center justify-end"
                                        title="Xóa bình luận"
                                    >
                                        <TrashIcon className="h-5 w-5 mr-1" />
                                        Xóa
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
        <div className="container mx-auto p-4 md:p-6 lg:p-8">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-2">
                    <ChatBubbleLeftIcon className="h-8 w-8 text-gray-700" />
                    Quản lý Bình luận
                </h1>
                <div className="flex items-center gap-4 w-full md:w-auto">
                    {/* Ô tìm kiếm */}
                    <div className="relative w-full md:w-64">
                        <input
                            type="text"
                            placeholder="Tìm kiếm bình luận..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block w-full px-4 py-2 pl-10 text-gray-700 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    </div>
                </div>
            </div>

            {renderContent()}

            {/* Confirmation Modal */}
            {showModal && selectedReview && (
                <ConfirmationModal
                    message={modalMessage}
                    onConfirm={modalAction}
                    onCancel={() => setShowModal(false)}
                />
            )}
        </div>
    );
}