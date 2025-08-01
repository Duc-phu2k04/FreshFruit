import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import styles from "./CartPage.module.css";

export default function CartPage() {
  const { user } = useAuth();
  const [cartItems, setCartItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchCartItems() {
      try {
        const res = await fetch(`http://localhost:3000/api/cart`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        if (!res.ok) throw new Error("Lấy giỏ hàng thất bại");
        const data = await res.json();
        setCartItems(data.items || []);
      } catch (error) {
        console.error(error);
        setErrorMsg("Không thể tải giỏ hàng");
      }
    }

    if (user?._id) fetchCartItems();
  }, [user]);

  const updateQuantity = async (cartItemId, newQuantity) => {
    if (newQuantity < 1) return;
    setCartItems((prev) =>
      prev.map((item) =>
        item._id === cartItemId ? { ...item, quantity: newQuantity } : item
      )
    );
    try {
      await fetch(`http://localhost:3000/api/cart/update`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ cartItemId, quantity: newQuantity }),
      });
    } catch (err) {
      console.error("Lỗi cập nhật số lượng:", err);
    }
  };

  const removeFromCart = async (cartItemId) => {
    setCartItems((prev) => prev.filter((item) => item._id !== cartItemId));
    setSelectedItems((prev) => prev.filter((id) => id !== cartItemId));
    try {
      await fetch(`http://localhost:3000/api/cart/${cartItemId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
    } catch (err) {
      console.error("Lỗi xoá sản phẩm:", err);
    }
  };

  const handleSelectItem = (cartItemId) => {
    setSelectedItems((prev) =>
      prev.includes(cartItemId)
        ? prev.filter((id) => id !== cartItemId)
        : [...prev, cartItemId]
    );
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedItems([]);
    } else {
      setSelectedItems(cartItems.map((item) => item._id));
    }
    setSelectAll(!selectAll);
  };

  const handleCheckout = () => {
    const selectedProducts = cartItems.filter((item) =>
      selectedItems.includes(item._id)
    );

    if (selectedProducts.length === 0) {
      setErrorMsg("Vui lòng chọn ít nhất 1 sản phẩm để đặt hàng.");
      return;
    }

    const sumPrice = selectedProducts.reduce(
      (total, item) => total + (item.price || 0) * item.quantity,
      0
    );

    const payload = {
      products: selectedProducts.map((item) => ({
        _id: item.product?._id,
        nameProduct: item.product?.name,
        variantId: item.variantId,
        attributes: item.attributes || {},
        quantity: item.quantity,
        price: item.price,
      })),
      sumPrice,
    };

    navigate("/checkout", { state: { cartData: payload } });
  };

  const totalPrice = cartItems.reduce(
    (acc, item) =>
      selectedItems.includes(item._id)
        ? acc + (item.price || 0) * item.quantity
        : acc,
    0
  );

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
                  <th>Số lượng</th>
                  <th className="text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {cartItems.map((item) => (
                  <tr key={item._id}>
                    <td>
                      <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={selectedItems.includes(item._id)}
                        onChange={() => handleSelectItem(item._id)}
                      />
                    </td>
                    <td className="flex items-center gap-4">
                      <img
                        src={`http://localhost:3000${item.product?.image}`}
                        alt={item.product?.name}
                        className={styles.productImage}
                      />
                      <div>
                        <div className={styles.productName}>
                          {item.product?.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {item.attributes?.weight} -{" "}
                          {item.attributes?.ripeness}
                        </div>
                      </div>
                    </td>
                    <td className={styles.price}>
                      {(item.price || 0).toLocaleString()}đ
                    </td>
                    <td>
                      <div className={styles.quantityControl}>
                        <button
                          onClick={() =>
                            updateQuantity(item._id, item.quantity - 1)
                          }
                          className={styles.quantityButton}
                        >
                          -
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          onClick={() =>
                            updateQuantity(item._id, item.quantity + 1)
                          }
                          className={styles.quantityButton}
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="text-center">
                      <button
                        onClick={() => removeFromCart(item._id)}
                        className={styles.removeButton}
                      >
                        Xoá
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.checkoutSection}>
            <div className={styles.totalPrice}>
              Tổng:{" "}
              <span className="font-semibold text-green-700">
                {totalPrice.toLocaleString()}₫
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
