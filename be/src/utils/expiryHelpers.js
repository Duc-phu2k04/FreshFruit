// server/utils/expiryHelpers.js

/** Số ngày giữa hai mốc (làm tròn lên) */
export const daysBetween = (a, b) => {
  try {
    const ms = a.getTime() - b.getTime();
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
};

/**
 * Tính thông tin hạn dùng + giá sau giảm (nếu có).
 * p: product plain object (đã unify từ service hoặc doc toObject)
 * overrideBasePrice: số giá muốn dùng để tính final (ví dụ giá của variant đang xét)
 *
 * Trả về:
 * {
 *   expireAt: Date|null,
 *   daysLeft: number|null,
 *   isNearExpiry: boolean,
 *   discountPercent: number,  // % áp dụng nếu cận hạn
 *   basePrice: number,        // đầu vào (overrideBasePrice hoặc suy ra từ product)
 *   finalPrice: number        // sau khi áp giảm (nếu cận hạn)
 * }
 */
export const computeExpiryInfo = (p, overrideBasePrice) => {
  const product = p || {};
  const exp = product.expiry || {};
  const now = new Date();

  // -----------------------------
  // 1) Xác định expireAt (ưu tiên chuẩn mới, fallback legacy)
  // -----------------------------
  let expireAt = null;

  // New: expireDate
  if (exp.expireDate) {
    const d = new Date(exp.expireDate);
    if (!Number.isNaN(d.getTime())) expireAt = d;
  }

  // Legacy: expiryDate
  if (!expireAt && exp.expiryDate) {
    const d = new Date(exp.expiryDate);
    if (!Number.isNaN(d.getTime())) expireAt = d;
  }

  // New: mfgDate + shelfLifeDays (nếu chưa có expireAt)
  if (!expireAt && exp.mfgDate && Number.isFinite(Number(exp.shelfLifeDays))) {
    const m = new Date(exp.mfgDate);
    if (!Number.isNaN(m.getTime()) && Number(exp.shelfLifeDays) > 0) {
      expireAt = new Date(
        m.getTime() + Number(exp.shelfLifeDays) * 24 * 60 * 60 * 1000
      );
    }
  }

  // -----------------------------
  // 2) daysLeft
  // -----------------------------
  let daysLeft = null;
  if (expireAt) {
    daysLeft = daysBetween(expireAt, now);
  }

  // -----------------------------
  // 3) near-expiry config
  // Hỗ trợ:
  //  - New: discountNearExpiry { active, thresholdDays, percent }
  //  - Legacy: enabled / nearExpiryDays / discountPercent
  // -----------------------------
  const dne = exp.discountNearExpiry || {};
  let thresholdDays =
    Number.isFinite(Number(dne.thresholdDays)) ? Number(dne.thresholdDays) : undefined;
  let percent =
    Number.isFinite(Number(dne.percent)) ? Number(dne.percent) : undefined;
  let active = typeof dne.active === "boolean" ? dne.active : undefined;

  // Legacy fallback
  if (thresholdDays === undefined && Number.isFinite(Number(exp.nearExpiryDays))) {
    thresholdDays = Number(exp.nearExpiryDays);
  }
  if (percent === undefined && Number.isFinite(Number(exp.discountPercent))) {
    percent = Number(exp.discountPercent);
  }
  if (active === undefined && typeof exp.enabled === "boolean") {
    active = exp.enabled;
  }

  // Default an toàn
  thresholdDays = Number.isFinite(thresholdDays) ? Math.max(0, thresholdDays) : 0;
  percent = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0;
  active = !!active;

  const isNearExpiry =
    !!expireAt &&
    !!active &&
    daysLeft != null &&
    daysLeft >= 0 &&
    thresholdDays > 0 &&
    daysLeft <= thresholdDays;

  // -----------------------------
  // 4) Giá gốc & giá sau giảm
  // basePrice: ưu tiên override; nếu không có thì lấy từ product
  // -----------------------------
  const basePriceFromProduct =
    Number(product?.displayVariant?.price ?? 0) ||
    Number(product?.variants?.[0]?.price ?? 0) ||
    Number(product?.baseVariant?.price ?? 0) ||
    0;

  const basePrice = Number.isFinite(Number(overrideBasePrice))
    ? Number(overrideBasePrice)
    : Number(basePriceFromProduct) || 0;

  const finalPrice =
    isNearExpiry && percent > 0
      ? Math.max(0, Math.round(basePrice * (1 - percent / 100)))
      : basePrice;

  return {
    expireAt: expireAt || null,
    daysLeft,
    isNearExpiry,
    discountPercent: isNearExpiry ? percent : 0,
    finalPrice,
    basePrice,
  };
};

export const fmtDate = (d) => {
  if (!d) return "-";
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return "-";
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yyyy = dt.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};
