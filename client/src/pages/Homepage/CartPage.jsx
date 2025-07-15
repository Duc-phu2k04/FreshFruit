import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import styles from "./CartPage.module.css";

function CartPage() {
  const { user } = useAuth();
  const [cartItems, setCartItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [voucher, setVoucher] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function fetchCartItems() {
      try {
        const response = await fetch(`http://localhost:3000/api/cart`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`
          }
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

  const updateQuantity = async (productId, newQuantity) => {
    if (newQuantity < 1) return;
    setCartItems((prevItems) =>
      prevItems.map((item) =>
        item.product._id === productId ? { ...item, quantity: newQuantity } : item
      )
    );
    try {
      await fetch(`http://localhost:3000/api/cart/update`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({ productId, quantity: newQuantity })
      });
    } catch (err) {
      console.error("Lỗi cập nhật số lượng:", err);
    }
  };

  const removeFromCart = async (productId) => {
    setCartItems((prevItems) =>
      prevItems.filter((item) => item.product._id !== productId)
    );
    setSelectedItems((prev) => prev.filter((id) => id !== productId));
    try {
      await fetch(`http://localhost:3000/api/cart/${productId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`
        }
      });
    } catch (err) {
      console.error("Lỗi xoá sản phẩm:", err);
    }
  };

  const handleSelectItem = (productId) => {
    setSelectedItems((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedItems([]);
    } else {
      setSelectedItems(cartItems.map((item) => item.product._id));
    }
    setSelectAll(!selectAll);
  };

  const handleCheckout = async () => {
    const selectedProducts = cartItems.filter((item) =>
      selectedItems.includes(item.product._id)
    );

    if (selectedProducts.length === 0) {
      setErrorMsg("Vui lòng chọn ít nhất 1 sản phẩm để đặt hàng.");
      return;
    }

    try {
      const response = await fetch("http://localhost:3000/api/orders/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({
          cartItems: selectedProducts.map((item) => ({
            productId: item.product._id,
            quantity: item.quantity
          })),
          voucher
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Đặt hàng thất bại");

      // ✅ Giữ lại sản phẩm chưa được chọn
      const selectedIds = selectedProducts.map(item => item.product._id);
      setCartItems(prev => prev.filter(item => !selectedIds.includes(item.product._id)));
      setSelectedItems([]);
      setSuccessMsg("Đặt hàng thành công!");
      setErrorMsg("");
      setVoucher("");
    } catch (err) {
      console.error(err);
      setSuccessMsg("");
      setErrorMsg(err.message || "Có lỗi xảy ra khi đặt hàng.");
    }
  };

  const totalPrice = cartItems.reduce(
    (acc, item) =>
      selectedItems.includes(item.product._id)
        ? acc + item.product.price * item.quantity
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
                  <tr key={item.product._id}>
                    <td>
                      <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={selectedItems.includes(item.product._id)}
                        onChange={() => handleSelectItem(item.product._id)}
                      />
                    </td>
                    <td className="flex items-center gap-4">
                      <img
                        src={item.product.image}
                        alt={item.product.name}
                        className={styles.productImage}
                      />
                      <span className={styles.productName}>
                        {item.product.name}
                      </span>
                    </td>
                    <td className={styles.price}>
                      {item.product.price.toLocaleString()}₫
                    </td>
                    <td>
                      <div className={styles.quantityControl}>
                        <button
                          onClick={() =>
                            updateQuantity(item.product._id, item.quantity - 1)
                          }
                          className={styles.quantityButton}
                        >
                          -
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          onClick={() =>
                            updateQuantity(item.product._id, item.quantity + 1)
                          }
                          className={styles.quantityButton}
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="text-center">
                      <button
                        onClick={() => removeFromCart(item.product._id)}
                        className={styles.removeButton}
                      >
                        Hủy đơn
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.checkoutSection}>
            <input
              type="text"
              placeholder="Nhập mã voucher..."
              value={voucher}
              onChange={(e) => setVoucher(e.target.value)}
              className={styles.voucherInput}
            />
            <div className={styles.totalPrice}>
              Tổng:{" "}
              <span className="font-semibold text-green-700">
                {totalPrice.toLocaleString()}₫
              </span>
            </div>
            <button
              onClick={handleCheckout}
              className={styles.orderButton}
            >
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
