import * as authService from '../services/auth.service.js';
import bcrypt from 'bcryptjs';
import User from '../models/user.model.js';
import crypto from 'crypto';
import { sendMail } from '../services/mail.service.js';

export const register = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    const user = await authService.register(username, email, password, role);
    res.status(201).json({ message: 'Đăng ký thành công', user });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Đăng ký thất bại' });
  }
};


export const login = async (req, res) => {
  try {
    const { usernameOrEmail, password } = req.body;
    const { token, user } = await authService.login(usernameOrEmail, password);
    res.json({ message: 'Đăng nhập thành công', token, user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Không thể lấy danh sách người dùng' });
  }
};


// Xóa tài khoản theo ID
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

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'Email không tồn tại trong hệ thống.' });
    }

    const newPassword = crypto.randomBytes(4).toString('hex'); // 8 ký tự ngẫu nhiên
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
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, role /*, ...any other fields you want to update */ } = req.body;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: 'Người dùng không tìm thấy.' });
    }

    // Cập nhật các trường
    if (username) user.username = username;
    if (email) user.email = email;
    // Chỉ cho phép cập nhật vai trò nếu nó hợp lệ và có quyền
    if (role && ['user', 'admin'].includes(role)) { // Đảm bảo role hợp lệ
      // Thêm logic kiểm tra quyền ở đây nếu bạn không muốn admin tự hạ quyền hoặc admin thường thay đổi quyền của super-admin
      user.role = role;
    }

    const updatedUser = await user.save(); // Lưu thay đổi

    res.status(200).json({ message: 'Thông tin người dùng đã được cập nhật!', data: updatedUser });
  } catch (error) {
    // Xử lý lỗi trùng email hoặc lỗi validation khác
    res.status(400).json({ message: error.message });
  }
};