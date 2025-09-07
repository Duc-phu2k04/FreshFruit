// src/pages/admin/product/Add.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../../../utils/axiosConfig";

export default function Add() {
  const navigate = useNavigate();

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

  // ---- State mới cho Preorder (Coming Soon) ----
  const [enablePreorder, setEnablePreorder] = useState(false);
  const [depositPercent, setDepositPercent] = useState(20);
  const [quota, setQuota] = useState(0);
  const [windowStart, setWindowStart] = useState("");
  const [windowEnd, setWindowEnd] = useState("");
  const [expectedHarvestStart, setExpectedHarvestStart] = useState("");
  const [expectedHarvestEnd, setExpectedHarvestEnd] = useState("");

  // ---- State mới cho Hạn sử dụng ----
  const [enableExpiry, setEnableExpiry] = useState(false);
  const [expireDate, setExpireDate] = useState(""); // yyyy-mm-dd
  const [mfgDate, setMfgDate] = useState("");       // yyyy-mm-dd (đổi nhãn thành Ngày nhập kho)
  const [shelfLifeDays, setShelfLifeDays] = useState("");
  const [nearActive, setNearActive] = useState(false);
  const [thresholdDays, setThresholdDays] = useState(0);
  const [discountPercentNear, setDiscountPercentNear] = useState(0);

  // Lấy danh mục & địa điểm
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [catRes, locRes] = await Promise.all([
          axiosInstance.get("/category"),
          axiosInstance.get("/locations"),
        ]);
        setCategories(catRes.data || []);
        setLocations(locRes.data || []);
      } catch (e) {
        console.error("[Add] Lỗi tải danh mục/địa điểm:", e);
      }
    };
    fetchData();
  }, []);

  // Khi bật Coming Soon -> tắt theo dõi hạn sử dụng + khoá UI hạn sử dụng
  useEffect(() => {
    if (enablePreorder && enableExpiry) {
      setEnableExpiry(false);
    }
  }, [enablePreorder]); // intentionally only reacts to preorder switch

  const toggleWeight = (w) => {
    setSelectedWeights((prev) =>
      prev.includes(w) ? prev.filter((x) => x !== w) : [...prev, w]
    );
  };
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
      const imagePath = res.data?.imagePath || res.data?.url;
      if (!imagePath) throw new Error("Không nhận được đường dẫn ảnh");
      setImage(imagePath);
      setPreview(
        imagePath.startsWith("http")
          ? imagePath
          : `http://localhost:3000${imagePath}`
      );
    } catch (err) {
      console.error("[Add] Lỗi upload ảnh:", err?.response?.data || err);
      alert("Không thể tải ảnh lên.");
    }
  };

  const toISOorNull = (d) => {
    if (!d) return null;
    const dt = new Date(d);
    return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
  };

  // Xây payload
  const buildPayload = () => {
    const basePriceNum = Number(price) || 0;
    const baseStockNum = Number(stock) || 0;

    const payload = {
      name: String(name || "").trim(),
      description: String(description || ""),
      image: String(image || ""),
      category: category || null,
      location: location || null,
      weightOptions: [...selectedWeights],
      ripenessOptions: [...selectedRipeness],
      baseVariant: {
        attributes: { weight: baseWeight || "", ripeness: baseRipeness || "" },
        price: basePriceNum,
        stock: baseStockNum,
      },
    };

    if (enablePreorder) {
      payload.preorder = {
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

    // Chỉ gửi expiry khi KHÔNG phải Coming Soon
    if (enableExpiry && !enablePreorder) {
      const exp = {};
      if (expireDate) {
        exp.expireDate = toISOorNull(expireDate); // ưu tiên expireDate
      } else {
        exp.mfgDate = toISOorNull(mfgDate);
        exp.shelfLifeDays =
          shelfLifeDays === "" ? null : Number(shelfLifeDays) || 0;
      }
      exp.discountNearExpiry = {
        active: !!nearActive,
        thresholdDays: Number(thresholdDays) || 0,
        percent: Number(discountPercentNear) || 0,
      };
      payload.expiry = exp;
    }

    return payload;
  };

  // Submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    // kiểm tra nhanh phía client
    if (selectedWeights.length === 0 || selectedRipeness.length === 0) {
      alert("❌ Vui lòng chọn ít nhất 1 khối lượng và 1 tình trạng");
      return;
    }
    if (!baseWeight || !baseRipeness) {
      alert("❌ Vui lòng chọn baseVariant");
      return;
    }

    const newProduct = buildPayload();

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

      // Reset preorder
      setEnablePreorder(false);
      setDepositPercent(20);
      setQuota(0);
      setWindowStart("");
      setWindowEnd("");
      setExpectedHarvestStart("");
      setExpectedHarvestEnd("");

      // Reset expiry
      setEnableExpiry(false);
      setExpireDate("");
      setMfgDate("");
      setShelfLifeDays("");
      setNearActive(false);
      setThresholdDays(0);
      setDiscountPercentNear(0);

      // Điều hướng về danh sách
      navigate("/admin/products");
    } catch (err) {
      console.error("[Add] Lỗi /product/add:", err?.response?.data || err);
      alert(
        err?.response?.data?.message ||
          "❌ Lỗi khi thêm sản phẩm. Vui lòng thử lại."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const chipCls = (active) =>
    `px-3 py-1 rounded-full border text-sm ${
      active
        ? "bg-green-100 border-green-500 text-green-700"
        : "bg-white border-gray-300 text-gray-700 hover:border-green-400"
    }`;

  const inputStyle =
    "border border-gray-300 rounded-lg px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500";

  const cardCls =
    "bg-white rounded-xl border border-gray-200 shadow-sm p-4 md:p-5";

  const sectionTitleCls = "text-lg font-semibold mb-3 flex items-center gap-2";

  const expiryLocked = !!enablePreorder; // khi Coming Soon bật, khoá toàn bộ HSD

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      {/* Header + Back */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/admin/products")}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            <span className="text-lg">←</span>
            <span>Quay về danh sách</span>
          </button>
          <h1 className="text-2xl font-bold">Thêm sản phẩm</h1>
        </div>

        <div className="text-sm text-gray-500">
          Trạng thái:{" "}
          {enablePreorder ? (
            <span className="text-amber-700 font-medium">Coming Soon</span>
          ) : enableExpiry ? (
            <span className="text-green-700 font-medium">
              Theo dõi hạn sử dụng
            </span>
          ) : (
            <span className="text-gray-600">Thông thường</span>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Thông tin cơ bản */}
        <section className={cardCls}>
          <h2 className={sectionTitleCls}>🧾 Thông tin cơ bản</h2>
          <div className="grid grid-cols-1 gap-3">
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
              rows={4}
              required
            />

            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-start">
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Ảnh sản phẩm
                </label>
                <input type="file" accept="image/*" onChange={handleImageUpload} />
                <p className="text-xs text-gray-500 mt-1">
                  Hỗ trợ ảnh .jpg, .png. Nên chọn ảnh tỉ lệ 1:1 hoặc 4:3.
                </p>
              </div>
              {preview && (
                <img
                  src={preview}
                  alt="Ảnh xem trước"
                  className="w-28 h-28 object-cover rounded-lg border mx-auto"
                />
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Danh mục
                </label>
                <select
                  className={inputStyle}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                >
                  <option value="">-- Chọn danh mục --</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Khu vực / Nơi bán
                </label>
                <select
                  className={inputStyle}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  required
                >
                  <option value="">-- Chọn địa điểm --</option>
                  {locations.map((l) => (
                    <option key={l._id} value={l._id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* Biến thể & Base variant */}
        <section className={cardCls}>
          <h2 className={sectionTitleCls}>🧬 Biến thể & Base variant</h2>

          <div className="mb-3">
            <h3 className="font-medium text-sm text-gray-700">Chọn khối lượng</h3>
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

          <div className="mb-4">
            <h3 className="font-medium text-sm text-gray-700">Chọn tình trạng</h3>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Base Weight
              </label>
              <select
                className={inputStyle}
                value={baseWeight}
                onChange={(e) => setBaseWeight(e.target.value)}
                required
              >
                <option value="">-- Chọn --</option>
                {selectedWeights.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Base Ripeness
              </label>
              <select
                className={inputStyle}
                value={baseRipeness}
                onChange={(e) => setBaseRipeness(e.target.value)}
                required
              >
                <option value="">-- Chọn --</option>
                {selectedRipeness.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Giá (VNĐ)</label>
              <input
                type="number"
                min="0"
                className={inputStyle}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
                placeholder="VD: 45000"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Tồn kho</label>
              <input
                type="number"
                min="0"
                className={inputStyle}
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                required
                placeholder="VD: 100"
              />
            </div>
          </div>
        </section>

        {/* Coming Soon */}
        <section className={cardCls}>
          <h2 className={sectionTitleCls}>⚡ Cấu hình Sản phẩm Sắp vào mùa</h2>

          <label className="flex items-center gap-2 mb-3">
            <input
              type="checkbox"
              checked={enablePreorder}
              onChange={(e) => setEnablePreorder(e.target.checked)}
            />
            <span>Bật chế độ đặt trước (Coming Soon)</span>
          </label>

          {enablePreorder && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Phần trăm cọc (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className={inputStyle}
                    value={depositPercent}
                    onChange={(e) => setDepositPercent(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Số lượng tối đa nhận đặt trước
                  </label>
                  <input
                    type="number"
                    min="0"
                    className={inputStyle}
                    value={quota}
                    onChange={(e) => setQuota(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Thời gian mở đặt trước
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Dự kiến mùa vụ (thời gian giao hàng)
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
              </div>
            </div>
          )}
        </section>

        {/* Hạn sử dụng & Giảm giá cận hạn */}
        <section className={cardCls}>
          <h2 className={sectionTitleCls}>🍏 Hạn sử dụng & Giảm giá cận hạn</h2>

          <label className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              checked={enableExpiry}
              onChange={(e) => setEnableExpiry(e.target.checked)}
              disabled={expiryLocked}
              title={expiryLocked ? "Đang bật Coming Soon - không thể theo dõi HSD" : ""}
            />
            <span>Theo dõi hạn sử dụng / cấu hình giảm giá cận hạn</span>
            {expiryLocked && (
              <span className="text-xs text-red-600 ml-2">
                (Đang bật Coming Soon — không thể theo dõi HSD)
              </span>
            )}
          </label>

          {enableExpiry && !expiryLocked && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Ngày hết hạn (expireDate)
                  </label>
                  <input
                    type="date"
                    className={inputStyle}
                    value={expireDate}
                    onChange={(e) => setExpireDate(e.target.value)}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Nếu nhập Ngày hết hạn, hệ thống sẽ ưu tiên dùng giá trị này.
                  </p>
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Ngày nhập kho
                  </label>
                  <input
                    type="date"
                    className={inputStyle}
                    value={mfgDate}
                    onChange={(e) => setMfgDate(e.target.value)}
                    disabled={!!expireDate}
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Số ngày sử dụng (shelfLifeDays)
                  </label>
                  <input
                    type="number"
                    min="0"
                    className={inputStyle}
                    value={shelfLifeDays}
                    onChange={(e) => setShelfLifeDays(e.target.value)}
                    disabled={!!expireDate}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={nearActive}
                    onChange={(e) => setNearActive(e.target.checked)}
                  />
                  <span>Kích hoạt giảm giá cận hạn</span>
                </label>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Ngưỡng cận hạn (ngày)
                  </label>
                  <input
                    type="number"
                    min="0"
                    className={inputStyle}
                    value={thresholdDays}
                    onChange={(e) => setThresholdDays(e.target.value)}
                    disabled={!nearActive}
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    % giảm khi cận hạn
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className={inputStyle}
                    value={discountPercentNear}
                    onChange={(e) => setDiscountPercentNear(e.target.value)}
                    disabled={!nearActive}
                  />
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Footer actions */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/admin/products")}
            className="w-full md:w-auto px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Hủy & quay về danh sách
          </button>

          <button
            type="submit"
            className="w-full md:w-auto bg-blue-600 text-white font-semibold py-2 px-5 rounded-lg hover:bg-blue-700 disabled:opacity-60"
            disabled={submitting}
          >
            {submitting ? "Đang thêm..." : "Thêm sản phẩm"}
          </button>
        </div>
      </form>
    </div>
  );
}
