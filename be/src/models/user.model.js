import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: {
    type: String,
    required: true,
    unique: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email không đúng định dạng'],
  },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },

  // Thêm các trường bổ sung để hỗ trợ ProfilePage
  fullName: { type: String },
  phone: { type: String },
  address: { type: String },
}, { timestamps: true });

export default mongoose.model('User', userSchema);
