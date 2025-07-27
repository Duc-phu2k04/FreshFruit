import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom'; // Không cần useNavigate nếu không chuyển hướng sang trang edit
import axiosInstance from '../../../utils/axiosConfig';
import { UserCircleIcon, TrashIcon, MagnifyingGlassIcon, ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/outline'; // UserCircleIcon cho nút chuyển đổi role
import Loader from '../../../components/common/Loader';
import ConfirmationModal from '../../../components/common/ComfirmDialog'; // Giả định bạn đã tạo component này


export default function UserList() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
    const [showModal, setShowModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [modalMessage, setModalMessage] = useState('');
    const [modalAction, setModalAction] = useState(null); // 'deleteUser' hoặc 'toggleRole'

    // --- LẤY DỮ LIỆU NGƯỜI DÙNG ---
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                setLoading(true);
                const res = await axiosInstance.get('http://localhost:3000/auth/users');
                setUsers(res.data.data || res.data);
            } catch (err) {
                setError('Lỗi khi tải danh sách người dùng. Vui lòng thử lại.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchUsers();
    }, []);

    // --- LOGIC TÌM KIẾM VÀ SẮP XẾP ---
    const sortedAndFilteredUsers = useMemo(() => {
        let workableUsers = [...users];

        if (searchTerm) {
            workableUsers = workableUsers.filter(user =>
                user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.email?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        if (sortConfig.key) {
            workableUsers.sort((a, b) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

                aValue = aValue === undefined || aValue === null ? '' : aValue;
                bValue = bValue === undefined || bValue === null ? '' : bValue;

                if (typeof aValue === 'string' && typeof bValue === 'string') {
                    aValue = aValue.toLowerCase();
                    bValue = bValue.toLowerCase();
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

        return workableUsers;
    }, [users, searchTerm, sortConfig]);

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

    // --- HÀM XỬ LÝ XÓA TÀI KHOẢN ---
    const handleDeleteUser = async (user) => {
        setSelectedUser(user);
        setModalMessage(`Bạn có chắc chắn muốn **xóa vĩnh viễn** tài khoản "${user.username}" không? Hành động này không thể hoàn tác.`);
        setModalAction(() => async () => {
            try {
                await axiosInstance.delete(`http://localhost:3000/auth/users/${user._id}`);
                setUsers(prevUsers => prevUsers.filter(u => u._id !== user._id));
                alert(`Tài khoản "${user.username}" đã được xóa thành công.`);
            } catch (err) {
                setError('Lỗi khi xóa tài khoản. Vui lòng thử lại.');
                console.error(err);
            } finally {
                setShowModal(false);
                setSelectedUser(null);
                setModalAction(null);
            }
        });
        setShowModal(true);
    };

    // --- HÀM XỬ LÝ CHUYỂN ĐỔI ROLE ---
    const handleToggleRole = async (user) => {
        const newRole = user.role === 'admin' ? 'user' : 'admin';
        setSelectedUser(user);
        setModalMessage(`Bạn có chắc chắn muốn chuyển vai trò của "${user.username}" từ **${user.role}** sang **${newRole}** không?`);
        setModalAction(() => async () => {
            try {
                // Giả định backend có endpoint PUT /api/auth/users/:id để cập nhật user
                const res = await axiosInstance.put(`http://localhost:3000/auth/users/${user._id}`, { role: newRole });

                // Cập nhật state users để hiển thị thay đổi ngay lập tức
                setUsers(prevUsers =>
                    prevUsers.map(u => (u._id === user._id ? { ...u, role: newRole } : u))
                );
                alert(`Vai trò của "${user.username}" đã được chuyển thành **${newRole}** thành công!`);
            } catch (err) {
                setError('Lỗi khi cập nhật vai trò. Vui lòng thử lại.');
                console.error(err);
            } finally {
                setShowModal(false);
                setSelectedUser(null);
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

        if (sortedAndFilteredUsers.length === 0 && searchTerm) {
            return <p className="text-center text-gray-500 bg-gray-100 p-4 rounded-lg">Không tìm thấy người dùng nào khớp với tìm kiếm.</p>;
        }

        if (sortedAndFilteredUsers.length === 0) {
            return <p className="text-center text-gray-500 bg-gray-100 p-4 rounded-lg">Chưa có người dùng nào.</p>;
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
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5">
                                <button onClick={() => requestSort('username')} className="flex items-center">
                                    Username {getSortIcon('username')}
                                </button>
                            </th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5">
                                <button onClick={() => requestSort('email')} className="flex items-center">
                                    Email {getSortIcon('email')}
                                </button>
                            </th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/12">
                                <button onClick={() => requestSort('role')} className="flex items-center">
                                    Vai trò {getSortIcon('role')}
                                </button>
                            </th>
                            <th scope="col" className="relative px-4 py-3 text-right w-1/6">
                                <span className="sr-only">Hành động</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {sortedAndFilteredUsers.map((user) => (
                            <tr key={user._id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 truncate" title={user._id}>
                                    {user._id.substring(0, 8)}...
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">{user.username || 'N/A'}</div>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {user.email || 'N/A'}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                                        }`}>
                                        {user.role || 'user'}
                                    </span>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <div className="flex items-center justify-end space-x-4">
                                        <button
                                            onClick={() => handleToggleRole(user)}
                                            className={`flex items-center ${user.role === 'admin' ? 'text-blue-600 hover:text-blue-900' : 'text-purple-600 hover:text-purple-900'
                                                }`}
                                            title={user.role === 'admin' ? 'Chuyển thành User' : 'Chuyển thành Admin'}
                                        >
                                            <UserCircleIcon className="h-5 w-5 mr-1" />
                                            {user.role === 'admin' ? 'Chuyển sang User' : 'Chuyển sang Admin'}
                                        </button>
                                        <button
                                            onClick={() => handleDeleteUser(user)}
                                            className="text-red-600 hover:text-red-900 flex items-center"
                                            title="Xóa tài khoản người dùng"
                                        >
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
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Quản lý Người dùng</h1>
                <div className="flex items-center gap-4 w-full md:w-auto">
                    {/* Ô tìm kiếm */}
                    <div className="relative w-full md:w-64">
                        <input
                            type="text"
                            placeholder="Tìm kiếm người dùng theo username hoặc email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block w-full px-4 py-2 pl-10 text-gray-700 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    </div>
                    {/* Nút thêm mới (Tùy chọn) */}

                </div>
            </div>

            {renderContent()}
            {showModal && selectedUser && (
                <ConfirmationModal
                    message={modalMessage}
                    onConfirm={modalAction}
                    onCancel={() => setShowModal(false)}
                />
            )}

        </div>
    );
}