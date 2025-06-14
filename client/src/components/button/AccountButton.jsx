import { FiUser } from 'react-icons/fi';
import { Link } from 'react-router-dom';

const AccountButton = () => {
    return (
        <div className="flex items-center space-x-2 text-black">
            <FiUser size={24} />
            <div className="flex leading-tight text-sm gap-2">
                <Link to="/dang-nhap" className="hover:underline text-base text-[#514d4d] font-medium">
                    Đăng nhập
                </Link>
                <Link to="/dang-ky" className="hover:underline text-base text-[#514d4d] font-medium">
                    Đăng ký
                </Link>
            </div>
        </div>
    );
};

export default AccountButton;
