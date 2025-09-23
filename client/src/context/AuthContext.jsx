import { createContext, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  });

  const login = (userData) => {
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token"); // ✅ Xóa token khi logout
    localStorage.removeItem("cart"); // ✅ Xóa giỏ hàng guest khi logout
    localStorage.removeItem("cart_mix_draft_v1"); // ✅ Xóa mix draft khi logout
    localStorage.removeItem("preorderPaying"); // ✅ Xóa trạng thái thanh toán preorder
    localStorage.removeItem("mix_widget_open_v1"); // ✅ Xóa trạng thái mix widget
  };

  const updateUser = (newUserData) => {
    setUser(newUserData);
    localStorage.setItem("user", JSON.stringify(newUserData));
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export { AuthContext };
