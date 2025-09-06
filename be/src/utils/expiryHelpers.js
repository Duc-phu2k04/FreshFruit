// server/utils/expiryHelpers.js
export const daysBetween = (a, b) => {
  const ms = a.getTime() - b.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
};

// p: product plain object (có p.variants hoặc p.baseVariant)
// overrideBasePrice: number | undefined  (giá muốn dùng – vd giá của variant đang chọn)
export const computeExpiryInfo = (p, overrideBasePrice) => {
  const exp = p?.expiry || {};
  const now = new Date();

  // 1) Xác định expireAt
  let expireAt = null;
  if (exp.expireDate) {
    const d = new Date(exp.expireDate);
    if (!Number.isNaN(d.getTime())) expireAt = d;
  } else if (exp.mfgDate && Number.isFinite(Number(exp.shelfLifeDays))) {
    const m = new Date(exp.mfgDate);
    if (!Number.isNaN(m.getTime())) {
      expireAt = new Date(m.getTime() + Number(exp.shelfLifeDays || 0) * 24 * 60 * 60 * 1000);
    }
  }

  // 2) daysLeft
  let daysLeft = null;
  if (expireAt) daysLeft = daysBetween(expireAt, now);

  // 3) near-expiry config
  const disc = exp.discountNearExpiry || {};
  const threshold = Number.isFinite(Number(disc.thresholdDays)) ? Number(disc.thresholdDays) : 0;
  const percent = Number.isFinite(Number(disc.percent)) ? Number(disc.percent) : 0;
  const active = typeof disc.active === "boolean" ? disc.active : false;

  const isNearExpiry = active && daysLeft != null && daysLeft >= 0 && daysLeft <= threshold;

  // 4) Giá gốc & giá sau giảm
  const basePriceFromProduct = p?.variants?.[0]?.price ?? p?.baseVariant?.price ?? 0;
  const basePrice = Number.isFinite(Number(overrideBasePrice))
    ? Number(overrideBasePrice)
    : Number(basePriceFromProduct) || 0;

  const finalPrice =
    isNearExpiry && percent > 0
      ? Math.max(0, Math.round(basePrice * (1 - percent / 100)))
      : basePrice;

  return {
    expireAt,
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
