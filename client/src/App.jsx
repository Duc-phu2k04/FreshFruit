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
import ForgotPassword from './pages/ForgotPassword';

import Dashboard from "./pages/Admin/Dashboard";
import CategoryList from "./pages/Admin/Category/List";
import AdminLayout from "./layouts/Admin-layout";
import CategoryCreateForm from "./pages/Admin/Category/Add";
import CategoryEditForm from "./pages/Admin/Category/Edit";
import LocationList from "./pages/Admin/Location/List";
import AddLocationForm from "./pages/Admin/Location/Add";
import EditLocationForm from "./pages/Admin/Location/Edit";
import ProductList from "./pages/Admin/Product/List";
import AddProductForm from "./pages/Admin/Product/Add";
import EditProductForm from "./pages/Admin/Product/Edit";

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
              <Route path="/quen-mat-khau" element={<ForgotPassword />} />
            </Route>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="/admin/category" element={<CategoryList />} />
              <Route path="/admin/category/add" element={<CategoryCreateForm />} />
              <Route path="/admin/category/edit/:id" element={<CategoryEditForm />} />
              <Route path="/admin/locations" element={<LocationList />} />
              <Route path="/admin/locations/add" element={<AddLocationForm />} />
              <Route path="/admin/locations/edit/:id" element={<EditLocationForm />} />
              <Route path="/admin/products" element={<ProductList />} />
              <Route path="/admin/products/add" element={<AddProductForm />} />
              <Route path="/admin/products/edit/:id" element={<EditProductForm />} />

            </Route >
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>

  );
}

export default App;
