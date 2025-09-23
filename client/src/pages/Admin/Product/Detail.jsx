// src/pages/admin/product/Detail.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axiosInstance from "../../../utils/axiosConfig";

// helpers nhỏ cho date
const isoToDateInput = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");
const toISOorNull = (d) => (d ? new Date(d).toISOString() : null);

export default function Detail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  // Danh mục / Địa điểm
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);

  // ----- State UI: Expiry -----
  const [enableExpiry, setEnableExpiry] = useState(false);
  const [expireDate, setExpireDate] = useState("");       // yyyy-mm-dd
  const [mfgDate, setMfgDate] = useState("");             // yyyy-mm-dd
  const [shelfLifeDays, setShelfLifeDays] = useState("");

  const [nearActive, setNearActive] = useState(false);
  const [thresholdDays, setThresholdDays] = useState(0);
  const [discountPercent, setDiscountPercent] = useState(0);

  // Preview nhanh HSD từ server (nếu có)
  const expiryView = useMemo(() => {
    // hỗ trợ cả _expiry lẫn expiryView từ service
    if (!product) return null;
    const ev = product.expiryView || {};
    const calc = product._expiry || {};
    return {
      expireAt: ev.expiryDate || calc.expireAt || null,
      daysLeft:
        typeof ev.daysLeft === "number"
          ? ev.daysLeft
          : typeof calc.daysLeft === "number"
          ? calc.daysLeft
          : null,
      isNearExpiry: ev.isNearExpiry ?? calc.isNearExpiry ?? false,
      discountPercent: ev.discountPercent ?? calc.discountPercent ?? 0,
    };
  }, [product]);

  useEffect(() => {
    fetchFilters();
  }, []);

  useEffect(() => {
    fetchProduct();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchFilters = async () => {
    try {
      const [catRes, locRes] = await Promise.all([
        axiosInstance.get("/category"),
        axiosInstance.get("/locations"),
      ]);
      setCategories(catRes.data || []);
      setLocations(locRes.data || []);
    } catch (err) {
      console.error("Lỗi lấy danh mục/địa điểm:", err);
    }
  };

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(`/product/${id}`);
      const data = res.data;
      
      // ✅ Debug: Log variants trước khi set state
      console.log("🔄 [Frontend] Fetched product variants:", data.variants?.map(v => ({
        _id: v._id,
        weight: v.attributes?.weight,
        ripeness: v.attributes?.ripeness,
        price: v.price,
        stock: v.stock
      })));
      
      setProduct(data);

      // ---- map Expiry từ server vào form ----
      const e = data?.expiry || {};
      const hasExpire = !!(e.expireDate || e.expiryDate);
      const ed = hasExpire ? e.expireDate || e.expiryDate : null;

      setEnableExpiry(Boolean(hasExpire || e.mfgDate || e.shelfLifeDays != null || e.discountNearExpiry));

      setExpireDate(isoToDateInput(ed));
      setMfgDate(isoToDateInput(e.mfgDate));
      setShelfLifeDays(
        e.shelfLifeDays == null || Number.isNaN(Number(e.shelfLifeDays)) ? "" : String(e.shelfLifeDays)
      );

      const dne = e.discountNearExpiry || {};
      const legacyActive = typeof e.enabled === "boolean" ? e.enabled : undefined;
      const legacyThreshold = Number.isFinite(Number(e.nearExpiryDays)) ? Number(e.nearExpiryDays) : undefined;
      const legacyPercent = Number.isFinite(Number(e.discountPercent)) ? Number(e.discountPercent) : undefined;

      setNearActive(typeof dne.active === "boolean" ? dne.active : legacyActive ?? false);
      setThresholdDays(
        Number.isFinite(Number(dne.thresholdDays))
          ? Number(dne.thresholdDays)
          : legacyThreshold ?? 0
      );
      setDiscountPercent(
        Number.isFinite(Number(dne.percent)) ? Number(dne.percent) : legacyPercent ?? 0
      );
    } catch (err) {
      console.error("Lỗi khi lấy sản phẩm:", err);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Cập nhật thông tin chung
  const handleSaveGeneral = async () => {
    try {
      await axiosInstance.put(`/product/${id}`, {
        name: product.name,
        description: product.description,
        image: product.image,
        category: product.category?._id || product.category,
        location: product.location?._id || product.location,
      });
      alert("✅ Cập nhật thông tin sản phẩm thành công");
      fetchProduct();
    } catch (err) {
      console.error("Lỗi cập nhật thông tin chung:", err);
      alert("❌ Lỗi khi cập nhật thông tin sản phẩm");
    }
  };

  // ✅ Upload ảnh nhanh (giữ path như các trang khác)
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("image", file);
    try {
      const res = await axiosInstance.post("/upload", formData);
      const imagePath = res.data?.imagePath || res.data?.url;
      if (!imagePath) throw new Error("Không nhận được đường dẫn ảnh");
      setProduct((prev) => ({ ...prev, image: imagePath }));
    } catch (err) {
      console.error("Upload ảnh lỗi:", err);
      alert("Không thể tải ảnh lên.");
    }
  };

  // ✅ Cập nhật BaseVariant / Variant
  const handleSaveVariant = async (variantId, updatedData) => {
    try {
      if (updatedData.isBase) {
        await axiosInstance.put(`/product/${id}`, {
          baseVariant: {
            ...product.baseVariant,
            price: Number(updatedData.price) || 0,
            stock: Number(updatedData.stock) || 0,
          },
        });
      } else {
        // ✅ Tìm variant hiện tại để lấy attributes và debug
        const currentVariant = product.variants.find(v => v._id === variantId);
        if (!currentVariant) {
          alert("❌ Không tìm thấy biến thể");
          return;
        }

        console.log("🔍 Debug variant update:", {
          variantId,
          currentVariant: {
            weight: currentVariant.attributes?.weight,
            ripeness: currentVariant.attributes?.ripeness,
            price: currentVariant.price,
            stock: currentVariant.stock
          },
          updatedData
        });

        const updatePayload = {
          price: Number(updatedData.price) || 0,
          stock: Number(updatedData.stock) || 0,
          // ✅ Gửi kèm attributes để đảm bảo không bị ghi đè
          attributes: {
            weight: currentVariant.attributes?.weight || "",
            ripeness: currentVariant.attributes?.ripeness || "",
            ...currentVariant.attributes
          }
        };
        
        console.log("🚀 [Frontend] Sending API request:", {
          url: `/product/${id}/variant/${variantId}`,
          payload: updatePayload
        });
        
        await axiosInstance.put(`/product/${id}/variant/${variantId}`, updatePayload);
      }
      alert("✅ Cập nhật thành công");
      fetchProduct();
    } catch (err) {
      console.error("Lỗi cập nhật:", err);
      alert("❌ Lỗi khi cập nhật");
    }
  };

  // ✅ Xoá BaseVariant
  const handleDeleteBaseVariant = async () => {
    if (!window.confirm("Bạn có chắc muốn xóa BaseVariant này?")) return;
    try {
      await axiosInstance.put(`/product/${id}`, { baseVariant: null });
      alert("🗑️ Xóa BaseVariant thành công");
      fetchProduct();
    } catch (err) {
      console.error("Lỗi xóa BaseVariant:", err);
      alert("❌ Lỗi khi xóa BaseVariant");
    }
  };

  // ✅ Xoá Variant
  const handleDeleteVariant = async (variantId) => {
    if (!window.confirm("Bạn có chắc muốn xóa biến thể này?")) return;
    try {
      await axiosInstance.delete(`/product/${id}/variant/${variantId}`);
      alert("🗑️ Xóa biến thể thành công");
      fetchProduct();
    } catch (err) {
      console.error("Lỗi xóa biến thể:", err);
      alert("❌ Lỗi khi xóa biến thể");
    }
  };

  // ✅ Lưu cấu hình Hạn sử dụng & Giảm giá cận hạn
  const handleSaveExpiry = async () => {
    try {
      let expiryPayload = undefined;

      if (enableExpiry) {
        // Ưu tiên expireDate nếu có
        if (expireDate) {
          expiryPayload = {
            expireDate: toISOorNull(expireDate),
            discountNearExpiry: {
              active: !!nearActive,
              thresholdDays: Number(thresholdDays) || 0,
              percent: Number(discountPercent) || 0,
            },
          };
        } else if (mfgDate || shelfLifeDays !== "") {
          expiryPayload = {
            mfgDate: toISOorNull(mfgDate),
            shelfLifeDays:
              shelfLifeDays === "" ? null : Math.max(0, Number(shelfLifeDays) || 0),
            discountNearExpiry: {
              active: !!nearActive,
              thresholdDays: Number(thresholdDays) || 0,
              percent: Number(discountPercent) || 0,
            },
          };
        } else {
          // bật mà không nhập gì -> chỉ lưu discountNearExpiry (nếu cần)
          expiryPayload = {
            discountNearExpiry: {
              active: !!nearActive,
              thresholdDays: Number(thresholdDays) || 0,
              percent: Number(discountPercent) || 0,
            },
          };
        }
      } else {
        // muốn tắt/ xoá hẳn cấu hình hạn sử dụng
        expiryPayload = null;
      }

      await axiosInstance.put(`/product/${id}`, { expiry: expiryPayload });
      alert("✅ Cập nhật hạn sử dụng / giảm giá cận hạn thành công");
      fetchProduct();
    } catch (err) {
      console.error("Lỗi lưu expiry:", err?.response?.data || err);
      alert("❌ Lỗi khi cập nhật hạn sử dụng");
    }
  };

  if (loading) return <p>Đang tải...</p>;
  if (!product) return <p>Không tìm thấy sản phẩm</p>;

  return (
    <div className="max-w-5xl mx-auto p-6 bg-white shadow rounded-lg">
      {/* Nút quay lại */}
      <button
        onClick={() => navigate(-1)}
        className="mb-4 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
      >
        ⬅ Quay lại
      </button>

      {/* Thông tin chung */}
      <h2 className="text-xl font-bold mb-2">Thông tin chung</h2>
      <div className="space-y-3 mb-6">
        <input
          type="text"
          value={product.name || ""}
          onChange={(e) => setProduct({ ...product, name: e.target.value })}
          className="border px-3 py-2 w-full rounded"
          placeholder="Tên sản phẩm"
        />
        <textarea
          value={product.description || ""}
          onChange={(e) => setProduct({ ...product, description: e.target.value })}
          className="border px-3 py-2 w-full rounded"
          placeholder="Mô tả sản phẩm"
        />

        {/* Ảnh + upload nhanh */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-center">
          <input
            type="text"
            value={product.image || ""}
            onChange={(e) => setProduct({ ...product, image: e.target.value })}
            className="border px-3 py-2 w-full rounded"
            placeholder="URL ảnh hoặc path từ /upload"
          />
          <label className="inline-block">
            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            <span className="bg-emerald-600 text-white px-4 py-2 rounded cursor-pointer inline-block">
              Tải ảnh
            </span>
          </label>
        </div>

        {/* Danh mục & địa điểm */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select
            value={product.category?._id || product.category || ""}
            onChange={(e) =>
              setProduct({ ...product, category: e.target.value })
            }
            className="border px-3 py-2 w-full rounded"
          >
            <option value="">-- Chọn danh mục --</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>

          <select
            value={product.location?._id || product.location || ""}
            onChange={(e) =>
              setProduct({ ...product, location: e.target.value })
            }
            className="border px-3 py-2 w-full rounded"
          >
            <option value="">-- Chọn địa điểm --</option>
            {locations.map((l) => (
              <option key={l._id} value={l._id}>{l.name}</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleSaveGeneral}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          💾 Lưu thông tin chung
        </button>
      </div>

      {/* ====== HẠN SỬ DỤNG & GIẢM GIÁ CẬN HẠN ====== */}
      <h2 className="text-xl font-bold mt-6 mb-2">🍏 Hạn sử dụng & Giảm giá cận hạn</h2>

      {/* Xem nhanh trạng thái hiện tại */}
      {expiryView && (
        <div className={`mb-3 p-3 rounded border ${
          expiryView.isNearExpiry
            ? "bg-amber-50 border-amber-200 text-amber-800"
            : "bg-gray-50 border-gray-200 text-gray-700"
        }`}>
          <div className="font-semibold">Tình trạng hiện tại</div>
          <div>
            HSD: <b>{expiryView.expireAt ? new Date(expiryView.expireAt).toLocaleDateString() : "—"}</b>
            {typeof expiryView.daysLeft === "number" && (
              <span>
                {" "}— {expiryView.daysLeft >= 0 ? `còn ${expiryView.daysLeft} ngày` : `quá hạn ${Math.abs(expiryView.daysLeft)} ngày`}
              </span>
            )}
          </div>
          {expiryView.isNearExpiry && expiryView.discountPercent > 0 && (
            <div>Đang áp dụng giảm giá cận hạn: <b>-{expiryView.discountPercent}%</b></div>
          )}
        </div>
      )}

      <label className="flex items-center gap-2 mb-3">
        <input
          type="checkbox"
          checked={enableExpiry}
          onChange={(e) => setEnableExpiry(e.target.checked)}
        />
        Bật theo dõi hạn sử dụng / cấu hình giảm giá cận hạn
      </label>

      {enableExpiry && (
        <div className="space-y-4">
          {/* ExpireDate hoặc MFG + shelfLifeDays */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Ngày hết hạn (expireDate)</label>
              <input
                type="date"
                className="border px-3 py-2 rounded w-full"
                value={expireDate}
                onChange={(e) => {
                  setExpireDate(e.target.value);
                  if (e.target.value) { // có expireDate thì khoá MFG/Shelf
                    setMfgDate("");
                    setShelfLifeDays("");
                  }
                }}
              />
              <p className="text-xs text-gray-500 mt-1">Nếu nhập ngày hết hạn, hệ thống ưu tiên dùng giá trị này.</p>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Ngày sản xuất (mfgDate)</label>
              <input
                type="date"
                className="border px-3 py-2 rounded w-full"
                value={mfgDate}
                onChange={(e) => setMfgDate(e.target.value)}
                disabled={!!expireDate}
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Số ngày sử dụng (shelfLifeDays)</label>
              <input
                type="number"
                min="0"
                className="border px-3 py-2 rounded w-full"
                value={shelfLifeDays}
                onChange={(e) => setShelfLifeDays(e.target.value)}
                disabled={!!expireDate}
              />
            </div>
          </div>

          {/* DiscountNearExpiry */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={nearActive}
                onChange={(e) => setNearActive(e.target.checked)}
              />
              Kích hoạt giảm giá cận hạn
            </label>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Ngưỡng cận hạn (ngày)</label>
              <input
                type="number"
                min="0"
                className="border px-3 py-2 rounded w-full"
                value={thresholdDays}
                onChange={(e) => setThresholdDays(e.target.value)}
                disabled={!nearActive}
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">% giảm khi cận hạn</label>
              <input
                type="number"
                min="0"
                max="100"
                className="border px-3 py-2 rounded w-full"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value)}
                disabled={!nearActive}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSaveExpiry}
              className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700"
            >
              💾 Lưu cấu hình hạn sử dụng
            </button>
            <button
              onClick={async () => {
                if (!window.confirm("Xoá toàn bộ cấu hình hạn sử dụng của sản phẩm?")) return;
                try {
                  await axiosInstance.put(`/product/${id}`, { expiry: null });
                  alert("🗑️ Đã xoá hạn sử dụng sản phẩm");
                  fetchProduct();
                } catch (err) {
                  console.error(err);
                  alert("Không xoá được hạn sử dụng.");
                }
              }}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              Xoá cấu hình hạn sử dụng
            </button>
          </div>
        </div>
      )}

      {/* ====== Base Variant ====== */}
      {product.baseVariant && (
        <>
          <h2 className="text-xl font-semibold mt-8 mb-2">Base Variant</h2>
          <div className="border p-4 rounded mb-4 flex flex-wrap items-center gap-3">
            <span className="px-2 py-1 bg-gray-100 rounded">
              {product.baseVariant?.attributes?.weight} • {product.baseVariant?.attributes?.ripeness}
            </span>
            <input
              type="number"
              min={0}
              value={product.baseVariant.price || 0}
              onChange={(e) =>
                setProduct({
                  ...product,
                  baseVariant: {
                    ...product.baseVariant,
                    price: Number(e.target.value),
                  },
                })
              }
              className="border px-2 py-1 w-28 rounded"
            />
            <input
              type="number"
              min={0}
              value={product.baseVariant.stock || 0}
              onChange={(e) =>
                setProduct({
                  ...product,
                  baseVariant: {
                    ...product.baseVariant,
                    stock: Number(e.target.value),
                  },
                })
              }
              className="border px-2 py-1 w-24 rounded"
            />
            <button
              className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
              onClick={() =>
                handleSaveVariant(null, {
                  price: product.baseVariant.price,
                  stock: product.baseVariant.stock,
                  isBase: true,
                })
              }
            >
              Lưu
            </button>
            <button
              className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
              onClick={handleDeleteBaseVariant}
            >
              Xóa
            </button>
          </div>
        </>
      )}

      {/* ====== Variants ====== */}
      <h2 className="text-xl font-semibold mt-6 mb-2">Danh sách biến thể</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full border">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2">Khối lượng</th>
              <th className="border p-2">Tình trạng</th>
              <th className="border p-2">Giá</th>
              <th className="border p-2">Tồn kho</th>
              <th className="border p-2">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {product.variants?.map((v) => (
              <tr key={v._id}>
                <td className="border p-2">{v.attributes?.weight}</td>
                <td className="border p-2">{v.attributes?.ripeness}</td>
                <td className="border p-2">
                  <input
                    type="number"
                    min={0}
                    value={v.price || 0}
                    onChange={(e) => {
                      console.log("🔍 [Frontend] Updating price for variant:", {
                        targetId: v._id,
                        targetWeight: v.attributes?.weight,
                        targetRipeness: v.attributes?.ripeness,
                        newPrice: e.target.value
                      });
                      setProduct((prev) => ({
                        ...prev,
                        variants: prev.variants.map((item) => {
                          const isMatch = item._id.toString() === v._id.toString();
                          if (isMatch) {
                            console.log("✅ [Frontend] Found matching variant for price update:", {
                              itemId: item._id,
                              itemWeight: item.attributes?.weight,
                              itemRipeness: item.attributes?.ripeness
                            });
                          }
                          return isMatch ? { ...item, price: Number(e.target.value) } : item;
                        }),
                      }));
                    }}
                    className="border px-2 py-1 w-28 rounded"
                  />
                </td>
                <td className="border p-2">
                  <input
                    type="number"
                    min={0}
                    value={v.stock || 0}
                    onChange={(e) => {
                      console.log("🔍 [Frontend] Updating stock for variant:", {
                        targetId: v._id,
                        targetWeight: v.attributes?.weight,
                        targetRipeness: v.attributes?.ripeness,
                        newStock: e.target.value
                      });
                      setProduct((prev) => ({
                        ...prev,
                        variants: prev.variants.map((item) => {
                          const isMatch = item._id.toString() === v._id.toString();
                          if (isMatch) {
                            console.log("✅ [Frontend] Found matching variant for stock update:", {
                              itemId: item._id,
                              itemWeight: item.attributes?.weight,
                              itemRipeness: item.attributes?.ripeness
                            });
                          }
                          return isMatch ? { ...item, stock: Number(e.target.value) } : item;
                        }),
                      }));
                    }}
                    className="border px-2 py-1 w-24 rounded"
                  />
                </td>
                <td className="border p-2 space-x-2">
                  <button
                    className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                    onClick={() => handleSaveVariant(v._id, { price: v.price, stock: v.stock })}
                  >
                    Lưu
                  </button>
                  <button
                    className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                    onClick={() => handleDeleteVariant(v._id)}
                  >
                    Xóa
                  </button>
                </td>
              </tr>
            ))}
            {(!product.variants || product.variants.length === 0) && (
              <tr>
                <td colSpan={5} className="text-center text-gray-500 p-4">
                  Chưa có biến thể nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
