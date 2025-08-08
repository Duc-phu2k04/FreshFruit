import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';

export async function register(username, email, password, role = 'user') {
  // Kiểm tra định dạng email trước
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Email không đúng định dạng');
  }

  // Kiểm tra trùng username
  const existingUsername = await User.findOne({ username });
  if (existingUsername) {
    throw new Error('Username đã được sử dụng');
  }

  // Kiểm tra trùng email
  const existingEmail = await User.findOne({ email });
  if (existingEmail) {
    throw new Error('Email đã được sử dụng');
  }

  // Băm mật khẩu và tạo user
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new User({ username, email, password: hashedPassword, role });
  await user.save();
  return user;
}



export async function login(usernameOrEmail, password) {
  const user = await User.findOne({
    $or: [{ username: usernameOrEmail }, { email: usernameOrEmail }]
  });
  if (!user) throw new Error('User not found');

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw new Error('Invalid password');

 const token = jwt.sign(
  { _id: user._id, username: user.username, role: user.role }, // dùng _id
  'secret',
  { expiresIn: '12h' }
);

  return { token, user };
}
