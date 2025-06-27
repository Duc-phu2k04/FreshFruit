import { FiShoppingCart } from 'react-icons/fi';

const CartIcon = ({ cartCount = 0 }) => {
    return (
        <div className="relative">
            <FiShoppingCart size={28} className="text-green-800" />
            <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full">
                {cartCount}
            </span>
        </div>
    );
};

export default CartIcon;
