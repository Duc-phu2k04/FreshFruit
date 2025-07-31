import React, { useState, useEffect } from "react";
import axiosInstance from "../../../utils/axiosConfig";

export default function Add() {
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

  // Lấy danh mục & địa điểm
  useEffect(() => {
    const fetchData = async () => {
      const [catRes, locRes] = await Promise.all([
        axiosInstance.get("/category"),
        axiosInstance.get("/locations"),
      ]);
      setCategories(catRes.data);
      setLocations(locRes.data);
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
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("image", file);

    try {
      const res = await axiosInstance.post("/upload", formData);
      const imagePath = res.data.imagePath;
      setImage(imagePath);
      setPreview(`http://localhost:3000${imagePath}`);
    } catch (err) {
      console.error("Lỗi upload ảnh:", err);
      alert("Không thể tải ảnh lên.");
    }
  };

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
        attributes: {
          weight: baseWeight,
          ripeness: baseRipeness,
        },
        price: parseFloat(price),
        stock: parseInt(stock),
      },
    };

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
    } catch (err) {
      console.error("🔴 Lỗi:", err.response?.data || err);
      alert("❌ Lỗi khi thêm sản phẩm.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle =
    "border border-gray-300 rounded-lg px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white rounded-xl shadow">
      <h1 className="text-2xl font-bold mb-4">Thêm sản phẩm</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
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
        <input type="file" accept="image/*" onChange={handleImageUpload} />
        {preview && (
          <img
            src={preview}
            alt="Ảnh xem trước"
            className="w-32 h-32 object-cover rounded-lg mt-2 border"
          />
        )}

        {/* Chọn danh mục */}
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

        {/* Chọn địa điểm */}
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

        {/* Chọn biến thể */}
        <div>
          <h3 className="font-semibold">Chọn khối lượng</h3>
          <div className="flex flex-wrap gap-4">
            {weightOptions.map((w) => (
              <label key={w} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedWeights.includes(w)}
                  onChange={() => toggleWeight(w)}
                />
                {w}
              </label>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-semibold mt-4">Chọn tình trạng</h3>
          <div className="flex flex-wrap gap-4">
            {ripenessOptions.map((r) => (
              <label key={r} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedRipeness.includes(r)}
                  onChange={() => toggleRipeness(r)}
                />
                {r}
              </label>
            ))}
          </div>
        </div>

        {/* Chọn baseVariant */}
        <div className="grid grid-cols-2 gap-2 mt-4">
          <select
            className={inputStyle}
            value={baseWeight}
            onChange={(e) => setBaseWeight(e.target.value)}
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
