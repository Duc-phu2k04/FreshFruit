import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const RegisterForm = () => {
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.username || !form.email || !form.password || !form.confirmPassword) {
      setError('Vui lòng nhập đầy đủ thông tin.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    alert('Đăng ký thành công!');
  };

  return (
    <div className="max-w-md mx-auto mt-16 p-8 bg-gradient-to-r from-green-400 via-blue-500 to-purple-600 rounded-xl shadow-lg text-white">
      <h2 className="text-3xl font-bold mb-6 text-center">Đăng ký</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block mb-2 font-semibold">Tên đăng nhập</label>
          <input
            type="text"
            name="username"
            value={form.username}
            onChange={handleChange}
            className="w-full px-4 py-2 rounded text-black"
            placeholder="Nhập tên đăng nhập"
          />
        </div>
        <div>
          <label className="block mb-2 font-semibold">Email</label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            className="w-full px-4 py-2 rounded text-black"
            placeholder="Nhập email"
          />
        </div>
        <div>
          <label className="block mb-2 font-semibold">Mật khẩu</label>
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            className="w-full px-4 py-2 rounded text-black"
            placeholder="Nhập mật khẩu"
          />
        </div>
        <div>
          <label className="block mb-2 font-semibold">Xác nhận mật khẩu</label>
          <input
            type="password"
            name="confirmPassword"
            value={form.confirmPassword}
            onChange={handleChange}
            className="w-full px-4 py-2 rounded text-black"
            placeholder="Nhập lại mật khẩu"
          />
        </div>
        {error && <div className="text-yellow-300 text-sm">{error}</div>}
        <button
          type="submit"
          className="w-full bg-white text-purple-700 font-bold py-2 rounded hover:bg-gray-200 transition"
        >
          Đăng ký
        </button>
      </form>
      <div className="mt-6 text-center">
        <Link to="/dang-nhap" className="underline text-white hover:text-gray-200">
          Đã có tài khoản? Đăng nhập ngay
        </Link>
      </div>
    </div>
  );
};

export default RegisterForm;
