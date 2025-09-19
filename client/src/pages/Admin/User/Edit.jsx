// src/pages/admin/users/UserEdit.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../../../utils/axiosConfig';
import Loader from '../../../components/common/Loader';

export default function UserEdit() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        role: 'user',
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Lấy dữ liệu user
    useEffect(() => {
        const fetchUser = async () => {
            try {
                setLoading(true);
                const res = await axiosInstance.get(`http://localhost:3000/auth/users/${id}`);
                setFormData({
                    username: res.data.username || '',
                    email: res.data.email || '',
                    role: res.data.role || 'user',
                });
            } catch (err) {
                setError('Lỗi khi tải thông tin người dùng.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchUser();
    }, [id]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await axiosInstance.put(`http://localhost:3000/auth/users/${id}`, formData);
            alert('Cập nhật tài khoản thành công!');
            navigate('/admin/users');
        } catch (err) {
            setError('Lỗi khi cập nhật tài khoản.');
            console.error(err);
        }
    };

    if (loading) return <Loader />;

    return (
        <div className="max-w-lg mx-auto p-6 bg-white rounded-lg shadow">
            <h1 className="text-2xl font-bold mb-4">Sửa tài khoản</h1>
            {error && <p className="text-red-500 mb-4">{error}</p>}
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium">Username</label>
                    <input
                        type="text"
                        name="username"
                        value={formData.username}
                        onChange={handleChange}
                        className="mt-1 block w-full border rounded px-3 py-2"
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium">Email</label>
                    <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className="mt-1 block w-full border rounded px-3 py-2"
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium">Vai trò</label>
                    <select
                        name="role"
                        value={formData.role}
                        onChange={handleChange}
                        className="mt-1 block w-full border rounded px-3 py-2"
                    >
                        <option value="user">Người dùng</option>
                        <option value="manager">Quản lý</option>
                        <option value="admin">Quản trị viên</option>
                    </select>
                </div>
                <div className="flex justify-end space-x-4">
                    <button
                        type="button"
                        onClick={() => navigate('/admin/users')}
                        className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                    >
                        Hủy
                    </button>
                    <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        Lưu
                    </button>
                </div>
            </form>
        </div>
    );
}