const ProductCard2 = ({ image, title, price }) => (
    <div className="flex bg-[#e7e9ec] rounded-xl shadow p-4 gap-4 items-center max-w-xl">
        <img
            src={image}
            alt={title}
            className="w-40 h-40 rounded-lg object-cover border-2 border-green-600"
        />
        <div>
            <h3 className="text-lg font-semibold mb-1">{title}</h3>
            <p className="text-green-700 font-bold text-xl mb-3">{price}</p>
            <button className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4 py-2 rounded-full">
                Mua Ngay
            </button>
        </div>
    </div>
);
export default ProductCard2;
