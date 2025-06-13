import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./layouts/Main-layout.jsx";
import Homepage from "./pages/Homepage/Homepage.jsx";
import LoginForm from "./pages/LoginForm.jsx";
import RegisterForm from "./pages/RegisterForm.jsx";
import ProductDetail from "./pages/Product/ProductDetail.jsx"; // Thêm dòng này

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Homepage />} />
          <Route path="dang-nhap" element={<LoginForm />} />
          <Route path="dang-ky" element={<RegisterForm />} />
          <Route path="san-pham/:id" element={<ProductDetail />} /> {/* Thêm route này */}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
