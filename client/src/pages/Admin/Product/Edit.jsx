// src/pages/admin/product/Edit.jsx
import React, { useState, useEffect } from 'react';
import axiosInstance from '../../../utils/axiosConfig';
import { useNavigate, useParams } from 'react-router-dom';

export default function EditProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();

  // --- State cơ bản ---
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [image, setImage] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [imagePreview, setImagePreview] = useState('');
  const [variants, setVariants] = useState([]);

  // --- Preorder / Coming Soon ---
  const [enablePreorder, setEnablePreorder] = useState(false);
  const [depositPercent, setDepositPercent] = useState(20);
  const [quota, setQuota] = useState(0);
  const [windowStart, setWindowStart] = useState('');
  const [windowEnd, setWindowEnd] = useState('');
  const [expectedHarvestStart, setExpectedHarvestStart] = useState('');
  const [expectedHarvestEnd, setExpectedHarvestEnd] = useState('');

  // --- Expiry (mới) ---
  const [enableExpiry, setEnableExpiry] = useState(false);
  const [expireDate, setExpireDate] = useState('');     // YYYY-MM-DD
  const [mfgDate, setMfgDate] = useState('');           // YYYY-MM-DD
  const [shelfLifeDays, setShelfLifeDays] = useState(''); // number
  const [nearActive, setNearActive] = useState(false);
  const [thresholdDays, setThresholdDays] = useState(0);
  const [discountPercentNear, setDiscountPercentNear] = useState(0);

  // --- Voucher nhanh cho cận hạn (mới) ---
  const [vCode, setVCode] = useState('');
  const [vDiscount, setVDiscount] = useState(0);       // % hoặc số tiền; BE sẽ hiểu theo field type
  const [vType, setVType] = useState('percent');       // 'percent' | 'amount'
  const [vMaxDiscount, setVMaxDiscount] = useState(0); // áp dụng khi type = percent
  const [vMinOrder, setVMinOrder] = useState(0);
  const [vUsageLimit, setVUsageLimit] = useState(0);
  const [vExpiresAt, setVExpiresAt] = useState('');    // YYYY-MM-DD
  const [creatingVoucher, setCreatingVoucher] = useState(false);

  const toISOorNull = (d) => (d ? new Date(d).toISOString() : null);
  const isoToDateInput = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');

  // Lấy thông tin sản phẩm
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await axiosInstance.get(`/product/${id}`);
        const data = res.data;

        setName(data.name || '');
        setDescription(data.description || '');
        setPrice(data.baseVariant?.price ?? '');
        setStock(data.baseVariant?.stock ?? '');
        setImage(data.image || '');
        setCategory(data.category?._id || data.category || '');
        setLocation(data.location?._id || data.location || '');
        setImagePreview(
          data.image?.startsWith('http')
            ? data.image
            : data.image
            ? `http://localhost:3000${data.image}`
            : ''
        );
        setVariants(Array.isArray(data.variants) ? data.variants : []);

        // Preorder
        const p = data.preorder || {};
        setEnablePreorder(!!p.enabled);
        setDepositPercent(typeof p.depositPercent === 'number' ? p.depositPercent : 20);
        setQuota(typeof p.quota === 'number' ? p.quota : 0);
        setWindowStart(isoToDateInput(p.windowStart));
        setWindowEnd(isoToDateInput(p.windowEnd));
        setExpectedHarvestStart(isoToDateInput(p.expectedHarvestStart));
        setExpectedHarvestEnd(isoToDateInput(p.expectedHarvestEnd));

        // Expiry (map theo chuẩn mới nhưng vẫn đọc được legacy nếu BE normalize)
        const e = data.expiry || {};
        // Cho phép bật/tắt form theo việc có dữ liệu
        const hasAnyExpiry =
          e.expireDate || e.mfgDate || Number.isFinite(Number(e.shelfLifeDays)) || e.discountNearExpiry;
        setEnableExpiry(!!hasAnyExpiry);

        setExpireDate(isoToDateInput(e.expireDate));
        setMfgDate(isoToDateInput(e.mfgDate));
        setShelfLifeDays(
          e.shelfLifeDays == null || Number.isNaN(Number(e.shelfLifeDays)) ? '' : String(e.shelfLifeDays)
        );
        const dne = e.discountNearExpiry || {};
        setNearActive(!!dne.active);
        setThresholdDays(Number.isFinite(Number(dne.thresholdDays)) ? Number(dne.thresholdDays) : 0);
        setDiscountPercentNear(Number.isFinite(Number(dne.percent)) ? Number(dne.percent) : 0);

        // Voucher quick defaults
        if (data.name) {
          const baseCode = data.name
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toUpperCase().replace(/\s+/g, '');
          setVCode(`NEAREXP-${baseCode}`.slice(0, 20));
        }
        setVDiscount(Number.isFinite(Number(dne.percent)) ? Number(dne.percent) : 10);
        setVType('percent');
        setVMaxDiscount(0);
        setVMinOrder(0);
        setVUsageLimit(0);
        setVExpiresAt('');
      } catch (err) {
        console.error('Lỗi khi lấy sản phẩm:', err);
        alert('Không tải được dữ liệu sản phẩm.');
      }
    };

    fetchProduct();
  }, [id]);

  // Danh mục & địa điểm
  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const [catRes, locRes] = await Promise.all([
          axiosInstance.get('/category'),
          axiosInstance.get('/locations'),
        ]);
        setCategories(catRes.data || []);
        setLocations(locRes.data || []);
      } catch (err) {
        console.error('Lỗi khi lấy danh mục/địa điểm:', err);
      }
    };
    fetchMeta();
  }, []);

  // Upload ảnh
  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);
    try {
      const res = await axiosInstance.post('/upload', formData);
      const path = res.data?.imagePath || res.data?.url || '';
      if (!path) throw new Error('Không nhận được đường dẫn ảnh');
      setImage(path);
      setImagePreview(path.startsWith('http') ? path : `http://localhost:3000${path}`);
    } catch (err) {
      console.error('Lỗi upload ảnh:', err);
      alert('Upload ảnh thất bại.');
    }
  };

  // Submit cập nhật sản phẩm
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name,
        description,
        image,
        category,
        location,
        baseVariant: {
          price: Number(price) || 0,
          stock: Number(stock) || 0,
        },
        variants,
      };

      // Preorder
      payload.preorder = enablePreorder
        ? {
            enabled: true,
            depositPercent: Number(depositPercent) || 0,
            quota: Number(quota) || 0,
            windowStart: toISOorNull(windowStart),
            windowEnd: toISOorNull(windowEnd),
            expectedHarvestStart: toISOorNull(expectedHarvestStart),
            expectedHarvestEnd: toISOorNull(expectedHarvestEnd),
            priceLock: true,
          }
        : { enabled: false };

      // Expiry chuẩn mới
      if (enableExpiry) {
        const exp = {};
        if (expireDate) {
          exp.expireDate = toISOorNull(expireDate);
        } else {
          if (mfgDate) exp.mfgDate = toISOorNull(mfgDate);
          if (shelfLifeDays !== '') exp.shelfLifeDays = Number(shelfLifeDays) || 0;
        }
        exp.discountNearExpiry = {
          active: !!nearActive,
          thresholdDays: Number(thresholdDays) || 0,
          percent: Number(discountPercentNear) || 0,
        };
        payload.expiry = exp;
      } else {
        // Nếu tắt expiry, gửi object rỗng để BE tắt cấu hình (tuỳ policy của bạn)
        payload.expiry = {};
      }

      await axiosInstance.put(`/product/${id}`, payload);
      alert('Cập nhật sản phẩm thành công!');
      navigate('/admin/products');
    } catch (err) {
      console.error('Lỗi cập nhật sản phẩm:', err?.response?.data || err);
      alert('Cập nhật thất bại!');
    }
  };

  // Tạo voucher nhanh cho sản phẩm cận hạn
  const createNearExpiryVoucher = async () => {
    try {
      if (!vCode) return alert('Vui lòng nhập mã voucher');
      setCreatingVoucher(true);

      const payload = {
        code: vCode.toUpperCase().trim(),
        type: vType, // 'percent' | 'amount'
        discount: Number(vDiscount) || 0,         // nếu type=percent: 0..100; nếu amount: số tiền
        maxDiscount: Number(vMaxDiscount) || 0,   // chỉ áp dụng khi type=percent (>0 mới giới hạn)
        minOrder: Number(vMinOrder) || 0,
        usageLimit: Number(vUsageLimit) || 0,     // 0 = không giới hạn
        expiresAt: toISOorNull(vExpiresAt),       // null = không hết hạn

        // Ràng buộc áp dụng:
        appliesTo: {
          scope: 'product',
          productId: id,
          nearExpiryOnly: true, // chỉ áp cho hàng cận hạn theo helper (daysLeft <= thresholdDays)
        },
      };

      // ⚠️ Nếu BE của bạn dùng route khác, đổi lại tại đây.
      await axiosInstance.post('/voucher/create', payload);

      alert('✅ Tạo voucher thành công!');
    } catch (err) {
      console.error('Tạo voucher lỗi:', err?.response?.data || err);
      alert(err?.response?.data?.message || 'Không tạo được voucher.');
    } finally {
      setCreatingVoucher(false);
    }
  };

  const inputCls = "w-full border px-3 py-2 rounded";
  const sectionTitleCls = "text-lg font-semibold mt-6 mb-2";

  return (
    <div className="max-w-2xl mx-auto mt-6 bg-white shadow p-6 rounded">
      <h2 className="text-2xl font-bold mb-4">Cập nhật sản phẩm</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Thông tin cơ bản */}
        <div>
          <label className="block font-medium">Tên sản phẩm</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
        </div>

        <div>
          <label className="block font-medium">Mô tả</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} required className={inputCls} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-medium">Giá gốc (base)</label>
            <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} required className={inputCls} />
          </div>
          <div>
            <label className="block font-medium">Tồn kho (base)</label>
            <input type="number" value={stock} onChange={(e) => setStock(e.target.value)} required className={inputCls} />
          </div>
        </div>

        {/* Ảnh */}
        <div>
          <label className="block font-medium">Ảnh sản phẩm</label>
          <input type="file" accept="image/*" onChange={handleImageChange} />
          {imagePreview && (
            <img src={imagePreview} alt="Preview" className="mt-2 w-32 h-32 object-cover border rounded" />
          )}
        </div>

        {/* Danh mục & Địa điểm */}
        <div>
          <label className="block font-medium">Danh mục</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} required className={inputCls}>
            <option value="">-- Chọn danh mục --</option>
            {categories.map((cat) => (
              <option key={cat._id} value={cat._id}>{cat.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-medium">Địa điểm</label>
          <select value={location} onChange={(e) => setLocation(e.target.value)} required className={inputCls}>
            <option value="">-- Chọn địa điểm --</option>
            {locations.map((loc) => (
              <option key={loc._id} value={loc._id}>{loc.name}</option>
            ))}
          </select>
        </div>

        {/* Preorder */}
        <h3 className={sectionTitleCls}>⚡ Cấu hình Sản phẩm Sắp vào mùa</h3>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={enablePreorder} onChange={(e) => setEnablePreorder(e.target.checked)} />
          Bật chế độ đặt trước (Coming Soon)
        </label>

        {enablePreorder && (
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Đặt cọc (%)</label>
                <input type="number" min="0" max="100" value={depositPercent}
                  onChange={(e) => setDepositPercent(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Hạn mức (quota)</label>
                <input type="number" min="0" value={quota}
                  onChange={(e) => setQuota(e.target.value)} className={inputCls} />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Cửa sổ đặt trước</label>
              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} className={inputCls} />
                <input type="date" value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} className={inputCls} />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Dự kiến mùa vụ (thời gian giao hàng)</label>
              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={expectedHarvestStart} onChange={(e) => setExpectedHarvestStart(e.target.value)} className={inputCls} />
                <input type="date" value={expectedHarvestEnd} onChange={(e) => setExpectedHarvestEnd(e.target.value)} className={inputCls} />
              </div>
            </div>
          </div>
        )}

        {/* Expiry */}
        <h3 className={sectionTitleCls}>🍏 Hạn sử dụng & Giảm giá cận hạn</h3>
        <label className="flex items-center gap-2 mb-2">
          <input type="checkbox" checked={enableExpiry} onChange={(e) => setEnableExpiry(e.target.checked)} />
          Theo dõi hạn & cấu hình giảm giá cận hạn
        </label>

        {enableExpiry && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Ngày hết hạn (expireDate)</label>
                <input type="date" value={expireDate} onChange={(e) => setExpireDate(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Ngày sản xuất (mfgDate)</label>
                <input type="date" value={mfgDate} onChange={(e) => setMfgDate(e.target.value)} className={inputCls} disabled={!!expireDate} />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Số ngày sử dụng (shelfLifeDays)</label>
                <input type="number" min="0" value={shelfLifeDays}
                  onChange={(e) => setShelfLifeDays(e.target.value)} className={inputCls} disabled={!!expireDate} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={nearActive} onChange={(e) => setNearActive(e.target.checked)} />
                Kích hoạt giảm giá cận hạn
              </label>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Ngưỡng cận hạn (ngày)</label>
                <input type="number" min="0" value={thresholdDays}
                  onChange={(e) => setThresholdDays(e.target.value)} className={inputCls} disabled={!nearActive} />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">% giảm khi cận hạn</label>
                <input type="number" min="0" max="100" value={discountPercentNear}
                  onChange={(e) => setDiscountPercentNear(e.target.value)} className={inputCls} disabled={!nearActive} />
              </div>
            </div>
          </div>
        )}

        {/* Voucher nhanh cho sản phẩm cận hạn */}
        <h3 className={sectionTitleCls}>🎟️ Tạo voucher cho sản phẩm cận hạn</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Mã voucher</label>
            <input className={inputCls} value={vCode} onChange={(e) => setVCode(e.target.value)} placeholder="NEAREXP-XXXX" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Loại giảm</label>
            <select className={inputCls} value={vType} onChange={(e) => setVType(e.target.value)}>
              <option value="percent">Phần trăm (%)</option>
              <option value="amount">Số tiền (đ)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Giá trị giảm</label>
            <input type="number" min="0" className={inputCls} value={vDiscount} onChange={(e) => setVDiscount(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Giảm tối đa (nếu %)</label>
            <input type="number" min="0" className={inputCls} value={vMaxDiscount} onChange={(e) => setVMaxDiscount(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Đơn tối thiểu</label>
            <input type="number" min="0" className={inputCls} value={vMinOrder} onChange={(e) => setVMinOrder(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Giới hạn lượt dùng</label>
            <input type="number" min="0" className={inputCls} value={vUsageLimit} onChange={(e) => setVUsageLimit(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Hết hạn (tuỳ chọn)</label>
            <input type="date" className={inputCls} value={vExpiresAt} onChange={(e) => setVExpiresAt(e.target.value)} />
          </div>
        </div>

        <button
          type="button"
          onClick={createNearExpiryVoucher}
          disabled={creatingVoucher || !vCode}
          className="mt-2 bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:opacity-60"
        >
          {creatingVoucher ? 'Đang tạo voucher...' : 'Tạo voucher cận hạn cho sản phẩm này'}
        </button>

        {/* Submit */}
        <button
          type="submit"
          className="mt-6 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          Cập nhật
        </button>
      </form>
    </div>
  );
}
