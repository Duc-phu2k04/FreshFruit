import React, { useState, useRef } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const emailRef = useRef(null);

  const validateEmail = () => {
    if (!email) return 'Vui lòng nhập email.';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return 'Email không hợp lệ.';
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errMsg = validateEmail();
    setError(errMsg);
    setMessage('');

    if (errMsg) {
      emailRef.current.focus();
      return;
    }

    try {
      const res = await axios.post('http://localhost:3000/auth/forgot-password', { email });
      setMessage(res.data.message);
      setError('');
      setEmail('');
    } catch (err) {
      const msg = err.response?.data?.message || 'Có lỗi xảy ra.';
      setError(msg);
      setMessage('');
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 bg-gray-50">
      <div className="hidden md:flex items-center justify-center bg-green-100">
        <img src="https://images.unsplash.com/photo-1567306226416-28f0efdc88ce" alt="Banner" className="..." />

      </div>

      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-md">
          <h2 className="text-2xl font-bold text-gray-800 text-center">Quên mật khẩu</h2>
          <p className="text-sm text-gray-500 text-center mb-4">Nhập email của bạn để nhận link đặt lại mật khẩu.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                ref={emailRef}
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                className={`w-full border px-3 py-2 rounded-md text-gray-800 focus:outline-none focus:ring-2 ${
                  error ? 'border-red-400 ring-red-200' : 'border-gray-300 ring-blue-200'
                }`}
                placeholder="example@email.com"
              />
              {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
            </div>

            <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition">
              Gửi yêu cầu
            </button>
          </form>

          {message && <div className="mt-4 text-center text-green-600">{message}</div>}
          {error && !message && <div className="mt-4 text-center text-red-500">{error}</div>}

          <div className="mt-6 text-center text-sm">
            <Link to="/dang-nhap" className="text-blue-600 hover:underline">
              Quay lại đăng nhập
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
