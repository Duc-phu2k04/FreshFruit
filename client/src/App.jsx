// src/App.jsx
import React from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";

import Layout from "./layouts/Main-layout";
import AdminLayout from "./layouts/Admin-layout";

/* ===== Public pages ===== */
import Homepage from "./pages/Homepage/Homepage";
import CartPage from "./pages/Homepage/CartPage";
import ProductListPage from "./pages/ProductList/ProductList";
import ProductDetail from "./pages/Product/ProductDetail";
import Checkout from "./pages/Checkout/Checkout";
import OrderSuccess from "./pages/Checkout/OrderSuccess";
import RegisterForm from "./pages/RegisterForm";
import LoginForm from "./pages/LoginForm";
import ListSanPham from "./pages/Product/ProductSearch";
import ForgotPassword from "./pages/ForgotPassword";
import ProfilePage from "./pages/ProfilePage/ProfilePage";

/* ===== Content pages ===== */
import About from "./pages/About/About";
import News from "./pages/News/News";
import Franchise from "./pages/Franchise/Franchise";
import StoreSystem from "./pages/Stores/StoreSystem";
import ComingSoon from "./pages/comingsoon/ComingSoon";

/* ===== Deposit / Preorder flow ===== */
import PreorderPayDeposit from "./pages/Deposit/PreorderPayDeposit";
import PreorderPayRemaining from "./pages/Deposit/PreorderPayRemaining";
import PreorderSuccess from "./pages/Deposit/PreorderSuccess";

/* ===== Returns (Preorder) ===== */
import ReturnRequestPage from "./pages/ProfilePage/ReturnRequestPage";
import ReturnRequestAdmin from "./pages/Admin/Preorder/ReturnRequestAdmin";

/* ✅ Returns (Order) */
import OrderReturnRequest from "./pages/ProfilePage/OrderReturnRequest";
import OrderReturnAdmin from "./pages/Admin/Order/OrderReturnAdmin";

/* ===== Admin pages ===== */
import Dashboard from "./pages/Admin/Dashboard";
import CategoryList from "./pages/Admin/Category/List";
import CategoryCreateForm from "./pages/Admin/Category/Add";
import CategoryEditForm from "./pages/Admin/Category/Edit";
import LocationList from "./pages/Admin/Location/List";
import AddLocationForm from "./pages/Admin/Location/Add";
import EditLocationForm from "./pages/Admin/Location/Edit";
import ProductList from "./pages/Admin/Product/List";
import AddProductForm from "./pages/Admin/Product/Add";
import EditProductForm from "./pages/Admin/Product/Edit";
import ProductDetailAdmin from "./pages/Admin/Product/Detail";
import UserList from "./pages/Admin/User/List";
import UserAdd from "./pages/Admin/User/Add";
import UserEdit from "./pages/Admin/User/Edit";
import ReviewList from "./pages/Admin/Reviews/List";
import VoucherList from "./pages/Admin/Voucher/List";
import AddVoucherForm from "./pages/Admin/Voucher/Add";
import EditVoucherForm from "./pages/Admin/Voucher/Edit";
import AdminOrderPage from "./pages/Admin/Order/list";
import AddressList from "./pages/Admin/Address/List";
import AddAddressAdd from "./pages/Admin/Address/Add";
import EditAddressEdit from "./pages/Admin/Address/Edit";
import PreordersAdmin from "./pages/Admin/Preorder/PreordersAdmin";
import ComingSoonAdmin from "./pages/Admin/CommingSoon/ComingSoonAdmin";

/* ===== Providers ===== */
import { CartProvider } from "./context/CartContext";
import { AuthProvider } from "./context/AuthContext";

/* ===== Widgets ===== */
import ChatFruitBot from "./components/chatbot/ChatFruitBot";
import MixWidgetDock from "./pages/mix/MixWidgetDock";



function AppWrapper() {
  const location = useLocation();
  const path = location.pathname;

  const hiddenPaths = ["/login", "/register", "/dang-nhap", "/dang-ky", "/quen-mat-khau"];
  const isAdminPath = path.startsWith("/admin");
  const isHiddenAuth = hiddenPaths.includes(path);

  // Ẩn chatbot ở admin & trang auth
  const hideChatbot = isAdminPath || isHiddenAuth;

  // Ẩn MixWidget ở admin, auth, trang checkout & success
  const hideMixWidget =
    isAdminPath ||
    isHiddenAuth ||
    path.startsWith("/checkout") ||
    path.startsWith("/order-success");

  // Nếu chatbot hiển thị → đặt MixWidget bên trái; ngược lại bên phải
  const mixDockSideClass = hideChatbot ? "right-4" : "left-4";

  return (
    <>
      <Routes>
        {/* ====== Public layout ====== */}
        <Route path="/" element={<Layout />}>
          <Route index element={<Homepage />} />
          <Route path="gio-hang" element={<CartPage />} />
          <Route path="san-pham" element={<ProductListPage />} />
          <Route path="san-pham/:id" element={<ProductDetail />} />
          <Route path="checkout" element={<Checkout />} />
          {/* match redirectUrl của MoMo */}
          <Route path="order-success" element={<OrderSuccess />} />
          <Route path="register" element={<RegisterForm />} />
          <Route path="login" element={<LoginForm />} />
          <Route path="product" element={<ListSanPham />} />
          <Route path="dang-ky" element={<RegisterForm />} />
          <Route path="dang-nhap" element={<LoginForm />} />
          <Route path="quen-mat-khau" element={<ForgotPassword />} />
          <Route path="thong-tin" element={<ProfilePage />} />

          {/* Returns - Preorder (user) */}
          <Route path="return-request/:preorderId" element={<ReturnRequestPage />} />

          {/* ✅ Returns - Order (user) */}
          <Route path="order-return/:orderId" element={<OrderReturnRequest />} />

          {/* Content pages */}
          <Route path="tin-tuc" element={<News />} />
          <Route path="ve-chung-toi" element={<About />} />
          <Route path="nhuong-quyen" element={<Franchise />} />
          <Route path="he-thong-cua-hang" element={<StoreSystem />} />

          {/* Coming Soon (Sắp vào mùa) */}
          <Route path="coming-soon" element={<ComingSoon />} />

          {/* Preorder payments */}
          <Route path="pay/deposit/:preorderId" element={<PreorderPayDeposit />} />
          <Route path="pay/remaining/:preorderId" element={<PreorderPayRemaining />} />
          <Route path="preorder-success" element={<PreorderSuccess />} />
        </Route>

        {/* ====== Admin layout ====== */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="category" element={<CategoryList />} />
          <Route path="category/add" element={<CategoryCreateForm />} />
          <Route path="category/edit/:id" element={<CategoryEditForm />} />
          <Route path="locations" element={<LocationList />} />
          <Route path="locations/add" element={<AddLocationForm />} />
          <Route path="locations/edit/:id" element={<EditLocationForm />} />
          <Route path="products" element={<ProductList />} />
          <Route path="products/add" element={<AddProductForm />} />
          <Route path="products/edit/:id" element={<EditProductForm />} />
          <Route path="products/detail/:id" element={<ProductDetailAdmin />} />
          <Route path="users" element={<UserList />} />
          <Route path="users/add" element={<UserAdd />} />
          <Route path="users/edit/:id" element={<UserEdit />} />
          <Route path="reviews" element={<ReviewList />} />
          <Route path="vouchers" element={<VoucherList />} />
          <Route path="vouchers/add" element={<AddVoucherForm />} />
          <Route path="vouchers/edit/:id" element={<EditVoucherForm />} />
          <Route path="orders" element={<AdminOrderPage />} />
          <Route path="address" element={<AddressList />} />
          <Route path="address/add" element={<AddAddressAdd />} />
          <Route path="address/edit/:id" element={<EditAddressEdit />} />
          <Route path="preorders" element={<PreordersAdmin />} />

          {/* Admin xử lý return PREORDER */}
          <Route path="preorders/:id/return" element={<ReturnRequestAdmin />} />

          {/* ✅ Admin xử lý return ORDER */}
          <Route path="orders/:id/return" element={<OrderReturnAdmin />} />

          {/* Coming Soon Admin */}
          <Route path="coming-soon" element={<ComingSoonAdmin />} />
        </Route>
      </Routes>

      {/* Floating widgets */}
      {!hideChatbot && <ChatFruitBot />}
      {!hideMixWidget && (
        <div className={`fixed bottom-4 ${mixDockSideClass} z-40`}>
          <MixWidgetDock />
        </div>
      )}
    </>
  );
}

function App() {


  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <AppWrapper />
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
