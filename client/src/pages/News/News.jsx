import React from 'react';

export default function News() {
  const newsList = [
    {
      title: 'Lợi ích tuyệt vời của việc ăn trái cây tươi mỗi ngày',
      image: 'https://cdn.pixabay.com/photo/2023/10/21/18/34/grapes-8331973_1280.jpg',
      content: 'Trái cây tươi không chỉ cung cấp vitamin mà còn giúp tăng sức đề kháng và làm đẹp da. Ăn trái cây mỗi ngày là một thói quen sống lành mạnh được các chuyên gia khuyên dùng.'
    },
    {
      title: 'FreshFruit khai trương cửa hàng mới tại TP.HCM',
      image: 'https://cdn.pixabay.com/photo/2013/11/18/13/30/cherry-212601_1280.jpg',
      content: 'Chúng tôi vừa mở thêm chi nhánh mới tại Quận 1. Với không gian hiện đại và nguồn trái cây tươi sạch, hy vọng sẽ mang đến trải nghiệm mua sắm tuyệt vời cho khách hàng.'
    },
    {
      title: 'Bí quyết bảo quản trái cây lâu hỏng tại nhà',
      image: 'https://cdn.pixabay.com/photo/2014/11/12/21/18/strawberries-528791_1280.jpg',
      content: 'Để trái cây luôn tươi ngon, hãy bảo quản trong nhiệt độ phù hợp, tránh ánh nắng trực tiếp và sử dụng hộp kín. Cùng tìm hiểu thêm các mẹo hữu ích khác!'
    }
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-green-700 mb-6 text-center">Tin tức & Cập nhật</h1>
      <div className="grid md:grid-cols-3 gap-8">
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
    </div>
  );
}
