// src/App.jsx
import React, { useState } from 'react';
import LoginForm from './Auth/LoginForm';
import RegisterForm from './Auth/RegisterForm';
import ForgotPasswordForm from './Auth/ForgotPasswordForm';
import LogoutButton from './Auth/LogoutButton';
import { isLoggedIn, getCurrentUser } from './utils/auth';

const App = () => {
  const [page, setPage] = useState(isLoggedIn() ? 'dashboard' : 'login');

  // Khi đăng nhập thành công, chuyển sang dashboard
  const handleLoginSuccess = () => setPage('dashboard');
  const handleLogout = () => setPage('login');
  const handleRegister = () => setPage('login');
  const handleForgot = () => setPage('login');

  return (
    <div style={{ padding: 24 }}>
      {page === 'login' && (
        <>
          <LoginForm onLoginSuccess={handleLoginSuccess} />
          <div style={{ marginTop: 8 }}>
            <button onClick={() => setPage('register')}>Đăng ký</button>
            <button onClick={() => setPage('forgot')}>Quên mật khẩu</button>
          </div>
        </>
      )}
      {page === 'register' && (
        <>
          <RegisterForm onRegister={handleRegister} />
          <button style={{ marginTop: 8 }} onClick={() => setPage('login')}>Quay lại đăng nhập</button>
        </>
      )}
      {page === 'forgot' && (
        <>
          <ForgotPasswordForm onSubmit={handleForgot} />
          <button style={{ marginTop: 8 }} onClick={() => setPage('login')}>Quay lại đăng nhập</button>
        </>
      )}
      {page === 'dashboard' && (
        <div>
          <h2>Chào mừng {getCurrentUser()?.email || 'bạn'}!</h2>
          <LogoutButton onLogout={handleLogout} />
        </div>
      )}
    </div>
  );
};

export default App;
