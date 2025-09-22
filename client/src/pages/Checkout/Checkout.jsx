// client/src/pages/Checkout/Checkout.jsx
import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { computeExpiryInfo, fmtDate } from "../../utils/expiryHelpers";
import { useCart } from "../../context/CartContext";

/* ================= Base config ================= */
const API_URL = import.meta?.env?.VITE_API_URL || "http://localhost:3000";
const PROVINCES_BASES = [
  "https://provinces.open-api.vn/api/v1",
  "https://provinces.open-api.vn/api",
];
const HANOI_CODE = 1;

/* ============ Helpers ============ */
const codeVariants = (code) => {
  const s = String(code ?? "").trim();
  if (!s) return [];
  const arr = [s];
  if (/^\d+$/.test(s)) {
    const p3 = s.padStart(3, "0");
    if (!arr.includes(p3)) arr.push(p3);
  }
  return arr;
};

const tokenHeaders = () => {
  const token = localStorage.getItem("token");
  return { Authorization: `Bearer ${token}` };
};

// Chuẩn hóa địa chỉ gửi BE
const buildAddressPayload = (addr) => {
  if (!addr) return null;
  return {
    fullName: addr.fullName || addr.name || "",
    phone: addr.phone || addr.phoneNumber || "",
    province: addr.province || addr.provinceName || "Hà Nội",
    district: addr.district || addr.districtName || "",
    ward: addr.ward || addr.wardName || "",
    detail: addr.detail || addr.address || addr.street || "",
    districtCode: addr.districtCode || addr.district_code || "",
    wardCode: addr.wardCode || addr.ward_code || "",
    _id: addr._id || undefined,
  };
};

// ---- fetch theo id, thử cả /product và /products để tương thích router
const fetchProductByIdSmart = async (id) => {
  try {
    const r1 = await axios.get(`${API_URL}/api/product/${id}`);
    return r1.data;
  } catch (e1) {
    try {
      const r2 = await axios.get(`${API_URL}/api/products/${id}`);
      return r2.data;
    } catch (e2) {
      throw e1 || e2;
    }
  }
};

// ---- quote combo (giá combo)
const fetchComboQuote = async (comboProductId) => {
  try {
    const res = await axios.post(`${API_URL}/api/product/combo-quote`, {
      comboProductId,
    });
    const raw = res?.data;
    const q = raw?.data || raw || {};
    return {
      subtotal: Number(q.subtotal || 0),
      discountPercent: Number(q.discountPercent || 0),
      total: Number(q.total || 0),
      title: q.title || "",
      image: q.image || null,
      items: Array.isArray(q.items) ? q.items : [], // [{productId, qty}]
    };
  } catch {
    return null;
  }
};

/* ============ BOX/LOOSE helpers cho tồn kho (hàng thường) ============ */
const parseKgFromLabel = (label = "") => {
  const s = String(label || "").toLowerCase().replace(",", ".").replace(/\s+/g, "");
  const mKg = s.match(/([\d.]+)\s*kg/);
  if (mKg && Number.isFinite(Number(mKg[1]))) return Number(mKg[1]);
  const mG = s.match(/([\d.]+)\s*g/);
  if (mG && Number.isFinite(Number(mG[1]))) return Number(mG[1]) / 1000;
  const m2 = s.match(/([\d.]+)/);
  if (m2 && Number.isFinite(Number(m2[1]))) return Number(m2[1]);
  return NaN;
};

const isBoxVariant = (variant) => {
  if (!variant) return false;
  if (variant?.kind === "box") return true;
  if (Number(variant?.attributes?.boxWeightKg || 0) > 0) return true;
  const w = String(variant?.attributes?.weight || "").toLowerCase();
  if (/thùng|crate|box/.test(w)) return true;
  return false;
};

const kgPerBox = (variant) => {
  const metaKg = Number(variant?.attributes?.boxWeightKg || 0);
  if (metaKg > 0) return metaKg;
  const fromLabel = parseKgFromLabel(variant?.attributes?.weight || "");
  if (Number.isFinite(fromLabel) && fromLabel > 0) return fromLabel;
  return 1;
};

const computeTotalLooseKg = (product) => {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  let totalKg = 0;
  for (const v of variants) {
    if (isBoxVariant(v)) continue;
    const wKg = parseKgFromLabel(v?.attributes?.weight || "");
    const unitKg = Number.isFinite(wKg) && wKg > 0 ? wKg : 1;
    const stock = Number(v?.stock || 0);
    totalKg += unitKg * Math.max(0, stock);
  }
  return Math.max(0, Math.floor(totalKg * 1000) / 1000);
};

const computeEffectiveStockForVariant = (product, variant) => {
  if (!variant) return 0;
  if (!isBoxVariant(variant)) {
    return Math.max(0, Number(variant?.stock || 0));
  }
  if (product && product._stockLinked) {
    return Math.max(0, Number(variant?.stock || 0));
  }
  const totalLooseKg = computeTotalLooseKg(product);
  const perBox = kgPerBox(variant);
  const derivedBoxes = Math.floor(Math.max(0, totalLooseKg) / Math.max(1e-9, perBox));
  const stored = Number(variant?.stock || 0);
  return stored > 0 ? Math.min(derivedBoxes, stored) : derivedBoxes;
};

/* ================================================================ */

export default function Checkout() {
  const location = useLocation();
  const selectedItems = location.state?.selectedItems;
  const navigate = useNavigate();

  // Cart context (để lấy Giỏ Mix)
  const { cartItems } = useCart();
  const mixLines = useMemo(
    () => (cartItems || []).filter((it) => it?.type === "mix"),
    [cartItems]
  );

  const [dataCart, setDataCart] = useState(null);
  const [checkBox, setCheckBox] = useState(false);

  // Voucher
  const [voucherCode, setVoucherCode] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const [discountAmount, setDiscountAmount] = useState(0);

  // Địa chỉ + ship (danh sách, chọn, thêm mới)
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [showAddressForm, setShowAddressForm] = useState(true);
  const [shippingFee, setShippingFee] = useState(0);
  const [shippingLabel, setShippingLabel] = useState("");
  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Thêm địa chỉ
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAddressForm, setNewAddressForm] = useState({
    fullName: "",
    phone: "",
    province: "",
    district: "",
    ward: "",
    detail: "",
    districtCode: "",
    wardCode: "",
  });
  const [districts, setDistricts] = useState([]);
  const [wards, setWards] = useState([]);

  const selectedAddress = addresses.find((a) => a._id === selectedAddressId) || null;

  /* ================== Địa giới hành chính (Hà Nội) ================== */
  useEffect(() => {
    (async () => {
      try {
        for (const base of PROVINCES_BASES) {
          const url = `${base}/p/${HANOI_CODE}?depth=2`;
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            const ds = (data.districts || []).map((d) => ({
              ...d,
              code: String(d.code),
            }));
            setDistricts(ds);
            break;
          }
        }
      } catch (err) {
        console.error("Lỗi tải districts:", err);
      }
    })();
  }, []);

  const handleDistrictChange = async (districtCode) => {
    const variants = codeVariants(districtCode);
    if (variants.length === 0) return;
    for (const variant of variants) {
      for (const base of PROVINCES_BASES) {
        try {
          const url = `${base}/d/${variant}?depth=2`;
          const res = await fetch(url);
          const ok = res && res.ok ? res.ok : false;
          if (!ok) continue;
          const data = await res.json();
          setWards(data.wards || []);
          return;
        } catch (err) {
          console.warn("Ward fetch failed", err);
        }
      }
    }
  };

  const addAddress = async () => {
    try {
      const headers = tokenHeaders();
      const payload = {
        ...newAddressForm,
        province: newAddressForm.province || "Hà Nội",
        isDefault: addresses.length === 0, // địa chỉ đầu tiên là mặc định
      };
      const res = await axios.post(`${API_URL}/api/address`, payload, { headers });
      const newAddr = res.data;
      setAddresses((prev) => [...prev, newAddr]);
      setSelectedAddressId(newAddr._id);
      setShowAddForm(false);
      setNewAddressForm({
        fullName: "",
        phone: "",
        province: "",
        district: "",
        ward: "",
        detail: "",
        districtCode: "",
        wardCode: "",
      });
    } catch (err) {
      console.error("Lỗi thêm địa chỉ:", err?.response?.data || err);
      alert("Không thể thêm địa chỉ mới.");
    }
  };

  /* ================== Hydrate giỏ hàng (variant/combo) ================== */
  const hydrateSelectedItems = async (items) => {
    const results = await Promise.all(
      (items || []).map(async (it) => {
        const qty = Number(it?.quantity || 1);
        try {
          const productId = it?.product?._id || it?.productId;
          const prod = await fetchProductByIdSmart(productId);

          // ===== COMBO =====
          if (prod?.isCombo) {
            const q = await fetchComboQuote(productId);
            const unitTotal =
              Number(q?.total ?? 0) || Number(prod?.comboPrice ?? 0);
            const unitSubtotal = Number(q?.subtotal ?? 0) || unitTotal;
            const dc =
              Number.isFinite(q?.discountPercent) && q?.discountPercent > 0
                ? q.discountPercent
                : Number(prod?.comboDiscountPercent || 0);

            const cStock =
              Number(prod?.comboInventory?.stock) ||
              Number(prod?.comboStock) ||
              0;

            const comboItems =
              (q?.items && q.items.length
                ? q.items
                : Array.isArray(prod?.comboItems)
                ? prod.comboItems.map((ci) => ({
                    productId: ci?.product?._id || ci?.product,
                    qty: Number(ci?.qty || 1),
                  }))
                : []) || [];

            return {
              _id: productId,
              nameProduct: prod?.name || "Combo",
              isCombo: true,
              priceBase: unitSubtotal,
              priceFinal: unitTotal,
              discountPercent: unitSubtotal > unitTotal ? dc : 0,
              expireAt: null,
              daysLeft: null,
              quantity: qty,
              variantInfo: {},
              variantId: null,
              stockEffective: Math.max(0, cStock),
              stockIssue: cStock <= 0 || qty > cStock,
              comboItems,
              comboTitle: q?.title || prod?.name || "Combo",
              comboImage: q?.image || prod?.image || null,
            };
          }

          // ===== HÀNG THƯỜNG =====
          const vId = it?.variant?._id || it?.variantId;
          const vAttrs = it?.variant?.attributes || it?.variantInfo || {};

          const matched =
            (Array.isArray(prod?.variants) &&
              (vId
                ? prod.variants.find((v) => String(v._id) === String(vId))
                : prod.variants.find(
                    (v) =>
                      String(v?.attributes?.weight || "") ===
                        String(vAttrs.weight || "") &&
                      String(v?.attributes?.ripeness || "") ===
                        String(vAttrs.ripeness || "")
                  ))) ||
            null;

          const lockedPrice = it?.variant?.price;
          if (lockedPrice != null && Number.isFinite(Number(lockedPrice))) {
            const finalLocked = Math.max(0, Number(lockedPrice));
            const baseFromServer = Number(
              matched?.price ?? prod?.baseVariant?.price ?? finalLocked
            );
            const base = Math.max(0, baseFromServer);
            const percent =
              base > 0 && finalLocked < base
                ? Math.round((1 - finalLocked / base) * 100)
                : 0;

            const effStock = matched ? computeEffectiveStockForVariant(prod, matched) : 0;

            return {
              _id: productId,
              nameProduct: prod?.name,
              isCombo: false,
              priceBase: base,
              priceFinal: finalLocked,
              discountPercent: percent,
              expireAt: computeExpiryInfo(prod)?.expireAt || null,
              daysLeft: computeExpiryInfo(prod)?.daysLeft ?? null,
              quantity: qty,
              variantInfo: { weight: vAttrs.weight, ripeness: vAttrs.ripeness },
              variantId: vId || (matched?._id || null),
              stockEffective: effStock,
              stockIssue: effStock <= 0 || qty > effStock,
            };
          }

          const variantBasePrice = Number(
            matched?.price ?? prod?.baseVariant?.price ?? prod?.price ?? 0
          );
          const ex = computeExpiryInfo(prod, variantBasePrice);
          const priceBase = Number(ex?.basePrice ?? variantBasePrice);
          const priceFinal = Number(ex?.finalPrice ?? variantBasePrice);
          const percent = Number(ex?.discountPercent || 0);
          const effStock = matched ? computeEffectiveStockForVariant(prod, matched) : 0;

          return {
            _id: productId,
            nameProduct: prod?.name,
            isCombo: false,
            priceBase,
            priceFinal,
            discountPercent: percent,
            expireAt: ex?.expireAt || null,
            daysLeft: Number.isFinite(ex?.daysLeft) ? ex.daysLeft : null,
            quantity: qty,
            variantInfo: { weight: vAttrs.weight, ripeness: vAttrs.ripeness },
            variantId: vId || (matched?._id || null),
            stockEffective: effStock,
            stockIssue: effStock <= 0 || qty > effStock,
          };
        } catch (err) {
          console.error("Hydrate item failed:", err);
          const vAttrs = it?.variant?.attributes || it?.variantInfo || {};
          const fallbackPrice = Number(it?.variant?.price || 0);
          const fallbackStock = Number(it?.variant?.stock || 0);
          return {
            _id: it?.product?._id || it?.productId,
            nameProduct: it?.product?.name || "Sản phẩm",
            isCombo: Boolean(it?.isCombo),
            priceBase: fallbackPrice,
            priceFinal: fallbackPrice,
            discountPercent: 0,
            expireAt: null,
            daysLeft: null,
            quantity: qty,
            variantInfo: vAttrs,
            variantId: it?.variant?._id || it?.variantId || null,
            stockEffective: fallbackStock,
            stockIssue: qty > fallbackStock,
          };
        }
      })
    );

    return { products: results };
  };

  /* ================== Khởi tạo: auth + nguồn giỏ ================== */
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
      } else if (mixLines.length > 0) {
        // Không có selectedItems nhưng có giỏ MIX → vẫn cho checkout
        setDataCart({ products: [] });
      } else {
        navigate("/gio-hang");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItems, navigate, mixLines.length]);

  /* ================== Tải địa chỉ & chọn mặc định ================== */
  useEffect(() => {
    const fetchAddresses = async () => {
      try {
        const headers = tokenHeaders();
        // Lấy profile để biết defaultAddressId
        const userRes = await axios.get(`${API_URL}/auth/profile`, { headers });
        const user = userRes.data;
        const defaultAddressId = user?.defaultAddressId;

        // Lấy tất cả địa chỉ
        const addressesRes = await axios.get(`${API_URL}/api/address`, { headers });
        const list = addressesRes.data || [];
        setAddresses(list);

        // Chọn địa chỉ
        if (defaultAddressId) setSelectedAddressId(defaultAddressId);
        else {
          const def = list.find((a) => a.isDefault);
          if (def) setSelectedAddressId(def._id);
          else if (list.length > 0) setSelectedAddressId(list[0]._id);
        }
      } catch (err) {
        console.error("Lỗi tải địa chỉ:", err);
        setAddresses([]);
      }
    };
    fetchAddresses();
  }, []);

  /* ================== Quote phí ship ================== */
  const subtotalProducts = useMemo(() => {
    if (!dataCart?.products?.length) return 0;
    return dataCart.products.reduce((sum, it) => {
      const unit = Number(it?.priceFinal || it?.price || 0);
      const line = unit * Number(it?.quantity || 0);
      return sum + line;
    }, 0);
  }, [dataCart]);

  const subtotalMix = useMemo(() => {
    if (!mixLines?.length) return 0;
    return mixLines.reduce((s, mx) => {
      const priceOneBox = Number(mx.price || mx.basePrice || 0);
      const q = Number(mx.quantity || 1);
      return s + priceOneBox * q;
    }, 0);
  }, [mixLines]);

  const subtotal = subtotalProducts + subtotalMix;

  useEffect(() => {
    const quote = async () => {
      if (!selectedAddressId) {
        setShippingFee(0);
        setShippingLabel("");
        return;
      }
      try {
        setQuoting(true);
        const headers = tokenHeaders();
        const res = await axios.get(`${API_URL}/api/orders/shipping/quote`, {
          headers,
          params: { addressId: selectedAddressId, subtotal },
        });
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
  }, [selectedAddressId, subtotal]);

  const total = Math.max(0, subtotal + (shippingFee || 0) - (discountAmount || 0));

  // Có sản phẩm vượt tồn?
  const hasStockIssue = useMemo(() => {
    if (!dataCart?.products?.length) return false;
    return dataCart.products.some((it) => it.stockIssue === true);
  }, [dataCart]);

  /* ================== Voucher ================== */
  const handleApplyVoucher = async () => {
    if (!voucherCode) return;
    try {
      const headers = tokenHeaders();
      const response = await axios.get(
        `${API_URL}/api/voucher/validate/${encodeURIComponent(voucherCode)}`,
        { headers }
      );
      const raw = response.data;
      const voucher = raw?.data || raw;
      if (!voucher || voucher.discount == null) throw new Error("Voucher không hợp lệ");

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
      console.error("Voucher error:", err?.response?.data || err);
      alert("Mã giảm giá không hợp lệ hoặc đã hết hạn.");
      setAppliedVoucher(null);
      setDiscountAmount(0);
    }
  };

  const removeVoucher = () => {
    setAppliedVoucher(null);
    setVoucherCode("");
    setDiscountAmount(0);
  };

  /* ================== Build cart payload ================== */
  // Gộp dòng trùng productId + variantId (hàng thường)
  const foldCartLines = (lines) => {
    const map = new Map();
    for (const ln of lines) {
      const key = `${ln.type || "variant"}:${ln.productId}:${ln.variantId || ""}`;
      if (!map.has(key)) map.set(key, { ...ln });
      else {
        const cur = map.get(key);
        cur.quantity = Number(cur.quantity || 0) + Number(ln.quantity || 0);
        map.set(key, cur);
      }
    }
    return Array.from(map.values());
  };

  // ⭐ Trả về cartItems đúng shape BE (variant, combo, mix)
  const buildCartItemsPayload = () => {
    const regularLines = [];
    const comboLines = [];
    const mixLinesPayload = [];

    for (const item of dataCart?.products || []) {
      if (!item.isCombo) {
        regularLines.push({
          type: "variant",
          productId: String(item._id),
          quantity: Math.max(1, Number(item.quantity || 1)),
          variantId: item.variantId ? String(item.variantId) : undefined,
          variant: {
            weight: item?.variantInfo?.weight,
            ripeness: item?.variantInfo?.ripeness || "Default",
          },
        });
      } else {
        const comboQty = Math.max(1, Number(item.quantity || 1));
        const snapItems = (item.comboItems || [])
          .filter((x) => x?.productId)
          .map((x) => ({ productId: x.productId, qty: Math.max(1, Number(x.qty || 1)) }));

        comboLines.push({
          type: "combo",
          productId: String(item._id),
          quantity: comboQty,
          snapshot: {
            title: item.comboTitle || item.nameProduct || "Combo",
            image: item.comboImage || null,
            unitPrice: Number(item.priceFinal || 0),
            discountPercent: Number(item.discountPercent || 0),
            items: snapItems,
          },
        });
      }
    }

    // ✅ Mix: lấy từ cart context
    for (const mx of mixLines || []) {
      const oneBox = Number(mx.price || mx.basePrice || 0);
      const q = Math.max(1, Number(mx.quantity || 1));
      mixLinesPayload.push({
        type: "mix",
        quantity: q,
        totalPrice: oneBox, // giá 1 hộp
        note: mx.note || "",
        items: (mx.mixItems || []).map((x) => ({
          productId: x.productId,
          qty: Number(x.qty || 0),
          unitPrice: x.unitPrice != null ? Number(x.unitPrice) : undefined,
          pricePerKg: x.pricePerKg != null ? Number(x.pricePerKg) : undefined,
          weightGram: x.weightGram != null ? Number(x.weightGram) : undefined,
          linePrice: Number(x.linePrice || 0),
        })),
      });
    }

    return [...foldCartLines(regularLines), ...comboLines, ...mixLinesPayload];
  };
  // ===== COD =====
  const handlePayment = async () => {
    if (submitting) return;
    if (!checkBox) return alert("Vui lòng chấp nhận điều khoản");
    if (!selectedAddressId) return alert("Chưa chọn địa chỉ giao hàng.");
    if (hasStockIssue) return alert("Một số sản phẩm vượt quá tồn kho. Vui lòng giảm số lượng.");

    try {
      setSubmitting(true);
      const headers = tokenHeaders();

      const addressPayload = buildAddressPayload(selectedAddress);
      const cartItemsPayload = buildCartItemsPayload();

      const payload = {
        cartItems: cartItemsPayload,
        voucher: appliedVoucher?.code || null,
        address: addressPayload?._id ? { _id: addressPayload._id } : addressPayload,
        paymentMethod: "cod",
        shippingFee,
      };

      await axios.post(`${API_URL}/api/orders/add`, payload, { headers });
      alert("Đặt hàng thành công!");
      navigate("/order-success");
    } catch (error) {
      console.error("Lỗi đặt hàng COD:", error?.response?.data || error);
      alert(error?.response?.data?.message || "Đặt hàng thất bại.");
    } finally {
      setSubmitting(false);
    }
  };

  // ===== MoMo (ĐÃ HỖ TRỢ MIX) =====
  const handlePaymentMomo = async () => {
    if (submitting) return;
    if (!checkBox) return alert("Vui lòng chấp nhận điều khoản");
    if (!selectedAddressId) return alert("Chưa chọn địa chỉ giao hàng.");
    if (hasStockIssue) return alert("Một số sản phẩm vượt quá tồn kho. Vui lòng giảm số lượng.");

    try {
      setSubmitting(true);
      const headers = tokenHeaders();

      // BẮT BUỘC: truyền shippingAddress theo shape BE cần
      const shippingAddress = {
        fullName: selectedAddress?.fullName,
        phone: selectedAddress?.phone,
        addressLine: selectedAddress?.detail,
        wardName: selectedAddress?.ward,
        districtName: selectedAddress?.district,
        provinceName: selectedAddress?.province,
        districtCode: selectedAddress?.districtCode || "",
        wardCode: selectedAddress?.wardCode || "",
        provinceCode: 1, // Hà Nội mặc định theo BE
      };

      const cartItemsPayload = buildCartItemsPayload();

      const payload = {
        cartItems: cartItemsPayload,
        voucher: appliedVoucher?.code || null,
        shippingAddress, // ƯU TIÊN dùng shippingAddress (controller sẽ chuẩn hoá)
      };

      const response = await axios.post(`${API_URL}/api/momo/create-payment`, payload, { headers });

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
  /* ================== UI ================== */
  return (
    <div className="w-[85%] mx-auto my-5 ff-checkout-page">
      {/* Back to cart */}
      <div className="mb-4 text-left ff-back-to-cart">
        <Link to="/gio-hang" className="text-blue-600 hover:underline flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Quay lại Giỏ hàng
        </Link>
      </div>

      <main className="grid grid-cols-1 md:grid-cols-2 gap-5 ff-main-grid">
        {/* ========== ĐỊA CHỈ ========== */}
        <div className="ff-address-col">
          <div className="flex items-center justify-between mb-4 ff-address-header">
            <h1 className="text-lg font-bold">Địa Chỉ Nhận Hàng</h1>
            <button
              onClick={() => setShowAddressForm(!showAddressForm)}
              className="text-blue-600 hover:underline text-sm"
            >
              {showAddressForm ? "Ẩn danh sách" : "Xem danh sách"}
            </button>
          </div>

          {/* Danh sách địa chỉ */}
          {showAddressForm && (
            <div className="bg-white border rounded-lg p-4 mb-4 max-h-80 overflow-y-auto ff-address-list">
              <h3 className="font-medium mb-3 text-gray-700">Chọn địa chỉ giao hàng:</h3>
              {addresses.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  Chưa có địa chỉ nào. Vui lòng thêm địa chỉ mới.
                </p>
              ) : (
                <div className="space-y-3">
                  {addresses.map((address) => (
                    <label
                      key={address._id}
                      className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-all ff-address-card ${
                        selectedAddressId === address._id
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="address"
                        value={address._id}
                        checked={selectedAddressId === address._id}
                        onChange={(e) => setSelectedAddressId(e.target.value)}
                        className="mt-1 text-blue-600"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-800">{address.fullName}</span>
                          <span className="text-gray-600">|</span>
                          <span className="text-gray-600">{address.phone}</span>
                          {address.isDefault && (
                            <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                              Mặc định
                            </span>
                          )}
                        </div>
                        <p className="text-gray-600 text-sm mt-1">
                          {address.detail}, {address.ward}, {address.district}, {address.province}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Hiển thị địa chỉ đã chọn */}
          {selectedAddress && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 ff-address-selected">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-green-800 font-medium text-sm">Địa chỉ đã chọn:</span>
              </div>
              <p className="font-medium text-gray-800">
                {selectedAddress.fullName} | {selectedAddress.phone}
              </p>
              <p className="text-gray-600 text-sm">
                {selectedAddress.detail}, {selectedAddress.ward}, {selectedAddress.district},{" "}
                {selectedAddress.province}
              </p>
            </div>
          )}

          {/* Thêm địa chỉ */}
          {showAddForm ? (
            <div className="bg-gray-50 border rounded-lg p-4 ff-address-add-form">
              <h3 className="font-medium mb-3">Thêm địa chỉ mới</h3>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Họ và tên"
                  value={newAddressForm.fullName}
                  onChange={(e) =>
                    setNewAddressForm({ ...newAddressForm, fullName: e.target.value })
                  }
                  className="border rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Số điện thoại"
                  value={newAddressForm.phone}
                  onChange={(e) =>
                    setNewAddressForm({ ...newAddressForm, phone: e.target.value })
                  }
                  className="border rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value="Hà Nội"
                  disabled
                  className="border rounded-lg px-3 py-2 w-full bg-gray-100 text-gray-600"
                />
                <select
                  value={newAddressForm.districtCode || ""}
                  onChange={(e) => {
                    const code = String(e.target.value);
                    const selectedDistrict = districts.find((d) => String(d.code) === code);
                    setNewAddressForm({
                      ...newAddressForm,
                      district: selectedDistrict?.name || "",
                      districtCode: code,
                      ward: "",
                      wardCode: "",
                    });
                    handleDistrictChange(code);
                  }}
                  className="border rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Chọn Quận/Huyện --</option>
                  {districts.map((d) => (
                    <option key={d.code} value={String(d.code)}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <select
                  value={newAddressForm.wardCode || ""}
                  onChange={(e) => {
                    const code = String(e.target.value);
                    const selectedWard = wards.find((w) => String(w.code) === code);
                    setNewAddressForm({
                      ...newAddressForm,
                      ward: selectedWard?.name || "",
                      wardCode: selectedWard ? String(selectedWard.code) : "",
                    });
                  }}
                  className="border rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Chọn Phường/Xã --</option>
                  {wards.map((w) => (
                    <option key={w.code} value={String(w.code)}>
                      {w.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Địa chỉ chi tiết"
                  value={newAddressForm.detail}
                  onChange={(e) =>
                    setNewAddressForm({ ...newAddressForm, detail: e.target.value })
                  }
                  className="border rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={addAddress}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    Lưu địa chỉ
                  </button>
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center justify-center gap-2 ff-btn-add-address"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Thêm địa chỉ mới
            </button>
          )}
        </div>

        {/* ========== SẢN PHẨM + THANH TOÁN ========== */}
        <div className="bg-gray-100 rounded-xl p-5 ff-summary-box">
          <h1 className="text-lg font-bold mb-4">Sản Phẩm Thanh Toán</h1>

          {hasStockIssue && (
            <div className="mb-3 p-3 rounded bg-red-50 text-red-700 text-sm ff-stock-warning">
              Một số sản phẩm vượt quá tồn kho. Vui lòng giảm số lượng trước khi thanh toán.
            </div>
          )}

          <table className="w-full text-left mb-4 ff-summary-table">
            <thead>
              <tr className="bg-gray-200">
                <th className="px-4 py-2">Tên</th>
                <th className="px-4 py-2">SL</th>
                <th className="px-4 py-2">Tổng</th>
              </tr>
            </thead>
            <tbody>
              {/* Hàng thường & Combo */}
              {dataCart?.products?.map((it, idx) => {
                const unit = Number(it?.priceFinal || 0);
                const line = unit * Number(it?.quantity || 0);
                const showOld =
                  typeof it?.priceBase === "number" && unit < it.priceBase;
                const over = it.stockIssue;

                return (
                  <tr
                    key={`${it._id}-${it?.variantInfo?.weight || "combo"}-${it?.variantInfo?.ripeness || idx}`}
                    className={over ? "bg-red-50" : ""}
                  >
                    <td className="px-4 py-2 align-top">
                      <div className="font-medium flex items-center gap-2">
                        {it?.nameProduct}
                        {it.isCombo && (
                          <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-green-600 text-white">
                            Combo
                          </span>
                        )}
                      </div>

                      {!it.isCombo && it?.variantInfo && (
                        <div className="text-sm text-gray-500">
                          ({it?.variantInfo?.weight} / {it?.variantInfo?.ripeness})
                        </div>
                      )}

                      {!it.isCombo && (
                        <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                          {it?.expireAt && <span>Ngày hết hạn: {fmtDate(it.expireAt)}</span>}
                          {Number.isFinite(it?.daysLeft) && it.daysLeft >= 0 && (
                            <span className="bg-yellow-500 text-white px-1.5 py-0.5 rounded">
                              Còn {it.daysLeft} ngày
                            </span>
                          )}
                        </div>
                      )}

                      <div className="mt-1 flex items-center gap-3">
                        <div>
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
                        <div className={`text-xs ${over ? "text-red-600" : "text-gray-600"}`}>
                          Còn lại: <b>{Number(it.stockEffective || 0)}</b>
                          {it.isCombo ? " combo" : ""}
                        </div>
                      </div>

                      {over && (
                        <div className="text-xs text-red-600 mt-1">
                          Vượt tồn kho. Vui lòng giảm SL ≤ {Number(it.stockEffective || 0)}.
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-2 align-top">x{it?.quantity}</td>

                    <td className="px-4 py-2 align-top">
                      {line.toLocaleString("vi-VN")}₫
                    </td>
                  </tr>
                );
              })}

              {/* Dòng MIX */}
              {mixLines.map((mx) => {
                const priceOne = Number(mx.price || mx.basePrice || 0);
                const q = Number(mx.quantity || 1);
                const lineTotal = priceOne * q;
                return (
                  <tr key={mx._id} className="bg-emerald-50">
                    <td className="px-4 py-2 align-top">
                      <div className="font-medium flex items-center gap-2">
                        {mx.displayName || "Giỏ Mix"}
                        <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-emerald-600 text-white">
                          Mix
                        </span>
                      </div>
                      {mx.note && (
                        <div className="text-xs italic text-gray-600 mt-0.5">
                          Ghi chú: {mx.note}
                        </div>
                      )}
                      <div className="mt-2 text-sm text-gray-700 border-t pt-2 space-y-1">
                        {(mx.mixItems || []).map((m, i) => (
                          <div key={`${mx._id}_${i}`} className="flex justify-between">
                            <span className="truncate">
                              {m.name}
                              {m.weightGram ? ` • ${m.weightGram}g` : ""} × {m.qty}
                            </span>
                            <span>{Number(m.linePrice || 0).toLocaleString("vi-VN")}₫</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2 align-top">x{q}</td>
                    <td className="px-4 py-2 align-top">
                      {lineTotal.toLocaleString("vi-VN")}₫
                    </td>
                  </tr>
                );
              })}

              {/* Tổng kết */}
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
                  {quoting ? "Đang tính..." : `${(shippingFee || 0).toLocaleString("vi-VN")}₫`}
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
                <td className="px-4 py-2">{total.toLocaleString("vi-VN") }₫</td>
              </tr>
            </tbody>
          </table>

          {/* Voucher */}
          <div className="flex gap-2 mb-4 ff-voucher-row">
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

          {/* Điều khoản */}
          <div className="flex items-center gap-2 mb-4 ff-terms">
            <input type="checkbox" onChange={(e) => setCheckBox(e.target.checked)} />
            <label className="text-sm">Vui lòng chấp nhận điều khoản</label>
          </div>

          {/* Buttons */}
          <button
            onClick={handlePaymentMomo}
            className="w-full h-14 bg-blue-600 text-white rounded-lg mb-3 disabled:opacity-60 ff-btn-momo"
            disabled={
              submitting ||
              (!dataCart?.products?.length && !mixLines.length) ||
              !selectedAddressId ||
              hasStockIssue
            }
          >
            Thanh Toán Qua MOMO
          </button>

          <button
            onClick={handlePayment}
            className="w-full h-14 bg-red-600 text-white rounded-lg disabled:opacity-60 ff-btn-cod"
            disabled={
              submitting ||
              (!dataCart?.products?.length && !mixLines.length) ||
              !selectedAddressId ||
              hasStockIssue
            }
          >
            Thanh Toán Khi Nhận Hàng
          </button>
        </div>
      </main>
    </div>
  );
}
