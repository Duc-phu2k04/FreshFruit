// src/pages/admin/product/ProductList.jsx
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import axiosInstance from "../../../utils/axiosConfig";
import {
  PlusIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  TrashIcon,
  ClipboardIcon,
} from "@heroicons/react/24/outline";
import Loader from "../../../components/common/Loader";

/** Utils nhỏ gọn cho FE (fallback nếu BE chưa gắn _expiry/priceView) */
const toNum = (v, def = 0) => (Number.isFinite(Number(v)) ? Number(v) : def);
const sumBy = (arr, fn) => arr.reduce((s, x) => s + toNum(fn(x), 0), 0);

const imageURL = (path) =>
  path?.startsWith("http") ? path : `http://localhost:3000${path || ""}`;

const shortId = (id = "") =>
  id.length <= 10 ? id : `${id.slice(0, 6)}…${id.slice(-4)}`;

const fmtDate = (d) => {
  if (!d) return "-";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const deriveExpiryFE = (p) => {
  // Ưu tiên _expiry của BE (đã có sẵn trong productService mới)
  if (p?._expiry) return p._expiry;

  // Fallback đơn giản khi BE cũ
  const ex = p?.expiry || {};
  const expireAt = ex.expireDate || ex.expiryDate || null;
  let daysLeft = null;
  let isNearExpiry = false;
  let discountPercent = toNum(ex?.discountNearExpiry?.percent || ex?.discountPercent, 0);

  if (expireAt) {
    const d = new Date(expireAt);
    const now = new Date();
    const ms = d.getTime() - now.getTime();
    daysLeft = Math.ceil(ms / (1000 * 60 * 60 * 24));
    const threshold = toNum(ex?.discountNearExpiry?.thresholdDays || ex?.nearExpiryDays, 0);
    isNearExpiry = Number.isFinite(daysLeft) && daysLeft >= 0 && daysLeft <= threshold;
  }

  const basePrice =
    toNum(p?.priceView?.base?.originalPrice) ||
    toNum(p?.baseVariant?.price) ||
    toNum(p?.variants?.[0]?.price);

  const finalPrice =
    isNearExpiry && discountPercent > 0
      ? Math.round(basePrice * (1 - discountPercent / 100))
      : basePrice;

  return {
    expireAt: expireAt ? new Date(expireAt) : null,
    daysLeft,
    isNearExpiry,
    discountPercent,
    basePrice,
    finalPrice,
  };
};

export default function ProductList() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Tìm kiếm & sắp xếp
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "name", direction: "ascending" });

  // Bộ lọc nhanh theo trạng thái
  const [filterNear, setFilterNear] = useState(false); // cận hạn (có thể kèm giảm)
  const [filterDiscount, setFilterDiscount] = useState(false); // có giảm cận hạn
  const [filterExpired, setFilterExpired] = useState(false); // quá hạn
  const [filterComing, setFilterComing] = useState(false); // sản phẩm Coming Soon

  // Tải cả 2 loại: thường & coming soon
  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [normalRes, comingRes] = await Promise.all([
        axiosInstance.get("/product", { params: { preorder: "false" } }),
        axiosInstance.get("/product", { params: { preorder: "true" } }),
      ]);

      const arr1 = normalRes.data?.data || normalRes.data || [];
      const arr2 = comingRes.data?.data || comingRes.data || [];

      // Gộp & loại trùng theo _id
      const map = new Map();
      [...arr1, ...arr2].forEach((p) => map.set(p._id, p));
      const merged = [...map.values()];

      // Enrich dữ liệu để hiển thị quản trị
      const enriched = merged.map((p) => {
        const ex = deriveExpiryFE(p);
        const isComingSoon = !!p?.preorder?.enabled;
        const isExpired = typeof ex.daysLeft === "number" && ex.daysLeft < 0;
        const hasDiscount = !isComingSoon && ex.isNearExpiry && ex.discountPercent > 0;
        const stockTotal =
          sumBy(p?.variants || [], (v) => v?.stock) ||
          toNum(p?.baseVariant?.stock) ||
          toNum(p?.variants?.[0]?.stock);

        return {
          ...p,
          // các field đã chuẩn hoá để sắp xếp/lọc/hiển thị
          __normalized: {
            isComingSoon,
            isExpired,
            isNearExpiry: !!ex.isNearExpiry,
            hasDiscount,
            daysLeft: ex.daysLeft,
            expireAt: ex.expireAt,
            priceBase:
              toNum(p?.priceView?.base?.originalPrice) ||
              toNum(p?.baseVariant?.price) ||
              toNum(p?.variants?.[0]?.price),
            priceFinal:
              toNum(p?.priceView?.base?.finalPrice) || toNum(ex.finalPrice) || 0,
            discountPercent: toNum(ex.discountPercent),
            stockTotal,
          },
        };
      });

      setProducts(enriched);
    } catch (err) {
      console.error(err);
      setError("Lỗi khi tải danh sách sản phẩm. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Xoá
  const handleDeleteProduct = async (productId) => {
    if (!window.confirm("Bạn có chắc muốn xóa sản phẩm này?")) return;
    try {
      await axiosInstance.delete(`/product/${productId}`);
      alert("🗑️ Xóa sản phẩm thành công");
      fetchProducts();
    } catch (err) {
      console.error("Lỗi khi xóa sản phẩm:", err);
      alert("❌ Lỗi khi xóa sản phẩm");
    }
  };

  // Copy ID
  const handleCopyId = async (id) => {
    try {
      await navigator.clipboard.writeText(id);
      alert("Đã copy ID vào clipboard!");
    } catch {
      alert("Không thể copy ID.");
    }
  };

  // Tìm kiếm + lọc
  const filtered = useMemo(() => {
    let data = [...products];

    if (searchTerm) {
      const q = searchTerm.toLowerCase().trim();
      data = data.filter((p) => {
        const cat = p?.category?.name || "";
        const loc = p?.location?.name || "";
        return (
          p?.name?.toLowerCase().includes(q) ||
          cat.toLowerCase().includes(q) ||
          loc.toLowerCase().includes(q) ||
          p?._id?.toLowerCase().includes(q)
        );
      });
    }

    // Bộ lọc trạng thái
    data = data.filter((p) => {
      const s = p.__normalized || {};
      if (filterNear && !s.isNearExpiry) return false;
      if (filterDiscount && !s.hasDiscount) return false;
      if (filterExpired && !s.isExpired) return false;
      if (filterComing && !s.isComingSoon) return false;
      return true;
    });

    return data;
  }, [products, searchTerm, filterNear, filterDiscount, filterExpired, filterComing]);

  // Sắp xếp
  const sorted = useMemo(() => {
    const data = [...filtered];
    const { key, direction } = sortConfig;
    const dir = direction === "ascending" ? 1 : -1;

    data.sort((a, b) => {
      const A = a.__normalized || {};
      const B = b.__normalized || {};

      let av;
      let bv;

      switch (key) {
        case "category":
          av = a?.category?.name || "";
          bv = b?.category?.name || "";
          break;
        case "location":
          av = a?.location?.name || "";
          bv = b?.location?.name || "";
          break;
        case "price":
          av = toNum(A.priceFinal || A.priceBase);
          bv = toNum(B.priceFinal || B.priceBase);
          break;
        case "stock":
          av = toNum(A.stockTotal);
          bv = toNum(B.stockTotal);
          break;
        case "daysLeft":
          // null/undefined đẩy xuống cuối
          av = typeof A.daysLeft === "number" ? A.daysLeft : Infinity;
          bv = typeof B.daysLeft === "number" ? B.daysLeft : Infinity;
          break;
        default:
          av = (a[key] ?? "").toString().toLowerCase();
          bv = (b[key] ?? "").toString().toLowerCase();
      }

      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });

    return data;
  }, [filtered, sortConfig]);

  const requestSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "ascending" ? "descending" : "ascending" };
      }
      return { key, direction: "ascending" };
    });
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === "ascending" ? (
      <ArrowUpIcon className="h-4 w-4 ml-1 inline" />
    ) : (
      <ArrowDownIcon className="h-4 w-4 ml-1 inline" />
    );
  };

  const renderBadges = (p) => {
    const s = p.__normalized || {};
    const badges = [];

    if (s.isComingSoon) {
      badges.push(
        <span key="coming" className="inline-block px-2 py-0.5 text-xs rounded-full border border-amber-300 text-amber-700 bg-amber-50">
          Coming Soon
        </span>
      );
    }
    if (s.isExpired) {
      badges.push(
        <span key="expired" className="inline-block px-2 py-0.5 text-xs rounded-full bg-red-600 text-white">
          Quá hạn
        </span>
      );
    } else if (s.isNearExpiry) {
      badges.push(
        <span key="near" className="inline-block px-2 py-0.5 text-xs rounded-full bg-amber-500 text-white">
          Cận hạn{s.discountPercent > 0 ? ` -${s.discountPercent}%` : ""}
        </span>
      );
    }
    if (s.stockTotal <= 0) {
      badges.push(
        <span key="oos" className="inline-block px-2 py-0.5 text-xs rounded-full bg-gray-200 text-gray-700">
          Hết hàng
        </span>
      );
    }

    return <div className="flex gap-1 flex-wrap">{badges}</div>;
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="text-center p-10">
          <Loader />
        </div>
      );
    }
    if (error) return <p className="text-center text-red-500">{error}</p>;
    if (!sorted.length) return <p className="text-center text-gray-500">Không có sản phẩm.</p>;

    return (
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-[28%]">
                <button onClick={() => requestSort("name")} className="flex items-center">
                  Sản phẩm {getSortIcon("name")}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                <button onClick={() => requestSort("category")} className="flex items-center">
                  Danh mục {getSortIcon("category")}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                <button onClick={() => requestSort("location")} className="flex items-center">
                  Khu vực {getSortIcon("location")}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                <button onClick={() => requestSort("price")} className="flex items-center">
                  Giá {getSortIcon("price")}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                <button onClick={() => requestSort("stock")} className="flex items-center">
                  Tồn {getSortIcon("stock")}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                <button onClick={() => requestSort("daysLeft")} className="flex items-center">
                  HSD {getSortIcon("daysLeft")}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-[180px]">
                Trạng thái
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Hành động
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {sorted.map((p) => {
              const s = p.__normalized || {};
              const showOld = s.priceFinal < s.priceBase && s.priceBase > 0;
              return (
                <tr key={p._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={imageURL(p.image)}
                        alt={p.name}
                        className="h-12 w-12 object-cover rounded border"
                      />
                      <div>
                        <div className="font-semibold">{p.name}</div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>ID: {shortId(p._id)}</span>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                            onClick={() => handleCopyId(p._id)}
                            title="Copy ID"
                          >
                            <ClipboardIcon className="h-4 w-4" /> Copy
                          </button>
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3">{p?.category?.name || "—"}</td>
                  <td className="px-4 py-3">{p?.location?.name || "—"}</td>

                  <td className="px-4 py-3">
                    {showOld ? (
                      <div className="flex flex-col leading-tight">
                        <span className="text-red-600 font-semibold">
                          {s.priceFinal.toLocaleString("vi-VN")}₫
                        </span>
                        <span className="text-gray-400 line-through text-xs">
                          {s.priceBase.toLocaleString("vi-VN")}₫
                        </span>
                      </div>
                    ) : (
                      <span className="font-medium">
                        {s.priceFinal.toLocaleString("vi-VN")}₫
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3">{s.stockTotal ?? "—"}</td>

                  <td className="px-4 py-3">
                    {p._expiry?.expireAt || p?.expiry?.expireDate || p?.expiry?.expiryDate ? (
                      <>
                        <div>HSD: {fmtDate(s.expireAt)}</div>
                        {typeof s.daysLeft === "number" && (
                          <div className={`text-xs ${s.daysLeft < 0 ? "text-red-600" : "text-gray-500"}`}>
                            {s.daysLeft < 0
                              ? `Quá hạn ${Math.abs(s.daysLeft)} ngày`
                              : `Còn ${s.daysLeft} ngày`}
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-400 text-sm">—</span>
                    )}
                  </td>

                  <td className="px-4 py-3">{renderBadges(p)}</td>

                  <td className="px-4 py-3 text-right space-x-3 whitespace-nowrap">
                    <Link
                      to={`/admin/products/detail/${p._id}`}
                      className="text-blue-600 hover:underline"
                    >
                      Xem/Sửa
                    </Link>
                    <button
                      onClick={() => handleDeleteProduct(p._id)}
                      className="text-red-600 hover:underline inline-flex items-center gap-1"
                    >
                      <TrashIcon className="h-4 w-4" /> Xóa
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-4">
      {/* Header + Search + Add + Quick Filters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
        <h1 className="text-2xl font-bold">Quản lý sản phẩm</h1>

        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Tìm theo tên, danh mục, khu vực, ID…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border px-4 py-2 rounded-lg w-[260px]"
          />

          <Link
            to="/admin/products/add"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <PlusIcon className="h-5 w-5" />
            Thêm sản phẩm
          </Link>
        </div>
      </div>

      {/* Quick filters */}
      <div className="bg-white rounded-lg shadow p-3 mb-4 flex flex-wrap gap-3 items-center">
        <span className="text-sm text-gray-600 mr-2">Bộ lọc nhanh:</span>

        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={filterNear} onChange={(e) => setFilterNear(e.target.checked)} />
          Cận hạn
        </label>

        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filterDiscount}
            onChange={(e) => setFilterDiscount(e.target.checked)}
          />
          Đang giảm (cận hạn)
        </label>

        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filterExpired}
            onChange={(e) => setFilterExpired(e.target.checked)}
          />
          Quá hạn
        </label>

        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filterComing}
            onChange={(e) => setFilterComing(e.target.checked)}
          />
          Coming Soon
        </label>
      </div>

      {renderContent()}
    </div>
  );
}
