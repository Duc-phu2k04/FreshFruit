// src/Auth/ForgotPasswordForm.jsx
import React, { useState } from 'react';

const ForgotPasswordForm = ({ onSubmit }) => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setMessage('Đã gửi email hướng dẫn đặt lại mật khẩu!');
    onSubmit && onSubmit(email);
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 400, margin: 'auto' }}>
      <h2>Quên mật khẩu</h2>
      <input
        type="email"
        placeholder="Nhập email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
        style={{ width: '100%', marginBottom: 8 }}
      />
      <button type="submit" style={{ width: '100%' }}>Gửi</button>
      {message && <div style={{ color: 'green', marginTop: 8 }}>{message}</div>}
    </form>
  );
};


export default ForgotPasswordForm;
