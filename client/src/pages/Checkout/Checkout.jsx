// client/src/pages/Checkout/Checkout.jsx
import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { computeExpiryInfo, fmtDate } from "../../utils/expiryHelpers"; // ✅ đúng path

export default function Checkout() {
  const location = useLocation();
  const selectedItems = location.state?.selectedItems;
  const navigate = useNavigate();

  const [dataCart, setDataCart] = useState(null);
  const [checkBox, setCheckBox] = useState(false);

  // Voucher
  const [voucherCode, setVoucherCode] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const [discountAmount, setDiscountAmount] = useState(0);

  // Địa chỉ + ship
  const [defaultAddress, setDefaultAddress] = useState(null);
  const [shippingFee, setShippingFee] = useState(0);
  const [shippingLabel, setShippingLabel] = useState("");
  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ---- helper: fetch theo id, thử cả /product và /products để tương thích router
  const fetchProductByIdSmart = async (id) => {
    try {
      const r1 = await axios.get(`http://localhost:3000/api/product/${id}`);
      return r1.data;
    } catch (e1) {
      try {
        const r2 = await axios.get(`http://localhost:3000/api/products/${id}`);
        return r2.data;
      } catch (e2) {
        throw e1 || e2;
      }
    }
  };

  // ==== Lấy thông tin sản phẩm để hiển thị HSD & tính giảm giá ====
  const hydrateSelectedItems = async (items) => {
    const results = await Promise.all(
      items.map(async (it) => {
        try {
          const productId = it?.product?._id;
          const prod = await fetchProductByIdSmart(productId);

          // xác định biến thể
          const vId = it?.variant?._id;
          const vAttrs = it?.variant?.attributes || it?.variantInfo || {};
          const matched =
            (Array.isArray(prod?.variants) &&
              (vId
                ? prod.variants.find((v) => String(v._id) === String(vId))
                : prod.variants.find(
                    (v) =>
                      v.attributes?.weight === vAttrs.weight &&
                      v.attributes?.ripeness === vAttrs.ripeness
                  ))) ||
            null;

          const originalVariantPrice = Number(
            matched?.price ?? it?.variant?.price ?? 0
          );

          // tính thông tin HSD/giảm giá từ helper FE
          const ex = computeExpiryInfo(prod);
          const percent = ex?.isNearExpiry ? Number(ex.discountPercent || 0) : 0;

          // Nếu đi từ ProductDetail, variant.price đã là FINAL (đã giảm)
          const priceFromPD = Number(it?.variant?.price ?? 0);
          let priceFinal;
          let priceBase;

          if (priceFromPD && priceFromPD > 0 && priceFromPD <= originalVariantPrice) {
            priceFinal = priceFromPD;
            priceBase = originalVariantPrice; // để gạch giá
          } else {
            // tự áp giảm nếu cận hạn
            priceBase = originalVariantPrice;
            priceFinal =
              percent > 0
                ? Math.max(0, Math.round(originalVariantPrice * (1 - percent / 100)))
                : originalVariantPrice;
          }

          return {
            _id: productId,
            nameProduct: prod?.name,
            // hiển thị
            priceBase,
            priceFinal,
            discountPercent: percent,
            expireAt: ex?.expireAt || null,
            daysLeft: typeof ex?.daysLeft === "number" ? ex.daysLeft : null,
            // quantity + variant
            quantity: Number(it?.quantity || 1),
            variantInfo: {
              weight: vAttrs.weight,
              ripeness: vAttrs.ripeness,
            },
          };
        } catch (err) {
          console.error("Hydrate item failed:", err);
          // fallback an toàn nếu fetch lỗi
          return {
            _id: it?.product?._id,
            nameProduct: it?.product?.name || "Sản phẩm",
            priceBase: Number(it?.variant?.price || 0),
            priceFinal: Number(it?.variant?.price || 0),
            discountPercent: 0,
            expireAt: null,
            daysLeft: null,
            quantity: Number(it?.quantity || 1),
            variantInfo: it?.variant?.attributes || it?.variantInfo || {},
          };
        }
      })
    );

    return { products: results };
  };

  // ====== KHỞI TẠO GIỎ HÀNG TỪ selectedItems (dùng priceFinal) ======
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/dang-nhap");
      return;
    }

    (async () => {
      if (selectedItems && selectedItems.length > 0) {
        const formatted = await hydrateSelectedItems(selectedItems);
        setDataCart(formatted);
      } else {
        navigate("/gio-hang");
      }
    })();
  }, [selectedItems, navigate]);

  // ====== TÍNH SUBTOTAL/TOTAL (theo finalPrice) ======
  const subtotal = useMemo(() => {
    if (!dataCart?.products?.length) return 0;
    return dataCart.products.reduce((sum, it) => {
      const unit = Number(it?.priceFinal || it?.price || 0);
      const line = unit * Number(it?.quantity || 0);
      return sum + line;
    }, 0);
  }, [dataCart]);

  const total = Math.max(0, subtotal + (shippingFee || 0) - (discountAmount || 0));

  // ====== LẤY ĐỊA CHỈ MẶC ĐỊNH ======
  useEffect(() => {
    const fetchDefaultAddress = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        const headers = { Authorization: `Bearer ${token}` };

        const userRes = await axios.get("http://localhost:3000/auth/profile", {
          headers,
        });
        const user = userRes.data;
        const defaultAddressId = user?.defaultAddressId;

        if (defaultAddressId) {
          const addressRes = await axios.get(
            `http://localhost:3000/api/address/${defaultAddressId}`,
            { headers }
          );
          setDefaultAddress(addressRes.data);
        } else {
          const addressesRes = await axios.get(
            "http://localhost:3000/api/address",
            { headers }
          );
          const list = addressesRes.data || [];
          const def = list.find((a) => a.isDefault) || null;
          setDefaultAddress(def);
        }
      } catch (err) {
        console.error("Lỗi khi lấy địa chỉ mặc định:", err);
        setDefaultAddress(null);
      }
    };
    fetchDefaultAddress();
  }, []);

  // ====== QUOTE PHÍ SHIP ======
  useEffect(() => {
    const quote = async () => {
      if (!defaultAddress?._id) {
        setShippingFee(0);
        setShippingLabel("");
        return;
      }
      try {
        setQuoting(true);
        const token = localStorage.getItem("token");
        const headers = { Authorization: `Bearer ${token}` };

        const res = await axios.get(
          "http://localhost:3000/api/orders/shipping/quote",
          {
            headers,
            params: { addressId: defaultAddress._id, subtotal },
          }
        );

        const data = res?.data?.data || {};
        setShippingFee(Number(data.amount || 0));

        const lbl =
          data.label || (Number(data.amount) === 0 ? "Freeship" : "Ngoại thành");
        setShippingLabel(lbl);
      } catch (e) {
        console.error("Quote shipping error:", e?.response?.data || e);
        setShippingFee(0);
        setShippingLabel("Ngoại thành");
      } finally {
        setQuoting(false);
      }
    };
    quote();
  }, [defaultAddress?._id, subtotal]);

  // ====== ÁP MÃ GIẢM GIÁ ======
  const handleApplyVoucher = async () => {
    if (!voucherCode) return;
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const response = await axios.get(
        `http://localhost:3000/api/voucher/validate/${encodeURIComponent(
          voucherCode
        )}`,
        { headers }
      );

      const raw = response.data;
      const voucher = raw?.data || raw;

      if (!voucher || voucher.discount == null) {
        throw new Error("Voucher không hợp lệ");
      }

      let discount = 0;
      const discountVal = Number(voucher.discount);

      if (discountVal > 0 && discountVal <= 100) {
        discount = subtotal * (discountVal / 100);
      } else {
        discount = discountVal;
      }

      const maxDiscount = Number(voucher.maxDiscount || 0);
      if (maxDiscount > 0) discount = Math.min(discount, maxDiscount);

      discount = Math.min(Math.round(discount), subtotal);

      setAppliedVoucher({ code: voucher.code, discount: discountVal });
      setDiscountAmount(discount);
    } catch (err) {
      console.error("Lỗi khi áp dụng mã giảm giá:", err?.response?.data || err);
      alert(err?.response?.data?.message || "Mã giảm giá không hợp lệ hoặc đã hết hạn.");
      setAppliedVoucher(null);
      setDiscountAmount(0);
    }
  };

  const removeVoucher = () => {
    setAppliedVoucher(null);
    setVoucherCode("");
    setDiscountAmount(0);
  };

  const buildCartItems = () => {
    return (dataCart?.products || []).map((item) => ({
      productId: item._id,
      quantity: item.quantity,
      variant: {
        weight: item?.variantInfo?.weight,
        ripeness: item?.variantInfo?.ripeness,
      },
    }));
  };

  // ====== GỬI ĐƠN COD ======
  const handlePayment = async () => {
    if (!checkBox) return alert("Vui lòng chấp nhận điều khoản");
    if (!defaultAddress?._id) return alert("Chưa có địa chỉ giao hàng.");

    try {
      setSubmitting(true);
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const payload = {
        cartItems: buildCartItems(),
        voucher: appliedVoucher?.code || null,
        address: { _id: defaultAddress._id },
        paymentMethod: "cod",
      };

      await axios.post("http://localhost:3000/api/orders/add", payload, {
        headers,
      });

      alert("Đặt hàng thành công!");
      navigate("/order-success");
    } catch (error) {
      console.error("Lỗi đặt hàng COD:", error?.response?.data || error);
      alert(error?.response?.data?.message || "Đặt hàng thất bại.");
    } finally {
      setSubmitting(false);
    }
  };

  // ====== GỬI ĐƠN MOMO ======
  const handlePaymentMomo = async () => {
    if (!checkBox) return alert("Vui lòng chấp nhận điều khoản");
    if (!defaultAddress?._id) return alert("Chưa có địa chỉ giao hàng.");

    try {
      setSubmitting(true);
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const payload = {
        cartItems: buildCartItems(),
        voucher: appliedVoucher?.code || null,
        address: { _id: defaultAddress._id },
        paymentMethod: "momo",
        shippingAddress: {
          fullName: defaultAddress.fullName,
          phone: defaultAddress.phone,
          addressLine: defaultAddress.detail,
          wardName: defaultAddress.ward,
          districtName: defaultAddress.district,
          provinceName: defaultAddress.province,
        },
        shippingFee,
      };

      const response = await axios.post(
        "http://localhost:3000/api/momo/create-payment",
        payload,
        { headers }
      );

      if (response.data?.paymentUrl) {
        window.location.href = response.data.paymentUrl;
      } else {
        alert("Không thể tạo thanh toán MoMo");
      }
    } catch (err) {
      console.error("Lỗi MoMo:", err?.response?.data || err);
      alert(err?.response?.data?.message || "Thanh toán MoMo thất bại.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-[85%] mx-auto my-5">
      <div className="mb-4 text-left">
        <Link
          to="/gio-hang"
          className="text-blue-600 hover:underline flex items-center gap-1"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Quay lại Giỏ hàng
        </Link>
      </div>

      <main className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <h1 className="text-lg font-bold mb-4">Địa Chỉ Nhận Hàng</h1>
          {defaultAddress ? (
            <div className="bg-white border rounded p-4">
              <p className="font-medium">
                {defaultAddress.fullName} | {defaultAddress.phone}
              </p>
              <p>
                {defaultAddress.detail}, {defaultAddress.ward},{" "}
                {defaultAddress.district}, {defaultAddress.province}
              </p>
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
              {dataCart?.products?.map((it) => {
                const unit = Number(it?.priceFinal || 0);
                const line = unit * Number(it?.quantity || 0);
                const showOld =
                  typeof it?.priceBase === "number" && unit < it.priceBase;

                return (
                  <tr
                    key={`${it._id}-${it?.variantInfo?.weight}-${it?.variantInfo?.ripeness}`}
                  >
                    <td className="px-4 py-2">
                      <div className="font-medium">{it?.nameProduct}</div>
                      {it?.variantInfo && (
                        <div className="text-sm text-gray-500">
                          ({it?.variantInfo?.weight} / {it?.variantInfo?.ripeness})
                        </div>
                      )}

                      {/* HSD + badge cận hạn */}
                      <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                        {it?.expireAt && <span>Ngày hết hạn: {fmtDate(it.expireAt)}</span>}
                        {Number.isFinite(it?.daysLeft) && it.daysLeft >= 0 && (
                          <span className="bg-yellow-500 text-white px-1.5 py-0.5 rounded">
                            Còn {it.daysLeft} ngày
                          </span>
                        )}
                      </div>

                      {/* Giá đơn vị + giá gạch nếu có giảm */}
                      <div className="mt-1">
                        <span className="text-red-600 font-semibold">
                          {unit.toLocaleString("vi-VN")}₫
                        </span>
                        {showOld && (
                          <span className="text-gray-500 line-through text-sm ml-2">
                            {Number(it.priceBase).toLocaleString("vi-VN")}₫
                          </span>
                        )}
                        {it?.discountPercent > 0 && (
                          <span className="ml-2 text-xs text-red-600 font-semibold">
                            -{it.discountPercent}%
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-2">x{it?.quantity}</td>

                    <td className="px-4 py-2">
                      {line.toLocaleString("vi-VN")}₫
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t">
                <td className="px-4 py-2 font-medium">Tạm Tính</td>
                <td></td>
                <td className="px-4 py-2">
                  {subtotal.toLocaleString("vi-VN")}₫
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium">
                  Phí Vận Chuyển{" "}
                  {shippingLabel && (
                    <span className="text-xs text-gray-600">
                      ({shippingLabel})
                    </span>
                  )}
                </td>
                <td></td>
                <td className="px-4 py-2">
                  {quoting
                    ? "Đang tính..."
                    : `${(shippingFee || 0).toLocaleString("vi-VN")}₫`}
                </td>
              </tr>
              {appliedVoucher && (
                <tr>
                  <td className="px-4 py-2 font-medium text-green-700">
                    Giảm: {appliedVoucher.code}
                  </td>
                  <td></td>
                  <td className="px-4 py-2 text-red-600">
                    - {discountAmount.toLocaleString("vi-VN")}₫
                  </td>
                </tr>
              )}
              <tr className="border-t font-bold">
                <td className="px-4 py-2">Tổng Cộng</td>
                <td></td>
                <td className="px-4 py-2">{total.toLocaleString("vi-VN")}₫</td>
              </tr>
            </tbody>
          </table>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="Nhập mã giảm giá"
              value={voucherCode}
              onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
              className="border rounded px-3 py-2 flex-1"
            />
            <button
              onClick={handleApplyVoucher}
              className="bg-green-600 text-white px-4 py-2 rounded"
              disabled={!voucherCode}
            >
              Áp dụng
            </button>
            {appliedVoucher && (
              <button onClick={removeVoucher} className="text-red-600">
                Xóa
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 mb-4">
            <input
              type="checkbox"
              onChange={(e) => setCheckBox(e.target.checked)}
            />
            <label className="text-sm">Vui lòng chấp nhận điều khoản</label>
          </div>

          <button
            onClick={handlePaymentMomo}
            className="w-full h-14 bg-blue-600 text-white rounded-lg mb-3 disabled:opacity-60"
            disabled={submitting || !dataCart?.products?.length}
          >
            Thanh Toán Qua MOMO
          </button>
          <button
            onClick={handlePayment}
            className="w-full h-14 bg-red-600 text-white rounded-lg disabled:opacity-60"
            disabled={submitting || !dataCart?.products?.length}
          >
            Thanh Toán Khi Nhận Hàng
          </button>
        </div>
      </main>
    </div>
  );
}
