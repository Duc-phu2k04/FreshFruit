import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Eye, EyeOff } from 'lucide-react';

const Input = ({ label, type = 'text', name, value, onChange, error, inputRef, toggle, show, setShow }) => (
  <div className="space-y-1">
    <label className="block text-sm font-medium text-gray-700">{label}</label>
    <div className="relative">
      <input
        ref={inputRef}
        type={toggle ? (show ? 'text' : 'password') : type}
        name={name}
        value={value}
        onChange={onChange}
        className={`w-full border px-3 py-2 rounded-md text-gray-800 focus:outline-none focus:ring-2 ${
          error ? 'border-red-400 ring-red-200' : 'border-gray-300 ring-blue-200'
        }`}
        placeholder={label}
      />
      {toggle && (
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      )}
    </div>
    {error && <p className="text-sm text-red-500">{error}</p>}
  </div>
);

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
      const res = await axios.post('http://localhost:3000/auth/login', form);
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
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 bg-gray-50">
      <div className="hidden md:flex items-center justify-center bg-green-100">
        <img src="https://images.unsplash.com/photo-1567306226416-28f0efdc88ce" alt="Banner" className="..." />

      </div>

      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-md">
          <h2 className="text-2xl font-bold text-gray-800 text-center">Đăng nhập</h2>
          <form onSubmit={handleSubmit} className="space-y-5 mt-6">
            <Input label="Tên đăng nhập hoặc email" name="usernameOrEmail" value={form.usernameOrEmail} onChange={handleChange} error={errors.usernameOrEmail} inputRef={usernameRef} />
            <Input label="Mật khẩu" name="password" value={form.password} toggle show={showPassword} setShow={setShowPassword} onChange={handleChange} error={errors.password} inputRef={passwordRef} />
            <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition">Đăng nhập</button>
          </form>

          <div className="text-center text-sm mt-4">
            <Link to="/quen-mat-khau" className="text-blue-600 hover:underline">Quên mật khẩu?</Link>
          </div>
          <div className="text-center text-sm mt-2">
            Chưa có tài khoản? <Link to="/dang-ky" className="text-blue-600 hover:underline">Đăng ký ngay</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
