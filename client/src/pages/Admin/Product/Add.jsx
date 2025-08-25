import React, { useState, useEffect } from "react";
import axiosInstance from "../../../utils/axiosConfig";

export default function Add() {
  // ---- State cũ ----
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [preview, setPreview] = useState(null);

  const weightOptions = ["0.5kg", "1kg", "1.5kg", "2kg"];
  const ripenessOptions = ["Chín", "Xanh", "Chín vừa"];

  const [selectedWeights, setSelectedWeights] = useState([]);
  const [selectedRipeness, setSelectedRipeness] = useState([]);

  const [baseWeight, setBaseWeight] = useState("");
  const [baseRipeness, setBaseRipeness] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");

  const [submitting, setSubmitting] = useState(false);

  // ---- State mới cho Preorder ----
  const [enablePreorder, setEnablePreorder] = useState(false);
  const [depositPercent, setDepositPercent] = useState(20);
  const [quota, setQuota] = useState(0);
  const [windowStart, setWindowStart] = useState("");
  const [windowEnd, setWindowEnd] = useState("");
  const [expectedHarvestStart, setExpectedHarvestStart] = useState("");
  const [expectedHarvestEnd, setExpectedHarvestEnd] = useState("");

  // Lấy danh mục & địa điểm
  useEffect(() => {
    const fetchData = async () => {
      const [catRes, locRes] = await Promise.all([
        axiosInstance.get("/category"),
        axiosInstance.get("/locations"),
      ]);
      setCategories(catRes.data || []);
      setLocations(locRes.data || []);
    };
    fetchData();
  }, []);

  // Toggle chọn weight
  const toggleWeight = (w) => {
    setSelectedWeights((prev) =>
      prev.includes(w) ? prev.filter((x) => x !== w) : [...prev, w]
    );
  };

  // Toggle chọn ripeness
  const toggleRipeness = (r) => {
    setSelectedRipeness((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]
    );
  };

  // Upload ảnh
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("image", file);

    try {
      const res = await axiosInstance.post("/upload", formData);
      const imagePath = res.data?.imagePath;
      if (!imagePath) throw new Error("Không nhận được đường dẫn ảnh");
      setImage(imagePath);
      setPreview(imagePath.startsWith("http") ? imagePath : `http://localhost:4000${imagePath}`);
    } catch (err) {
      console.error("Lỗi upload ảnh:", err);
      alert("Không thể tải ảnh lên.");
    }
  };

  const toISOorNull = (d) => (d ? new Date(d).toISOString() : null);

  // Submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (selectedWeights.length === 0 || selectedRipeness.length === 0) {
      alert("❌ Vui lòng chọn ít nhất 1 khối lượng và 1 tình trạng");
      return;
    }

    if (!baseWeight || !baseRipeness) {
      alert("❌ Vui lòng chọn baseVariant");
      return;
    }

    const newProduct = {
      name,
      description,
      image,
      category,
      location,
      weightOptions: selectedWeights,
      ripenessOptions: selectedRipeness,
      baseVariant: {
        attributes: { weight: baseWeight, ripeness: baseRipeness },
        price: Number(price) || 0,
        stock: Number(stock) || 0,
      },
    };

    // Nếu bật Preorder -> gắn thêm config
    if (enablePreorder) {
      newProduct.preorder = {
        enabled: true,
        depositPercent: Number(depositPercent) || 0,
        quota: Number(quota) || 0,
        windowStart: toISOorNull(windowStart),
        windowEnd: toISOorNull(windowEnd),
        expectedHarvestStart: toISOorNull(expectedHarvestStart),
        expectedHarvestEnd: toISOorNull(expectedHarvestEnd),
        soldPreorder: 0,
        priceLock: true,
        cancelPolicy: { feePercent: 10 },
      };
    }

    try {
      setSubmitting(true);
      await axiosInstance.post("/product/add", newProduct);
      alert("✅ Thêm sản phẩm thành công!");

      // Reset form
      setName("");
      setDescription("");
      setImage("");
      setPreview(null);
      setCategory("");
      setLocation("");
      setSelectedWeights([]);
      setSelectedRipeness([]);
      setBaseWeight("");
      setBaseRipeness("");
      setPrice("");
      setStock("");
      setEnablePreorder(false);
      setDepositPercent(20);
      setQuota(0);
      setWindowStart("");
      setWindowEnd("");
      setExpectedHarvestStart("");
      setExpectedHarvestEnd("");
    } catch (err) {
      console.error("🔴 Lỗi:", err?.response?.data || err);
      alert("❌ Lỗi khi thêm sản phẩm.");
    } finally {
      setSubmitting(false);
    }
  };

  const chipCls = (active) =>
    `px-3 py-1 rounded-full border text-sm ${
      active ? "bg-green-100 border-green-500 text-green-700" : "bg-white border-gray-300 text-gray-700"
    }`;

  const inputStyle =
    "border border-gray-300 rounded-lg px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white rounded-xl shadow">
      <h1 className="text-2xl font-bold mb-4">Thêm sản phẩm</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ---- Thông tin cơ bản ---- */}
        <input
          type="text"
          placeholder="Tên sản phẩm"
          className={inputStyle}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <textarea
          placeholder="Mô tả"
          className={inputStyle}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />

        {/* Upload ảnh */}
        <div>
          <input type="file" accept="image/*" onChange={handleImageUpload} />
          {preview && (
            <img
              src={preview}
              alt="Ảnh xem trước"
              className="w-32 h-32 object-cover rounded-lg mt-2 border"
            />
          )}
        </div>

        {/* Danh mục */}
        <select
          className={inputStyle}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          required
          aria-label="Chọn danh mục"
        >
          <option value="">-- Chọn danh mục --</option>
          {categories.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>

        {/* Địa điểm */}
        <select
          className={inputStyle}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          required
          aria-label="Chọn địa điểm"
        >
          <option value="">-- Chọn địa điểm --</option>
          {locations.map((l) => (
            <option key={l._id} value={l._id}>
              {l.name}
            </option>
          ))}
        </select>

        {/* ---- Biến thể ---- */}
        <div>
          <h3 className="font-semibold">Chọn khối lượng</h3>
          <div className="flex flex-wrap gap-2 mt-2">
            {weightOptions.map((w) => (
              <button
                type="button"
                key={w}
                className={chipCls(selectedWeights.includes(w))}
                onClick={() => toggleWeight(w)}
              >
                {w}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-semibold mt-4">Chọn tình trạng</h3>
          <div className="flex flex-wrap gap-2 mt-2">
            {ripenessOptions.map((r) => (
              <button
                type="button"
                key={r}
                className={chipCls(selectedRipeness.includes(r))}
                onClick={() => toggleRipeness(r)}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Base variant */}
        <div className="grid grid-cols-2 gap-2 mt-4">
          <select
            className={inputStyle}
            value={baseWeight}
            onChange={(e) => setBaseWeight(e.target.value)}
            required
            aria-label="Base Weight"
          >
            <option value="">-- Base Weight --</option>
            {selectedWeights.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
          <select
            className={inputStyle}
            value={baseRipeness}
            onChange={(e) => setBaseRipeness(e.target.value)}
            required
            aria-label="Base Ripeness"
          >
            <option value="">-- Base Ripeness --</option>
            {selectedRipeness.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {/* Giá & tồn kho */}
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            min="0"
            placeholder="Giá (vnđ)"
            className={inputStyle}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
          <input
            type="number"
            min="0"
            placeholder="Tồn kho"
            className={inputStyle}
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            required
          />
        </div>

        {/* ---- Mới: Cấu hình Sắp vào mùa ---- */}
        <div className="mt-6 border-t pt-4">
          <h2 className="text-lg font-semibold mb-2">⚡ Cấu hình Sản phẩm Sắp vào mùa</h2>
          <label className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              checked={enablePreorder}
              onChange={(e) => setEnablePreorder(e.target.checked)}
            />
            Bật chế độ đặt trước (Coming Soon)
          </label>

          {enablePreorder && (
            <div className="space-y-3">
              {/* Phần trăm cọc */}
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Phần trăm cọc (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="Ví dụ: 20 nghĩa là khách đặt cọc 20% giá trị đơn"
                  className={inputStyle}
                  value={depositPercent}
                  onChange={(e) => setDepositPercent(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Số tiền cọc sẽ tính = (Giá * Số lượng) × (Phần trăm cọc / 100).
                </p>
              </div>

              {/* Hạn mức đặt trước */}
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Số lượng tối đa nhận đặt trước
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="Ví dụ: 100 nghĩa là chỉ nhận tối đa 100 suất đặt trước"
                  className={inputStyle}
                  value={quota}
                  onChange={(e) => setQuota(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Khi đạt tối đa hạn mức, sản phẩm sẽ hiển thị hết suất đặt trước.
                </p>
              </div>

              {/* Thời gian mở đặt trước */}
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Thời gian mở đặt trước
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    className={inputStyle}
                    value={windowStart}
                    onChange={(e) => setWindowStart(e.target.value)}
                  />
                  <input
                    type="date"
                    className={inputStyle}
                    value={windowEnd}
                    onChange={(e) => setWindowEnd(e.target.value)}
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
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    className={inputStyle}
                    value={expectedHarvestStart}
                    onChange={(e) => setExpectedHarvestStart(e.target.value)}
                  />
                  <input
                    type="date"
                    className={inputStyle}
                    value={expectedHarvestEnd}
                    onChange={(e) => setExpectedHarvestEnd(e.target.value)}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Khoảng thời gian dự kiến trái cây chín và có thể giao cho khách.
                </p>
              </div>
            </div>
          )}
        </div>

        <button
          type="submit"
          className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 w-full"
          disabled={submitting}
        >
          {submitting ? "Đang thêm..." : "Thêm sản phẩm"}
        </button>
      </form>
    </div>
  );
}
