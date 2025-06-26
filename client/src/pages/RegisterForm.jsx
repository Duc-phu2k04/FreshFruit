import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import axios from 'axios';

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

const RegisterForm = () => {
  const [form, setForm] = useState({ username: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const usernameRef = useRef();
  const emailRef = useRef();
  const passwordRef = useRef();
  const confirmRef = useRef();
  const navigate = useNavigate();

  const validate = () => {
    const err = {};
    if (!form.username) err.username = 'Tên đăng nhập bắt buộc.';
    else if (form.username.length < 3) err.username = 'Ít nhất 3 ký tự.';
    if (!form.email) err.email = 'Email bắt buộc.';
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) err.email = 'Email không hợp lệ.';
    if (!form.password) err.password = 'Mật khẩu bắt buộc.';
    else if (form.password.length < 6) err.password = 'Ít nhất 6 ký tự.';
    if (!form.confirmPassword) err.confirmPassword = 'Xác nhận mật khẩu bắt buộc.';
    else if (form.confirmPassword !== form.password) err.confirmPassword = 'Mật khẩu không khớp.';
    return err;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      if (validationErrors.username) usernameRef.current.focus();
      else if (validationErrors.email) emailRef.current.focus();
      else if (validationErrors.password) passwordRef.current.focus();
      else if (validationErrors.confirmPassword) confirmRef.current.focus();
      return;
    }

    try {
      await axios.post('http://localhost:3000/auth/register', form);
      alert('Đăng ký thành công!');
      navigate('/dang-nhap');
    } catch (error) {
      alert(error.response?.data?.message || 'Lỗi không xác định.');
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 bg-gray-50">
      {/* Bên trái: Ảnh minh họa */}
      <div className="hidden md:flex items-center justify-center bg-green-100">
        <img src="https://images.unsplash.com/photo-1567306226416-28f0efdc88ce" alt="Banner" className="..." />

      </div>

      {/* Bên phải: Form */}
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-md bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-800 text-center">Đăng ký tài khoản</h2>
          <p className="text-sm text-gray-500 text-center mb-6">Tham gia FreshFruit để đặt hàng dễ dàng hơn!</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input label="Tên đăng nhập" name="username" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} error={errors.username} inputRef={usernameRef} />
            <Input label="Email" name="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} error={errors.email} inputRef={emailRef} />
            <Input label="Mật khẩu" name="password" toggle show={showPassword} setShow={setShowPassword} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} error={errors.password} inputRef={passwordRef} />
            <Input label="Xác nhận mật khẩu" name="confirmPassword" toggle show={showConfirm} setShow={setShowConfirm} value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })} error={errors.confirmPassword} inputRef={confirmRef} />

            <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition">
              Đăng ký
            </button>
          </form>

          <div className="mt-4 text-center text-sm text-gray-600">
            Đã có tài khoản?{' '}
            <Link to="/dang-nhap" className="text-blue-600 hover:underline">
              Đăng nhập
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterForm;
