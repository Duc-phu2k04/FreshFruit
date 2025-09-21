// src/utils/axiosConfig.js
import axios from "axios";

/**
 * axiosInstance dùng chung cho toàn FE
 * - Tự gắn Authorization từ localStorage ("accessToken" | "token")
 * - Tự set Content-Type = application/json (trừ khi là FormData)
 * - Bắt 401: xoá token + chuyển /login?next=<path hiện tại>
 * - Nếu BE dùng cookie httpOnly: bật withCredentials: true & cấu hình CORS ở BE.
 */
const axiosInstance = axios.create({
  baseURL: "http://localhost:3000/api",
  timeout: 15000,
  withCredentials: false, // đổi true nếu auth = cookie httpOnly
  // ❌ Đừng set "X-Requested-With" để tránh CORS preflight bị chặn
});

/* =========================
 * REQUEST INTERCEPTOR
 * ======================= */
axiosInstance.interceptors.request.use(
  (config) => {
    // Lấy token (ưu tiên accessToken, fallback token)
    let token = null;
    try {
      if (typeof localStorage !== "undefined") {
        token =
          localStorage.getItem("accessToken") || localStorage.getItem("token");
      }
    } catch {
      // ignore lỗi đọc localStorage
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      delete config.headers.Authorization;
    }

    // Chỉ set Content-Type khi không phải FormData
    const isFormData =
      typeof FormData !== "undefined" && config.data instanceof FormData;

    if (isFormData) {
      // Browser tự set boundary cho multipart/form-data
      delete config.headers["Content-Type"];
    } else if (config.data && !config.headers["Content-Type"]) {
      config.headers["Content-Type"] = "application/json";
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/* =========================
 * RESPONSE INTERCEPTOR
 * ======================= */
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    // Bỏ qua log nếu là cancel
    const isCanceled =
      axios.isCancel?.(error) ||
      error?.code === "ERR_CANCELED" ||
      error?.name === "CanceledError" ||
      (typeof error?.message === "string" &&
        error.message.toLowerCase() === "canceled");

    if (!isCanceled) {
      const method = error?.config?.method?.toUpperCase?.() || "";
      const url = error?.config?.url || "";
      const status = error?.response?.status;
      const msg =
        error?.response?.data?.message ||
        error?.message ||
        "Network Error";
      // eslint-disable-next-line no-console
      console.error(`[API ${method} ${url}] ${status || ""} ${msg}`);
    }

    // 401: xoá token + redirect login (tránh vòng lặp ở endpoint auth)
    const status = error?.response?.status;
    const reqUrl = error?.config?.url || "";
    const isAuthEndpoint = /\/auth\/(login|register|me|refresh)/i.test(reqUrl);

    if (status === 401 && !isAuthEndpoint && typeof window !== "undefined") {
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.removeItem("accessToken");
          localStorage.removeItem("token");
        }
      } catch {
        // ignore lỗi xoá localStorage
      }

      const now = window.location.pathname + window.location.search;
      const next = encodeURIComponent(now);
      if (!/\/login/i.test(window.location.pathname)) {
        window.location.href = `/login?next=${next}`;
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
