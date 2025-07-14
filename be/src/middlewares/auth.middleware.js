// src/middleware/auth.middleware.js
import jwt from 'jsonwebtoken';

/**
 * Middleware xác thực người dùng thông qua JWT
 */
export function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, 'secret'); // dùng .env để bảo mật hơn

    req.user = {
      ...decoded,
      _id: decoded._id || decoded.id, // đảm bảo _id luôn có
    };

    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

/**
 * Chỉ cho phép người dùng có vai trò admin
 */
export function isAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied: Admin only' });
  }
  next();
}

/**
 * Cho phép truy cập nếu là admin hoặc chính chủ userId
 */
export function verifyTokenAndAuthorization(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, 'secret');

    const user = {
      ...decoded,
      _id: decoded._id || decoded.id,
    };
    req.user = user;

    // Cho phép nếu là admin hoặc là chính user được yêu cầu
    if (user.role === 'admin' || user._id === req.params.id) {
      next();
    } else {
      return res.status(403).json({ message: 'Access denied' });
    }
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}
