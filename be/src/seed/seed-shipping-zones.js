// be/src/seed/seed-shipping-zones.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import ShippingZone from "../models/ShippingZone.model.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/freshfruit";

// ====== CHỈ CẦN SỬA CHỖ NÀY ======
// Điền mã QUẬN nội thành (chuỗi 3 ký tự, giữ số 0 đầu). Ví dụ "004" = Long Biên.
const INNER_DISTRICT_CODES = [
  // Ví dụ sẵn: chỉnh theo quan điểm nội thành của bạn
  "001", // Ba Đình
  "002", // Hoàn Kiếm
  "003", // Tây Hồ
  "004", // Long Biên
  "005", // Cầu Giấy
  "006", // Đống Đa
  "007", // Hai Bà Trưng
  "008", // Hoàng Mai
  "009", // Thanh Xuân
  "268", // Hà Đông
  "019", // Nam  Từ Liêm
  "021", // Bắc Từ Liêm
];

// (Tuỳ chọn) Nếu muốn freeship khi CÙNG PHƯỜNG với cơ sở, điền mã PHƯỜNG ở đây (chuỗi 5 ký tự)
const STORE_WARD_CODES = [
    "00623"// Phường Phương Canh freeship
  // "00139", // Phường Bồ Đề (ví dụ). Nếu chưa dùng rule này, để mảng rỗng.
];

// Phí mặc định (có thể override bằng ENV)
const SHIP_FEE_INNER = Number(process.env.SHIP_FEE_INNER || 30000); // nội thành
const SHIP_FEE_OUTER = Number(process.env.SHIP_FEE_OUTER || 45000); // ngoại thành

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log(" Connected to", MONGO_URI);

  //  Nếu muốn xoá toàn bộ zone cũ trước khi seed, bỏ comment dòng sau:
  // await ShippingZone.deleteMany({});

  // 1) (OPTIONAL) Freeship khi CÙNG PHƯỜNG với cơ sở
  if (STORE_WARD_CODES.length > 0) {
    await ShippingZone.updateOne(
      { name: "HN - Cùng phường (freeship)" },
      {
        $set: {
          name: "HN - Cùng phường (freeship)",
          wardCodes: STORE_WARD_CODES,
          districtCodes: [],
          baseFee: 0,
          freeThreshold: null,
          isDefault: false,
          priority: 100, // ưu tiên cao nhất
          // Tương thích cấu trúc cũ (không bắt buộc)
          match: { province_code: 1, ward_codes: STORE_WARD_CODES, district_codes: [] },
          fee: { type: "flat", amount: 0, free_threshold: null },
        },
      },
      { upsert: true }
    );
    console.log("• Upserted: HN - Cùng phường (freeship) with wards:", STORE_WARD_CODES);
  } else {
    console.log("• Skipped 'Cùng phường (freeship)' (STORE_WARD_CODES empty).");
  }

  // 2) HN - Nội thành (áp dụng cho các quận trong danh sách, ví dụ 30k)
  await ShippingZone.updateOne(
    { name: "HN - Nội thành" },
    {
      $set: {
        name: "HN - Nội thành",
        districtCodes: INNER_DISTRICT_CODES,
        wardCodes: [],
        baseFee: SHIP_FEE_INNER,
        freeThreshold: null, // nếu muốn free trên ngưỡng, set số vào đây
        isDefault: false,
        priority: 10,
        // Tương thích cũ
        match: { province_code: 1, district_codes: INNER_DISTRICT_CODES, ward_codes: [] },
        fee: { type: "flat", amount: SHIP_FEE_INNER, free_threshold: null },
      },
    },
    { upsert: true }
  );
  console.log("• Upserted: HN - Nội thành with districts:", INNER_DISTRICT_CODES);

  // 3) HN - Ngoại thành (mặc định, ví dụ 45k)
  await ShippingZone.updateOne(
    { name: "HN - Ngoại thành (mặc định)" },
    {
      $set: {
        name: "HN - Ngoại thành (mặc định)",
        districtCodes: [], // để trống -> mọi quận KHÔNG thuộc nội thành sẽ rơi vào đây
        wardCodes: [],
        baseFee: SHIP_FEE_OUTER,
        freeThreshold: null,
        isDefault: true, //  rất quan trọng: zone mặc định
        priority: 0,
        // Tương thích cũ
        match: { province_code: 1, district_codes: [], ward_codes: [] },
        fee: { type: "flat", amount: SHIP_FEE_OUTER, free_threshold: null },
      },
    },
    { upsert: true }
  );
  console.log("• Upserted: HN - Ngoại thành (mặc định)");

  console.log(" Seed shipping zones hoàn tất!");
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error(" Seed error:", err);
  process.exit(1);
});
