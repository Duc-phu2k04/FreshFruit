import { faFacebook, faInstagram, faYoutube } from '@fortawesome/free-brands-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import SwiperSlideBanner from '../slide/Headerslide';
import SearchBar from '../button/Searchbar';
import AccountButton from '../button/AccountButton';
import CategoryDropdown from '../button/CategoryButton';
import Navbar from '../button/Navbar';
import { Link } from 'react-router-dom';
import CartIcon from '../button/CartButton';
export const Header = () => {
    return (
        <header>
            <div className="h-8 w-full bg-[#F67010] flex justify-center items-center">
                <div className="w-[1280px] h-8 flex items-center">
                    <div className='w-1/4 flex justify-center '>
                        <div><span><FontAwesomeIcon icon={faFacebook} className='text-white ml-2 mr-2' /></span></div>
                        <div><span><FontAwesomeIcon icon={faYoutube} className='text-white ml-2 mr-2' /></span></div>
                        <div><span><FontAwesomeIcon icon={faInstagram} className='text-white ml-2 mr-2' /></span></div>
                    </div>
                    <div className='w-1/2 h-8'>
                        <div>
                            <SwiperSlideBanner />
                        </div>
                    </div>
                    <div className='w-1/4'>

                    </div>
                </div>
            </div>
            <div className='h-[100px] w-full flex flex-row justify-center items-center '>
                <div className='w-[1300px] h-[100px] flex flex-row justify-center items-center'>
                    <div className='h-[74px] flex items-center w-auto'>
                        <div><SearchBar /></div>
                    </div>
                    <div className='w-[480px] h-[74px] flex items-center justify-center'>
                        <div className='inline-block'><a href="http://"><img src="https://fujifruit.com.vn/wp-content/uploads/2022/10/Logo.svg" alt="" className='w-[162px] h-10' /></a></div>
                    </div>
                    <div className='w-[360px] h-[74px] flex items-center justify-around'>
                        <div><AccountButton /></div>
                    </div>

                </div>
            </div>
            <div className='h-[100px] w-full border-t-[#ccc] border-t-1 flex justify-center'>
                <div className='w-[1300px] h-[100px] flex flex-row gap-x-22 items-center'>
                    <div className='ml-5'>
                        <div><CategoryDropdown /></div>
                    </div>
                    <div>
                        <div><Navbar /></div>
                    </div>
                    <div>
                        <div><Link to="/gio-hang"><CartIcon cartCount={3} /></Link></div>
                    </div>
                </div>
            </div>
        </header >
    );
}