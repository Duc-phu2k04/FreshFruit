// be/src/models/Address.js
import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    fullName: { type: String, required: true, trim: true },
    phone:    { type: String, required: true, trim: true },

    province: { type: String, required: true, trim: true },
    district: { type: String, required: true, trim: true },
    ward:     { type: String, required: true, trim: true },
    detail:   { type: String, required: true, trim: true },

    //  Dùng cho rule theo khu vực (giữ dạng string để không mất số 0 ở đầu)
    //   Ví dụ: districtCode "004" (Long Biên), wardCode "00139" (Bồ Đề)
    districtCode: { type: String, trim: true, default: null },
    wardCode:     { type: String, trim: true, default: null },

    //  Dùng cho rule theo khoảng cách (được geocode & cache lại)
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },

    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false }
);

// (Tuỳ chọn) Index hỗ trợ query nhanh theo user/isDefault
addressSchema.index({ user: 1, isDefault: 1 });

export default mongoose.model('Address', addressSchema);
