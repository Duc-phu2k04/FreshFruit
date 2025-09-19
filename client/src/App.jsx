import React from 'react'; // Thêm dòng này
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import Layout from "./layouts/Main-layout";
import Homepage from "./pages/Homepage/Homepage";
import CartPage from "./pages/Homepage/CartPage";
import ProductListPage from "./pages/ProductList/ProductList";
import Checkout from "./pages/Checkout/Checkout";
import OrderSuccess from "./pages/Checkout/OrderSuccess";
import { CartProvider } from "./context/CartContext";
import { AuthProvider } from "./context/AuthContext";
import RegisterForm from "./pages/RegisterForm";
import LoginForm from "./pages/LoginForm";
import ListSanPham from "./pages/Product/ProductSearch";
import ForgotPassword from './pages/ForgotPassword';
import ProfilePage from './pages/ProfilePage/ProfilePage';

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
import ProductDetailAdmin from "./pages/Admin/Product/Detail";
import ProductDetail from "./pages/Product/ProductDetail";
import UserList from "./pages/Admin/User/List";
import UserAdd from "./pages/Admin/User/Add";
import UserEdit from "./pages/Admin/User/Edit";

import ReviewList from "./pages/Admin/Reviews/List";
import VoucherList from "./pages/Admin/Voucher/List";
import AddVoucherForm from "./pages/Admin/Voucher/Add";
import EditVoucherForm from "./pages/Admin/Voucher/Edit";
import AdminOrderPage from "./pages/Admin/Order/list";
import AddressList from './pages/Admin/Address/List';
import AddAddressAdd from './pages/Admin/Address/Add';
import EditAddressEdit from './pages/Admin/Address/Edit';
import PreordersAdmin from "./pages/Admin/Preorder/PreordersAdmin";

//  Import trang ComingSoonAdmin
import ComingSoonAdmin from "./pages/Admin/CommingSoon/ComingSoonAdmin";

// Các trang mới thêm
import About from './pages/About/About';
import News from './pages/News/News';
import Franchise from './pages/Franchise/Franchise';
import StoreSystem from './pages/Stores/StoreSystem';

// Import trang Sắp vào mùa (Coming Soon)
import ComingSoon from "./pages/comingsoon/ComingSoon";
import PreorderPayDeposit from "./pages/Deposit/PreorderPayDeposit"
import PreorderPayRemaining from "./pages/Deposit/PreorderPayRemaining";
import PreorderSuccess from "./pages/Deposit/PreorderSuccess";
//  Import Chatbot
import ChatFruitBot from "./components/chatbot/ChatFruitBot";
//
import sessionManager from './utils/sessionManager';

function AppWrapper() {
  const location = useLocation();
  const path = location.pathname;

  const hiddenPaths = ["/login", "/register", "/dang-nhap", "/dang-ky", "/quen-mat-khau"];
  const isAdminPath = path.startsWith("/admin");
  const isHiddenAuth = hiddenPaths.includes(path);

  const hideChatbot = isAdminPath || isHiddenAuth;

  return (
    <>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Homepage />} />
          <Route path="gio-hang" element={<CartPage />} />
          <Route path="san-pham" element={<ProductListPage />} />
          <Route path="san-pham/:id" element={<ProductDetail />} />
          <Route path="checkout" element={<Checkout />} />
          <Route path="/order-success" element={<OrderSuccess />} />
          <Route path="register" element={<RegisterForm />} />
          <Route path="login" element={<LoginForm />} />
          <Route path="product" element={<ListSanPham />} />
          <Route path="dang-ky" element={<RegisterForm />} />
          <Route path="dang-nhap" element={<LoginForm />} />
          <Route path="/quen-mat-khau" element={<ForgotPassword />} />
          <Route path="/thong-tin" element={<ProfilePage />} />

          {/* Các trang nội dung mới */}
          <Route path="tin-tuc" element={<News />} />
          <Route path="ve-chung-toi" element={<About />} />
          <Route path="nhuong-quyen" element={<Franchise />} />
          <Route path="he-thong-cua-hang" element={<StoreSystem />} />

          {/*  Trang Sắp vào mùa */}
          <Route path="coming-soon" element={<ComingSoon />} />
          {/*  Trang thanh toán cọc */}
          <Route path="/pay/deposit/:preorderId" element={<PreorderPayDeposit />} />
          <Route path="/pay/remaining/:preorderId" element={<PreorderPayRemaining />} />
          <Route path="/preorder-success" element={<PreorderSuccess />} />
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
          <Route path="/admin/products/detail/:id" element={<ProductDetailAdmin />} />
          <Route path="/admin/users" element={<UserList />} />
          <Route path="/admin/users/add" element={<UserAdd />} />
          <Route path="/admin/users/edit/:id" element={<UserEdit />} />

          <Route path="/admin/reviews" element={<ReviewList />} />
          <Route path="/admin/vouchers" element={<VoucherList />} />
          <Route path="/admin/vouchers/add" element={<AddVoucherForm />} />
          <Route path="/admin/vouchers/edit/:id" element={<EditVoucherForm />} />
          <Route path="/admin/orders" element={<AdminOrderPage />} />
          <Route path="/admin/address" element={<AddressList />} />
          <Route path="/admin/address/add" element={<AddAddressAdd />} />
          <Route path="/admin/address/edit/:id" element={<EditAddressEdit />} />
          <Route path="/admin/preorders" element={<PreordersAdmin />} />

          {/*  Route Coming Soon Admin */}
          <Route path="/admin/coming-soon" element={<ComingSoonAdmin />} />
        </Route>
      </Routes>

      {!hideChatbot && <ChatFruitBot />}
    </>
  );
}

function App() {
  // Thêm dòng này để kích hoạt sessionManager
  React.useEffect(() => {
    // sessionManager sẽ tự động hoạt động khi component mount
    console.log('SessionManager activated');
  }, []);
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
