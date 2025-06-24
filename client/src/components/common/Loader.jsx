import React from 'react';

const Loader = () => {
    return (
        // Lớp phủ toàn màn hình để làm mờ nội dung phía sau
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white bg-opacity-75">
            {/* Vòng xoay spinner */}
            <div className="h-16 w-16 animate-spin rounded-full border-8 border-solid border-blue-600 border-t-transparent"></div>
        </div>
    );
};

export default Loader;