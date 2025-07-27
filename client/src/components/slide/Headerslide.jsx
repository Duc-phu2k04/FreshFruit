
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Autoplay } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';

const SwiperSlideBanner = () => {
    const messages = [
        'Giao hàng miễn phí <5km',
        'Giảm giá 10% cho đơn hàng đầu tiên',
        'Hỗ trợ đổi trả trong 7 ngày',
        'Thanh toán khi nhận hàng'
    ];

    return (
        <Swiper
            modules={[Navigation, Autoplay]}
            navigation
            autoplay={{ delay: 3000 }}
            loop
            className="bg-orange-500 text-white font-semibold text-sm md:text-base h-8"
        >
            {messages.map((message, index) => (
                <SwiperSlide key={index}>
                    <div className="flex justify-center items-center py-1">
                        {message}
                    </div>
                </SwiperSlide>
            ))}
        </Swiper>
    );
};

export default SwiperSlideBanner;
