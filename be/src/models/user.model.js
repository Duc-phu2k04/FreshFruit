// src/models/user.model.js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email không đúng định dạng'],
    },
    password: { type: String, required: true },

    role: { type: String, enum: ['user', 'admin', 'manager'], default: 'user' },

    // Bổ sung cho ProfilePage (giữ nguyên)
    fullName: { type: String, trim: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },

    // Địa chỉ mặc định
    defaultAddressId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Address',
      default: null,
      index: true, // giúp truy vấn nhanh
    },
  },
  { timestamps: true, versionKey: false }
);

// Ẩn password khi trả JSON
userSchema.set('toJSON', {
  transform: function (doc, ret) {
    delete ret.password;
    return ret;
  },
});

export default mongoose.model('User', userSchema);
