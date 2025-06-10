// src/Auth/LoginForm.jsx
import React, { useState } from 'react';
import { login } from '../utils/auth';

const LoginForm = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(email, password);
      setError('');
      onLoginSuccess && onLoginSuccess();
    } catch (err) {
      setError('Sai thông tin đăng nhập');
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 400, margin: 'auto' }}>
      <h2>Đăng nhập</h2>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
        style={{ width: '100%', marginBottom: 8 }}
      />
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <input
          type={showPassword ? 'text' : 'password'}
          placeholder="Mật khẩu"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          style={{ width: '100%' }}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          style={{ position: 'absolute', right: 0, top: 0 }}
        >
          {showPassword ? 'Ẩn' : 'Hiện'}
        </button>
      </div>
      {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}
      <button type="submit" style={{ width: '100%' }}>Đăng nhập</button>
    </form>
  );
};

export default LoginForm;
