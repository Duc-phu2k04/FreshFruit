import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import styles from "./CartPage.module.css";

function CartPage() {
  const { user } = useAuth();

  // Dữ liệu giả để test giao diện
  const fakeData = [
    {
      id: 1,
      name: "Táo đỏ Mỹ",
      image:
        "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQcxRKzsmVjdAfylJUpuZsGt8DvjNAuf_FxFQ&s",
      price: 35000,
      quantity: 2,
    },
    {
      id: 2,
      name: "Chuối tiêu chín",
      image:
        "https://media.vneconomy.vn/images/upload/2021/04/21/lam-dep-b-15393264483772087274308.jpg",
      price: 12000,
      quantity: 6,
    },
    {
      id: 3,
      name: "Cam sành Hà Giang",
      image:
        "https://imgcdn.tapchicongthuong.vn/thumb/w_1920/tcct-media/22/12/28/cam-sanh-ha-giang-10.jpg",
      price: 20000,
      quantity: 4,
    },
  ];

  const [cartItems, setCartItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [voucher, setVoucher] = useState("");

  useEffect(() => {
    // Dùng dữ liệu giả để test giao diện, comment phần này khi chạy thật
    setCartItems(fakeData);

    //gọi API lấy dữ liệu giỏ hàng từ DB
    
    async function fetchCartItems() {
      try {
        const response = await fetch(
          `https://your-api.com/cart?userId=${user.id}`
        );
        if (!response.ok) {
          throw new Error("Lấy giỏ hàng thất bại");
        }
        const data = await response.json();
        setCartItems(data);
      } catch (error) {
        console.error(error);
      }
    }
    fetchCartItems();
   
  }, [user]);

  const updateQuantity = (itemId, newQuantity) => {
    if (newQuantity < 1) return;
    setCartItems((prevItems) =>
      prevItems.map((item) =>
        item.id === itemId ? { ...item, quantity: newQuantity } : item
      )
    );

    //  gọi API cập nhật số lượng trong DB
    
    fetch(`https://your-api.com/cart/${itemId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity: newQuantity }),
    }).catch(console.error);
    
  };

  const removeFromCart = (itemId) => {
    setCartItems((prevItems) => prevItems.filter((item) => item.id !== itemId));
    setSelectedItems((prev) => prev.filter((id) => id !== itemId));

    //  gọi API xóa sản phẩm khỏi giỏ hàng
    
    fetch(`https://your-api.com/cart/${itemId}`, {
      method: "DELETE",
    }).catch(console.error);
    
  };

  const handleSelectItem = (itemId) => {
    setSelectedItems((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedItems([]);
    } else {
      setSelectedItems(cartItems.map((item) => item.id));
    }
    setSelectAll(!selectAll);
  };

  const clearCart = () => {
    setCartItems([]);
    setSelectedItems([]);
  };

  const handleCheckout = () => {
    const selectedProducts = cartItems.filter((item) =>
      selectedItems.includes(item.id)
    );
    if (selectedProducts.length === 0) {
      alert("Vui lòng chọn ít nhất 1 sản phẩm để đặt hàng.");
      return;
    }
    alert("Đặt hàng thành công! 🎉");

    //gọi API đặt hàng và xóa giỏ hàng tương ứng
    
    fetch("https://your-api.com/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, items: selectedProducts }),
    })
      .then(() => {
        clearCart();
      })
      .catch(console.error);
    

    clearCart();
  };

  const totalPrice = cartItems.reduce(
    (acc, item) =>
      selectedItems.includes(item.id)
        ? acc + item.price * item.quantity
        : acc,
    0
  );

  return (
    <div className={`${styles.container} mx-auto max-w-[1300px]`}>
      <h1 className={styles.title}>Giỏ hàng của bạn</h1>

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
                  <tr key={item.id}>
                    <td>
                      <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={selectedItems.includes(item.id)}
                        onChange={() => handleSelectItem(item.id)}
                      />
                    </td>
                    <td className="flex items-center gap-4">
                      <img
                        src={item.image}
                        alt={item.name}
                        className={styles.productImage}
                      />
                      <span className={styles.productName}>{item.name}</span>
                    </td>
                    <td className={styles.price}>
                      {item.price.toLocaleString()}₫
                    </td>
                    <td>
                      <div className={styles.quantityControl}>
                        <button
                          onClick={() =>
                            updateQuantity(item.id, item.quantity - 1)
                          }
                          className={styles.quantityButton}
                        >
                          -
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          onClick={() =>
                            updateQuantity(item.id, item.quantity + 1)
                          }
                          className={styles.quantityButton}
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="text-center">
                      <button
                        onClick={() => removeFromCart(item.id)}
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
