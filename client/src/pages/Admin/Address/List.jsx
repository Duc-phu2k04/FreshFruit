import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const AddressList = () => {
  const [addresses, setAddresses] = useState([]);

  useEffect(() => {
    fetchAddresses();
  }, []);

  const fetchAddresses = async () => {
    try {
      const res = await axios.get('/api/address', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      setAddresses(res.data);
    } catch (err) {
      console.error('Lỗi khi tải địa chỉ:', err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn chắc chắn muốn xoá?')) return;

    try {
      await axios.delete(`/api/address/${id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      fetchAddresses();
    } catch (err) {
      console.error('Lỗi khi xoá:', err);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Danh sách địa chỉ</h2>
        <Link
          to="/admin/address/add"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
        >
          + Thêm địa chỉ
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-200 rounded-md bg-white">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="px-4 py-2 border-b">Tên</th>
              <th className="px-4 py-2 border-b">SĐT</th>
              <th className="px-4 py-2 border-b">Địa chỉ</th>
              <th className="px-4 py-2 border-b text-center">Mặc định</th>
              <th className="px-4 py-2 border-b text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {addresses.map((addr) => (
              <tr key={addr._id} className="hover:bg-gray-50">
                <td className="px-4 py-2 border-b">{addr.fullName}</td>
                <td className="px-4 py-2 border-b">{addr.phone}</td>
                <td className="px-4 py-2 border-b">
                  {`${addr.detail}, ${addr.ward}, ${addr.district}, ${addr.province}`}
                </td>
                <td className="px-4 py-2 border-b text-center">
                  {addr.isDefault ? '✔️' : ''}
                </td>
                <td className="px-4 py-2 border-b text-center space-x-2">
                  <Link
                    to={`/admin/address/edit/${addr._id}`}
                    className="text-blue-600 hover:underline"
                  >
                    Sửa
                  </Link>
                  <button
                    onClick={() => handleDelete(addr._id)}
                    className="text-red-600 hover:underline"
                  >
                    Xoá
                  </button>
                </td>
              </tr>
            ))}

            {addresses.length === 0 && (
              <tr>
                <td colSpan="5" className="text-center text-gray-500 py-4">
                  Không có địa chỉ nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AddressList;
