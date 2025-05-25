import { FaFileAlt, FaGlobe, FaMapMarkerAlt, FaPhoneAlt } from "react-icons/fa";
import PhoneSubscribe from "../button/PhoneSubscrice";
import SocialIcons from "../button/SocialIcons";

export const Footer = () => {
    return (
        <footer >
            <div className="h-[600px] w-full bg-gradient-to-b from-[#0DAD4D] to-[#005577] flex justify-center">
                <div className="w-[1280px]">
                    <div className="flex items-center mt-14 gap-x-6">
                        <div className="ml-4">
                            <div className='inline-block'><a href="http://"><img src="https://fujifruit.com.vn/wp-content/uploads/2023/10/logo_2.svg" alt="" className='w-[295px] h-[71]' /></a></div>
                        </div>
                        <div>
                            <div className="">
                                <PhoneSubscribe />
                            </div>
                        </div>
                        <div>
                            <div className="">
                                <SocialIcons />
                            </div>
                        </div>
                    </div>
                    <div className="flex">
                        <div>
                            <div className=" text-white pl-6 pt-6 rounded-lg w-[530px]">
                                <h2 className="text-2xl font-bold uppercase mb-4">
                                    CÔNG TY CP XUẤT NHẬP KHẨU FUJI
                                </h2>

                                <div className="flex items-start gap-3 mb-3">
                                    <FaMapMarkerAlt className="mt-1" />
                                    <p>Trụ sở: 352 Giải Phóng, Phường Liệt, Thanh Xuân, Hà Nội</p>
                                </div>

                                <div className="flex items-start gap-3 mb-3">
                                    <FaPhoneAlt className="mt-1" />
                                    <p>Hotline: 1900 2268 - 0989 96 69 96</p>
                                </div>

                                <div className="flex items-start gap-3 mb-3">
                                    <FaGlobe className="mt-1" />
                                    <p>Website: <a href="https://www.fujifruit.com.vn" className="underline">www.fujifruit.com.vn</a></p>
                                </div>

                                <div className="flex items-start gap-3">
                                    <FaFileAlt className="mt-1" />
                                    <p>
                                        Giấy CNĐKKD: 0107875928 do Sở Kế hoạch và Đầu tư TP. Hà Nội cấp ngày 09/06/2017
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div>
                            <div className=" text-white p-6 rounded-md">
                                <h3 className="text-[15px] font-bold uppercase border-b border-white pb-2 mb-4">
                                    Hỗ trợ khách hàng
                                </h3>
                                <ul className="space-y-3 text-base">
                                    <li>
                                        <a href="/ve-chung-toi" className="hover:underline block">
                                            Về chúng tôi
                                        </a>
                                    </li>
                                    <li>
                                        <a href="/chinh-sach-ho-tro" className="hover:underline block">
                                            Chính sách hỗ trợ
                                        </a>
                                    </li>
                                    <li>
                                        <a href="/cam-ket" className="hover:underline block">
                                            Cam kết
                                        </a>
                                    </li>
                                    <li>
                                        <a href="/giai-thuong" className="hover:underline block">
                                            Giải thưởng
                                        </a>
                                    </li>
                                </ul>
                            </div>
                        </div>
                        <div>
                            <div className=" text-white p-6 rounded-md">
                                <h3 className="text-[15px] font-bold uppercase border-b border-white pb-2 mb-4">
                                    Về chúng tôi
                                </h3>
                                <ul className="space-y-3 text-base">
                                    <li>
                                        <a href="/" className="hover:underline block">
                                            Trang chủ
                                        </a>
                                    </li>
                                    <li>
                                        <a href="/san-pham" className="hover:underline block">
                                            Sản phẩm
                                        </a>
                                    </li>
                                    <li>
                                        <a href="/tin-tuc" className="hover:underline block">
                                            Tin tức
                                        </a>
                                    </li>
                                    <li>
                                        <a href="/ve-chung-toi" className="hover:underline block">
                                            Về chúng tôi
                                        </a>
                                    </li>
                                    <li>
                                        <a href="/nhuong-quyen" className="hover:underline block">
                                            Nhượng quyền
                                        </a>
                                    </li>
                                    <li>
                                        <a href="/he-thong-cua-hang" className="hover:underline block">
                                            Hệ thống cửa hàng
                                        </a>
                                    </li>
                                </ul>
                            </div>
                        </div>
                        <div>
                            <div className="mt-6 ml-16"><img src="https://fujifruit.com.vn/wp-content/uploads/2023/10/image-24.png" alt="" /></div>
                        </div>
                    </div>
                    <div className="flex justify-center mt-7">
                        <div className="text-[#FFB800]">© 2023 Hệ thống hoa quả sạch Fuji Fruit – Powered by CCMartech</div>
                    </div>
                </div>
            </div>
        </footer>
    );
}