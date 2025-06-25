import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Eye, EyeOff } from 'lucide-react'; // icon toggle password

const LoginForm = () => {
  const [form, setForm] = useState({ usernameOrEmail: '', password: '' });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const usernameRef = useRef(null);
  const passwordRef = useRef(null);
  const navigate = useNavigate();
  const { login } = useAuth();

  const validate = () => {
    const newErrors = {};
    if (!form.usernameOrEmail) newErrors.usernameOrEmail = 'Vui lòng nhập tên đăng nhập hoặc email.';
    if (!form.password) newErrors.password = 'Vui lòng nhập mật khẩu.';
    return newErrors;
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      if (validationErrors.usernameOrEmail) usernameRef.current.focus();
      else if (validationErrors.password) passwordRef.current.focus();
      return;
    }

    try {
      const res = await axios.post('http://localhost:3000/auth/login', {
        usernameOrEmail: form.usernameOrEmail,
        password: form.password,
      });

      const { token, user } = res.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      login(user);
      alert('Đăng nhập thành công!');
      navigate('/');
    } catch (err) {
      alert('Tên đăng nhập/email hoặc mật khẩu không đúng.');
    }
  };

  return (
    <div className="max-w-md mx-auto mt-16 p-8 bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 rounded-xl shadow-lg text-white">
      <h2 className="text-3xl font-bold mb-6 text-center">Đăng nhập</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block mb-2 font-semibold">Tên đăng nhập hoặc email</label>
          <input
            ref={usernameRef}
            type="text"
            name="usernameOrEmail"
            value={form.usernameOrEmail}
            onChange={handleChange}
            className={`w-full px-4 py-2 rounded text-black ${errors.usernameOrEmail ? 'border-2 border-yellow-300' : ''}`}
            placeholder="Tên đăng nhập hoặc email"
          />
          {errors.usernameOrEmail && <div className="text-yellow-300 text-sm mt-1">{errors.usernameOrEmail}</div>}
        </div>

        <div>
          <label className="block mb-2 font-semibold">Mật khẩu</label>
          <div className="relative">
            <input
              ref={passwordRef}
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={form.password}
              onChange={handleChange}
              className={`w-full px-4 py-2 rounded text-black ${errors.password ? 'border-2 border-yellow-300' : ''}`}
              placeholder="Nhập mật khẩu"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-600"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
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
