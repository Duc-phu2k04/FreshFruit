export function verifyToken(req, res, next) {
  // Giả lập kiểm tra token (thực tế dùng JWT.verify)
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    // const decoded = jwt.verify(token, "your-secret");
    // req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
}

export function isAdmin(req, res, next) {
  // Giả lập kiểm tra quyền admin
  // if (req.user.role !== 'admin') return res.status(403).json({ message: "Access denied" });
  next();
}
