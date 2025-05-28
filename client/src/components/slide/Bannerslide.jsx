// components/BannerSlider.jsx
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/autoplay';
import { Autoplay, Pagination } from 'swiper/modules';

const banners = [
    {
        id: 1,
        image: 'https://fujifruit.com.vn/wp-content/uploads/2024/03/4.jpg',
        alt: 'Banner 1',
    },
    {
        id: 2,
        image: 'https://fujifruit.com.vn/wp-content/uploads/2024/03/5.jpg',
        alt: 'Banner 2',
    },
    {
        id: 3,
        image: 'https://fujifruit.com.vn/wp-content/uploads/2024/03/6.jpg',
        alt: 'Banner 3',
    },
    {
        id: 4,
        image: 'https://fujifruit.com.vn/wp-content/uploads/2024/03/8.jpg',
        alt: 'Banner 5',
    },
];

const BannerSlider = () => {
    return (
        <div className="w-full m-0">
            <Swiper
                modules={[Autoplay, Pagination]}
                autoplay={{ delay: 3000, disableOnInteraction: false }}
                pagination={{ clickable: true }}
                loop={true}
            >
                {banners.map((banner) => (
                    <SwiperSlide key={banner.id}>
                        <img
                            src={banner.image}
                            alt={banner.alt}
                            className="w-full object-cover h-[200px] sm:h-[300px] md:h-[450px]"
                        />
                    </SwiperSlide>
                ))}
            </Swiper>
        </div>
    );
};

export default BannerSlider;