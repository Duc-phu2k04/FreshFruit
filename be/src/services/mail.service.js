import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

// Load biến môi trường từ file .env
dotenv.config();

export const sendMail = async (to, subject, text) => {
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
      to, // địa chỉ email người nhận (được truyền vào)
      subject,
      text
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ Gửi email thành công tới:', to);
  } catch (err) {
    console.error('❌ Lỗi gửi email:', err.message);
    throw new Error('Không thể gửi email: ' + err.message);
  }
};
