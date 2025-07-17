// ✅ FILE: Checkout.jsx (fixed)
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useLocation, useNavigate } from 'react-router-dom';

export default function Checkout({ handlePayment, handlePaymentMomo }) {
  const location = useLocation();
  const cartData = location.state?.cartData;
  const navigate = useNavigate();
  const [dataCart, setDataCart] = useState(null);

  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [provinceCode, setProvinceCode] = useState('');
  const [districtCode, setDistrictCode] = useState('');
  const [wardCode, setWardCode] = useState('');
  const [address, setAddress] = useState('');
  const [checkBox, setCheckBox] = useState(false);
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const [discountAmount, setDiscountAmount] = useState(0);

  const [data, setData] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [wards, setWards] = useState([]);

  const BASE_SHIPPING_FEE = 30000;

  useEffect(() => {
    if (cartData) {
      setDataCart(cartData);
    } else {
      navigate("/cart");
    }
  }, [cartData, navigate]);

  useEffect(() => {
    axios.get('https://provinces.open-api.vn/api/?depth=3').then(res => {
      setData(res.data);
    });
  }, []);

  useEffect(() => {
    const province = data.find(p => p.code === +provinceCode);
    setDistricts(province?.districts || []);
    setDistrictCode('');
    setWardCode('');
    setWards([]);
  }, [provinceCode, data]);

  useEffect(() => {
    const province = data.find(p => p.code === +provinceCode);
    const district = province?.districts.find(d => d.code === +districtCode);
    setWards(district?.wards || []);
    setWardCode('');
  }, [districtCode, provinceCode, data]);

  const handleApplyVoucher = async () => {
    if (!voucherCode) return;
    try {
      const response = await axios.get(`http://localhost:3000/api/voucher/validate/${encodeURIComponent(voucherCode)}`);
      const voucher = response.data;

      let discount = 0;
      const sum = dataCart?.sumPrice || 0;
      if (voucher.discount > 0 && voucher.discount <= 100) {
        discount = sum * (voucher.discount / 100);
      } else {
        discount = voucher.discount;
      }

      discount = Math.round(discount);

      setAppliedVoucher(voucher);
      setDiscountAmount(discount);
    } catch (err) {
      console.error("Lỗi khi áp dụng mã giảm giá:", err);
      alert("Mã giảm giá không hợp lệ hoặc đã hết hạn.");
      setAppliedVoucher(null);
      setDiscountAmount(0);
    }
  };

  const removeVoucher = () => {
    setAppliedVoucher(null);
    setVoucherCode('');
    setDiscountAmount(0);
  };

const subtotal = dataCart?.products?.reduce((sum, item) => {
  return sum + (item.price * item.quantity);
}, 0) || 0;

const total = Math.max(0, subtotal + BASE_SHIPPING_FEE - discountAmount);

console.log("Subtotal:", subtotal);
console.log("Shipping:", BASE_SHIPPING_FEE);
console.log("Discount:", discountAmount);
console.log("Total:", total);



  return (
    <div className="w-[85%] mx-auto my-5">
      <div className="mb-4 text-left">
        <Link to="/gio-hang" className="text-blue-600 hover:underline flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Quay lại Giỏ hàng
        </Link>
      </div>
      <main className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <h1 className="text-lg font-bold mb-4">Thông Tin Thanh Toán</h1>
          <div className="flex flex-col gap-4">
            <input type="text" placeholder="Nhập họ tên" onChange={(e) => setName(e.target.value)} className="border rounded px-4 py-2" />
            <input type="text" placeholder="Số điện thoại" onChange={(e) => setPhoneNumber(e.target.value)} className="border rounded px-4 py-2" />
            <input type="email" placeholder="Email" onChange={(e) => setEmail(e.target.value)} className="border rounded px-4 py-2" />
            <select className="border rounded px-4 py-2" value={provinceCode} onChange={(e) => setProvinceCode(e.target.value)}>
              <option value="">Chọn Tỉnh/Thành</option>
              {data.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
            </select>
            <select className="border rounded px-4 py-2" value={districtCode} onChange={(e) => setDistrictCode(e.target.value)} disabled={!provinceCode}>
              <option value="">Chọn Quận/Huyện</option>
              {districts.map(d => <option key={d.code} value={d.code}>{d.name}</option>)}
            </select>
            <select className="border rounded px-4 py-2" value={wardCode} onChange={(e) => setWardCode(e.target.value)} disabled={!districtCode}>
              <option value="">Chọn Phường/Xã</option>
              {wards.map(w => <option key={w.code} value={w.code}>{w.name}</option>)}
            </select>
            <input type="text" placeholder="Địa chỉ nhận hàng" onChange={(e) => setAddress(e.target.value)} className="border rounded px-4 py-2" />
          </div>
        </div>

        <div className="bg-gray-100 rounded-xl p-5">
          <h1 className="text-lg font-bold mb-4">Sản Phẩm Thanh Toán</h1>
          <table className="w-full text-left mb-4">
            <thead>
              <tr className="bg-gray-200">
                <th className="px-4 py-2">Tên</th>
                <th className="px-4 py-2">SL</th>
                <th className="px-4 py-2">Tổng</th>
              </tr>
            </thead>
            <tbody>
              {dataCart?.products?.map((item) => (
                <tr key={item._id}>
                  <td className="px-4 py-2">{item.nameProduct}</td>
                  <td className="px-4 py-2">x{item.quantity}</td>
                  <td className="px-4 py-2">{item.price?.toLocaleString()}₫</td>
                </tr>
              ))}
              <tr className="border-t">
                <td className="px-4 py-2 font-medium">Tạm Tính</td>
                <td></td>
                <td className="px-4 py-2">{subtotal.toLocaleString()}₫</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium">Phí Vận Chuyển</td>
                <td></td>
                <td className="px-4 py-2">{BASE_SHIPPING_FEE.toLocaleString()}₫</td>
              </tr>
              {appliedVoucher && (
                <tr>
                  <td className="px-4 py-2 font-medium text-green-700">Giảm: {appliedVoucher.code}</td>
                  <td></td>
                  <td className="px-4 py-2 text-red-600">- {discountAmount.toLocaleString()}₫</td>
                </tr>
              )}
              <tr className="border-t font-bold">
                <td className="px-4 py-2">Tổng Cộng</td>
                <td></td>
                <td className="px-4 py-2">{total.toLocaleString()}₫</td>
              </tr>
            </tbody>
          </table>

          <div className="flex gap-2 mb-4">
            <input type="text" placeholder="Nhập mã giảm giá" value={voucherCode} onChange={(e) => setVoucherCode(e.target.value.toUpperCase())} className="border rounded px-3 py-2 flex-1" />
            <button onClick={handleApplyVoucher} className="bg-green-600 text-white px-4 py-2 rounded">Áp dụng</button>
            {appliedVoucher && <button onClick={removeVoucher} className="text-red-600">Xóa</button>}
          </div>

          <div className="flex items-center gap-2 mb-4">
            <input type="checkbox" onChange={(e) => setCheckBox(e.target.checked)} />
            <label className="text-sm">Vui lòng chấp nhận điều khoản</label>
          </div>

          <button onClick={handlePaymentMomo} className="w-full h-14 bg-blue-600 text-white rounded-lg mb-3">Thanh Toán Qua VNPAY</button>
          <button onClick={handlePayment} className="w-full h-14 bg-red-600 text-white rounded-lg">Thanh Toán Khi Nhận Hàng</button>
        </div>
      </main>
    </div>
  );
}
