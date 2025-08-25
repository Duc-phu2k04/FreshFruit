import React from 'react';

const About = () => {
  return (
    <div className="max-w-6xl mx-auto py-10 px-4 space-y-10">
      {/* Tiêu đề */}
      <h1 className="text-4xl font-bold text-green-700 text-center">Về Chúng Tôi</h1>

      {/* Giới thiệu chung */}
      <section className="grid md:grid-cols-2 gap-8 items-center">
        <div>
          <h2 className="text-2xl font-semibold mb-3 text-green-600">FreshFruit là ai?</h2>
          <p className="text-gray-700 leading-relaxed">
            FreshFruit là thương hiệu chuyên cung cấp trái cây sạch, tươi ngon, có nguồn gốc rõ ràng từ các nông trại đạt chuẩn trong nước và quốc tế. 
            Chúng tôi cam kết mang đến trải nghiệm mua sắm trái cây hiện đại, tiện lợi và đảm bảo chất lượng cho từng sản phẩm.
          </p>
        </div>
        <img src="https://cdn.pixabay.com/photo/2020/01/10/21/03/garden-4756275_1280.jpg" alt="FreshFruit intro" className="rounded-xl shadow-md w-full h-auto object-cover" />
      </section>

      {/* Thế mạnh sản phẩm */}
      <section className="grid md:grid-cols-2 gap-8 items-center">
        <img src="https://cdn.pixabay.com/photo/2015/05/21/16/57/vegetable-777473_1280.jpg" alt="FreshFruit strengths" className="rounded-xl shadow-md w-full h-auto object-cover" />
        <div>
          <h2 className="text-2xl font-semibold mb-3 text-green-600">Thế mạnh của chúng tôi</h2>
          <ul className="list-disc list-inside text-gray-700 space-y-2">
            <li>🌱 Sản phẩm đạt chuẩn VietGAP, GlobalGAP</li>
            <li>🚚 Giao hàng nhanh trong 2h tại TP.HCM, Hà Nội</li>
            <li>🧊 Hệ thống bảo quản lạnh hiện đại</li>
            <li>🏪 Hơn 20 cửa hàng trên toàn quốc</li>
            <li>📦 Đóng gói an toàn, thân thiện với môi trường</li>
          </ul>
        </div>
      </section>

      {/* Thông tin liên hệ */}
      <section className="bg-green-50 p-6 rounded-xl shadow-inner">
  <h2 className="text-2xl font-semibold text-green-700 mb-4">
    Liên hệ với chúng tôi
  </h2>
  <div className="grid md:grid-cols-2 gap-6">
    {/* Thông tin liên hệ */}
    <div className="space-y-2 text-gray-700">
      <p>📍 Trụ sở chính: Số 1 Trịnh Văn Bô, Hà Nội</p>
      <p>📞 Hotline: <strong>0812560603</strong></p>
      <p>✉️ Email: <strong>freshfruit@gmail.com</strong></p>
      <p>🌐 Website: <strong>www.freshfruit.vn</strong></p>
    </div>

    {/* Hình ảnh liên quan đến hoa quả */}
    <div className="flex items-center justify-center">
      <img 
        src="../../public/image/1.6.jpg" 
        alt="hoa quả" 
        className="rounded-xl shadow-md hover:scale-105 transition-transform duration-300"
      />
    </div>
  </div>
</section>

    </div>
  );
};

export default About;
