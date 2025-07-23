// src/utils/axiosConfig.js
import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: 'http://localhost:3000/api', // ⚠️ Đổi nếu dùng server khác
  timeout: 10000,
});

// 👉 Thêm token nếu có
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    // ⚠️ Nếu đang gửi FormData thì KHÔNG set Content-Type
    if (!(config.data instanceof FormData)) {
      config.headers['Content-Type'] = 'application/json';
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// 👉 Xử lý lỗi response
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export default axiosInstance;
