import CategoryFilter from "../../components/button/CategoryFilter";
import ViewNowButton from "../../components/button/ViewnowButton";
import ProductList from "../../components/product/ProductList";
import BannerSlider from "../../components/slide/Bannerslide";
import ProductCarousel from "../../components/slide/Productslide";
import { motion } from "framer-motion";

function Homepage() {
    return (
        <div>
            {/* Banner Slider */}
            <div className="">
                <BannerSlider />
            </div>

            {/* Feature Icons Section */}
            <div className="w-full mt-10 flex justify-center px-4">
                <div className="w-full max-w-7xl flex flex-nowrap justify-around gap-y-5 overflow-x-auto sm:flex-wrap sm:justify-evenly sm:mb-8">
                    <div className="hidden sm:w-auto sm:flex sm:justify-center"><img src="https://fujifruit.com.vn/wp-content/uploads/2024/12/72h.png" className="h-24 sm:h-32" alt="" /></div>
                    <div className="flex-shrink-0 w-1/3 sm:w-auto flex justify-center"><img src="https://fujifruit.com.vn/wp-content/uploads/2023/10/phanhoi.svg" className="h-24 sm:h-32" alt="" /></div>
                    <div className="flex-shrink-0 w-1/3 sm:w-auto flex justify-center"><img src="https://fujifruit.com.vn/wp-content/uploads/2023/10/mienphi.svg" className="h-24 sm:h-32" alt="" /></div>
                    <div className="flex-shrink-0 w-1/3 sm:w-auto flex justify-center"><img src="https://fujifruit.com.vn/wp-content/uploads/2023/10/thanhtoan.svg" className="h-24 sm:h-32" alt="" /></div>
                    <div className="hidden sm:w-auto sm:flex sm:justify-center"><img src="https://fujifruit.com.vn/wp-content/uploads/2023/10/Thuonghieu.svg" className="h-24 sm:h-32" alt="" /></div>
                </div>
            </div>

            {/* Product Program Section */}
            <div className="w-full flex justify-center">
                <div className="w-full max-w-[1300px] flex flex-col sm:flex-row justify-between py-5 px-4 sm:px-2.5 sm:items-end">
                    <div className="flex flex-col mb-5 sm:mb-0 text-left">
                        <div className="text-[#00613C] text-[13px]"><span>CHƯƠNG TRÌNH BÁN HÀNG</span></div>
                        <div className="text-2xl sm:text-4xl font-medium flex flex-wrap gap-4  sm:flex-row sm:items-center sm:gap-4">
                            Sản Phẩm

                            <span className="relative text-[#00613C] switch-text w-[87px] sm:w-32 h-10"></span>
                            <span>
                                của FreshFruit
                            </span>
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

            {/* Product Collection Section */}
            <div className="w-full flex justify-center mt-8 px-4">
                <div className="w-full max-w-[1300px] flex flex-col sm:flex-row sm:justify-between">
                    <div className="w-full sm:w-[903px] order-2 sm:order-1">
                        <div className="flex flex-col mb-2 sm:mb-0 text-left">
                            <div className="text-[#00613C] text-[13px]"><span>BỘ SƯU TẬP</span></div>
                            <div className="text-2xl sm:text-4xl font-medium flex flex-wrap gap-4 sm:flex-row sm:items-center sm:gap-4">
                                Sản Phẩm

                                <span className="relative text-[#00613C] switch-text w-[87px] sm:w-32 h-10"></span>
                                <span>

                                    của FreshFruit
                                </span>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-center sm:justify-end mb-4 sm:mt-4"><CategoryFilter /></div>
                            <div><ProductList /></div>
                        </div>
                    </div>
                    <div className="w-full sm:w-auto flex justify-center mb-8 sm:mb-0 order-1 sm:order-2">
                        <motion.div
                            className="overflow-hidden rounded-xl"
                            animate={{ x: [0, 5, -5] }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                        >
                            <img
                                src="https://fujifruit.com.vn/wp-content/uploads/2024/08/20240823-133320.jpg"
                                alt="Fuji Fruit promotion on My Viettel"
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
                        <img src="https://fujifruit.com.vn/wp-content/uploads/2023/10/1712.png" className="h-[250px] sm:h-[477px] opacity-100" alt="" />
                    </div>
                    <div className="flex flex-col sm:flex-row z-10">
                        <div className="hidden sm:block h-auto w-full sm:h-[433px] sm:w-[593px]"></div>
                        <div className="flex flex-col h-auto w-full sm:w-[632px] sm:justify-center sm:text-left">
                            <div className="text-[#00613C] text-[13px]"><span>KHÁT VỌNG VƯƠN LÊN</span></div>
                            <div className="text-2xl sm:text-4xl font-medium flex flex-wrap gap-1 sm:flex-row sm:items-center sm:gap-4 sm:flex-wrap sm:justify-start">
                                Niềm tự hào về

                                <span className="relative text-[#00613C] switchtext w-[87px] sm:w-32 h-10"></span>
                                <span>

                                    của FreshFruit
                                </span>
                            </div>
                            <div className="mt-3 mb-3 text-sm sm:text-base"><span>Chúng tôi luôn mong muốn và đã tạo ra nhiều giá trị về sức khỏe và niềm vui cho người dùng Việt. Điều đó thật hạnh phúc khi thật vinh dự vì khách hàng đã tin tưởng vào dịch vụ và sản phẩm của Fuji Fruit. Khách hàng và động lực lớn nhất để chúng tôi phát triển và lớn hơn từng ngày.</span></div>
                            <div><ViewNowButton /></div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="w-full h-[50px] sm:h-[150px]"></div>

            {/* Why Choose Us Section */}
            <div className="w-full bg-no-repeat bg-contain flex justify-center px-4" style={{ backgroundImage: 'url("your-background-image-url.jpg")' }}>
                <div className="w-full max-w-[1300px] flex flex-col sm:flex-row backdrop-blur-sm bg-white/30 rounded-lg overflow-hidden">
                    <div className="flex flex-col w-full sm:w-[824px] justify-center leading-normal sm:pr-5 sm:text-left">
                        <div className="text-[#00613C] text-[13px] text-left"><span>CÙNG LẮNG NGHE</span></div>
                        <div className="text-2xl sm:text-4xl font-medium flex flex-wrap gap-1 items-center sm:flex-row sm:items-start">
                            <span>Tại sao bạn</span>
                            <div className="">
                                <motion.span className="text-[#00613C]" animate={{ opacity: [0, 1, 0] }}
                                    transition={{ duration: 3, repeat: Infinity }}>Lựa chọn</motion.span>
                            </div>
                            <span>chúng tôi</span>
                        </div>
                        <div className="text-sm text-left sm:text-base mt-2">
                            <span>Hoa quả sạch Fuji với đa dạng các trái cây nhập khẩu đến từ các nền nông nghiệp tiên tiến, hiện đại bậc nhất thế giới: Nhật Bản, Hoa Kỳ, Hàn Quốc, Canada, Australia,v.v. đem đến dinh dưỡng và những sự lựa phong phú người dùng.</span>
                        </div>
                        <div className="mx-0 sm:mx-5 mt-4 mb-8 font-medium text-sm sm:text-base text-left">
                            <ul className="list-disc list-inside space-y-2">
                                <li>Tận tâm với khách hàng và người tiêu dùng</li>
                                <li>Hệ thống 50 cửa hàng Fuji trên toàn quốc</li>
                                <li>Quy trình sản phẩm chuẩn mực hàng đầu</li>
                                <li>Công nghệ bảo quản lạnh CAS hiện đại tân tiến</li>
                            </ul>
                        </div>
                        <div className="self-left sm:self-start"><ViewNowButton /></div>
                    </div>
                    <div className="w-full sm:w-auto flex justify-center items-center p-4 sm:p-0">
                        <div>
                            <img src="https://fujifruit.com.vn/wp-content/uploads/2023/10/harvesting-delicious-organic-strawberries-fruit1.jpg" className="h-auto w-full max-w-[280px] sm:h-[360px] sm:max-w-none rounded-2xl object-cover" alt="" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="w-full h-[100px] sm:h-[150px]"></div>

        </div >
    );
}
export default Homepage;