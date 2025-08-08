import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useLocation, useNavigate } from 'react-router-dom';

export default function Checkout() {
  const location = useLocation();
  const selectedItems = location.state?.selectedItems;
  const navigate = useNavigate();
  const [dataCart, setDataCart] = useState(null);
  const [checkBox, setCheckBox] = useState(false);
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [defaultAddress, setDefaultAddress] = useState(null);

  const BASE_SHIPPING_FEE = 30000;

  useEffect(() => {
    if (selectedItems && selectedItems.length > 0) {
      const formattedData = {
        products: selectedItems.map((item) => ({
          _id: item.product._id,
          nameProduct: item.product.name,
          price: item.variant.price,
          quantity: item.quantity,
          variantInfo: item.variant.attributes
        })),
      };
      setDataCart(formattedData);
    } else {
      navigate("/gio-hang");
    }
  }, [selectedItems, navigate]);

  useEffect(() => {
    const fetchDefaultAddress = async () => {
      try {
        const res = await axios.get('http://localhost:3000/api/address', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        });
        const addressList = res.data;
        const defaultAddr = addressList.find(a => a.isDefault);
        setDefaultAddress(defaultAddr || null);
      } catch (err) {
        console.error("Lỗi khi lấy địa chỉ:", err);
      }
    };
    fetchDefaultAddress();
  }, []);

  const subtotal = dataCart?.products?.reduce((sum, item) => sum + (item.price * item.quantity), 0) || 0;
  const total = Math.max(0, subtotal + BASE_SHIPPING_FEE - discountAmount);

  const handleApplyVoucher = async () => {
    if (!voucherCode) return;
    try {
      const response = await axios.get(`http://localhost:3000/api/voucher/validate/${encodeURIComponent(voucherCode)}`);
      const voucher = response.data;
      let discount = 0;
      if (voucher.discount > 0 && voucher.discount <= 100) {
        discount = subtotal * (voucher.discount / 100);
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

  const buildShippingAddress = () => {
    if (!defaultAddress) return null;
    return {
      fullName: defaultAddress.fullName,
      phone: defaultAddress.phone,
      province: defaultAddress.province,
      district: defaultAddress.district,
      ward: defaultAddress.ward,
      detail: defaultAddress.detail,
    };
  };

  const handlePayment = async () => {
    if (!checkBox) return alert("Vui lòng chấp nhận điều khoản");
    try {
      const cartItems = dataCart.products.map(item => ({
        productId: item._id,
        quantity: item.quantity,
        variant: {
          weight: item.variantInfo?.weight,
          ripeness: item.variantInfo?.ripeness
        }
      }));

      const response = await axios.post('http://localhost:3000/api/orders/add', {
        cartItems,
        voucher: appliedVoucher?.code || null,
        address: buildShippingAddress(),
        paymentMethod: "cod"
      }, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        }
      });

      alert("Đặt hàng thành công!");
      navigate('/order-success');
    } catch (error) {
      console.error("Lỗi đặt hàng COD:", error);
      alert("Đặt hàng thất bại.");
    }
  };

  const handlePaymentMomo = async () => {
  if (!checkBox) return alert("Vui lòng chấp nhận điều khoản");

  try {
    const cartItems = dataCart.products.map(item => ({
      productId: item._id,
      quantity: item.quantity,
      variant: {
        weight: item.variantInfo?.weight,
        ripeness: item.variantInfo?.ripeness
      }
    }));

    const response = await axios.post('http://localhost:3000/api/momo/create-payment', {
      cartItems,
      voucher: appliedVoucher?.code || null,
      address: buildShippingAddress(),
      paymentMethod: "momo"
    }, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      }
    });

    if (response.data.paymentUrl) {
      window.location.href = response.data.paymentUrl;
    } else {
      alert("Không thể tạo thanh toán MoMo");
    }
  } catch (err) {
    console.error("Lỗi MoMo:", err);
    alert("Thanh toán MoMo thất bại.");
  }
};


  const removeVoucher = () => {
    setAppliedVoucher(null);
    setVoucherCode('');
    setDiscountAmount(0);
  };

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
          <h1 className="text-lg font-bold mb-4">Địa Chỉ Nhận Hàng</h1>
          {defaultAddress ? (
            <div className="bg-white border rounded p-4">
              <p className="font-medium">{defaultAddress.fullName} | {defaultAddress.phone}</p>
              <p>{defaultAddress.detail}, {defaultAddress.ward}, {defaultAddress.district}, {defaultAddress.province}</p>
            </div>
          ) : (
            <p className="text-red-600">Không tìm thấy địa chỉ mặc định.</p>
          )}
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
                <tr key={`${item._id}-${item.variantInfo?.weight}-${item.variantInfo?.ripeness}`}>
                  <td className="px-4 py-2">
                    {item.nameProduct}
                    {item.variantInfo && (
                      <span className="block text-sm text-gray-500">
                        ({item.variantInfo.weight} / {item.variantInfo.ripeness})
                      </span>
                    )}
                  </td>
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

          <button onClick={handlePaymentMomo} className="w-full h-14 bg-blue-600 text-white rounded-lg mb-3">Thanh Toán Qua MOMO</button>
          <button onClick={handlePayment} className="w-full h-14 bg-red-600 text-white rounded-lg">Thanh Toán Khi Nhận Hàng</button>
        </div>
      </main>
    </div>
  );
}