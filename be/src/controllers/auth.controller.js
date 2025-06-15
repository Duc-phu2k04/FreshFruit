import * as authService from '../services/auth.service.js';
import User from '../models/user.model.js';

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
