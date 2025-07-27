import React, { useState, useEffect } from 'react';
import axiosInstance from '../../../utils/axiosConfig';
import { useNavigate, useParams } from 'react-router-dom';

export default function EditProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();

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

  // Lấy thông tin sản phẩm hiện tại
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await axiosInstance.get(`/products/${id}`);
        const data = res.data;

        setName(data.name);
        setDescription(data.description);
        setPrice(data.baseVariant?.price || '');
        setStock(data.baseVariant?.stock || '');
        setImage(data.image);
        setCategory(data.category || '');
        setLocation(data.location || '');
        setImagePreview(data.image);
        setVariants(data.variants || []);
      } catch (err) {
        console.error('Lỗi khi lấy sản phẩm:', err);
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
        setCategories(catRes.data);
        setLocations(locRes.data);
      } catch (err) {
        console.error('Lỗi khi lấy danh mục/địa điểm:', err);
      }
    };

    fetchData();
  }, []);

  // Xử lý chọn ảnh mới
  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await axiosInstance.post('/upload', formData);
      setImage(res.data.url);
      setImagePreview(URL.createObjectURL(file));
    } catch (err) {
      console.error('Lỗi upload ảnh:', err);
    }
  };

  // Submit cập nhật
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await axiosInstance.put(`/product/${id}`, {
        name,
        description,
        image,
        category,
        location,
        baseVariant: {
          price: parseFloat(price),
          stock: parseInt(stock),
        },
        variants, // ✅ Giữ lại biến thể cũ
      });

      alert('Cập nhật sản phẩm thành công!');
      navigate('/admin/products');
    } catch (err) {
      console.error('Lỗi cập nhật sản phẩm:', err);
      alert('Cập nhật thất bại!');
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-6 bg-white shadow p-6 rounded">
      <h2 className="text-2xl font-bold mb-4">Cập nhật sản phẩm</h2>
      <form onSubmit={handleSubmit} className="space-y-4">

        <div>
          <label className="block font-medium">Tên sản phẩm</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full border px-3 py-2 rounded"
          />
        </div>

        <div>
          <label className="block font-medium">Mô tả</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            className="w-full border px-3 py-2 rounded"
          />
        </div>

        <div>
          <label className="block font-medium">Giá gốc (base)</label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
            className="w-full border px-3 py-2 rounded"
          />
        </div>

        <div>
          <label className="block font-medium">Tồn kho (base)</label>
          <input
            type="number"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            required
            className="w-full border px-3 py-2 rounded"
          />
        </div>

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

        <div>
          <label className="block font-medium">Danh mục</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
            className="w-full border px-3 py-2 rounded"
          >
            <option value="">-- Chọn danh mục --</option>
            {categories.map((cat) => (
              <option key={cat._id} value={cat._id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-medium">Địa điểm</label>
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
            className="w-full border px-3 py-2 rounded"
          >
            <option value="">-- Chọn địa điểm --</option>
            {locations.map((loc) => (
              <option key={loc._id} value={loc._id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>

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
