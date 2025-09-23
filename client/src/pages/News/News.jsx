import React from 'react';

export default function News() {
  const newsList = [
    {
      title: 'Lợi ích tuyệt vời của việc ăn trái cây tươi mỗi ngày',
      image: 'https://cdn.pixabay.com/photo/2023/10/21/18/34/grapes-8331973_1280.jpg',
      content: 'Trái cây tươi không chỉ cung cấp vitamin mà còn giúp tăng sức đề kháng và làm đẹp da. Ăn trái cây mỗi ngày là một thói quen sống lành mạnh được các chuyên gia khuyên dùng.'
    },
    {
      title: 'FreshFruit dự tính mở cửa hàng mới tại TP.HCM',
      image: 'https://cdn.pixabay.com/photo/2013/11/18/13/30/cherry-212601_1280.jpg',
      content: 'Chúng tôi dự tính mở thêm chi nhánh mới tại Quận 1. Với không gian hiện đại và nguồn trái cây tươi sạch, hy vọng sẽ mang đến trải nghiệm mua sắm tuyệt vời cho khách hàng.'
    },
    {
      title: 'Bí quyết bảo quản trái cây lâu hỏng tại nhà',
      image: 'https://cdn.pixabay.com/photo/2014/11/12/21/18/strawberries-528791_1280.jpg',
      content: 'Để trái cây luôn tươi ngon, hãy bảo quản trong nhiệt độ phù hợp, tránh ánh nắng trực tiếp và sử dụng hộp kín. Cùng tìm hiểu thêm các mẹo hữu ích khác!'
    }
  ];

  // Thông tin ship Hà Nội (ví dụ). Bạn có thể sửa danh sách phường/xã theo dữ liệu chính xác.
  const hanoiShipping = {
    inner: {
      title: 'Ship nội thành Hà Nội',
      price: 30000,
      areas: [
        'Quận Hoàn Kiếm',
        'Quận Ba Đình',
        'Quận Hai Bà Trưng',
        'Quận Đống Đa',
        'Quận Tây Hồ',
        'Quận Cầu Giấy'
      ]
    },
    outer: {
      title: 'Ship ngoại thành Hà Nội',
      price: 45000,
      areas: [
        'Huyện Đông Anh',
        'Huyện Gia Lâm',
        'Huyện Thanh Trì',
        'Huyện Hoài Đức',
        'Huyện Sóc Sơn'
      ]
    }
  };

  const formatCurrency = (v) => {
    return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ';
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-green-700 mb-6 text-center">Tin tức & Cập nhật</h1>

      <div className="grid md:grid-cols-3 gap-8 mb-10">
        {newsList.map((item, idx) => (
          <div key={idx} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300">
            <img src={item.image} alt={item.title} className="w-full h-48 object-cover" />
            <div className="p-4">
              <h2 className="text-xl font-semibold text-gray-800 mb-2">{item.title}</h2>
              <p className="text-gray-600 text-sm">{item.content}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Phần Ship Hà Nội */}
      <section className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Phí ship tại Hà Nội</h2>
        <p className="text-gray-600 mb-6">Phí ship nội thành, ngoại thành Hà Nội</p>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Nội thành */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium text-gray-800">{hanoiShipping.inner.title}</h3>
              <span className="font-semibold">{formatCurrency(hanoiShipping.inner.price)}</span>
            </div>
            <p className="text-sm text-gray-600 mb-2">Các quận / phường :</p>
            <ul className="list-disc list-inside text-gray-700 text-sm">
              {hanoiShipping.inner.areas.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>

          {/* Ngoại thành */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium text-gray-800">{hanoiShipping.outer.title}</h3>
              <span className="font-semibold">{formatCurrency(hanoiShipping.outer.price)}</span>
            </div>
            <p className="text-sm text-gray-600 mb-2">Các huyện / xã :</p>
            <ul className="list-disc list-inside text-gray-700 text-sm">
              {hanoiShipping.outer.areas.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        </div>

        <p className="text-xs text-gray-500 mt-4">
          Ghi chú: Giá ship áp dụng cho đơn hàng tiêu chuẩn. Trường hợp ngoại lệ (vùng quá xa, yêu cầu giao gấp, khối lượng lớn...) có thể phát sinh phí khác.
        </p>
      </section>
    </div>
  );
}
