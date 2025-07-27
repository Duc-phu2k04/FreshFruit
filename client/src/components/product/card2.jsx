import React from 'react';

const ProductCard2 = ({ image, title, price }) => (
    <div className="flex flex-col bg-[#e7e9ec] rounded-xl shadow p-2 sm:p-3 gap-2 sm:flex-row">
        <img
            src={image}
            alt={title}
            className="w-full h-32 sm:h-40 sm:w-40 rounded-lg object-cover border-2 border-green-600"
        />
        <div className="flex flex-col items-start p-1 sm:items-start">
            <h3 className="text-base sm:text-lg font-semibold mb-1 line-clamp-2">{title}</h3>
            <p className="text-green-700 font-bold text-lg sm:text-xl mb-2">{price}</p>
            <button className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-3 py-1.5 rounded-full text-sm">
                Mua Ngay
            </button>
        </div>
    </div>
);

export default ProductCard2;