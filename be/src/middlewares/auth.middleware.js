// src/middleware/auth.middleware.js
import jwt from 'jsonwebtoken';

/**
 * Middleware xác thực người dùng thông qua JWT
 */
export function verifyToken(req, res, next) {
  // Lấy token từ header Authorization: Bearer <token>
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];

  console.log("👉 Token nhận được từ client:", token); // 👈 DEBUG quan trọng

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    // Giải mã token
    const decoded = jwt.verify(token, 'secret'); // Nên dùng process.env.JWT_SECRET cho bảo mật hơn

    // Gắn user vào req để route phía sau sử dụng
    req.user = {
      ...decoded,
      _id: decoded._id || decoded.id, // bảo đảm có _id
    };

    next(); // Cho phép đi tiếp
  } catch (err) {
    console.error("❌ Lỗi xác thực JWT:", err.message); // 👈 DEBUG lỗi token
    return res.status(401).json({ message: 'Invalid token' });
  }
}

/**
 * Middleware kiểm tra quyền admin
 */
export function isAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied: Admin only' });
  }
  next();
}

/**
 * Cho phép truy cập nếu là admin hoặc chính user
 */
export function verifyTokenAndAuthorization(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, 'secret');
    const user = {
      ...decoded,
      _id: decoded._id || decoded.id,
    };
    req.user = user;

    // Cho phép nếu là admin hoặc là chính chủ
    if (user.role === 'admin' || user._id === req.params.id) {
      next();
    } else {
      return res.status(403).json({ message: 'Access denied' });
    }
  } catch (err) {
    console.error("❌ Lỗi xác thực JWT (auth+authorization):", err.message);
    return res.status(401).json({ message: 'Invalid token' });
  }
}
