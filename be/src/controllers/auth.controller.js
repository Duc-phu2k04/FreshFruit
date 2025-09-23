import * as authService from '../services/auth.service.js';
import bcrypt from 'bcryptjs';
import User from '../models/user.model.js';
import Order from '../models/order.model.js';
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

// Lấy toàn bộ người dùng (chỉ admin)
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Không thể lấy danh sách người dùng' });
  }
};

// Lấy người dùng theo ID + lịch sử đơn hàng
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password').lean();
    if (!user) return res.status(404).json({ message: 'Không tìm thấy người dùng' });

    const orders = await Order.find({ user: req.params.id })
      .populate('items.product', 'name image price')
      .sort({ createdAt: -1 })
      .lean();

    user.orders = orders;

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server khi lấy thông tin người dùng', error: error.message });
  }
};

// ** Lấy profile user hiện tại (theo token) **
export const getCurrentUserProfile = async (req, res) => {
  try {
    const userId = req.user?._id || req.userId;
    const user = await User.findById(userId).select('-password -__v');
    if (!user) return res.status(404).json({ message: 'User không tồn tại' });

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy thông tin user', error: error.message });
  }
};

// Cập nhật người dùng
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, phone, address, role, fullName, defaultAddressId } = req.body;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'Người dùng không tìm thấy.' });

    if (fullName !== undefined) user.fullName = fullName;
    if (username !== undefined) user.username = username;
    if (email !== undefined) user.email = email;
    if (phone !== undefined) user.phone = phone;
    if (address !== undefined) user.address = address;
    if (role !== undefined && ['user', 'admin', 'manager'].includes(role)) {
  user.role = role;
}
    if (defaultAddressId !== undefined) {
      user.defaultAddressId = defaultAddressId;
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
    const currentUserId = req.user._id;
    const isAdmin = req.user.role === 'admin';
    
    // Kiểm tra quyền: chỉ admin hoặc tự xóa chính mình
    if (!isAdmin && currentUserId.toString() !== id) {
      return res.status(403).json({ error: 'Bạn không có quyền xóa người dùng này' });
    }
    
    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }
    
    // ✅ Kiểm tra nếu admin xóa chính mình
    const isSelfDeletion = currentUserId.toString() === id;
    
    res.json({ 
      message: 'Xóa người dùng thành công', 
      user: deletedUser,
      isSelfDeletion: isSelfDeletion // Flag để frontend biết cần đăng xuất
    });
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

// Kiểm tra username hoặc email đã tồn tại
export const checkDuplicate = async (req, res) => {
  try {
    const { username, email } = req.query;

    let query = {};
    if (username) query.username = username;
    if (email) query.email = email;

    const existingUser = await User.findOne(query);
    if (existingUser) {
      return res.status(200).json({ exists: true });
    }

    res.status(200).json({ exists: false });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi kiểm tra tài khoản' });
  }
};
