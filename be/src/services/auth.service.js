import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';

export async function register(username, email, password, role = 'user') {
  const existingUser = await User.findOne({ $or: [{ username }, { email }] });
  if (existingUser) throw new Error('Username hoặc email đã tồn tại');

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Email không đúng định dạng');
  }

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
  { expiresIn: '1h' }
);

  return { token, user };
}
