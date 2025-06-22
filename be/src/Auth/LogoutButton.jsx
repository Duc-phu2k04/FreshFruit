// src/Auth/LogoutButton.jsx
import React from 'react';
import { logout } from '../utils/auth';

const LogoutButton = ({ onLogout }) => (
  <button
    onClick={() => {
      logout();
      onLogout && onLogout();
    }}
    style={{ margin: 8 }}
  >
    Đăng xuất
  </button>
);


export default LogoutButton;
