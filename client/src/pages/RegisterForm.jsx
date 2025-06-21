import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const RegisterForm = () => {
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const usernameRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmPasswordRef = useRef(null);
  const navigate = useNavigate();

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const validate = () => {
    const newErrors = {};
    if (!form.username) newErrors.username = 'Vui lòng nhập tên đăng nhập.';
    else if (form.username.length < 3) newErrors.username = 'Tên đăng nhập phải có ít nhất 3 ký tự.';
    if (!form.email) newErrors.email = 'Vui lòng nhập email.';
    else if (!validateEmail(form.email)) newErrors.email = 'Email không hợp lệ.';
    if (!form.password) newErrors.password = 'Vui lòng nhập mật khẩu.';
    else if (form.password.length < 6) newErrors.password = 'Mật khẩu phải có ít nhất 6 ký tự.';
    if (!form.confirmPassword) newErrors.confirmPassword = 'Vui lòng xác nhận mật khẩu.';
    else if (form.confirmPassword !== form.password) newErrors.confirmPassword = 'Mật khẩu xác nhận không khớp.';
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
      else if (validationErrors.email) emailRef.current.focus();
      else if (validationErrors.password) passwordRef.current.focus();
      else if (validationErrors.confirmPassword) confirmPasswordRef.current.focus();
      return;
    }

    localStorage.setItem('registeredUser', JSON.stringify({
      username: form.username,
      email: form.email,
      password: form.password,
    }));

    alert('Đăng ký thành công!');
    navigate('/dang-nhap');
  };

  return (
    <div className="max-w-md mx-auto mt-16 p-8 bg-gradient-to-r from-green-400 via-blue-500 to-purple-600 rounded-xl shadow-lg text-white">
      <h2 className="text-3xl font-bold mb-6 text-center">Đăng ký</h2>
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
          <label className="block mb-2 font-semibold">Email</label>
          <input
            ref={emailRef}
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            className={`w-full px-4 py-2 rounded text-black ${errors.email ? 'border-2 border-yellow-300' : ''}`}
            placeholder="Nhập email"
          />
          {errors.email && <div className="text-yellow-300 text-sm mt-1">{errors.email}</div>}
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
        <div>
          <label className="block mb-2 font-semibold">Xác nhận mật khẩu</label>
          <input
            ref={confirmPasswordRef}
            type="password"
            name="confirmPassword"
            value={form.confirmPassword}
            onChange={handleChange}
            className={`w-full px-4 py-2 rounded text-black ${errors.confirmPassword ? 'border-2 border-yellow-300' : ''}`}
            placeholder="Nhập lại mật khẩu"
          />
          {errors.confirmPassword && <div className="text-yellow-300 text-sm mt-1">{errors.confirmPassword}</div>}
        </div>
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
