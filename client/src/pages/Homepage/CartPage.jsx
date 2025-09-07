// src/pages/cart.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { computeExpiryInfo, fmtDate } from "../../utils/expiryHelpers";

export default function CartPage() {
  const [items, setItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const navigate = useNavigate();

  const fetchCart = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:3000/api/cart", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const arr = Array.isArray(data?.items) ? data.items : [];
      setItems(arr);

      setSelectedItems((prev) =>
        arr
          .filter((item) =>
            prev.find(
              (sel) =>
                sel.productId === item.product._id &&
                sel.variantId === item.variantId
            )
          )
          .map((item) => ({
            productId: item.product._id,
            variantId: item.variantId,
          }))
      );
    } catch (err) {
      console.error("Lỗi khi tải giỏ hàng:", err);
    }
  };

  useEffect(() => {
    fetchCart();
  }, []);

  const updateQuantity = async (productId, variantId, quantity) => {
    try {
      const token = localStorage.getItem("token");
      await fetch("http://localhost:3000/api/cart/update", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ productId, variantId, quantity }),
      });
      fetchCart();
    } catch (err) {
      console.error("Lỗi khi cập nhật số lượng:", err);
    }
  };

  const removeItem = async (productId, variantId) => {
    try {
      const token = localStorage.getItem("token");
      await fetch(`http://localhost:3000/api/cart/${productId}/${variantId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchCart();
    } catch (err) {
      console.error("Lỗi khi xoá sản phẩm:", err);
    }
  };

  const changeVariant = async (productId, oldVariantId, newVariantId, quantity) => {
    try {
      const token = localStorage.getItem("token");

      await fetch(`http://localhost:3000/api/cart/${productId}/${oldVariantId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      await fetch("http://localhost:3000/api/cart/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ productId, variantId: newVariantId, quantity }),
      });

      fetchCart();
    } catch (err) {
      console.error("Lỗi khi đổi biến thể:", err);
    }
  };

  const isSelected = (productId, variantId) =>
    selectedItems.some(
      (item) => item.productId === productId && item.variantId === variantId
    );

  const handleSelectItem = (productId, variantId) => {
    const exists = isSelected(productId, variantId);
    setSelectedItems((prev) =>
      exists
        ? prev.filter(
            (item) =>
              item.productId !== productId || item.variantId !== variantId
          )
        : [...prev, { productId, variantId }]
    );
  };

  const handleSelectAll = () => {
    if (selectedItems.length === items.length) {
      setSelectedItems([]);
    } else {
      const all = items.map((item) => ({
        productId: item.product._id,
        variantId: item.variantId,
      }));
      setSelectedItems(all);
    }
  };

  const handleRemoveSelected = () => {
    selectedItems.forEach((item) => removeItem(item.productId, item.variantId));
    setSelectedItems([]);
  };

  // Helper: tính pricing theo biến thể đang chọn bằng cách "project" giá biến thể vào variants[0]
  const getPricingForItem = (item) => {
    const vPrice = Number(item?.variant?.price ?? 0);
    const projectedProduct = {
      ...item.product,
      variants: [{ price: vPrice }],
      baseVariant: { price: vPrice },
    };
    const info = computeExpiryInfo(projectedProduct);
    return {
      basePrice: Number(info.basePrice ?? vPrice),
      finalPrice: Number(info.finalPrice ?? vPrice),
      discountPercent: Number(info.discountPercent ?? 0),
      expireAt: info.expireAt,
      daysLeft: info.daysLeft,
    };
  };

  const handleCheckout = () => {
    const selectedData = items.filter((item) =>
      isSelected(item.product._id, item.variantId)
    );
    // Đưa thêm giá final vào state để checkout dùng đúng giá cận hạn (nếu có)
    navigate("/checkout", {
      state: {
        selectedItems: selectedData.map((item) => {
          const { basePrice, finalPrice, discountPercent, expireAt, daysLeft } =
            getPricingForItem(item);
          return {
            ...item,
            pricing: { basePrice, finalPrice, discountPercent, expireAt, daysLeft },
            variantInfo: {
              weight: item.variant?.attributes?.weight,
              ripeness: item.variant?.attributes?.ripeness,
            },
          };
        }),
      },
    });
  };

  const total = items.reduce((sum, item) => {
    if (!isSelected(item.product._id, item.variantId)) return sum;
    const { finalPrice } = getPricingForItem(item);
    return sum + finalPrice * item.quantity;
  }, 0);

  const imageUrl = (p) => {
    const raw =
      p?.images?.[0]?.url || p?.images?.[0] || p?.image || "";
    if (typeof raw === "string" && (raw.startsWith("http://") || raw.startsWith("https://"))) {
      return raw;
    }
    return `http://localhost:3000${raw}`;
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Giỏ hàng của bạn</h1>

      {items.length === 0 ? (
        <p>Giỏ hàng trống.</p>
      ) : (
        <>
          <div className="flex items-center mb-4 gap-4">
            <input
              type="checkbox"
              checked={selectedItems.length === items.length}
              onChange={handleSelectAll}
              className="w-5 h-5 cursor-pointer"
            />
            <span className="text-sm font-medium">
              Chọn tất cả ({selectedItems.length}/{items.length})
            </span>
            <button
              onClick={handleRemoveSelected}
              className="text-red-600 text-sm hover:underline"
            >
              Xoá sản phẩm đã chọn
            </button>
          </div>

          <div className="space-y-6">
            {items.map((item) => {
              const { basePrice, finalPrice, discountPercent, expireAt, daysLeft } =
                getPricingForItem(item);

              return (
                <div
                  key={`${item.product._id}-${item.variantId}`}
                  className="grid grid-cols-[40px_80px_1fr_160px_150px_80px] items-center gap-4 border-b pb-4"
                >
                  <input
                    type="checkbox"
                    checked={isSelected(item.product._id, item.variantId)}
                    onChange={() =>
                      handleSelectItem(item.product._id, item.variantId)
                    }
                    className="w-5 h-5 cursor-pointer"
                  />

                  <img
                    src={imageUrl(item.product)}
                    alt={item.product.name}
                    className="w-20 h-20 object-cover rounded"
                  />

                  <div>
                    <h3
                      className="font-semibold cursor-pointer hover:underline"
                      onClick={() => navigate(`/san-pham/${item.product._id}`)}
                    >
                      {item.product.name}
                    </h3>

                    {/* HSD + badge cận hạn */}
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                      {expireAt && <span>HSD: {fmtDate(expireAt)}</span>}
                      {Number.isFinite(daysLeft) && daysLeft >= 0 && (
                        <span className="bg-yellow-500 text-white px-1.5 py-0.5 rounded">
                          Còn {daysLeft} ngày
                        </span>
                      )}
                    </div>

                    <select
                      value={item.variantId}
                      onChange={(e) =>
                        changeVariant(
                          item.product._id,
                          item.variantId,
                          e.target.value,
                          item.quantity
                        )
                      }
                      className="mt-1 border rounded px-2 py-1 text-sm"
                    >
                      {item.product.variants.map((v) => (
                        <option key={v._id} value={v._id}>
                          {v?.attributes?.weight} / {v?.attributes?.ripeness}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Giá theo helper (có giảm cận hạn) */}
                  <div className="flex flex-col">
                    <div className="text-red-600 font-semibold">
                      {finalPrice.toLocaleString()}đ
                    </div>
                    {discountPercent > 0 && finalPrice < basePrice && (
                      <div className="text-gray-500 line-through text-sm">
                        {basePrice.toLocaleString()}đ
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        updateQuantity(
                          item.product._id,
                          item.variantId,
                          item.quantity - 1
                        )
                      }
                      disabled={item.quantity <= 1}
                      className="px-2 border rounded"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={item.quantity}
                      min={1}
                      max={item.variant?.stock}
                      onChange={(e) =>
                        updateQuantity(
                          item.product._id,
                          item.variantId,
                          Number(e.target.value)
                        )
                      }
                      className="w-12 border rounded text-center"
                    />
                    <button
                      onClick={() =>
                        updateQuantity(
                          item.product._id,
                          item.variantId,
                          item.quantity + 1
                        )
                      }
                      disabled={
                        typeof item.variant?.stock === "number" &&
                        item.quantity >= item.variant.stock
                      }
                      className="px-2 border rounded"
                    >
                      +
                    </button>
                  </div>

                  <button
                    onClick={() =>
                      removeItem(item.product._id, item.variantId)
                    }
                    className="text-red-500 hover:underline text-sm"
                  >
                    Xoá
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex justify-between items-center">
            <div className="text-xl font-bold">
              Tổng: <span className="text-red-600">{total.toLocaleString()}đ</span>
            </div>
            <button
              className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:opacity-50"
              disabled={selectedItems.length === 0}
              onClick={handleCheckout}
            >
              Đặt hàng
            </button>
          </div>
        </>
      )}
    </div>
  );
}
