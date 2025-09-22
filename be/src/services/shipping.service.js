// be/src/services/shipping.service.js
import ShippingZone from "../models/ShippingZone.model.js";

/* =========================
 * DEBUG helper
 * Bật log bằng cách đặt env: SHIPPING_DEBUG=1 (hoặc NODE_ENV=development)
 * ========================= */
const SHIP_DEBUG =
  String(process.env.SHIPPING_DEBUG || "").trim() === "1" ||
  String(process.env.NODE_ENV || "").trim() === "development";

function dbg(tag, payload) {
  if (SHIP_DEBUG) {
    try {
      console.log(`[SHIPPING_DEBUG] ${tag}`, payload);
    } catch {
      // no-op
    }
  }
}

/* =========================
 * Chuẩn hoá mã quận/phường (giữ 0 ở đầu)
 * ========================= */
const padDistrict = (v) => {
  const s = String(v ?? "").trim();
  return /^\d+$/.test(s) ? s.padStart(3, "0") : s;
};
const padWard = (v) => {
  const s = String(v ?? "").trim();
  return /^\d+$/.test(s) ? s.padStart(5, "0") : s;
};

/* (Tuỳ chọn) ENV: freeship nếu trùng phường với cửa hàng */
const ENV_STORE_WARD = (() => {
  const raw =
    String(process.env.SHIPPING_STORE_WARD_CODE || process.env.STORE_WARD_CODE || "").trim();
  return raw ? padWard(raw) : "";
})();

/* =========================
 * Pick zone theo thứ tự ưu tiên:
 * 1) match phường (zone tên chứa "Cùng phường" hoặc cờ sameWard)
 * 2) match quận (nội thành)
 * 3) match theo tỉnh (zone không ràng buộc quận/phường)
 * 4) zone mặc định (isDefault=true)
 * Hỗ trợ cả field mới (wardCodes/districtCodes) lẫn legacy (match.ward_codes/match.district_codes)
 * ========================= */
async function pickZone({ provinceCode = 1, districtCode, wardCode }) {
  const dRaw = districtCode ? String(districtCode).trim() : "";
  const wRaw = wardCode ? String(wardCode).trim() : "";

  const d = dRaw && /^\d+$/.test(dRaw) ? padDistrict(dRaw) : dRaw || null;
  const w = wRaw && /^\d+$/.test(wRaw) ? padWard(wRaw) : wRaw || null;

  dbg("pickZone.in", { provinceCode, districtCode, wardCode, norm: { d, w } });

  // 1) CÙNG PHƯỜNG — ưu tiên zone “HN - Cùng phường (freeship)”
  if (w && /^\d{5}$/.test(w)) {
    // Zone có gắn cờ “cùng phường” (tên hoặc flag)
    const byWard =
      (await ShippingZone.findOne({
        $and: [
          {
            $or: [
              { wardCodes: { $in: [w] } },
              { "match.ward_codes": { $in: [w] } }, // legacy
            ],
          },
          {
            $or: [
              { name: { $regex: /cùng\s*phường/i } },
              { isSameWard: true },
              { sameWard: true },
              { "flags.sameWard": true },
            ],
          },
        ],
      })
        .sort({ priority: -1 })
        .lean()) || null;

    if (byWard) {
      dbg("pickZone.hit", { matchedBy: "ward", zoneId: String(byWard._id), name: byWard.name });
      return { zone: byWard, matchedBy: "ward" };
    }

    // Nếu seed chỉ set wardCodes mà không đặt cờ, vẫn cho phép match ward thường
    const anyWard =
      (await ShippingZone.findOne({
        $or: [{ wardCodes: { $in: [w] } }, { "match.ward_codes": { $in: [w] } }],
      })
        .sort({ priority: -1 })
        .lean()) || null;

    if (anyWard) {
      dbg("pickZone.hit", { matchedBy: "ward", zoneId: String(anyWard._id), name: anyWard.name });
      return { zone: anyWard, matchedBy: "ward" };
    }
  }

  // 2) THEO QUẬN (nội thành)
  if (d) {
    const byDistrict =
      (await ShippingZone.findOne({
        $or: [{ districtCodes: { $in: [d] } }, { "match.district_codes": { $in: [d] } }],
      })
        .sort({ priority: -1 })
        .lean()) || null;

    if (byDistrict) {
      dbg("pickZone.hit", {
        matchedBy: "district",
        zoneId: String(byDistrict._id),
        name: byDistrict.name,
      });
      return { zone: byDistrict, matchedBy: "district" };
    }
  }

  // 3) THEO PROVINCE (zone không ràng buộc ward/district)
  const byProvince =
    (await ShippingZone.findOne({
      "match.province_code": Number(provinceCode),
      $and: [
        // kiểu mới: không ràng buộc
        { $or: [{ wardCodes: { $exists: false } }, { wardCodes: { $size: 0 } }] },
        { $or: [{ districtCodes: { $exists: false } }, { districtCodes: { $size: 0 } }] },
        // kiểu cũ: không ràng buộc
        { $or: [{ "match.ward_codes": { $exists: false } }, { "match.ward_codes": { $size: 0 } }] },
        { $or: [{ "match.district_codes": { $exists: false } }, { "match.district_codes": { $size: 0 } }] },
      ],
    })
      .sort({ priority: -1 })
      .lean()) || null;

  if (byProvince) {
    dbg("pickZone.hit", {
      matchedBy: "province",
      zoneId: String(byProvince._id),
      name: byProvince.name,
    });
    return { zone: byProvince, matchedBy: "province" };
  }

  // 4) MẶC ĐỊNH
  const asDefault =
    (await ShippingZone.findOne({ isDefault: true }).sort({ priority: -1 }).lean()) || null;

  if (asDefault) {
    dbg("pickZone.hit", {
      matchedBy: "default",
      zoneId: String(asDefault._id),
      name: asDefault.name,
    });
    return { zone: asDefault, matchedBy: "default" };
  }

  dbg("pickZone.miss", { matchedBy: "fallback" });
  return { zone: null, matchedBy: "fallback" };
}

/* =========================
 * Quote phí ship
 * Trả về: { amount, ruleName, matchedBy, zoneId, freeThreshold, label }
 * ========================= */
export async function quoteShipping({
  provinceCode = 1,
  districtCode,
  wardCode,
  cartSubtotal = 0,
}) {
  // Chuẩn hoá input (để pad 0 & log chính xác)
  const dRaw = districtCode ? String(districtCode).trim() : "";
  const wRaw = wardCode ? String(wardCode).trim() : "";
  const d = dRaw && /^\d+$/.test(dRaw) ? padDistrict(dRaw) : dRaw || null;
  const w = wRaw && /^\d+$/.test(wRaw) ? padWard(wRaw) : wRaw || null;

  dbg("quote.in", { provinceCode, districtCode, wardCode, norm: { d, w }, cartSubtotal });

  // ENV override: freeship nếu trùng phường cửa hàng
  if (w && ENV_STORE_WARD && w === ENV_STORE_WARD) {
    const out = {
      amount: 0,
      ruleName: "Cùng phường (ENV)",
      matchedBy: "same_ward_env",
      zoneId: null,
      freeThreshold: null,
      label: "Freeship",
    };
    dbg("quote.out.sameWard.env", out);
    return out;
  }

  try {
    const { zone, matchedBy } = await pickZone({
      provinceCode,
      districtCode: d,
      wardCode: w,
    });

    // Fallback khi chưa có zone nào
    if (!zone) {
      const out = {
        amount: 30000,
        ruleName: "Mặc định",
        matchedBy: "fallback",
        zoneId: null,
        freeThreshold: null,
        label: "Ngoại thành",
      };
      dbg("quote.out.fallback", out);
      return out;
    }

    // Xác định có phải “Cùng phường” không (theo seed: tên “Cùng phường (freeship)”)
    const isSameWardZone =
      /cùng\s*phường/i.test(String(zone?.name || "")) ||
      zone?.isSameWard === true ||
      zone?.sameWard === true ||
      zone?.flags?.sameWard === true;

    // Base & threshold (hỗ trợ legacy)
    const rawBase = zone.baseFee ?? zone?.fee?.amount ?? 0;
    const rawThreshold = zone.freeThreshold ?? zone?.fee?.free_threshold ?? null;

    let amount = Number(rawBase);
    if (!Number.isFinite(amount) || amount < 0) amount = 0;

    const subtotal = Number(cartSubtotal) || 0;
    const freeThreshold =
      rawThreshold == null ? null : Number.isFinite(Number(rawThreshold)) ? Number(rawThreshold) : null;

    // Miễn phí nếu “cùng phường” hoặc vượt ngưỡng free
    if (isSameWardZone && w) {
      amount = 0;
    } else if (freeThreshold != null && subtotal >= freeThreshold) {
      amount = 0;
    } else if (Array.isArray(zone.surcharges) && zone.surcharges.length > 0) {
      for (const s of zone.surcharges) {
        const min = s?.minSubtotal;
        const max = s?.maxSubtotal;
        const add = Number(s?.amount || 0) || 0;

        const minOk = min == null || subtotal >= Number(min);
        const maxOk = max == null || subtotal <= Number(max);

        if (minOk && maxOk) amount += add;
      }
    }

    // Tên rule hiển thị
    const ruleName =
      (isSameWardZone ? "Cùng phường" : zone.name) ||
      (matchedBy === "ward"
        ? "Theo phường/xã"
        : matchedBy === "district"
        ? "Theo quận/huyện"
        : matchedBy === "province"
        ? "Theo tỉnh/thành"
        : "Mặc định");

    // Label ngắn cho FE
    const norm = (s) => String(s || "").toLowerCase();
    let label = "Ngoại thành";
    if (amount === 0) {
      label = "Freeship";
    } else if (
      norm(zone.name).includes("nội thành") ||
      (Array.isArray(zone.districtCodes) && zone.districtCodes.length > 0) ||
      (Array.isArray(zone?.match?.district_codes) && zone.match.district_codes.length > 0)
    ) {
      label = "Nội thành";
    } else if (zone.isDefault) {
      label = "Ngoại thành";
    }

    // Làm tròn
    amount = Math.max(0, Math.round(amount));

    const out = {
      amount,
      ruleName,
      matchedBy: isSameWardZone ? "same_ward" : matchedBy,
      zoneId: String(zone._id),
      freeThreshold: freeThreshold ?? null,
      label,
    };
    dbg("quote.out", out);
    return out;
  } catch (e) {
    dbg("quote.error", { message: e?.message || e, stack: e?.stack });
    return {
      amount: 0,
      ruleName: "ErrorFallback",
      matchedBy: "error",
      zoneId: null,
      freeThreshold: null,
      label: "Ngoại thành",
    };
  }
}

export default {
  quoteShipping,
};
