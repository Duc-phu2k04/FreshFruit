// components/ProductCarousel.jsx
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/navigation';
import { Pagination, Autoplay, Navigation } from 'swiper/modules';
import ProductCard from '../product/card';

const productList = [
    {
        image: 'https://fujifruit.com.vn/wp-content/uploads/2023/06/1-600x600.png',
        title: 'Giỏ quà biếu tặng 13',
        price: '750.000 VND',
    },
    {
        image: 'https://fujifruit.com.vn/wp-content/uploads/2023/06/5-300x300.png',
        title: 'Giỏ quà biếu tặng 14',
        price: '1.000.000 VND',
    },
    {
        image: 'https://fujifruit.com.vn/wp-content/uploads/2024/03/Gio-hoa-900-x-900-px-3-600x600.png',
        title: 'Giỏ quà biếu tặng 16',
        price: '950.000 VND',
    },
    {
        image: 'https://fujifruit.com.vn/wp-content/uploads/2024/03/468122138_932815988911374_5791732756503854853_n-600x600.jpg',
        title: 'Giỏ quà biếu tặng 4',
        price: '2.000.000 VND',
    },
    {
        image: 'https://fujifruit.com.vn/wp-content/uploads/2024/03/468122138_932815988911374_5791732756503854853_n-600x600.jpg',
        title: 'Giỏ quà biếu tặng 4',
        price: '2.000.000 VND',
    },
];

const ProductCarousel = () => {
    return (
        <div className="w-full mx-auto">
            <Swiper
                spaceBetween={20}
                slidesPerView={1}
                pagination={{ clickable: true }}
                navigation={true}
                autoplay={{
                    delay: 3000,
                    disableOnInteraction: false,
                }}
                breakpoints={{
                    640: {
                        slidesPerView: 2,
                        spaceBetween: 20,
                    },
                    1024: {
                        slidesPerView: 3,
                        spaceBetween: 30,
                    },

                    1280: {
                        slidesPerView: 4,
                        spaceBetween: 40,
                    },
                }}
                loop={true}
                modules={[Pagination, Autoplay, Navigation]}
                className="mySwiper"
            >
                {productList.map((product, index) => (
                    <SwiperSlide key={index} className='pb-12'>
                        <ProductCard image={product.image} title={product.title} price={product.price} />
                    </SwiperSlide>
                ))}
            </Swiper>
        </div>
    );
};

export default ProductCarousel;