// src/controllers/address.controller.js
import Address from '../models/address.model.js';
import User from '../models/user.model.js';  // nhớ import User để update defaultAddressId

// Helpers: chuẩn hoá mã khu vực
const normDistrictCode = (v) => {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  // districts thường có 3 chữ số, ví dụ "001"
  return /^\d+$/.test(s) ? s.padStart(3, '0') : s;
};
const normWardCode = (v) => {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  // wards thường có 5 chữ số, ví dụ "00001"
  return /^\d+$/.test(s) ? s.padStart(5, '0') : s;
};

// ===================== Tạo địa chỉ mới =====================
export const createAddress = async (req, res) => {
  try {
    const {
      fullName,
      phone,
      province,
      district,
      ward,
      detail,
      isDefault,
      districtCode, //  nhận thêm
      wardCode,     //  nhận thêm
    } = req.body;
    const userId = req.user?._id || req.userId;

    // (giữ nguyên) — có thể thêm validate nếu cần
    if (!fullName || !phone || !province || !district || !ward || !detail) {
      return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin' });
    }

    const addressCount = await Address.countDocuments({ user: userId });
    const shouldBeDefault = addressCount === 0 || !!isDefault;

    if (shouldBeDefault) {
      await Address.updateMany({ user: userId }, { isDefault: false });
    }

    const newAddress = new Address({
      user: userId,
      fullName,
      phone,
      province,
      district,
      ward,
      detail,
      // Lưu mã khu vực đã chuẩn hoá
      districtCode: normDistrictCode(districtCode),
      wardCode: normWardCode(wardCode),
      isDefault: shouldBeDefault,
    });

    await newAddress.save();

    if (shouldBeDefault) {
      await User.findByIdAndUpdate(userId, { defaultAddressId: newAddress._id });
    }

    res.status(201).json(newAddress);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi tạo địa chỉ mới', error: error.message || error });
  }
};

// ===================== Lấy danh sách địa chỉ user =====================
export const getUserAddresses = async (req, res) => {
  try {
    const userId = req.user?._id || req.userId;
    const addresses = await Address.find({ user: userId }).sort({ isDefault: -1, createdAt: -1 });
    res.status(200).json(addresses);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy địa chỉ', error: error.message || error });
  }
};

// ===================== Lấy địa chỉ theo ID =====================
export const getAddressById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id || req.userId;
    const address = await Address.findOne({ _id: id, user: userId });

    if (!address) {
      return res.status(404).json({ message: 'Không tìm thấy địa chỉ' });
    }

    res.status(200).json(address);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy địa chỉ', error: error.message || error });
  }
};

// ===================== Cập nhật địa chỉ =====================
export const updateAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id || req.userId;
    const {
      fullName,
      phone,
      province,
      district,
      ward,
      detail,
      isDefault,
      districtCode, //  nhận thêm
      wardCode,     //  nhận thêm
    } = req.body;

    if (isDefault) {
      await Address.updateMany({ user: userId }, { isDefault: false });
    }

    const addr = await Address.findOne({ _id: id, user: userId });
    if (!addr) {
      return res.status(404).json({ message: 'Không tìm thấy địa chỉ' });
    }

    // Giữ nguyên logic cũ + cập nhật field nếu truyền vào
    if (fullName !== undefined) addr.fullName = fullName;
    if (phone !== undefined) addr.phone = phone;
    if (province !== undefined) addr.province = province;
    if (district !== undefined) addr.district = district;
    if (ward !== undefined) addr.ward = ward;
    if (detail !== undefined) addr.detail = detail;

    // Cập nhật mã khu vực (nếu FE gửi)
    if (districtCode !== undefined) addr.districtCode = normDistrictCode(districtCode || '');
    if (wardCode !== undefined) addr.wardCode = normWardCode(wardCode || '');

    if (typeof isDefault === 'boolean') addr.isDefault = isDefault;

    await addr.save();

    if (addr.isDefault) {
      await User.findByIdAndUpdate(userId, { defaultAddressId: addr._id });
    }

    res.status(200).json(addr);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi cập nhật địa chỉ', error: error.message || error });
  }
};

// ===================== Cập nhật địa chỉ mặc định =====================
export const setDefaultAddress = async (req, res) => {
  try {
    const userId = req.user?._id || req.userId;
    const { id } = req.params;

    await Address.updateMany({ user: userId }, { isDefault: false });

    const updated = await Address.findOneAndUpdate(
      { _id: id, user: userId },
      { isDefault: true },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Không tìm thấy địa chỉ' });
    }

    await User.findByIdAndUpdate(userId, { defaultAddressId: updated._id });

    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi cập nhật địa chỉ mặc định', error: error.message || error });
  }
};

// ===================== Xoá địa chỉ =====================
export const deleteAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id || req.userId;

    const addressToDelete = await Address.findOne({ _id: id, user: userId });
    if (!addressToDelete) {
      return res.status(404).json({ message: 'Không tìm thấy địa chỉ' });
    }

    await addressToDelete.deleteOne();

    if (addressToDelete.isDefault) {
      const another = await Address.findOne({ user: userId }).sort({ createdAt: -1 });
      if (another) {
        another.isDefault = true;
        await another.save();
        await User.findByIdAndUpdate(userId, { defaultAddressId: another._id });
      } else {
        await User.findByIdAndUpdate(userId, { $unset: { defaultAddressId: 1 } });
      }
    }

    res.status(200).json({ message: 'Xoá thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi xoá địa chỉ', error: error.message || error });
  }
};
