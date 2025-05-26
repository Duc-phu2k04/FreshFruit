import React from 'react';

const ViewNowButton = () => {
    return (
        <button

            className="bg-green-800 text-white text-[20px] cursor-pointer px-4 py-2 rounded hover:bg-green-700 transition-all duration-300 group"
        >
            <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">
                Xem ngay →
            </span>
        </button>
    );
};

export default ViewNowButton;
