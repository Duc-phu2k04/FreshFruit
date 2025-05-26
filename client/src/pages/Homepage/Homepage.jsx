import CategoryFilter from "../../components/button/CategoryFilter";
import ViewNowButton from "../../components/button/ViewnowButton";
import ProductList from "../../components/product/ProductList";
import BannerSlider from "../../components/slide/Bannerslide";
import ProductCarousel from "../../components/slide/Productslide";
import { motion } from "framer-motion";
function Homepage() {
    return (
        <div>
            <div className=""><BannerSlider /></div>
            <div className="w-full mt-10 flex justify-center">
                <div className="w-7xl flex justify-around">
                    <div><img src="https://fujifruit.com.vn/wp-content/uploads/2024/12/72h.png" className=" h-32" alt="" /></div>
                    <div ><img src="https://fujifruit.com.vn/wp-content/uploads/2023/10/phanhoi.svg" className=" h-32" alt="" /></div>
                    <div ><img src="https://fujifruit.com.vn/wp-content/uploads/2023/10/mienphi.svg" className=" h-32" alt="" /></div>
                    <div ><img src="https://fujifruit.com.vn/wp-content/uploads/2023/10/thanhtoan.svg" className=" h-32" alt="" /></div>
                    <div><img src="https://fujifruit.com.vn/wp-content/uploads/2023/10/Thuonghieu.svg" className=" h-32" alt="" /></div>
                </div>
            </div>
            <div className="w-full flex justify-center">
                <div className="w-[1300px] flex justify-between items-end py-10 px-2.5">
                    <div className="flex flex-col">
                        <div className="text-[#00613C] text-[13px]"><span>CHƯƠNG TRÌNH BÁN HÀNG</span></div>
                        <div className="h-̀[54px] text-4xl font-medium flex gap-4 ">
                            <div>
                                <span>Sản Phẩm</span>
                            </div>
                            <div className="w-32">
                                <span class="relative text-[#00613C] switch-text"></span>
                            </div>
                            <div><span>của FreshFruit</span></div>
                        </div>
                    </div>
                    <div>
                        <div>
                            <ViewNowButton />
                        </div>
                    </div>
                </div>
            </div>
            <div className="flex w-full justify-center">
                <div className="w-[1300px]"> <ProductCarousel /></div>
            </div>
            <div className="w-full flex justify-center">
                <div className="w-[1300px] flex justify-between mt-8">
                    <div className="w-[903px]">
                        <div className="flex flex-col ml-[11px] mb-3">
                            <div className="text-[#00613C] text-[13px]"><span>BỘ SƯU TẬP</span></div>
                            <div className="h-̀[54px] text-4xl font-medium flex gap-4 ">
                                <div>
                                    <span>Sản Phẩm</span>
                                </div>
                                <div className="w-32">
                                    <span class="relative text-[#00613C] switch-text"></span>
                                </div>
                                <div><span>của FreshFruit</span></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-end"><CategoryFilter /></div>
                            <div><ProductList /></div>
                        </div>
                    </div>
                    <div>
                        <motion.div
                            className="overflow-hidden rounded-xl"
                            animate={{
                                x: [0, 5, -5], // Lắc qua trái phải
                            }}
                            transition={{
                                duration: 1.5,
                                repeat: Infinity,
                                ease: "easeInOut",
                            }}
                        >
                            <img
                                src="https://fujifruit.com.vn/wp-content/uploads/2024/08/20240823-133320.jpg"
                                alt="Fuji Fruit promotion on My Viettel"
                                className=" object-cover h-[498px] w-[337px]"
                            />
                        </motion.div>
                    </div>
                </div>
            </div>
            <div className="w-full h-[150px]"></div>
            <div className="w-full flex justify-center bg-[#EDEDED]">
                <div className="w-[1300px] relative ">
                    <div className="absolute left-[-340px] top-[-85px]"><img src="https://fujifruit.com.vn/wp-content/uploads/2023/10/1712.png" className="h-[477px]" alt="" /></div>
                    <div className="flex ">
                        <div className="h-[433px] w-[593px]"></div>
                        <div className="flex flex-col h-[433px] w-[632px] justify-center">
                            <div className="text-[#00613C] text-[13px]"><span>KHÁT VỌNG VƯƠN LÊN</span></div>
                            <div className="h-̀[54px] text-4xl font-medium flex gap-1 ">
                                <div className="w-[260px]">
                                    <span>Niềm tự hào về của FreshFruit</span>
                                </div>
                                <div className="w-64">
                                    <span class="relative text-[#00613C] switchtext"></span>
                                </div>

                            </div>
                            <div className="mt-3 mb-3"><span>Chúng tôi luôn mong muốn và đã tạo ra nhiều giá trị về sức khỏe và niềm vui cho người dùng Việt. Điều đó thật hạnh phúc khi thật vinh dự vì khách hàng đã tin tưởng vào dịch vụ và sản phẩm của Fuji Fruit. Khách hàng và động lực lớn nhất để chúng tôi phát triển và lớn hơn từng ngày.</span></div>
                            <div><ViewNowButton /></div>
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
}
export default Homepage;