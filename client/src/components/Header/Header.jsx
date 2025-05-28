import { faFacebook, faInstagram, faYoutube } from '@fortawesome/free-brands-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars, faTimes } from '@fortawesome/free-solid-svg-icons';
import SwiperSlideBanner from '../slide/Headerslide';
import SearchBar from '../button/Searchbar';
import AccountButton from '../button/AccountButton';
import CategoryDropdown from '../button/CategoryButton';
import Navbar from '../button/Navbar';
import { Link } from 'react-router-dom';
import CartIcon from '../button/CartButton';
import { useState } from 'react';
export const Header = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    return (
        <header>
            {/* ======================= HEADER CHO THIẾT BỊ DI ĐỘNG ===================== */}
            <div className="md:hidden">
                <div className="flex items-center justify-between h-20 px-4 shadow-md bg-white">
                    <button onClick={() => setIsMenuOpen(true)} className="p-2">
                        <FontAwesomeIcon icon={faBars} className="h-6 w-6 text-gray-700" />
                    </button>
                    <div className='flex-shrink-0'>
                        <a href="http://">
                            <img src="https://fujifruit.com.vn/wp-content/uploads/2022/10/Logo.svg" alt="Fuji Fruit Logo" className='w-32 h-auto' />
                        </a>
                    </div>
                    <div className="p-2">
                        <Link to="/gio-hang"><CartIcon cartCount={3} /></Link>
                    </div>
                </div>

                {/* Menu Off-canvas (Drawer) */}
                {isMenuOpen && (
                    <div className="fixed inset-0 z-40">
                        {/* Lớp nền mờ */}
                        <div
                            className="absolute inset-0 bg-black opacity-50"
                            onClick={() => setIsMenuOpen(false)}
                        ></div>
                        <div className="relative z-50 h-full w-4/5 max-w-sm bg-white p-6 flex flex-col gap-y-6 sm:gap-y-8 overflow-y-auto">
                            <button onClick={() => setIsMenuOpen(false)} className="self-end p-2 -mr-2 sm:self-start sm:p-2 sm:-ml-2">
                                <FontAwesomeIcon icon={faTimes} className="h-6 w-6 text-gray-700" />
                            </button>
                            <div className="w-full">
                                <SearchBar />
                            </div>
                            <div className="w-full">
                                <CategoryDropdown />
                            </div>
                            <div className="border-t pt-4 w-full">
                                <Navbar />
                            </div>
                            <div className="border-t pt-4 w-full">
                                <AccountButton />
                            </div>
                            <div className="flex justify-center gap-x-4 sm:gap-x-6 mt-auto py-4">
                                <span><FontAwesomeIcon icon={faFacebook} className='h-6 w-6 text-gray-600' /></span>
                                <span><FontAwesomeIcon icon={faYoutube} className='h-6 w-6 text-gray-600' /></span>
                                <span><FontAwesomeIcon icon={faInstagram} className='h-6 w-6 text-gray-600' /></span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            {/* ======================= HEADER CHO DESKTOP ============================ */}

            <div className="hidden md:block">
                <div className="h-8 w-full bg-[#F67010] flex justify-center items-center">
                    <div className="w-[1200px] h-8 flex items-center justify-between">
                        <div className='flex justify-start gap-x-4'>
                            <div><span><FontAwesomeIcon icon={faFacebook} className='text-white' /></span></div>
                            <div><span><FontAwesomeIcon icon={faYoutube} className='text-white' /></span></div>
                            <div><span><FontAwesomeIcon icon={faInstagram} className='text-white' /></span></div>
                        </div>
                        <div className='h-8 w-[600px]'>
                            <div><SwiperSlideBanner /></div>
                        </div>
                        <div className=''></div>
                    </div>
                </div>
                <div className='h-[100px] w-full flex flex-row justify-center items-center'>
                    <div className='w-[1300px] h-[100px] flex gap-50 items-center'>
                        <div className='h-[74px] flex items-center'>
                            <div><SearchBar /></div>
                        </div>
                        <div className='h-[74px] flex items-center justify-center'>
                            <div className='inline-block'><a href="http://"><img src="https://fujifruit.com.vn/wp-content/uploads/2022/10/Logo.svg" alt="" className='w-[162px] h-10' /></a></div>
                        </div>
                        <div className='h-[74px] flex items-center justify-end'>
                            <div><AccountButton /></div>
                        </div>
                    </div>
                </div>
                <div className='h-[100px] w-full border-t border-gray-200 flex justify-center'>
                    <div className='w-[1300px] h-[100px] flex flex-row justify-between items-center'>
                        <div className='flex items-center gap-x-25'>
                            <div><CategoryDropdown /></div>
                            <div><Navbar /></div>
                        </div>
                        <div>
                            <div><Link to="/gio-hang"><CartIcon cartCount={3} /></Link></div>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}