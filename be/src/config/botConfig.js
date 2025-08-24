// src/config/botConfig.js
// Các thông tin bổ sung để FruitBot tư vấn chính xác hơn.
// Không lưu trực tiếp trong schema Product để tránh phải sửa DB.

export const BOT_CONFIG = {
  "Măng cụt": {
    taste: { sweet: 4, sour: 2, crisp: 1 },   // ngọt, hơi chua, mềm
    season: [5, 6, 7, 8],                     // chính vụ mùa hè
    seedless: false,
    peelEase: 2,                              // khó bóc
    useTags: ["ăn liền", "giải nhiệt"]
  },
  "Táo Fuji": {
    taste: { sweet: 4, sour: 1, crisp: 5 },   // ngọt, giòn, ít chua
    season: [9, 10, 11, 12, 1, 2, 3],
    seedless: false,
    peelEase: 3,
    useTags: ["ăn liền", "biếu tặng", "cho bé"]
  },
  "Nho đỏ không hạt": {
    taste: { sweet: 4, sour: 1, crisp: 3 },
    season: [8, 9, 10, 11],
    seedless: true,
    peelEase: 5,
    useTags: ["ăn liền", "cho bé", "biếu tặng"]
  },
  "Cam Ai Cập": {
    taste: { sweet: 3, sour: 2, crisp: 1 },
    season: [11, 12, 1, 2, 3, 4],
    seedless: true,
    peelEase: 5,
    useTags: ["ăn liền", "ép nước", "cho bé"]
  },
  "Xoài cát Hòa Lộc": {
    taste: { sweet: 5, sour: 1, crisp: 2 },
    season: [3, 4, 5, 6],
    seedless: false,
    peelEase: 3,
    useTags: ["ăn liền", "tráng miệng", "biếu tặng"]
  },
  "Sầu riêng Ri6": {
    taste: { sweet: 5, sour: 1, crisp: 1 },
    season: [5, 6, 7, 8, 9],
    seedless: false,
    peelEase: 1,
    useTags: ["ăn liền", "món đặc sản"]
  },
  "Chuối tiêu": {
    taste: { sweet: 3, sour: 1, crisp: 2 },
    season: [1,2,3,4,5,6,7,8,9,10,11,12],     // quanh năm
    seedless: false,
    peelEase: 5,
    useTags: ["ăn liền", "cho bé", "thể thao"]
  }
};
