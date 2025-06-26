// src/utils/axiosConfig.js
import axios from 'axios';

const axiosInstance = axios.create({
    baseURL: 'http://localhost:3000/api', // ⚠️ Đổi URL phù hợp với server bạn
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// 👉 Thêm interceptor nếu cần: token, xử lý lỗi...
axiosInstance.interceptors.request.use(
    (config) => {
        // Ví dụ: thêm token nếu có
        const token = localStorage.getItem('token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
        // Bạn có thể xử lý lỗi 401, 403 ở đây
        console.error('API Error:', error);
        return Promise.reject(error);
    }
);

export default axiosInstance;
