import React from 'react';

const PhoneSubscribe = () => {
  return (
    <div className="flex items-center justify-center w-full md:w-fit p-6 bg-gradient-to-r from-yellow-100 to-green-100 rounded-2xl shadow-inner">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-32 h-32 text-green-600"
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        <path d="M12 2C10 2 7 4 7 8s3 6 5 6 5-2 5-6-2-6-5-6zM5 22h14c0-5-3-8-7-8s-7 3-7 8z"/>
      </svg>
      <p className="ml-4 text-green-700 font-semibold text-lg">
        Trái cây tươi ngon mỗi ngày 🌿
      </p>
    </div>
  );
};

export default PhoneSubscribe;
