import { Link } from "react-router-dom";

const ViewNowButton = () => {
    return (
        <Link
            to="/san-pham"
            className="bg-green-800 text-white text-[20px] cursor-pointer px-4 py-2 rounded hover:bg-green-700 transition-all duration-300 group inline-block"
        >
            <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">
                Xem ngay →
            </span>
        </Link>
    );
};

export default ViewNowButton;
