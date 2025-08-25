// src/pages/Preorder/ComingSoon.jsx
import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

export default function ComingSoon() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();

  // optional filter: category, limit
  const category = searchParams.get("category") || "";
  const limit = searchParams.get("limit") || "24";

  useEffect(() => {
    const fetchPreorderProducts = async () => {
      try {
        const url = new URL("http://localhost:3000/api/product/coming-soon");
        if (category) url.searchParams.set("category", category);
        if (limit) url.searchParams.set("limit", limit);

        const res = await fetch(url.toString());
        if (!res.ok) throw new Error("Không lấy được sản phẩm sắp vào mùa");
        const data = await res.json();

        // Dữ liệu đã được BE lọc sẵn: preorder.enabled = true
        setProducts(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Lỗi khi lấy danh sách preorder:", err);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    setLoading(true);
    fetchPreorderProducts();
  }, [category, limit]);

  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");

  const resolveImg = (img) => {
    if (!img) return "";
    if (img.startsWith("http://") || img.startsWith("https://")) return img;
    return `http://localhost:3000${img}`;
  };

  if (loading) return <p className="text-center mt-10">Đang tải...</p>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Trái cây sắp vào mùa 🍊</h1>

        {/* bộ lọc nhỏ gọn (tuỳ chọn) */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Hiển thị</label>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={limit}
            onChange={(e) => setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              next.set("limit", e.target.value);
              if (!next.get("limit")) next.delete("limit");
              return next;
            })}
          >
            <option value="12">12</option>
            <option value="24">24</option>
            <option value="48">48</option>
          </select>
        </div>
      </div>

      {products.length === 0 ? (
        <p className="text-gray-500">Hiện chưa có sản phẩm nào sắp vào mùa.</p>
      ) : (
        <div className="grid md:grid-cols-3 gap-6">
          {products.map((p) => (
            <div
              key={p._id}
              className="border rounded-lg shadow hover:shadow-lg transition bg-white overflow-hidden"
            >
              <Link to={`/san-pham/${p._id}?preorder=1`}>
                <img
                  src={resolveImg(p.image)}
                  alt={p.name}
                  className="w-full h-48 object-cover"
                />
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-lg line-clamp-1">{p.name}</h2>
                    <span className="px-2 py-0.5 text-[10px] bg-yellow-400 text-white rounded-full font-bold">
                      ĐẶT TRƯỚC
                    </span>
                  </div>

                  <p className="text-sm text-gray-500 mt-1 mb-2 line-clamp-2">
                    {p.description || "Trái cây sắp vào mùa"}
                  </p>

                  {/* Giá tham khảo từ baseVariant (nếu có) */}
                  <p className="text-green-700 font-bold">
                    {p?.baseVariant?.price
                      ? `${Number(p.baseVariant.price).toLocaleString()}đ`
                      : "Liên hệ"}
                  </p>

                  {/* Thời gian dự kiến */}
                  <div className="mt-2 text-xs text-gray-600">
                    <div>
                      Dự kiến:{" "}
                      <b>
                        {fmtDate(p?.preorder?.expectedHarvestStart)} –{" "}
                        {fmtDate(p?.preorder?.expectedHarvestEnd)}
                      </b>
                    </div>
                    {p?.preorder?.windowEnd && (
                      <div>
                        Hạn đặt trước: <b>{fmtDate(p.preorder.windowEnd)}</b>
                      </div>
                    )}
                  </div>

                  <div className="mt-3">
                    <span className="inline-block px-3 py-1 text-xs bg-yellow-400 text-white rounded-full">
                      Đặt trước ngay
                    </span>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
