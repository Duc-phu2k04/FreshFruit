// RegisterForm.js
import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import axios from 'axios';

const InputField = ({ label, type = 'text', name, value, onChange, error, inputRef, showToggle, toggleValue, setToggleValue }) => (
  <div>
    <label className="block mb-2 font-semibold">{label}</label>
    <div className="relative">
      <input
        ref={inputRef}
        type={showToggle ? (toggleValue ? 'text' : 'password') : type}
        name={name}
        value={value}
        onChange={onChange}
        className={`w-full px-4 py-2 rounded text-black ${error ? 'border-2 border-yellow-300' : ''}`}
        placeholder={label}
      />
      {showToggle && (
        <button
          type="button"
          onClick={() => setToggleValue(!toggleValue)}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-600"
        >
          {toggleValue ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      )}
    </div>
    {error && <div className="text-yellow-300 text-sm mt-1">{error}</div>}
  </div>
);

const RegisterForm = () => {
  const [form, setForm] = useState({ username: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const usernameRef = useRef();
  const emailRef = useRef();
  const passwordRef = useRef();
  const confirmPasswordRef = useRef();
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

  const handleSubmit = async (e) => {
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
    try {
      await axios.post('http://localhost:3000/auth/register', {
        username: form.username,
        email: form.email,
        password: form.password,
      });
      alert('Đăng ký thành công!');
      navigate('/dang-nhap');
    } catch (error) {
      alert('Đăng ký thất bại: ' + error.response?.data?.message || 'Lỗi không xác định');
    }
  };

  return (
    <div className="max-w-md mx-auto mt-16 p-8 bg-gradient-to-r from-green-400 via-blue-500 to-purple-600 rounded-xl shadow-lg text-white">
      <h2 className="text-3xl font-bold mb-6 text-center">Đăng ký</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <InputField label="Tên đăng nhập" name="username" value={form.username} onChange={handleChange} error={errors.username} inputRef={usernameRef} />
        <InputField label="Email" name="email" value={form.email} onChange={handleChange} error={errors.email} inputRef={emailRef} />
        <InputField label="Mật khẩu" name="password" value={form.password} onChange={handleChange} error={errors.password} inputRef={passwordRef} showToggle toggleValue={showPassword} setToggleValue={setShowPassword} />
        <InputField label="Xác nhận mật khẩu" name="confirmPassword" value={form.confirmPassword} onChange={handleChange} error={errors.confirmPassword} inputRef={confirmPasswordRef} showToggle toggleValue={showConfirmPassword} setToggleValue={setShowConfirmPassword} />
        <button type="submit" className="w-full bg-white text-purple-700 font-bold py-2 rounded hover:bg-gray-200 transition">Đăng ký</button>
      </form>
      <div className="mt-6 text-center">
        <Link to="/dang-nhap" className="underline text-white hover:text-gray-200">Đã có tài khoản? Đăng nhập ngay</Link>
      </div>
    </div>
  );
};

export default RegisterForm;