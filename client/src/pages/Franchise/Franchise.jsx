import React from 'react';

const Franchise = () => {
  return (
    <div className="max-w-5xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold text-green-700 mb-6">Hợp tác nhượng quyền</h1>
      <img src="https://cdn.pixabay.com/photo/2017/09/01/17/44/england-2704973_1280.jpg" alt="nhượng quyền" className="w-full rounded-xl mb-6 shadow" />
      <p className="text-gray-700 mb-4">
        Cùng FreshFruit mở rộng hệ thống cửa hàng khắp Việt Nam với mô hình vận hành tối ưu & nguồn hàng ổn định.
      </p>
      <ul className="list-disc pl-6 space-y-2 text-gray-700">
        <li>Setup cửa hàng từ A-Z</li>
        <li>Hỗ trợ Marketing toàn diện</li>
        <li>Thương hiệu uy tín và bền vững</li>
        <li>Chi phí đầu tư linh hoạt, hoàn vốn nhanh</li>
      </ul>
      <p className="mt-6">☎️ Gọi ngay: <strong>0939 999 888</strong> – Email: franchise@freshfruit.vn</p>
    </div>
  );
};

export default Franchise;
