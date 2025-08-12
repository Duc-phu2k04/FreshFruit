import { faFacebook, faInstagram, faYoutube } from '@fortawesome/free-brands-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars, faTimes } from '@fortawesome/free-solid-svg-icons';
import SwiperSlideBanner from '../slide/Headerslide';
import SearchBar from '../button/Searchbar';
import AccountButton from '../button/AccountButton';
import CategoryDropdown from '../button/CategoryButton';
import Navbar from '../button/Navbar';
import { Link } from 'react-router-dom';
import CartIcon from '../button/CartButton';
import { useState, useEffect } from 'react';
import UserMenu from '../button/UserMenu';
import { useAuth } from '../../context/useAuth';

export const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user } = useAuth();
  const [cartCount, setCartCount] = useState(0);

  // Hàm lấy số đơn hàng trong giỏ hàng
  const fetchCartCount = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await fetch("http://localhost:3000/api/cart", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Lỗi khi lấy giỏ hàng");

      const data = await res.json();
      // ✅ Tính số đơn hàng (mỗi item tính là 1, không cộng dồn quantity)
      setCartCount(data.items.length);
    } catch (err) {
      console.error("Lỗi khi lấy số lượng giỏ hàng:", err);
    }
  };

  useEffect(() => {
    fetchCartCount();

    // Lắng nghe sự kiện cập nhật giỏ hàng từ localStorage
    const handleStorageChange = (e) => {
      if (e.key === "cartUpdated") {
        fetchCartCount();
      }
    };
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  return (
    <header>
      {/* ======================= HEADER CHO THIẾT BỊ DI ĐỘNG ===================== */}
      <div className="md:hidden">
        <div className="flex items-center justify-between h-20 px-4 shadow-md bg-white">
          <button onClick={() => setIsMenuOpen(true)} className="p-2">
            <FontAwesomeIcon icon={faBars} className="h-6 w-6 text-gray-700" />
          </button>
          <div className='flex-shrink-0'>
            <a href="/">
              <img src="./public/image/logo2-bg.png" alt="Fuji Fruit Logo" className='w-32 h-auto' />
            </a>
          </div>
          <div className="p-2">
            <Link to="/gio-hang"><CartIcon cartCount={cartCount} /></Link>
          </div>
        </div>

        {/* Menu Off-canvas (Drawer) */}
        {isMenuOpen && (
          <div className="fixed inset-0 z-40">
            <div
              className="absolute inset-0 bg-black opacity-50"
              onClick={() => setIsMenuOpen(false)}
            ></div>
            <div className="relative z-50 h-full w-4/5 max-w-sm bg-white p-6 flex flex-col gap-y-6 overflow-y-auto">
              <button onClick={() => setIsMenuOpen(false)} className="self-end p-2 -mr-2">
                <FontAwesomeIcon icon={faTimes} className="h-6 w-6 text-gray-700" />
              </button>
              <SearchBar />
              <CategoryDropdown />
              <div className="border-t pt-4 w-full">
                <Navbar />
              </div>
              <div className="border-t pt-4 w-full">
                {user ? <UserMenu /> : <AccountButton />}
              </div>
              <div className="flex justify-center gap-x-4 mt-auto py-4">
                <FontAwesomeIcon icon={faFacebook} className='h-6 w-6 text-gray-600' />
                <FontAwesomeIcon icon={faYoutube} className='h-6 w-6 text-gray-600' />
                <FontAwesomeIcon icon={faInstagram} className='h-6 w-6 text-gray-600' />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ======================= HEADER CHO DESKTOP ============================ */}
      <div className="hidden md:block">
        <div className="h-8 w-full bg-[#F67010] flex justify-center items-center">
          <div className="w-[1200px] h-8 flex items-center justify-between">
            <div className='flex justify-start gap-x-4'>
              <FontAwesomeIcon icon={faFacebook} className='text-white' />
              <FontAwesomeIcon icon={faYoutube} className='text-white' />
              <FontAwesomeIcon icon={faInstagram} className='text-white' />
            </div>
            <div className='h-8 w-[600px]'>
              <SwiperSlideBanner />
            </div>
            <div></div>
          </div>
        </div>
        <div className='h-[100px] w-full flex justify-center items-center'>
          <div className='w-[1300px] h-[100px] flex gap-50 items-center'>
            <div className='h-[74px] flex items-center'>
              <SearchBar />
            </div>
            <div className='h-[74px] flex items-center justify-center'>
              <a href="/"><img src="./public/image/logo2-bg.png" alt="" className='w-[150px]' /></a>
            </div>
            <div className='h-[74px] flex items-center justify-end'>
              {user ? <UserMenu /> : <AccountButton />}
            </div>
          </div>
        </div>
        <div className='h-[100px] w-full border-t border-gray-200 flex justify-center'>
          <div className='w-[1300px] h-[100px] flex justify-between items-center'>
            <div className='flex items-center gap-x-25'>
              <CategoryDropdown />
              <Navbar />
            </div>
            <div>
              <Link to="/gio-hang"><CartIcon cartCount={cartCount} /></Link>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
