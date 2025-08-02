import Address from '../models/address.model.js';

// Tạo địa chỉ mới
export const createAddress = async (req, res) => {
  try {
    const { fullName, phone, province, district, ward, detail, isDefault } = req.body;
    const userId = req.user?._id || req.userId;

    const addressCount = await Address.countDocuments({ user: userId });
    const shouldBeDefault = addressCount === 0 || isDefault;

    // Nếu là địa chỉ mặc định, xoá mặc định cũ
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
      isDefault: !!shouldBeDefault,
    });

    await newAddress.save();
    res.status(201).json(newAddress);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi tạo địa chỉ mới', error });
  }
};

// Lấy danh sách địa chỉ của người dùng
export const getUserAddresses = async (req, res) => {
  try {
    const userId = req.user?._id || req.userId;
    const addresses = await Address.find({ user: userId });
    res.status(200).json(addresses);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi lấy địa chỉ', error });
  }
};

// Cập nhật địa chỉ
export const updateAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id || req.userId;
    const { fullName, phone, province, district, ward, detail, isDefault } = req.body;

    if (isDefault) {
      await Address.updateMany({ user: userId }, { isDefault: false });
    }

    const updated = await Address.findOneAndUpdate(
      { _id: id, user: userId },
      {
        fullName,
        phone,
        province,
        district,
        ward,
        detail,
        isDefault: !!isDefault,
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Không tìm thấy địa chỉ' });
    }

    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi cập nhật địa chỉ', error });
  }
};

// Xoá địa chỉ
export const deleteAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id || req.userId;

    const addressToDelete = await Address.findOne({ _id: id, user: userId });
    if (!addressToDelete) {
      return res.status(404).json({ message: 'Không tìm thấy địa chỉ' });
    }

    await addressToDelete.deleteOne();

    // Nếu xoá địa chỉ mặc định, gán cái khác làm mặc định
    if (addressToDelete.isDefault) {
      const another = await Address.findOne({ user: userId });
      if (another) {
        another.isDefault = true;
        await another.save();
      }
    }

    res.status(200).json({ message: 'Xoá thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi xoá địa chỉ', error });
  }
};
