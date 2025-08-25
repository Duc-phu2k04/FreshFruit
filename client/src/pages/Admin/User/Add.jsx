import React, { useState } from 'react';
import axiosInstance from '../../../utils/axiosConfig';
import { useNavigate } from 'react-router-dom';

export default function UserAdd() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'user'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await axiosInstance.post('http://localhost:3000/auth/register', formData);
      setSuccess('Tạo tài khoản thành công!');
      setTimeout(() => {
        navigate('/admin/users'); // Chuyển về danh sách user
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'username hoặc email đã tồn tại trong hệ thống');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white shadow rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-4">Tạo tài khoản mới</h2>
      
      {error && <p className="text-red-500 mb-3">{error}</p>}
      {success && <p className="text-green-500 mb-3">{success}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1 font-medium">Tên đăng nhập</label>
          <input
            type="text"
            name="username"
            value={formData.username}
            onChange={handleChange}
            required
            className="border rounded w-full px-3 py-2"
          />
        </div>

        <div>
          <label className="block mb-1 font-medium">Email</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            className="border rounded w-full px-3 py-2"
          />
        </div>

        <div>
          <label className="block mb-1 font-medium">Mật khẩu</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            className="border rounded w-full px-3 py-2"
          />
        </div>

        <div>
          <label className="block mb-1 font-medium">Vai trò</label>
          <select
            name="role"
            value={formData.role}
            onChange={handleChange}
            className="border rounded w-full px-3 py-2"
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {loading ? 'Đang tạo...' : 'Tạo tài khoản'}
        </button>
      </form>
    </div>
  );
}
