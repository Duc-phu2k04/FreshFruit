// src/controllers/address.controller.js
import Address from '../models/address.model.js';
import User from '../models/user.model.js';  // update defaultAddressId & lấy default

// ===================== DEBUG helper =====================
const ADDR_DEBUG =
  String(process.env.SHIPPING_DEBUG || '').trim() === '1' ||
  String(process.env.NODE_ENV || '').trim() === 'development';

function dbg(tag, payload) {
  if (ADDR_DEBUG) {
    try { console.log(`[ADDR_DEBUG] ${tag}`, payload); } catch { /* no-op */ }
  }
}

// ===================== Chuẩn hoá mã khu vực =====================
const normDistrictCode = (v) => {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return /^\d+$/.test(s) ? s.padStart(3, '0') : s;   // ví dụ "4" -> "004"
};
const normWardCode = (v) => {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return /^\d+$/.test(s) ? s.padStart(5, '0') : s;   // ví dụ "623" -> "00623"
};

/** Đảm bảo address object trả ra đã có code dạng string padded */
function normalizeAddressOut(doc) {
  if (!doc) return doc;
  const a = doc.toObject ? doc.toObject() : { ...doc };
  if (a.districtCode != null) a.districtCode = normDistrictCode(a.districtCode) || '';
  if (a.wardCode != null) a.wardCode = normWardCode(a.wardCode) || '';
  return a;
}

/** Validate bắt buộc có mã quận/phường để tính phí ship chuẩn theo seed */
function assertHasCodesOrFail({ districtCode, wardCode }) {
  const d = normDistrictCode(districtCode);
  const w = normWardCode(wardCode);
  if (!d || !/^\d{3}$/.test(d)) {
    const err = new Error('Thiếu hoặc sai mã quận (districtCode). Ví dụ "004"');
    err.status = 422;
    throw err;
  }
  if (!w || !/^\d{5}$/.test(w)) {
    const err = new Error('Thiếu hoặc sai mã phường (wardCode). Ví dụ "00623"');
    err.status = 422;
    throw err;
  }
  return { d, w };
}

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
      districtCode,
      wardCode,
    } = req.body;
    const userId = req.user?._id || req.userId;

    if (!fullName || !phone || !province || !district || !ward || !detail) {
      return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin' });
    }

    // BẮT BUỘC có mã quận/phường để tính ship chính xác theo seed
    const { d, w } = assertHasCodesOrFail({ districtCode, wardCode });

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
      districtCode: d,
      wardCode: w,
      isDefault: shouldBeDefault,
    });

    await newAddress.save();
    if (shouldBeDefault) {
      await User.findByIdAndUpdate(userId, { defaultAddressId: newAddress._id });
    }

    const out = normalizeAddressOut(newAddress);
    dbg('createAddress.ok', { userId: String(userId), out });
    res.status(201).json(out);
  } catch (error) {
    dbg('createAddress.err', { err: error?.message || error });
    return res
      .status(error?.status || 500)
      .json({ message: 'Lỗi khi tạo địa chỉ mới', error: error?.message || error });
  }
};

// ===================== Lấy danh sách địa chỉ user =====================
export const getUserAddresses = async (req, res) => {
  try {
    const userId = req.user?._id || req.userId;
    const addresses = await Address.find({ user: userId }).sort({ isDefault: -1, createdAt: -1 });
    const out = (addresses || []).map(normalizeAddressOut);
    res.status(200).json(out);
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
    if (!address) return res.status(404).json({ message: 'Không tìm thấy địa chỉ' });
    res.status(200).json(normalizeAddressOut(address));
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy địa chỉ', error: error.message || error });
  }
};

// ===================== Lấy địa chỉ mặc định của user (tiện cho checkout) =====================
export const getDefaultAddress = async (req, res) => {
  try {
    const userId = req.user?._id || req.userId;
    const user = await User.findById(userId).lean();
    let address = null;

    if (user?.defaultAddressId) {
      address = await Address.findOne({ _id: user.defaultAddressId, user: userId }).lean();
    }
    if (!address) {
      address = await Address.findOne({ user: userId, isDefault: true }).lean();
    }
    if (!address) {
      return res.status(404).json({ message: 'Chưa có địa chỉ mặc định' });
    }

    res.status(200).json(normalizeAddressOut(address));
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy địa chỉ mặc định', error: error.message || error });
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
      districtCode,
      wardCode,
    } = req.body;

    // Nếu yêu cầu đặt default, tắt default các địa chỉ còn lại
    if (isDefault) {
      await Address.updateMany({ user: userId }, { isDefault: false });
    }

    const addr = await Address.findOne({ _id: id, user: userId });
    if (!addr) return res.status(404).json({ message: 'Không tìm thấy địa chỉ' });

    // Cập nhật trường text
    if (fullName !== undefined) addr.fullName = fullName;
    if (phone !== undefined) addr.phone = phone;
    if (province !== undefined) addr.province = province;
    if (district !== undefined) addr.district = district;
    if (ward !== undefined) addr.ward = ward;
    if (detail !== undefined) addr.detail = detail;
    if (typeof isDefault === 'boolean') addr.isDefault = isDefault;

    // Cập nhật & validate mã khu vực nếu có gửi lên
    // Nếu FE gửi 1 trong 2, bắt buộc phải đủ cả 2 để đảm bảo tính ship chính xác
    const dcProvided = districtCode !== undefined;
    const wcProvided = wardCode !== undefined;

    if (dcProvided || wcProvided) {
      const d = dcProvided ? normDistrictCode(districtCode || '') : addr.districtCode;
      const w = wcProvided ? normWardCode(wardCode || '') : addr.wardCode;
      const checked = assertHasCodesOrFail({ districtCode: d, wardCode: w });
      addr.districtCode = checked.d;
      addr.wardCode = checked.w;
    } else {
      // Không gửi code mới: vẫn đảm bảo field hiện có là string padded (nếu đang có)
      if (addr.districtCode != null) addr.districtCode = normDistrictCode(addr.districtCode) || '';
      if (addr.wardCode != null) addr.wardCode = normWardCode(addr.wardCode) || '';
      // Nếu hiện tại thiếu code -> KHÔNG cho lưu vì sẽ làm sai logic freeship
      if (!addr.districtCode || !/^\d{3}$/.test(addr.districtCode) ||
          !addr.wardCode || !/^\d{5}$/.test(addr.wardCode)) {
        const err = new Error('Địa chỉ hiện tại thiếu mã quận/phường — vui lòng gửi đủ districtCode/wardCode');
        err.status = 422;
        throw err;
      }
    }

    await addr.save();
    if (addr.isDefault) {
      await User.findByIdAndUpdate(userId, { defaultAddressId: addr._id });
    }

    const out = normalizeAddressOut(addr);
    dbg('updateAddress.ok', { id: String(addr._id), out });
    res.status(200).json(out);
  } catch (error) {
    dbg('updateAddress.err', { err: error?.message || error });
    return res
      .status(error?.status || 500)
      .json({ message: 'Lỗi khi cập nhật địa chỉ', error: error?.message || error });
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

    if (!updated) return res.status(404).json({ message: 'Không tìm thấy địa chỉ' });

    // Đảm bảo địa chỉ mặc định cũng có code hợp lệ
    if (!updated.districtCode || !/^\d{3}$/.test(String(updated.districtCode)) ||
        !updated.wardCode || !/^\d{5}$/.test(String(updated.wardCode))) {
      const err = new Error('Địa chỉ mặc định thiếu mã quận/phường — vui lòng cập nhật districtCode/wardCode');
      err.status = 422;
      throw err;
    }

    await User.findByIdAndUpdate(userId, { defaultAddressId: updated._id });

    res.status(200).json(normalizeAddressOut(updated));
  } catch (error) {
    res.status(error?.status || 500).json({ message: 'Lỗi khi cập nhật địa chỉ mặc định', error: error?.message || error });
  }
};

// ===================== Xoá địa chỉ =====================
export const deleteAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id || req.userId;

    const addressToDelete = await Address.findOne({ _id: id, user: userId });
    if (!addressToDelete) return res.status(404).json({ message: 'Không tìm thấy địa chỉ' });

    await addressToDelete.deleteOne();

    if (addressToDelete.isDefault) {
      const another = await Address.findOne({ user: userId }).sort({ createdAt: -1 });
      if (another) {
        another.isDefault = true;

        // nếu địa chỉ thay thế thiếu code -> chặn vì sẽ phá logic ship
        if (!another.districtCode || !/^\d{3}$/.test(String(another.districtCode)) ||
            !another.wardCode || !/^\d{5}$/.test(String(another.wardCode))) {
          // bỏ đặt mặc định để tránh dùng sai
          another.isDefault = false;
          await another.save();
          await User.findByIdAndUpdate(userId, { $unset: { defaultAddressId: 1 } });
        } else {
          await another.save();
          await User.findByIdAndUpdate(userId, { defaultAddressId: another._id });
        }
      } else {
        await User.findByIdAndUpdate(userId, { $unset: { defaultAddressId: 1 } });
      }
    }

    res.status(200).json({ message: 'Xoá thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi xoá địa chỉ', error: error.message || error });
  }
};
