import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // ✅

const LoginForm = () => {
  const [form, setForm] = useState({ username: '', password: '' });
  const [errors, setErrors] = useState({});
  const usernameRef = useRef(null);
  const passwordRef = useRef(null);
  const navigate = useNavigate();
  const { login } = useAuth(); // ✅ lấy hàm login từ context

  const validate = () => {
    const newErrors = {};
    if (!form.username) newErrors.username = 'Vui lòng nhập tên đăng nhập.';
    if (!form.password) newErrors.password = 'Vui lòng nhập mật khẩu.';
    return newErrors;
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: '' });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validationErrors = validate();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      if (validationErrors.username) usernameRef.current.focus();
      else if (validationErrors.password) passwordRef.current.focus();
      return;
    }

    const storedUser = JSON.parse(localStorage.getItem('registeredUser'));
    if (!storedUser || storedUser.username !== form.username || storedUser.password !== form.password) {
      alert('Tên đăng nhập hoặc mật khẩu không đúng.');
      return;
    }

    // ✅ Gọi hàm login từ AuthContext để lưu user vào context
    login({ username: form.username });

    alert('Đăng nhập thành công!');
    navigate('/');
  };

  return (
    <div className="max-w-md mx-auto mt-16 p-8 bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 rounded-xl shadow-lg text-white">
      <h2 className="text-3xl font-bold mb-6 text-center">Đăng nhập</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block mb-2 font-semibold">Tên đăng nhập</label>
          <input
            ref={usernameRef}
            type="text"
            name="username"
            value={form.username}
            onChange={handleChange}
            className={`w-full px-4 py-2 rounded text-black ${errors.username ? 'border-2 border-yellow-300' : ''}`}
            placeholder="Nhập tên đăng nhập"
          />
          {errors.username && <div className="text-yellow-300 text-sm mt-1">{errors.username}</div>}
        </div>
        <div>
          <label className="block mb-2 font-semibold">Mật khẩu</label>
          <input
            ref={passwordRef}
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            className={`w-full px-4 py-2 rounded text-black ${errors.password ? 'border-2 border-yellow-300' : ''}`}
            placeholder="Nhập mật khẩu"
          />
          {errors.password && <div className="text-yellow-300 text-sm mt-1">{errors.password}</div>}
        </div>
        <button
          type="submit"
          className="w-full bg-white text-purple-700 font-bold py-2 rounded hover:bg-gray-200 transition"
        >
          Đăng nhập
        </button>
      </form>
      <div className="mt-6 text-center">
        <Link to="/dang-ky" className="underline text-white hover:text-gray-200">
          Chưa có tài khoản? Đăng ký ngay
        </Link>
      </div>
    </div>
  );
};

export default LoginForm;
