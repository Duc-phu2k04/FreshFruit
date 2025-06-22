import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

export default function Checkout({ dataCart, handlePayment, handlePaymentMomo }) {
    const [name, setName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [email, setEmail] = useState('');
    const [provinceCode, setProvinceCode] = useState('');
    const [districtCode, setDistrictCode] = useState('');
    const [wardCode, setWardCode] = useState('');
    const [address, setAddress] = useState('');
    const [checkBox, setCheckBox] = useState(false);
    const [appliedDiscount, setAppliedDiscount] = useState(null);
    const [discountAmount, setDiscountAmount] = useState(0);

    const [data, setData] = useState([]);
    const [districts, setDistricts] = useState([]);
    const [wards, setWards] = useState([]);

    // --- Shipping Fee Constant ---
    const BASE_SHIPPING_FEE = 30000; // Example base shipping fee in VND
    // ----------------------------

    // --- Example Discount Data ---
    const availableDiscounts = [
        { code: 'SALE10', name: 'Giảm 10% đơn hàng', type: 'percentage', value: 0.10 },
        { code: 'FREESHIP', name: 'Miễn phí vận chuyển', type: 'fixed', value: BASE_SHIPPING_FEE }, // Uses BASE_SHIPPING_FEE
        { code: 'SUMMER20', name: 'Giảm 20k cho đơn trên 200k', type: 'fixed', value: 20000, minOrder: 200000 },
    ];
    // ----------------------------

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

    const applyDiscount = (discount) => {
        let calculatedAmount = 0;
        const currentSumPrice = dataCart?.sumPrice || 0;

        if (discount.minOrder && currentSumPrice < discount.minOrder) {
            alert(`Đơn hàng của bạn chưa đủ điều kiện để áp dụng mã "${discount.name}". Cần tối thiểu ${discount.minOrder.toLocaleString()} VND.`);
            setAppliedDiscount(null);
            setDiscountAmount(0);
            return;
        }

        if (discount.type === 'percentage') {
            calculatedAmount = currentSumPrice * discount.value;
        } else if (discount.type === 'fixed') {
            calculatedAmount = discount.value;
        }

        setDiscountAmount(calculatedAmount);
        setAppliedDiscount(discount);
    };

    const removeDiscount = () => {
        setAppliedDiscount(null);
        setDiscountAmount(0);
    };

    // Calculate total before final discount, including shipping
    const subtotalWithShipping = (dataCart?.sumPrice || 0) + BASE_SHIPPING_FEE;

    // Calculate final price after all deductions
    const finalPrice = subtotalWithShipping - discountAmount;

    return (
        <div className="w-[85%] mx-auto my-5">
            <div className="mb-4 text-left">
                <Link to="/cart" className="text-blue-600 hover:underline flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Quay lại Giỏ hàng
                </Link>
            </div>
            <main className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Thông tin thanh toán */}
                <div>
                    <h1 className="text-lg font-extrabold text-[#2a2a2a] border-b border-gray-300 pb-4 mb-4">
                        Thông Tin Thanh Toán
                    </h1>

                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col md:flex-row gap-4">
                            <input
                                type="text"
                                placeholder="Nhập họ tên"
                                onChange={(e) => setName(e.target.value)}
                                className="flex-1 border border-gray-300 rounded-md px-4 py-2"
                            />
                        </div>

                        <div className="flex flex-col md:flex-row gap-4">
                            <input
                                type="text"
                                placeholder="Số điện thoại"
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                className="flex-1 border border-gray-300 rounded-md px-4 py-2"
                            />
                            <input
                                type="email"
                                placeholder="Email"
                                onChange={(e) => setEmail(e.target.value)}
                                className="flex-1 border border-gray-300 rounded-md px-4 py-2"
                            />
                        </div>

                        {/* Chọn tỉnh / huyện / xã */}
                        <select
                            className="border border-gray-300 rounded-md px-4 py-2"
                            value={provinceCode}
                            onChange={(e) => setProvinceCode(e.target.value)}
                        >
                            <option value="">Chọn Tỉnh/Thành</option>
                            {data.map(p => (
                                <option key={p.code} value={p.code}>{p.name}</option>
                            ))}
                        </select>

                        <select
                            className="border border-gray-300 rounded-md px-4 py-2"
                            value={districtCode}
                            onChange={(e) => setDistrictCode(e.target.value)}
                            disabled={!provinceCode}
                        >
                            <option value="">Chọn Quận/Huyện</option>
                            {districts.map(d => (
                                <option key={d.code} value={d.code}>{d.name}</option>
                            ))}
                        </select>

                        <select
                            className="border border-gray-300 rounded-md px-4 py-2"
                            value={wardCode}
                            onChange={(e) => setWardCode(e.target.value)}
                            disabled={!districtCode}
                        >
                            <option value="">Chọn Phường/Xã</option>
                            {wards.map(w => (
                                <option key={w.code} value={w.code}>{w.name}</option>
                            ))}
                        </select>

                        <input
                            type="text"
                            placeholder="Địa chỉ nhận hàng"
                            onChange={(e) => setAddress(e.target.value)}
                            className="border border-gray-300 rounded-md px-4 py-2"
                        />
                    </div>
                </div>

                {/* Đơn hàng */}
                <div className="bg-gray-100 rounded-xl p-5">
                    <h1 className="text-lg font-extrabold text-[#2a2a2a] border-b border-gray-300 pb-4 mb-4">
                        Sản Phẩm Thanh Toán
                    </h1>

                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left border border-gray-200 mb-4">
                            <thead>
                                <tr className="bg-gray-100 text-sm font-medium text-gray-700">
                                    <th className="px-4 py-2 border">Tên Sản Phẩm</th>
                                    <th className="px-4 py-2 border">Số Lượng</th>
                                    <th className="px-4 py-2 border">Tổng</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dataCart?.products?.map((item) => (
                                    <tr key={item?._id} className="border-t">
                                        <td className="px-4 py-2">{item?.nameProduct}</td>
                                        <td className="px-4 py-2">x {item?.quantity}</td>
                                        <td className="px-4 py-2">$ {item.price?.toLocaleString()}</td>
                                    </tr>
                                ))}
                                <tr className="font-semibold bg-gray-50 border-t">
                                    <td className="px-4 py-2">Tạm Tính</td>
                                    <td></td>
                                    <td className="px-4 py-2">$ {dataCart?.sumPrice?.toLocaleString()}</td>
                                </tr>
                                {/* Shipping Fee Row */}
                                <tr className="font-semibold bg-gray-50 border-t">
                                    <td className="px-4 py-2">Phí Vận Chuyển</td>
                                    <td></td>
                                    <td className="px-4 py-2">$ {BASE_SHIPPING_FEE.toLocaleString()}</td>
                                </tr>
                                {/* Discount Card Section */}
                                <tr className="border-t">
                                    <td className="px-4 py-2" colSpan="3">
                                        <h3 className="font-semibold mb-2">Mã Giảm Giá</h3>
                                        {appliedDiscount ? (
                                            <div className="flex items-center justify-between bg-green-100 border border-green-300 rounded-md p-2 text-sm">
                                                <span>Đã áp dụng: **{appliedDiscount.name}**</span>
                                                <button
                                                    onClick={removeDiscount}
                                                    className="ml-2 text-red-600 hover:text-red-800 font-bold"
                                                >
                                                    Xóa
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {availableDiscounts.map(discount => (
                                                    <button
                                                        key={discount.code}
                                                        onClick={() => applyDiscount(discount)}
                                                        // Disable button if discount is not applicable (e.g., min order not met)
                                                        disabled={discount.minOrder && (dataCart?.sumPrice || 0) < discount.minOrder}
                                                        className={`bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-left transition-colors duration-200 ${discount.minOrder && (dataCart?.sumPrice || 0) < discount.minOrder
                                                            ? 'opacity-50 cursor-not-allowed'
                                                            : 'hover:bg-gray-50'
                                                            }`}
                                                    >
                                                        <span className="font-medium text-blue-700">{discount.code}</span> - {discount.name}
                                                        {discount.minOrder && (dataCart?.sumPrice || 0) < discount.minOrder && (
                                                            <p className="text-red-500 text-xs mt-1">Cần tối thiểu {(discount.minOrder || 0).toLocaleString()} VND</p>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                                {discountAmount > 0 && (
                                    <tr className="font-semibold bg-gray-50 border-t">
                                        <td className="px-4 py-2">Giảm giá</td>
                                        <td></td>
                                        <td className="px-4 py-2">-$ {discountAmount?.toLocaleString()}</td>
                                    </tr>
                                )}
                                <tr className="font-bold bg-gray-100 border-t">
                                    <td className="px-4 py-2">Tổng Cộng</td>
                                    <td></td>
                                    <td className="px-4 py-2">$ {finalPrice?.toLocaleString()}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="flex flex-col gap-4">
                        <div className="flex items-start gap-2">
                            <input
                                type="checkbox"
                                onChange={(e) => setCheckBox(e.target.checked)}
                                className="mt-1"
                            />
                            <label className="text-sm font-bold">
                                Vui lòng chấp nhận điều khoản của chúng tôi
                            </label>
                        </div>

                        <button
                            onClick={handlePaymentMomo}
                            className="w-full h-14 bg-gradient-to-r from-[#005baa] to-[#009edb] rounded-lg text-white font-semibold flex items-center justify-center gap-2 cursor-pointer"
                        >
                            <img
                                src="https://cdn.haitrieu.com/wp-content/uploads/2022/10/Icon-VNPAY-QR.png"
                                alt="vnpay"
                                className="w-6 h-6"
                            />
                            <span>Thanh Toán Qua VNPAY</span>
                        </button>

                        <button
                            onClick={handlePayment}
                            className="w-full h-14 bg-[#ff2020] rounded-lg text-white font-semibold cursor-pointer"
                        >
                            Thanh Toán Khi Nhận Hàng
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}