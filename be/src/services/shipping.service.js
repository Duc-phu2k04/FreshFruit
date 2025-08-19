// be/src/services/shipping.service.js
import ShippingZone from "../models/ShippingZone.model.js";

// Giữ số 0 đầu
const padDistrict = (v) => {
  const s = String(v ?? "").trim();
  return /^\d+$/.test(s) ? s.padStart(3, "0") : s;
};
const padWard = (v) => {
  const s = String(v ?? "").trim();
  return /^\d+$/.test(s) ? s.padStart(5, "0") : s;
};

// Tìm zone theo thứ tự: Cùng phường → Nội thành (quận) → (tùy) province → Mặc định
async function pickZone({ provinceCode = 1, districtCode, wardCode }) {
  const dRaw = districtCode ? String(districtCode).trim() : "";
  const wRaw = wardCode ? String(wardCode).trim() : "";

  const d = dRaw && /^\d+$/.test(dRaw) ? padDistrict(dRaw) : null;
  const w = wRaw && /^\d+$/.test(wRaw) ? padWard(wRaw) : null;

  // 1) CÙNG PHƯỜNG (chỉ match đúng zone có tên "Cùng phường" và chứa chính xác ward code)
  if (w && /^\d{5}$/.test(w)) {
    const byWard = await ShippingZone.findOne({
      name: { $regex: /cùng\s*phường/i },   // bắt buộc đúng zone "Cùng phường"
      wardCodes: { $in: [w] },              // chứa chính xác mã phường trong seed
    })
      .sort({ priority: -1 })
      .lean();

    if (byWard) return { zone: byWard, matchedBy: "ward" };
  }

  // 2) THEO QUẬN (nội thành) — match khi districtCodes chứa đúng mã quận
  if (d && /^\d{3}$/.test(d)) {
    const byDistrict = await ShippingZone.findOne({
      districtCodes: { $in: [d] },
    })
      .sort({ priority: -1 })
      .lean();

    if (byDistrict) return { zone: byDistrict, matchedBy: "district" };
  }

  // 3) (TÙY CHỌN) THEO PROVINCE — chỉ lấy zone province nếu KHÔNG có bất kỳ ràng buộc ward/district
  const byProvince = await ShippingZone.findOne({
    "match.province_code": Number(provinceCode),
    $and: [
      // ràng buộc kiểu mới
      { $or: [{ wardCodes: { $exists: false } }, { wardCodes: { $size: 0 } }] },
      { $or: [{ districtCodes: { $exists: false } }, { districtCodes: { $size: 0 } }] },
      // ràng buộc kiểu cũ
      { $or: [{ "match.ward_codes": { $exists: false } }, { "match.ward_codes": { $size: 0 } }] },
      { $or: [{ "match.district_codes": { $exists: false } }, { "match.district_codes": { $size: 0 } }] },
    ],
  })
    .sort({ priority: -1 })
    .lean();

  if (byProvince) return { zone: byProvince, matchedBy: "province" };

  // 4) MẶC ĐỊNH
  const asDefault = await ShippingZone.findOne({ isDefault: true })
    .sort({ priority: -1 })
    .lean();
  if (asDefault) return { zone: asDefault, matchedBy: "default" };

  return { zone: null, matchedBy: "fallback" };
}

export async function quoteShipping({
  provinceCode = 1,
  districtCode,
  wardCode,
  cartSubtotal = 0,
}) {
  const { zone, matchedBy } = await pickZone({ provinceCode, districtCode, wardCode });

  // Fallback khi chưa có zone nào
  if (!zone) {
    return {
      amount: 30000,
      ruleName: "Mặc định",
      matchedBy: "fallback",
      freeThreshold: null,
      label: "Ngoại thành",
    };
  }

  const baseFee = zone.baseFee ?? zone?.fee?.amount ?? 0;
  const freeThreshold = zone.freeThreshold ?? zone?.fee?.free_threshold ?? null;

  let amount = Number(baseFee) || 0;

  // Miễn phí nếu vượt ngưỡng của zone
  if (freeThreshold != null && Number(cartSubtotal) >= Number(freeThreshold)) {
    amount = 0;
  } else if (Array.isArray(zone.surcharges)) {
    // Phụ phí theo dải subtotal (nếu có)
    for (const s of zone.surcharges) {
      const minOk = s.minSubtotal == null || cartSubtotal >= s.minSubtotal;
      const maxOk = s.maxSubtotal == null || cartSubtotal <= s.maxSubtotal;
      if (minOk && maxOk) amount += Number(s.amount || 0);
    }
  }

  // Tên rule (để debug nếu cần)
  const ruleName =
    zone.name ||
    (matchedBy === "ward"
      ? "Theo phường/xã"
      : matchedBy === "district"
      ? "Theo quận/huyện"
      : matchedBy === "province"
      ? "Theo tỉnh/thành"
      : "Mặc định");

  // Nhãn ngắn gọn cho FE hiển thị
  const norm = (s) => String(s || "").toLowerCase();
  let label = "Ngoại thành";
  if (amount === 0 && matchedBy === "ward") {
    label = "Freeship";
  } else if (norm(zone.name).includes("nội thành") || (Array.isArray(zone.districtCodes) && zone.districtCodes.length > 0)) {
    label = "Nội thành";
  } else if (zone.isDefault) {
    label = "Ngoại thành";
  }

  return {
    amount,
    ruleName,
    matchedBy,
    zoneId: String(zone._id),
    freeThreshold: freeThreshold ?? null,
    label,
  };
}
