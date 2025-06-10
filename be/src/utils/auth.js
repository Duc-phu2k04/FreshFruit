// src/utils/auth.js

// Giả lập API đăng nhập
export const login = async (email, password) => {
  if (email === 'test@example.com' && password === '123456') {
    const token = 'fake-jwt-token';
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify({ email }));
    return true;
  } else {
    throw new Error('Sai thông tin đăng nhập');
  }
};

export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

export const getCurrentUser = () => {
  return JSON.parse(localStorage.getItem('user'));
};


export const isLoggedIn = () => {
  return !!localStorage.getItem('token');
};
