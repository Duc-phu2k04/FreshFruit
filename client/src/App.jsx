import { BrowserRouter, Route, Routes } from "react-router-dom";
import Layout from "./layouts/Main-layout";
import Homepage from "./pages/Homepage/Homepage";
import CartPage from "./pages/Homepage/CartPage";
import ProductListPage from "./pages/ProductList/ProductList";
import Checkout from "./pages/Checkout/Checkout";
import { CartProvider } from "./context/CartContext";
import { AuthProvider } from "./context/AuthContext";
import RegisterForm from "./pages/RegisterForm";
import LoginForm from "./pages/LoginForm";
import ListSanPham from "./pages/Product/ProductSearch";
import Dashboard from "./pages/Admin/Dashboard";

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Homepage />} />
              <Route path="gio-hang" element={<CartPage />} />
              <Route path="san-pham" element={<ProductListPage />} />
              <Route path="checkout" element={<Checkout />} />
              <Route path="register" element={<RegisterForm />} />
              <Route path="login" element={<LoginForm />} />
              <Route path="products" element={<ListSanPham />} />
              <Route path="dang-ky" element={<RegisterForm />} />
              <Route path="dang-nhap" element={<LoginForm />} />
            </Route>
            <Route path="/dashboard" element={<Dashboard />} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>

  );
}

export default App;
