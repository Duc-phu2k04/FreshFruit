// src/pages/Homepage/Homepage.jsx
import { useState, useEffect, useMemo } from "react";
import CategoryFilter from "../../components/button/CategoryFilter";
import ViewNowButton from "../../components/button/ViewnowButton";
import ProductList from "../../components/product/ProductList";
import BannerSlider from "../../components/slide/Bannerslide";
import ProductCarousel from "../../components/slide/Productslide";
import { motion } from "framer-motion";

//  Dùng helper chung
import { computeExpiryInfo, fmtDate } from "../../utils/expiryHelpers";

function Homepage() {
  // Chữ nhấp nháy theo danh mục
  const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);
  const categories = ["nội địa", "nhập khẩu", "combo"];

  // Sản phẩm cận hạn
  const [nearExpiry, setNearExpiry] = useState([]);
  const [loadingNE, setLoadingNE] = useState(false);
  const [errNE, setErrNE] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentCategoryIndex((prev) => (prev + 1) % categories.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Fetch sản phẩm (loại Coming Soon) để lọc cận hạn
  useEffect(() => {
    const loadNearExpiry = async () => {
      setLoadingNE(true);
      setErrNE("");
      try {
        const res = await fetch("http://localhost:3000/api/product?preorder=false");
        if (!res.ok) throw new Error("Không tải được danh sách sản phẩm.");
        const data = await res.json();

        const arr = Array.isArray(data)
          ? data
          : Array.isArray(data.data)
          ? data.data
          : Array.isArray(data.products)
          ? data.products
          : [];

        const computed = arr
          .map((p) => ({ ...p, _expiry: computeExpiryInfo(p) }))
          .filter((p) => p._expiry?.isNearExpiry)
          .sort((a, b) => {
            // Ưu tiên sắp hết hạn trước
            const da = a._expiry.daysLeft ?? 9999;
            const db = b._expiry.daysLeft ?? 9999;
            return da - db;
          })
          .slice(0, 8); // show tối đa 8

        setNearExpiry(computed);
      } catch (e) {
        setErrNE(e.message || "Lỗi tải dữ liệu cận hạn.");
        setNearExpiry([]);
      } finally {
        setLoadingNE(false);
      }
    };

    loadNearExpiry();
  }, []);

  const NearExpirySection = useMemo(() => {
    if (loadingNE) {
      return (
        <div className="w-full flex justify-center my-8">
          <div className="text-gray-500">Đang tải ưu đãi cận hạn...</div>
        </div>
      );
    }
    if (errNE) {
      return (
        <div className="w-full flex justify-center my-8">
          <div className="text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
            {errNE}
          </div>
        </div>
      );
    }
    if (!nearExpiry.length) return null;

    return (
      <div className="w-full flex justify-center mt-10 px-4">
        <div className="w-full max-w-[1300px]">
          <div className="flex items-end justify-between mb-4">
            <div className="flex flex-col text-left">
              <div className="text-[#00613C] text-[13px]">
                <span>ƯU ĐÃI CẬN HẠN</span>
              </div>
              <div className="text-2xl sm:text-4xl font-medium">
                Sản phẩm sắp hết hạn – Giá tốt hôm nay
              </div>
            </div>
          </div>

          <div className="grid gap-5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {nearExpiry.map((p) => {
              const img =
                p.image?.startsWith("http")
                  ? p.image
                  : `http://localhost:3000${p.image || ""}`;
              const { basePrice, finalPrice, discountPercent, daysLeft, expireAt } = p._expiry;

              return (
                <motion.div
                  key={p._id}
                  className="border rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition"
                  whileHover={{ scale: 1.02 }}
                >
                  <div className="relative">
                    <img
                      src={img}
                      alt={p.name}
                      className="w-full h-44 object-cover"
                    />
                    {discountPercent > 0 && (
                      <div className="absolute top-2 left-2 bg-red-600 text-white text-xs font-semibold px-2 py-1 rounded">
                        -{discountPercent}%
                      </div>
                    )}
                    {Number.isFinite(daysLeft) && (
                      <div className="absolute top-2 right-2 bg-yellow-500 text-white text-xs font-semibold px-2 py-1 rounded">
                        Còn {daysLeft} ngày
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="font-semibold line-clamp-2 mb-1">{p.name}</div>
                    <div className="text-sm text-gray-500 mb-2">
                      HSD: {fmtDate(expireAt)}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <div className="text-green-700 font-bold text-lg">
                        {finalPrice.toLocaleString()}đ
                      </div>
                      {finalPrice !== basePrice && (
                        <div className="text-gray-400 line-through">
                          {basePrice.toLocaleString()}đ
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }, [nearExpiry, loadingNE, errNE]);

  return (
    <div>
      {/* Banner Slider */}
      <div className="">
        <BannerSlider />
      </div>

      {/* Feature Icons Section */}
      <div className="w-full mt-10 flex justify-center px-4">
        <div className="w-full max-w-7xl flex flex-nowrap justify-around gap-y-5 overflow-x-auto sm:flex-wrap sm:justify-evenly sm:mb-8">
          <div className="hidden sm:w-auto sm:flex sm:justify-center">
            <img
              src="https://fujifruit.com.vn/wp-content/uploads/2024/12/72h.png"
              className="h-24 sm:h-32"
              alt=""
            />
          </div>
          <div className="flex-shrink-0 w-1/3 sm:w-auto flex justify-center">
            <img
              src="https://fujifruit.com.vn/wp-content/uploads/2023/10/phanhoi.svg"
              className="h-24 sm:h-32"
              alt=""
            />
          </div>
          <div className="flex-shrink-0 w-1/3 sm:w-auto flex justify-center">
            <img
              src="https://fujifruit.com.vn/wp-content/uploads/2023/10/mienphi.svg"
              className="h-24 sm:h-32"
              alt=""
            />
          </div>
          <div className="flex-shrink-0 w-1/3 sm:w-auto flex justify-center">
            <img
              src="https://fujifruit.com.vn/wp-content/uploads/2023/10/thanhtoan.svg"
              className="h-24 sm:h-32"
              alt=""
            />
          </div>
          <div className="hidden sm:w-auto sm:flex sm:justify-center">
            <img
              src="https://fujifruit.com.vn/wp-content/uploads/2023/10/Thuonghieu.svg"
              className="h-24 sm:h-32"
              alt=""
            />
          </div>
        </div>
      </div>

      {/* Product Program Section */}
      <div className="w-full flex justify-center">
        <div className="w-full max-w-[1300px] flex flex-col sm:flex-row justify-between py-5 px-4 sm:px-2.5 sm:items-end">
          <div className="flex flex-col mb-5 sm:mb-0 text-left">
            <div className="text-[#00613C] text-[13px]">
              <span>CHƯƠNG TRÌNH BÁN HÀNG</span>
            </div>
            <div className="text-2xl sm:text-4xl font-medium flex flex-wrap gap-4  sm:flex-row sm:items-center sm:gap-4">
              Sản Phẩm
              <span>của FreshFruit</span>
            </div>
          </div>

          <div className="flex justify-end sm:justify-end sm:h-12">
            <ViewNowButton />
          </div>
        </div>
      </div>

      {/* Product Carousel */}
      <div className="flex w-full justify-center px-4">
        <div className="w-full max-w-[1300px]">
          <ProductCarousel />
        </div>
      </div>

      {/* ƯU ĐÃI CẬN HẠN */}
      {NearExpirySection}

      {/* Product Collection Section */}
      <div className="w-full flex justify-center mt-8 px-4">
        <div className="w-full max-w-[1300px] flex flex-col sm:flex-row sm:justify-between">
          <div className="w-full sm:w-[903px] order-2 sm:order-1">
            <div className="flex flex-col mb-2 sm:mb-0 text-left">
              <div className="text-[#00613C] text-[13px]">
                <span>BỘ SƯU TẬP</span>
              </div>
              <div className="text-2xl sm:text-4xl font-medium flex flex-wrap gap-4 sm:flex-row sm:items-center sm:gap-4">
                Sản Phẩm
                <motion.span
                  className="relative text-[#00613C] w-[87px] sm:w-32 h-10"
                  key={`collection-${currentCategoryIndex}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5 }}
                >
                  {categories[currentCategoryIndex]}
                </motion.span>
                <span>của FreshFruit</span>
              </div>
            </div>
            <div>
              <div className="flex justify-center sm:justify-end mb-4 sm:mt-4">
                <CategoryFilter />
              </div>
              <div>
                <ProductList currentCategory={categories[currentCategoryIndex]} />
              </div>
            </div>
          </div>
          <div className="w-full sm:w-auto flex justify-center mb-8 sm:mb-0 order-1 sm:order-2">
            <motion.div
              className="overflow-hidden rounded-xl"
              animate={{ x: [0, 5, -5] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <img
                src="../../public/image/1.5.jpg"
                alt="Fresh Fruit promotion on My Viettel"
                className="object-cover h-[300px] w-[250px] sm:h-[498px] sm:w-[337px]"
              />
            </motion.div>
          </div>
        </div>
      </div>

      <div className="w-full h-[50px] sm:h-[150px]"></div>

      {/* About Section */}
      <div className="w-full flex justify-center bg-[#EDEDED] px-4 py-10 sm:py-0">
        <div className="w-full max-w-[1300px] relative flex flex-col items-center sm:flex-row overflow-hidden sm:overflow-visible">
          <div className="hidden sm:block absolute left-32 transform -translate-x-1/2 top-[-85px] sm:left-[140px] z-0">
            <img
              src="https://fujifruit.com.vn/wp-content/uploads/2023/10/1712.png"
              className="h-[250px] sm:h-[477px] opacity-100"
              alt=""
            />
          </div>
          <div className="flex flex-col sm:flex-row z-10">
            <div className="hidden sm:block h-auto w-full sm:h-[433px] sm:w-[593px]"></div>
            <div className="flex flex-col h-auto w-full sm:w-[632px] sm:justify-center sm:text-left">
              <div className="text-[#00613C] text-[13px]">
                <span>KHÁT VỌNG VƯƠN LÊN</span>
              </div>
              <div className="text-2xl sm:text-4xl font-medium flex flex-wrap gap-1 sm:flex-row sm:items-center sm:gap-4 sm:flex-wrap sm:justify-start">
                Niềm tự hào về hoa quả
                <span>của FreshFruit</span>
              </div>
              <div className="mt-3 mb-3 text-sm sm:text-base">
                <span>
                  Chúng tôi luôn mong muốn và đã tạo ra nhiều giá trị về sức
                  khỏe và niềm vui cho người dùng Việt. Điều đó thật hạnh phúc khi
                  thật vinh dự vì khách hàng đã tin tưởng vào dịch vụ và sản phẩm
                  của Fresh Fruit. Khách hàng và động lực lớn nhất để chúng tôi
                  phát triển và lớn hơn từng ngày.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full h-[50px] sm:h-[150px]"></div>

      {/* Why Choose Us Section */}
      <div
        className="w-full bg-no-repeat bg-contain flex justify-center px-4"
        style={{ backgroundImage: 'url("your-background-image-url.jpg")' }}
      >
        <div className="w-full max-w-[1300px] flex flex-col sm:flex-row backdrop-blur-sm bg-white/30 rounded-lg overflow-hidden">
          <div className="flex flex-col w-full sm:w-[824px] justify-center leading-normal sm:pr-5 sm:text-left">
            <div className="text-[#00613C] text-[13px] text-left">
              <span>CÙNG LẮNG NGHE</span>
            </div>
            <div className="text-2xl sm:text-4xl font-medium flex flex-wrap gap-1 items-center sm:flex-row sm:items-start">
              <span>Tại sao bạn</span>
              <div className="">
                <motion.span
                  className="text-[#00613C]"
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  Lựa chọn
                </motion.span>
              </div>
              <span>chúng tôi</span>
            </div>
            <div className="text-sm text-left sm:text-base mt-2">
              <span>
                Hoa quả sạch Fresh với đa dạng các trái cây nhập khẩu đến từ các
                nền nông nghiệp tiên tiến, hiện đại bậc nhất thế giới: Nhật Bản,
                Hoa Kỳ, Hàn Quốc, Canada, Australia,v.v. đem đến dinh dưỡng và
                những sự lựa phong phú người dùng.
              </span>
            </div>
            <div className="mx-0 sm:mx-5 mt-4 mb-8 font-medium text-sm sm:text-base text-left">
              <ul className="list-disc list-inside space-y-2">
                <li>Tận tâm với khách hàng và người tiêu dùng</li>
                <li>Sắp mở 50 cửa hàng Fresh trên toàn quốc</li>
                <li>Quy trình sản phẩm chuẩn mực hàng đầu</li>
                <li>Công nghệ bảo quản lạnh CAS hiện đại tân tiến</li>
              </ul>
            </div>
          </div>
          <div className="w-full sm:w-auto flex justify-center items-center p-4 sm:p-0">
            <div>
              <img
                src="https://fujifruit.com.vn/wp-content/uploads/2023/10/harvesting-delicious-organic-strawberries-fruit1.jpg"
                className="h-auto w-full max-w-[280px] sm:h-[360px] sm:max-w-none rounded-2xl object-cover"
                alt=""
              />
            </div>
          </div>
        </div>
      </div>

      <div className="w-full h-[100px] sm:h-[150px]"></div>
    </div>
  );
}
export default Homepage;
