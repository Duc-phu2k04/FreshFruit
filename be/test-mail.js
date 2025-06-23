import dotenv from 'dotenv';
dotenv.config();

import nodemailer from 'nodemailer';

// Hàm gửi mail đơn giản để test
const sendTestMail = async () => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
      }
    });

    const mailOptions = {
      from: `"FreshFruit" <${process.env.MAIL_USER}>`,
      to: 'nguyenducphu2k4@gmail.com', // 👈 Thay bằng email bạn muốn test
      subject: 'Thử nghiệm gửi mail từ hệ thống FreshFruit',
      text: `Xin chào!\n\nĐây là email thử nghiệm được gửi từ hệ thống FreshFruit.\n\nNếu bạn nhận được email này, nghĩa là cấu hình gửi mail hoạt động đúng.\n\nChúc bạn một ngày tốt lành!\n\n— Đội ngũ FreshFruit`
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ Gửi email thành công!');
  } catch (error) {
    console.error('❌ Gửi email thất bại:', error.message);
  }
};

// Gọi hàm test
sendTestMail();
