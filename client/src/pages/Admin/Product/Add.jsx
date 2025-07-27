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

  const [gradeOptions] = useState(["A", "B", "C"]);
  const [weightOptions] = useState(["0.5kg", "1kg", "1.5kg", "2kg"]);
  const [ripenessOptions] = useState(["Chín", "Xanh"]);

  const [baseGrade, setBaseGrade] = useState("A");
  const [baseWeight, setBaseWeight] = useState("1kg");
  const [baseRipeness, setBaseRipeness] = useState("Chín");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");

  const [submitting, setSubmitting] = useState(false);

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

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("image", file);

    try {
      const res = await axiosInstance.post("/upload", formData);
      const imagePath = res.data.imagePath;

      // ✅ Gửi imagePath về BE (ví dụ: /images/abc.jpg)
      setImage(imagePath);

      // ✅ Hiển thị ảnh đúng từ server BE ở cổng 3000
      setPreview(`http://localhost:3000${imagePath}`);
    } catch (err) {
      console.error("Lỗi upload ảnh:", err);
      alert("Không thể tải ảnh lên.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newProduct = {
      name,
      description,
      image, // ➜ Đường dẫn tương đối
      category,
      location,
      gradeOptions,
      weightOptions,
      ripenessOptions,
      baseVariant: {
        attributes: {
          grade: baseGrade,
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
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-xl shadow">
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

        <input
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className={inputStyle}
        />
        {preview && (
          <img
            src={preview}
            alt="Ảnh xem trước"
            className="w-32 h-32 object-cover rounded-lg mt-2 border border-gray-300"
          />
        )}

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

        <div className="grid grid-cols-3 gap-2">
          <select
            className={inputStyle}
            value={baseGrade}
            onChange={(e) => setBaseGrade(e.target.value)}
          >
            {gradeOptions.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <select
            className={inputStyle}
            value={baseWeight}
            onChange={(e) => setBaseWeight(e.target.value)}
          >
            {weightOptions.map((w) => (
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
            {ripenessOptions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            placeholder="Giá (vnđ)"
            className={inputStyle}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
          <input
            type="number"
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
