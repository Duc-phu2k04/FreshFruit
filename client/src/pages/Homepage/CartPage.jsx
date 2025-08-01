import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import styles from "./CartPage.module.css";

function CartPage() {
  const { user } = useAuth();
  const [cartItems, setCartItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [editingItemKey, setEditingItemKey] = useState(null);
  const [editedItem, setEditedItem] = useState({});
  const navigate = useNavigate();

  const generateItemKey = (item) =>
    `${item.product._id}-${item.weight}-${item.ripeness}`;

  useEffect(() => {
    async function fetchCartItems() {
      try {
        const response = await fetch(`http://localhost:3000/api/cart`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        if (!response.ok) throw new Error("Lấy giỏ hàng thất bại");
        const data = await response.json();
        setCartItems(data.items || []);
      } catch (error) {
        console.error(error);
        setErrorMsg("Không thể tải giỏ hàng");
      }
    }

    if (user?._id) fetchCartItems();
  }, [user]);

  const updateQuantity = async (itemKey, newQuantity) => {
    if (newQuantity < 1) return;
    setCartItems((prevItems) =>
      prevItems.map((item) =>
        generateItemKey(item) === itemKey
          ? { ...item, quantity: newQuantity }
          : item
      )
    );

    const [productId, weight, ripeness] = itemKey.split("-");

    try {
      await fetch(`http://localhost:3000/api/cart/update`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          productId,
          weight,
          ripeness,
          quantity: newQuantity,
        }),
      });
    } catch (err) {
      console.error("Lỗi cập nhật số lượng:", err);
    }
  };

  const removeFromCart = async (itemKey) => {
    const [productId, weight, ripeness] = itemKey.split("-");
    setCartItems((prevItems) =>
      prevItems.filter((item) => generateItemKey(item) !== itemKey)
    );
    setSelectedItems((prev) => prev.filter((id) => id !== itemKey));
    try {
      await fetch(
        `http://localhost:3000/api/cart/${productId}?weight=${weight}&ripeness=${ripeness}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
    } catch (err) {
      console.error("Lỗi xoá sản phẩm:", err);
    }
  };

  const saveEdit = async (originalItem) => {
    const updated = {
      productId: originalItem.product._id,
      weight: editedItem.weight,
      ripeness: editedItem.ripeness,
      quantity: editedItem.quantity,
    };

    try {
      await fetch(`http://localhost:3000/api/cart/update`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(updated),
      });

      const response = await fetch(`http://localhost:3000/api/cart`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      const data = await response.json();
      setCartItems(data.items || []);
      setEditingItemKey(null);
    } catch (err) {
      console.error("Lỗi khi lưu chỉnh sửa:", err);
      setErrorMsg("Không thể lưu chỉnh sửa");
    }
  };

  const handleSelectItem = (itemKey) => {
    setSelectedItems((prev) =>
      prev.includes(itemKey)
        ? prev.filter((id) => id !== itemKey)
        : [...prev, itemKey]
    );
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedItems([]);
    } else {
      const validKeys = cartItems
        .filter((item) => item.product && item.product._id)
        .map((item) => generateItemKey(item));
      setSelectedItems(validKeys);
    }
    setSelectAll(!selectAll);
  };

  const handleCheckout = () => {
    const selectedProducts = cartItems.filter((item) =>
      selectedItems.includes(generateItemKey(item))
    );

    if (selectedProducts.length === 0) {
      setErrorMsg("Vui lòng chọn ít nhất 1 sản phẩm để đặt hàng.");
      return;
    }

    const sumPrice = selectedProducts.reduce((total, item) => {
      return total + (item.price || 0) * item.quantity;
    }, 0);

    const payload = {
      products: selectedProducts.map((item) => ({
        _id: item.product._id,
        nameProduct: item.product.name,
        quantity: item.quantity,
        price: item.price,
        weight: item.weight,
        ripeness: item.ripeness,
      })),
      sumPrice,
    };

    navigate("/checkout", { state: { cartData: payload } });
  };

  const totalPrice = cartItems.reduce((acc, item) => {
    if (selectedItems.includes(generateItemKey(item))) {
      return acc + (item.price || 0) * item.quantity;
    }
    return acc;
  }, 0);

  return (
    <div className={`${styles.container} mx-auto max-w-[1300px]`}>
      <h1 className={styles.title}>Giỏ hàng của bạn</h1>

      {errorMsg && <div className="text-red-500 mb-2">{errorMsg}</div>}
      {successMsg && <div className="text-green-600 mb-2">{successMsg}</div>}

      {cartItems.length === 0 ? (
        <div className="text-center text-gray-500">
          Giỏ hàng trống.{" "}
          <Link to="/" className="text-[#00613C] underline">
            Quay lại trang chủ
          </Link>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={selectAll}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th>Sản phẩm</th>
                  <th>Giá</th>
                  <th>Khối lượng</th>
                  <th>Tình trạng</th>
                  <th>Số lượng</th>
                  <th className="text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {cartItems.map((item) =>
                  item.product ? (
                    <tr key={generateItemKey(item)}>
                      <td>
                        <input
                          type="checkbox"
                          className={styles.checkbox}
                          checked={selectedItems.includes(generateItemKey(item))}
                          onChange={() =>
                            handleSelectItem(generateItemKey(item))
                          }
                        />
                      </td>
                      <td className="flex items-center gap-4">
                        <img
                          src={`http://localhost:3000${item.product.image}`}
                          alt={item.product.name}
                          className={styles.productImage}
                        />
                        <span className={styles.productName}>
                          {item.product.name}
                        </span>
                      </td>
                      <td className={styles.price}>
                        {item.price
                          ? `${item.price.toLocaleString()}đ`
                          : "Giá: Đang cập nhật"}
                      </td>
                      <td>
                        {editingItemKey === generateItemKey(item) ? (
                          <select
                            value={editedItem.weight}
                            onChange={(e) =>
                              setEditedItem((prev) => ({
                                ...prev,
                                weight: e.target.value,
                              }))
                            }
                          >
                            {[...new Set(item.product.variants.map((v) => v.attributes.weight))].map(
                              (weight, i) => (
                                <option key={i} value={weight}>
                                  {weight}
                                </option>
                              )
                            )}
                          </select>
                        ) : (
                          item.weight || "Không rõ"
                        )}
                      </td>
                      <td>
                        {editingItemKey === generateItemKey(item) ? (
                          <select
                            value={editedItem.ripeness}
                            onChange={(e) =>
                              setEditedItem((prev) => ({
                                ...prev,
                                ripeness: e.target.value,
                              }))
                            }
                          >
                            {item.product.variants
                              .filter(
                                (v) =>
                                  v.attributes.weight === editedItem.weight
                              )
                              .map((v, i) => (
                                <option
                                  key={i}
                                  value={v.attributes.ripeness}
                                >
                                  {v.attributes.ripeness}
                                </option>
                              ))}
                          </select>
                        ) : (
                          item.ripeness || "Không rõ"
                        )}
                      </td>
                      <td>
                        {editingItemKey === generateItemKey(item) ? (
                          <input
                            type="number"
                            min={1}
                            value={editedItem.quantity}
                            onChange={(e) =>
                              setEditedItem((prev) => ({
                                ...prev,
                                quantity: +e.target.value,
                              }))
                            }
                            className="border w-16 px-2 py-1"
                          />
                        ) : (
                          <div className={styles.quantityControl}>
                            <button
                              onClick={() =>
                                updateQuantity(
                                  generateItemKey(item),
                                  item.quantity - 1
                                )
                              }
                              className={styles.quantityButton}
                            >
                              -
                            </button>
                            <span>{item.quantity}</span>
                            <button
                              onClick={() =>
                                updateQuantity(
                                  generateItemKey(item),
                                  item.quantity + 1
                                )
                              }
                              className={styles.quantityButton}
                            >
                              +
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="text-center">
                        {editingItemKey === generateItemKey(item) ? (
                          <>
                            <button
                              onClick={() => saveEdit(item)}
                              className="text-green-600 mr-2 underline"
                            >
                              Lưu
                            </button>
                            <button
                              onClick={() => setEditingItemKey(null)}
                              className="text-gray-500 underline"
                            >
                              Hủy
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                setEditingItemKey(generateItemKey(item));
                                setEditedItem({
                                  weight: item.weight,
                                  ripeness: item.ripeness,
                                  quantity: item.quantity,
                                });
                              }}
                              className="text-blue-600 mr-2 underline"
                            >
                              Sửa
                            </button>
                            <button
                              onClick={() =>
                                removeFromCart(generateItemKey(item))
                              }
                              className={styles.removeButton}
                            >
                              Hủy đơn
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ) : null
                )}
              </tbody>
            </table>
          </div>

          <div className={styles.checkoutSection}>
            <div className={styles.totalPrice}>
              Tổng:{" "}
              <span className="font-semibold text-green-700">
                {totalPrice.toLocaleString()}đ
              </span>
            </div>
            <button onClick={handleCheckout} className={styles.orderButton}>
              Đặt hàng
            </button>
          </div>

          <div>
            <Link to="/" className={styles.backLink}>
              ← Quay lại trang chủ
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

export default CartPage;
