import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const LoginForm = () => {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.username || !form.password) {
      setError('Vui lòng nhập đầy đủ thông tin.');
      return;
    }
    alert('Đăng nhập thành công!');
  };

  return (
    <div className="max-w-md mx-auto mt-16 p-8 bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 rounded-xl shadow-lg text-white">
      {!showForgotPassword ? (
        <>
          <h2 className="text-3xl font-bold mb-6 text-center">Đăng nhập</h2>
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
            {error && <div className="text-yellow-300 text-sm">{error}</div>}
            <button
              type="submit"
              className="w-full bg-white text-purple-700 font-bold py-2 rounded hover:bg-gray-200 transition"
            >
              Đăng nhập
            </button>
          </form>
          <div className="mt-4 text-center">
            <button
              onClick={() => setShowForgotPassword(true)}
              className="underline text-white hover:text-gray-200"
            >
              Quên mật khẩu?
            </button>
          </div>
          <div className="mt-6 text-center">
            <Link to="/dang-ky" className="underline text-white hover:text-gray-200">
              Chưa có tài khoản? Đăng ký ngay
            </Link>
          </div>
        </>
      ) : (
        <ForgotPassword onBack={() => setShowForgotPassword(false)} />
      )}
    </div>
  );
};

const ForgotPassword = ({ onBack }) => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email) {
      setMessage('Vui lòng nhập email.');
      return;
    }
    // Xử lý gửi email quên mật khẩu
    setMessage('Yêu cầu đặt lại mật khẩu đã được gửi. Vui lòng kiểm tra email.');
  };

  return (
    <div>
      <h2 className="text-3xl font-bold mb-6 text-center">Quên mật khẩu</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block mb-2 font-semibold">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 rounded text-black"
            placeholder="Nhập email của bạn"
          />
        </div>
        {message && <div className="text-green-300 text-sm">{message}</div>}
        <button
          type="submit"
          className="w-full bg-white text-purple-700 font-bold py-2 rounded hover:bg-gray-200 transition"
        >
          Gửi yêu cầu
        </button>
      </form>
      <div className="mt-4 text-center">
        <button onClick={onBack} className="underline text-white hover:text-gray-200">
          Quay lại đăng nhập
        </button>
      </div>
    </div>
  );
};

export default LoginForm;
