import * as authService from '../services/auth.service.js';
import bcrypt from 'bcryptjs';
import User from '../models/user.model.js';
import Order from '../models/order.model.js'; // Thêm dòng này
import crypto from 'crypto';
import { sendMail } from '../services/mail.service.js';

// Đăng ký tài khoản
export const register = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    const user = await authService.register(username, email, password, role);
    res.status(201).json({ message: 'Đăng ký thành công', user });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Đăng ký thất bại' });
  }
};

// Đăng nhập
export const login = async (req, res) => {
  try {
    const { usernameOrEmail, password } = req.body;
    const { token, user } = await authService.login(usernameOrEmail, password);
    res.json({ message: 'Đăng nhập thành công', token, user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Lấy toàn bộ người dùng
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Không thể lấy danh sách người dùng' });
  }
};

//  Lấy người dùng theo ID + lịch sử đơn hàng
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password').lean();
    if (!user) return res.status(404).json({ message: 'Không tìm thấy người dùng' });

    //  Lấy đơn hàng của user
    const orders = await Order.find({ user: req.params.id })
      .populate('items.product', 'name image price')
      .sort({ createdAt: -1 })
      .lean();

    user.orders = orders; // gán vào user để FE dễ hiển thị

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server khi lấy thông tin người dùng', error: error.message });
  }
};

// Cập nhật người dùng
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, phone, address, role, fullName } = req.body;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'Người dùng không tìm thấy.' });

    if (fullName) user.fullName = fullName;
    if (username) user.username = username;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (address) user.address = address;
    if (role && ['user', 'admin'].includes(role)) {
      user.role = role;
    }

    const updatedUser = await user.save();
    res.status(200).json({ message: 'Thông tin người dùng đã được cập nhật!', data: updatedUser });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Xóa người dùng
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }
    res.json({ message: 'Xóa người dùng thành công', user: deletedUser });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi khi xóa người dùng' });
  }
};

// Quên mật khẩu
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'Email không tồn tại trong hệ thống.' });
    }

    const newPassword = crypto.randomBytes(4).toString('hex');
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    await user.save();

    const emailContent = `
Xin chào ${user.username || 'bạn'}, 

Chúng tôi đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản FreshFruit của bạn.

🔑 Mật khẩu mới của bạn là: ${newPassword}

Vui lòng đăng nhập và đổi mật khẩu ngay để đảm bảo an toàn cho tài khoản.

Trân trọng,
Đội ngũ FreshFruit
    `;

    await sendMail(
      email,
      '🔐 Mật khẩu mới từ hệ thống FreshFruit',
      emailContent
    );

    res.status(200).json({ message: 'Mật khẩu mới đã được gửi đến email của bạn.' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};
