import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const AddAddressAdd = () => {
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    province: '',
    district: '',
    ward: '',
    detail: '',
    isDefault: false,
  });
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();

  const validate = () => {
    const newErrors = {};
    if (!form.fullName.trim()) newErrors.fullName = 'Vui lòng nhập họ tên.';
    if (!form.phone.match(/^[0-9]{9,11}$/)) newErrors.phone = 'SĐT không hợp lệ.';
    if (!form.province.trim()) newErrors.province = 'Vui lòng nhập tỉnh.';
    if (!form.district.trim()) newErrors.district = 'Vui lòng nhập quận/huyện.';
    if (!form.ward.trim()) newErrors.ward = 'Vui lòng nhập phường/xã.';
    if (!form.detail.trim()) newErrors.detail = 'Vui lòng nhập địa chỉ chi tiết.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      await axios.post('/api/address', form, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      navigate('/admin/address');
    } catch (err) {
      console.error('Lỗi khi thêm địa chỉ:', err);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-4 bg-white rounded shadow">
      <h2 className="text-2xl font-bold mb-4">Thêm địa chỉ</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {[
          ['Họ tên', 'fullName'],
          ['SĐT', 'phone'],
          ['Tỉnh', 'province'],
          ['Quận/Huyện', 'district'],
          ['Phường/Xã', 'ward'],
          ['Địa chỉ chi tiết', 'detail']
        ].map(([label, name]) => (
          <div key={name}>
            <input
              className="w-full border p-2 rounded"
              placeholder={label}
              value={form[name]}
              onChange={e => setForm({ ...form, [name]: e.target.value })}
            />
            {errors[name] && <p className="text-red-500 text-sm">{errors[name]}</p>}
          </div>
        ))}

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.isDefault}
            onChange={e => setForm({ ...form, isDefault: e.target.checked })}
          />
          Đặt làm địa chỉ mặc định
        </label>

        <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
          Thêm
        </button>
      </form>
    </div>
  );
};

export default AddAddressAdd;
