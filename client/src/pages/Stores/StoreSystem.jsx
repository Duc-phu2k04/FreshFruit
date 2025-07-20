import React from 'react';

const StoreSystem = () => {
  return (
    <div className="max-w-5xl mx-auto py-10 px-4 space-y-6">
      <h1 className="text-3xl font-bold text-green-700">Hệ thống cửa hàng</h1>
      <p className="text-gray-700">
        FreshFruit có mặt tại TP.HCM, Hà Nội, Đà Nẵng... Đến ngay cửa hàng gần bạn!
      </p>
      <div className="space-y-4">
        <div>
          <h2 className="font-semibold text-lg">FreshFruit Quận 1</h2>
          <p>123 Lê Lợi, Quận 1, TP.HCM</p>
        </div>
        <div>
          <h2 className="font-semibold text-lg">FreshFruit Hà Nội</h2>
          <p>78 Trần Duy Hưng, Cầu Giấy, Hà Nội</p>
        </div>
      </div>
      <div className="mt-6">
        <iframe
          title="Map"
          src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3919.133040408312!2d106.70042497583096!3d10.800014158798794!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3175292cd95ffdf3%3A0x8e3d52f7b660a5ae!2zMTIzIEzDqiBM4buxYywgUXXhuq1uIDEsIFRow6BuaCBwaOG7kSBIw7JhLCBUUC4gSOG7kyBDaMOtbmgsIFZpZXRuYW0!5e0!3m2!1svi!2s!4v1626091923123!5m2!1svi!2s"
          className="w-full h-80 rounded-xl border"
          allowFullScreen=""
          loading="lazy"
        ></iframe>
      </div>
    </div>
  );
};

export default StoreSystem;
