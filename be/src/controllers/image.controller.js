import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Đảm bảo thư mục public/images tồn tại
const dir = 'public/images';
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

// Cấu hình nơi lưu và tên file ảnh
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, name);
  },
});

// Khởi tạo middleware upload
const upload = multer({ storage }).single('image');

// Hàm xử lý upload trả về URL
const uploadImage = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Không có ảnh được gửi lên' });
  }

  const imagePath = `/images/${req.file.filename}`;
  res.status(200).json({ imagePath });
};

export { upload, uploadImage };
