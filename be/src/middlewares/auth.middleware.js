import jwt from 'jsonwebtoken';

// Kiểm tra token có hợp lệ hay không
export function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, 'secret');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

// Chỉ cho admin được quyền
export function isAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }
  next();
}

//  Mới: Cho phép nếu là admin hoặc chính chủ userId
export function verifyTokenAndAuthorization(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, 'secret');
    req.user = decoded;

    //  Cho phép nếu là admin hoặc đúng người dùng
    if (decoded.role === 'admin' || decoded.id === req.params.id) {
      next();
    } else {
      return res.status(403).json({ message: 'Access denied' });
    }
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}
