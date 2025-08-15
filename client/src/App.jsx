// App.jsx
import { BrowserRouter, Route, Routes } from "react-router-dom";
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
import UserEdit from './pages/Admin/User/Edit';
import UserAdd from './pages/Admin/User/Add';
import ReviewList from "./pages/Admin/Reviews/List";
import VoucherList from "./pages/Admin/Voucher/List";
import AddVoucherForm from "./pages/Admin/Voucher/Add";
import EditVoucherForm from "./pages/Admin/Voucher/Edit";
import AdminOrderPage from "./pages/Admin/Order/list";
import AddressList from './pages/Admin/Address/List';
import AddAddressAdd from './pages/Admin/Address/Add';
import EditAddressEdit from './pages/Admin/Address/Edit';


// Các trang mới thêm
import About from './pages/About/About';
import News from './pages/News/News';
import Franchise from './pages/Franchise/Franchise';
import StoreSystem from './pages/Stores/StoreSystem';

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
              <Route path="/admin/edit/:id" element={<UserEdit />} />
              <Route path="/admin/user/add" element={<UserAdd />} />
              <Route path="/admin/reviews" element={<ReviewList />} />
              <Route path="/admin/vouchers" element={<VoucherList />} />
              <Route path="/admin/vouchers/add" element={<AddVoucherForm />} />
              <Route path="/admin/vouchers/edit/:id" element={<EditVoucherForm />} />

              <Route path="/admin/orders" element={<AdminOrderPage />} />

              <Route path="/admin/address" element={<AddressList />} />
              <Route path="/admin/address/add" element={<AddAddressAdd />} />
              <Route path="/admin/address/edit/:id" element={<EditAddressEdit />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
