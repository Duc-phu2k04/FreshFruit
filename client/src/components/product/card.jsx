import React from 'react';

const ProductCard = ({ image, title, price }) => {
    return (
        <div className="bg-[#f5f7fd] rounded-xl shadow-md text-center ml-[10px]">
            <img src={image} alt={title} className="rounded-lg w-full h-80 object-cover mb-4" />
            <h3 className="text-[18px] font-medium mb-2">{title}</h3>
            <p className="text-[#025492] font-bold text-[20px] mb-2">{price}</p>
            <div className="text-yellow-400 text-lg">
                {'★'.repeat(5)}
            </div>
        </div>
    );
};

export default ProductCard;
