// server/utils/geo.js
/**
 * Công cụ địa lý dùng chung:
 *  - Tính khoảng cách Haversine (km)
 *  - Geocode địa chỉ (Nominatim / OpenStreetMap)
 *  - Một số helper chuẩn hoá chuỗi địa chỉ VN
 *
 * 100% ESM, không phụ thuộc thư viện ngoài.
 * Yêu cầu Node >= 18 (có global fetch).
 */

// ===== Helpers chuỗi =====
export function removeVNDiacritics(str = "") {
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

export function normalizeSpaces(str = "") {
  return String(str).replace(/\s+/g, " ").trim();
}

/**
 * Ghép các phần địa chỉ thành 1 chuỗi tìm kiếm.
 * Ví dụ: ["Số 230", "Phường Bồ Đề", "Quận Long Biên", "Hà Nội", "Việt Nam"]
 */
export function buildAddressQuery(parts = [], { addHanoiVN = true } = {}) {
  const cleaned = parts.filter(Boolean).map((s) => normalizeSpaces(s));
  const base = cleaned.join(", ");

  if (!addHanoiVN) return base;

  // Nếu chưa có "Hà Nội" hoặc "Vietnam" trong chuỗi -> nối thêm
  const lower = base.toLowerCase();
  const hasHanoi = lower.includes("hà nội") || lower.includes("ha noi");
  const hasVN =
    lower.includes("việt nam") ||
    lower.includes("viet nam") ||
    lower.includes("vietnam");

  let q = base;
  if (!hasHanoi) q = q ? `${q}, Hà Nội` : "Hà Nội";
  if (!hasVN) q = q ? `${q}, Việt Nam` : "Việt Nam";
  return q;
}

// ===== Haversine =====
export function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  if (!Number.isFinite(d)) return null;
  return d;
}

export function roundDistanceKm(d, step = 0.5) {
  if (!Number.isFinite(d)) return d;
  if (!step) return d;
  return Math.ceil(d / step) * step;
}

// ===== Fetch với timeout =====
async function fetchWithTimeout(url, options = {}, timeoutMs = 6000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

// ===== Cache đơn giản trong RAM để tránh geocode lặp lại =====
const _geoCache = new Map(); // key: query string (lower) -> { lat, lng, ts }
const GEO_CACHE_MAX = 300;

/**
 * Lưu cache dạng FIFO đơn giản
 */
function _cacheSet(key, val) {
  if (_geoCache.size >= GEO_CACHE_MAX) {
    // xoá key đầu tiên
    const firstKey = _geoCache.keys().next().value;
    if (firstKey !== undefined) _geoCache.delete(firstKey);
  }
  _geoCache.set(key, { ...val, ts: Date.now() });
}

function _cacheGet(key) {
  const v = _geoCache.get(key);
  return v ? { lat: v.lat, lng: v.lng } : null;
}

// ===== Geocode (Nominatim) =====
/**
 * Thử geocode bằng Nominatim với 1 truy vấn
 */
async function tryNominatimOnce(query) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "0");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", query);

  const headers = {
    "User-Agent": "freshfruit-app/1.0 (contact: admin@freshfruit.local)",
    // Nominatim yêu cầu UA hợp lệ
  };

  const res = await fetchWithTimeout(url, { headers }, 6000);
  if (!res.ok) return null;

  const arr = await res.json().catch(() => null);
  if (!Array.isArray(arr) || arr.length === 0) return null;

  const { lat, lon } = arr[0] || {};
  if (!lat || !lon) return null;

  const latN = Number(lat);
  const lngN = Number(lon);
  if (!Number.isFinite(latN) || !Number.isFinite(lngN)) return null;

  return { lat: latN, lng: lngN };
}

/**
 * Geocode thông minh:
 *  - Dùng cache trước
 *  - Thử query gốc
 *  - Nếu fail, thêm ", Hà Nội, Việt Nam"
 *  - Nếu vẫn fail, bỏ dấu tiếng Việt và thử lại 2 lần trên
 */
export async function geocodeAddressToLatLng(rawText) {
  const base = normalizeSpaces(String(rawText || ""));
  if (!base) return null;

  const cacheKey = base.toLowerCase();
  const cached = _cacheGet(cacheKey);
  if (cached) return cached;

  // 1) thử nguyên bản
  let q1 = base;
  let result = await tryNominatimOnce(q1);

  // 2) nếu fail, thêm HN + VN
  if (!result) {
    const q2 = buildAddressQuery([base], { addHanoiVN: true });
    if (q2 !== q1) {
      result = await tryNominatimOnce(q2);
    }
  }

  // 3) nếu vẫn fail, bỏ dấu VN
  if (!result) {
    const noAccent = removeVNDiacritics(base);
    if (noAccent && noAccent !== base) {
      // 3.1) bản không dấu
      result = await tryNominatimOnce(noAccent);
      // 3.2) thêm HN + VN cho bản không dấu
      if (!result) {
        const q3 = buildAddressQuery([noAccent], { addHanoiVN: true });
        if (q3 !== noAccent) {
          result = await tryNominatimOnce(q3);
        }
      }
    }
  }

  if (result) _cacheSet(cacheKey, result);
  return result; // có thể null nếu không định vị được
}

/**
 * Dạng text gợi ý cho khoảng cách, ví dụ: "4.5 km", "≈ 12 km"
 */
export function formatDistanceKm(d, { approx = false } = {}) {
  if (!Number.isFinite(d)) return "";
  const v = d >= 10 ? Math.round(d) : Math.round(d * 10) / 10;
  return approx ? `≈ ${v} km` : `${v} km`;
}
