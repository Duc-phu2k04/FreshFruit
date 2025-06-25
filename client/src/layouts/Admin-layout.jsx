import React from 'react';
import Sidebar from '../pages/Admin/SideBar';
import { Outlet } from 'react-router-dom';

const AdminLayout = () => {
    return (
        <div className="flex min-h-screen">
            {/* Sidebar trái */}
            <div className="w-64 bg-gray-100 border-r">
                <Sidebar />
            </div>

            {/* Nội dung bên phải */}
            <div className="flex-1 p-6 bg-white">
                <Outlet />
            </div>
        </div>
    );
};

export default AdminLayout;
