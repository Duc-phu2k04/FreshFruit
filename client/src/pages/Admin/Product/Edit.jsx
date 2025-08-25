import React, { useState, useEffect } from 'react';
import axiosInstance from '../../../utils/axiosConfig';
import { useNavigate, useParams } from 'react-router-dom';

export default function EditProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();

  // --- State cũ ---
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

  // --- State mới: Preorder / Coming Soon ---
  const [enablePreorder, setEnablePreorder] = useState(false);
  const [depositPercent, setDepositPercent] = useState(20);
  const [quota, setQuota] = useState(0);
  const [windowStart, setWindowStart] = useState('');            // yyyy-mm-dd
  const [windowEnd, setWindowEnd] = useState('');
  const [expectedHarvestStart, setExpectedHarvestStart] = useState('');
  const [expectedHarvestEnd, setExpectedHarvestEnd] = useState('');

  // Helpers
  const toISOorNull = (d) => (d ? new Date(d).toISOString() : null);
  const isoToDateInput = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');

  // Lấy thông tin sản phẩm hiện tại
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        // ⚠️ API đúng là /product/:id (không có "s")
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
          data.image?.startsWith('http') ? data.image : (data.image ? `http://localhost:4000${data.image}` : '')
        );
        setVariants(Array.isArray(data.variants) ? data.variants : []);

        // Preorder (nếu có)
        const p = data.preorder || {};
        setEnablePreorder(!!p.enabled);
        setDepositPercent(typeof p.depositPercent === 'number' ? p.depositPercent : 20);
        setQuota(typeof p.quota === 'number' ? p.quota : 0);
        setWindowStart(isoToDateInput(p.windowStart));
        setWindowEnd(isoToDateInput(p.windowEnd));
        setExpectedHarvestStart(isoToDateInput(p.expectedHarvestStart));
        setExpectedHarvestEnd(isoToDateInput(p.expectedHarvestEnd));
      } catch (err) {
        console.error('Lỗi khi lấy sản phẩm:', err);
        alert('Không tải được dữ liệu sản phẩm.');
      }
    };

    fetchProduct();
  }, [id]);

  // Lấy danh sách danh mục & địa điểm
  useEffect(() => {
    const fetchData = async () => {
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

    fetchData();
  }, []);

  // Xử lý chọn ảnh mới
  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await axiosInstance.post('/upload', formData);
      // Backend trước đó trả về { imagePath }
      const path = res.data?.imagePath || res.data?.url || '';
      if (!path) throw new Error('Không nhận được đường dẫn ảnh');

      setImage(path); // lưu path gốc để BE dùng
      setImagePreview(path.startsWith('http') ? path : `http://localhost:4000${path}`);
    } catch (err) {
      console.error('Lỗi upload ảnh:', err);
      alert('Upload ảnh thất bại.');
    }
  };

  // Submit cập nhật
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const payload = {
        name,
        description,
        image,                                 // lưu path như BE mong đợi (ví dụ /images/xxx.jpg)
        category,
        location,
        baseVariant: {
          price: Number(price) || 0,
          stock: Number(stock) || 0,
        },
        variants,                              // ✅ Giữ lại biến thể cũ
      };

      // Preorder: chỉ gửi khi muốn bật hoặc tắt rõ ràng
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

      // ⚠️ API update đúng là /product/:id (theo routes bạn gửi)
      await axiosInstance.put(`/product/${id}`, payload);

      alert('Cập nhật sản phẩm thành công!');
      navigate('/admin/products');
    } catch (err) {
      console.error('Lỗi cập nhật sản phẩm:', err?.response?.data || err);
      alert('Cập nhật thất bại!');
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
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={inputCls}
          />
        </div>

        <div>
          <label className="block font-medium">Mô tả</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            className={inputCls}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-medium">Giá gốc (base)</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
              className={inputCls}
            />
          </div>
          <div>
            <label className="block font-medium">Tồn kho (base)</label>
            <input
              type="number"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              required
              className={inputCls}
            />
          </div>
        </div>

        {/* Ảnh */}
        <div>
          <label className="block font-medium">Ảnh sản phẩm</label>
          <input type="file" accept="image/*" onChange={handleImageChange} />
          {imagePreview && (
            <img
              src={imagePreview}
              alt="Preview"
              className="mt-2 w-32 h-32 object-cover border rounded"
            />
          )}
        </div>

        {/* Danh mục */}
        <div>
          <label className="block font-medium">Danh mục</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
            className={inputCls}
          >
            <option value="">-- Chọn danh mục --</option>
            {categories.map((cat) => (
              <option key={cat._id} value={cat._id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Địa điểm */}
        <div>
          <label className="block font-medium">Địa điểm</label>
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
            className={inputCls}
          >
            <option value="">-- Chọn địa điểm --</option>
            {locations.map((loc) => (
              <option key={loc._id} value={loc._id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>

        {/* --- Mới: Cấu hình Sắp vào mùa (Preorder) --- */}
        <h3 className={sectionTitleCls}>⚡ Cấu hình Sản phẩm Sắp vào mùa</h3>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={enablePreorder}
            onChange={(e) => setEnablePreorder(e.target.checked)}
          />
          Bật chế độ đặt trước (Coming Soon)
        </label>

        {enablePreorder && (
          <div className="space-y-3 mt-2">
            {/* Phần trăm cọc & Hạn mức */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Đặt cọc (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={depositPercent}
                  onChange={(e) => setDepositPercent(e.target.value)}
                  className={inputCls}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Ví dụ 20% nghĩa là khách đặt cọc 20% giá trị đơn. Tiền cọc = (Giá × SL) × (%
                  cọc / 100).
                </p>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Hạn mức (quota)</label>
                <input
                  type="number"
                  min="0"
                  value={quota}
                  onChange={(e) => setQuota(e.target.value)}
                  className={inputCls}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Số suất tối đa nhận đặt trước. Hết hạn mức sẽ ngừng nhận đơn preorder.
                </p>
              </div>
            </div>

            {/* Cửa sổ đặt trước */}
            <div>
              <label className="block text-sm text-gray-600 mb-1">Cửa sổ đặt trước</label>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date"
                  value={windowStart}
                  onChange={(e) => setWindowStart(e.target.value)}
                  className={inputCls}
                />
                <input
                  type="date"
                  value={windowEnd}
                  onChange={(e) => setWindowEnd(e.target.value)}
                  className={inputCls}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Khách chỉ có thể đặt trước trong khoảng thời gian này.
              </p>
            </div>

            {/* Dự kiến mùa vụ */}
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Dự kiến mùa vụ (thời gian giao hàng)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date"
                  value={expectedHarvestStart}
                  onChange={(e) => setExpectedHarvestStart(e.target.value)}
                  className={inputCls}
                />
                <input
                  type="date"
                  value={expectedHarvestEnd}
                  onChange={(e) => setExpectedHarvestEnd(e.target.value)}
                  className={inputCls}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Khoảng thời gian dự kiến trái cây chín và có thể giao cho khách.
              </p>
            </div>
          </div>
        )}

        <button
          type="submit"
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          Cập nhật
        </button>
      </form>
    </div>
  );
}
