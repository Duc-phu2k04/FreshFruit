import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

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
      setItems(data.items);

      setSelectedItems((prev) =>
        data.items
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

  const handleCheckout = () => {
    const selectedData = items.filter((item) =>
      isSelected(item.product._id, item.variantId)
    );
    navigate("/checkout", {
      state: {
        selectedItems: selectedData.map((item) => ({
          ...item,
          variantInfo: {
            weight: item.variant.attributes.weight,
            ripeness: item.variant.attributes.ripeness,
          },
        })),
      },
    });
  };

  const total = items.reduce(
    (sum, item) =>
      isSelected(item.product._id, item.variantId)
        ? sum + item.variant.price * item.quantity
        : sum,
    0
  );

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
            {items.map((item) => (
              <div
                key={`${item.product._id}-${item.variantId}`}
                className="grid grid-cols-[40px_80px_1fr_100px_150px_80px] items-center gap-4 border-b pb-4"
              >
                <input
                  type="checkbox"
                  checked={isSelected(item.product._id, item.variantId)}
                  onChange={() =>
                    handleSelectItem(item.product._id, item.variantId)
                  }
                />

                <img
                  src={`http://localhost:3000${item.product.image}`}
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
                        {v.attributes.weight} / {v.attributes.ripeness}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="text-red-600 font-semibold">
                  {item.variant.price.toLocaleString()}đ
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
                    max={item.variant.stock}
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
                    disabled={item.quantity >= item.variant.stock}
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
            ))}
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
