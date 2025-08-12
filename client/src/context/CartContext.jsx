import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./useAuth";

const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const { user } = useAuth();
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Tải giỏ hàng khi user thay đổi
  useEffect(() => {
    const fetchCart = async () => {
      setLoading(true);
      if (user?._id) {
        try {
          const res = await fetch("http://localhost:3000/api/cart", {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          });
          const data = await res.json();
          setCartItems(data.items || []);
        } catch (err) {
          console.error("Lỗi lấy giỏ hàng từ server:", err);
        }
      } else {
        const stored = localStorage.getItem("cart");
        setCartItems(stored ? JSON.parse(stored) : []);
      }
      setLoading(false);
    };

    fetchCart();
  }, [user]);

  // Đồng bộ localStorage nếu chưa login
  useEffect(() => {
    if (!user?._id) {
      localStorage.setItem("cart", JSON.stringify(cartItems));
    }
  }, [cartItems, user]);

  // Thêm vào giỏ hàng
  const addToCart = async (product) => {
    if (user?._id) {
      try {
        const res = await fetch("http://localhost:3000/api/cart/add", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({ productId: product._id, quantity: 1 }),
        });

        if (res.ok) {
          const updated = await res.json();
          setCartItems(updated.cart.items || []);
        }
      } catch (err) {
        console.error("Lỗi thêm vào giỏ hàng:", err);
      }
    } else {
      setCartItems((prev) => {
        const existing = prev.find((i) => i._id === product._id);
        if (existing) {
          return prev.map((i) =>
            i._id === product._id ? { ...i, quantity: i.quantity + 1 } : i
          );
        }
        return [...prev, { ...product, quantity: 1 }];
      });
    }
  };

  // Xoá sản phẩm
  const removeFromCart = async (productId) => {
    if (user?._id) {
      try {
        await fetch(`http://localhost:3000/api/cart/${productId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        setCartItems((prev) =>
          prev.filter((item) => item.product._id !== productId)
        );
      } catch (err) {
        console.error("Lỗi xoá sản phẩm:", err);
      }
    } else {
      setCartItems((prev) => prev.filter((item) => item._id !== productId));
    }
  };

  // Cập nhật số lượng
  const updateQuantity = async (productId, quantity) => {
    if (quantity <= 0) return removeFromCart(productId);

    if (user?._id) {
      try {
        const res = await fetch("http://localhost:3000/api/cart/update", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({ productId, quantity }),
        });
        if (res.ok) {
          const updated = await res.json();
          setCartItems(updated.cart.items || []);
        }
      } catch (err) {
        console.error("Lỗi cập nhật:", err);
      }
    } else {
      setCartItems((prev) =>
        prev.map((item) =>
          item._id === productId ? { ...item, quantity } : item
        )
      );
    }
  };

  
  const clearCart = () => {
    if (user?._id) {
      console.warn("clearCart chưa hỗ trợ server-side");
    }
    setCartItems([]);
    if (!user?._id) localStorage.removeItem("cart");
  };

  
  const removePurchasedItems = (purchasedIds) => {
    setCartItems((prev) =>
      prev.filter((item) => {
        const id = user?._id ? item.product._id : item._id;
        return !purchasedIds.includes(id);
      })
    );

    if (!user?._id) {
      const updated = cartItems.filter(
        (item) => !purchasedIds.includes(item._id)
      );
      localStorage.setItem("cart", JSON.stringify(updated));
    }
  };

  
  const totalItems = cartItems.reduce(
    (sum, item) => sum + (item.quantity || 0),
    0
  );

  
  const totalPrice = cartItems.reduce((sum, item) => {
    const price = item.product?.price || item.price || 0;
    return sum + price * item.quantity;
  }, 0);

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        removePurchasedItems, //  thêm vào context
        totalItems,
        totalPrice,
        loading,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
