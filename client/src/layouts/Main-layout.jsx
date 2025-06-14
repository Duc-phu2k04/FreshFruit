import { Outlet } from 'react-router-dom';
import { Header } from '../components/Header/Header';
import { Footer } from '../components/Footer/Footer';




export default function Layout() {
    return (
        <>
            <div className='overflow-x-hidden'>
                <Header />
                <Outlet />
                <Footer />
            </div>
        </>
    );
}