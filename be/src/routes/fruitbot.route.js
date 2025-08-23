import express from "express";
import Product from "../models/product.model.js";
import { BOT_CONFIG } from "../config/botConfig.js";
// Nếu Node < 18, bỏ comment dòng dưới và cài: npm i node-fetch
// import fetch from "node-fetch";

export const fruitbotRouter = express.Router();

/* ========== Enrich product từ DB + BOT_CONFIG (phân biệt tồn kho theo variant) ========== */
function enrichProduct(p) {
  const extra = BOT_CONFIG[p.name] || {};

  // Ưu tiên displayVariant nếu có & còn hàng
  const dv = p.displayVariant && typeof p.displayVariant === "object" ? p.displayVariant : null;
  const dvInStock = dv && Number(dv.stock) > 0;

  // Chuẩn hóa danh sách variants
  const variants = Array.isArray(p.variants)
    ? p.variants.map((v) => ({
        weight: v?.attributes?.weight,
        ripeness: v?.attributes?.ripeness,
        price: Number(v?.price ?? 0),
        stock: Number(v?.stock ?? 0),
      }))
    : [];

  // Biến thể rẻ nhất còn hàng
  const inStockVariants = variants.filter((v) => v.stock > 0).sort((a, b) => a.price - b.price);
  const cheapestInStock = inStockVariants[0] || null;

  // Fallback:
  // 1) displayVariant còn hàng
  // 2) biến thể rẻ nhất còn hàng
  // 3) baseVariant (nếu có)
  // 4) "ảo" 0 giá/0 tồn
  const chosen =
    (dvInStock && {
      price: Number(dv.price || 0),
      stock: Number(dv.stock || 0),
      weight: dv.attributes?.weight,
      ripeness: dv.attributes?.ripeness,
    }) ||
    cheapestInStock ||
    (p.baseVariant
      ? {
          price: Number(p.baseVariant.price || 0),
          stock: Number(p.baseVariant.stock || 0),
          weight: p.baseVariant.attributes?.weight,
          ripeness: p.baseVariant.attributes?.ripeness,
        }
      : { price: 0, stock: 0 });

  return {
    id: p._id?.toString(),
    name: p.name,
    origin: "Việt Nam", // có thể map từ location nếu cần
    price: chosen.price,
    stock: chosen.stock,
    variant: {
      weight: chosen.weight,
      ripeness: chosen.ripeness,
    },
    variants, // lưu để chọn theo ngân sách nếu cần
    ...extra, // taste, season, seedless, peelEase, useTags
  };
}

/* ========== FAQ tĩnh cơ bản ========== */
const FAQ = [
  { q: ["thanh toán", "payment", "trả tiền"], a: "Hỗ trợ COD khi nhận hàng hoặc chuyển khoản." },
  { q: ["freeship", "miễn phí"], a: "Đơn từ 300k sẽ freeship nội thành." },
];
function matchFAQ(msg) {
  const t = (msg || "").toLowerCase();
  for (const f of FAQ) if (f.q.some((k) => t.includes(k))) return f.a;
  return null;
}

/* ========== Rule phí ship (động) ========== */
/**
 * - Nội thành: 30k
 * - Ngoại thành: 45k
 * - Cùng phường với cơ sở: freeship
 * Cấu hình phường cơ sở qua .env: STORE_WARD="Phường 12"
 */
const STORE_WARD = (process.env.STORE_WARD || "").toLowerCase();

function detectShippingIntent(text) {
  const t = (text || "").toLowerCase();
  // các cụm từ thể hiện hỏi phí ship
  const isAsk = /(phí\s*ship|tiền\s*ship|ship\s*bao\s*nhieu|ship\s*bn|vận\s*chuyển|giao\s*hàng|ship\s*nhanh)/.test(
    t
  );
  if (!isAsk) return null;

  // xác định phạm vi
  const sameWard = STORE_WARD && t.includes("phường") && t.includes(STORE_WARD);

  const isInner = /(nội\s*thành|trong\s*thành\s*phố|inner\s*city)/.test(t);
  const isOuter = /(ngoại\s*thành|ngoài\s*thành\s*phố|outer)/.test(t);

  return { sameWard, isInner, isOuter };
}

function shippingReplyByScope({ sameWard, isInner, isOuter }) {
  if (sameWard) return "Bạn cùng phường với cơ sở nên **freeship** nhé 🎉";
  if (isInner) return "Phí ship **nội thành** là **30.000đ**.";
  if (isOuter) return "Phí ship **ngoại thành** là **45.000đ**.";
  // nếu không rõ phạm vi, trả lời guideline + gợi ý cung cấp phường
  return `Phí ship: **nội thành 30.000đ**, **ngoại thành 45.000đ**.
Nếu bạn cho mình biết **phường** (ví dụ: “Phường 12”), và nếu **cùng phường** với cơ sở thì sẽ **freeship** nhé.`;
}

/* ========== Helpers tư vấn (rule-based) ========== */
function inSeason(p, m = new Date().getMonth() + 1) {
  return p.season?.includes(m);
}
function parseBudgetVND(text) {
  if (!text) return null;
  const t = text.toLowerCase().replace(/\./g, "").replace(/k\b/g, "000").replace(/triệu/g, "000000");
  const m = t.match(/(\d{3,7})\s*(vnđ|vnd|đ|dong|đồng)?/);
  return m ? parseInt(m[1], 10) : null;
}
function extractPrefs(msg) {
  const t = (msg || "").toLowerCase();
  return {
    wantSweet: /(ngọt|ít chua)/.test(t),
    wantSour: /(chua|thanh)/.test(t),
    wantCrisp: /(giòn)/.test(t),
    wantSeedless: /(không hạt|ít hạt)/.test(t),
    wantEasyPeel: /(dễ gọt|vỏ mỏng|dễ bóc)/.test(t),
    budget: parseBudgetVND(t),
    useJuice: /(ép|nước ép)/.test(t),
    useBaby: /(cho bé|trẻ nhỏ)/.test(t),
    useGift: /(biếu|tặng|quà)/.test(t),
  };
}

// Chọn biến thể sát ngân sách nhất nhưng còn hàng
function pickVariantByBudget(product, budget) {
  if (!budget || !Array.isArray(product.variants) || !product.variants.length) return null;
  const inStock = product.variants.filter((v) => v.stock > 0);
  if (!inStock.length) return null;
  const sorted = inStock
    .map((v) => ({ v, diff: Math.abs(v.price - budget) }))
    .sort((a, b) => a.diff - b.diff);
  return sorted[0].v;
}

/* ===== Tuning rule ===== */
const MIN_SCORE_TO_RECOMMEND = 4; // ngưỡng tối thiểu để show sản phẩm
const MIN_SIGNALS_TO_RECOMMEND = 2; // cần ≥2 tín hiệu ngoài ngân sách

function countSignals(f) {
  let n = 0;
  if (f.wantSweet) n++;
  if (f.wantSour) n++;
  if (f.wantCrisp) n++;
  if (f.wantSeedless) n++;
  if (f.wantEasyPeel) n++;
  if (f.useJuice) n++;
  if (f.useBaby) n++;
  if (f.useGift) n++;
  return n;
}

function score(p, f) {
  // nếu không còn biến thể nào > 0 → loại sớm
  const anyInStock =
    (p.stock > 0) || (Array.isArray(p.variants) && p.variants.some((v) => v.stock > 0));
  if (!anyInStock) return -Infinity;

  let s = 0;

  // vị/texture
  if (f.wantSweet) s += (p.taste?.sweet || 0) * 2;
  if (f.wantSour) s += (p.taste?.sour || 0) * 2;
  if (f.wantCrisp) s += (p.taste?.crisp || 0) * 1.5;

  // thuộc tính
  if (f.wantSeedless && p.seedless) s += 3;
  if (f.wantEasyPeel && (p.peelEase || 0) >= 4) s += 2;

  // nhu cầu sử dụng
  if (f.useJuice && p.useTags?.includes("ép nước")) s += 3;
  if (f.useBaby && p.useTags?.includes("cho bé")) s += 3;
  if (f.useGift && p.useTags?.includes("biếu tặng")) s += 3;

  // ngân sách: CHỈ cộng nếu đã có ít nhất 1 tín hiệu khác
  const nonBudgetSignals =
    f.wantSweet ||
    f.wantSour ||
    f.wantCrisp ||
    f.wantSeedless ||
    f.wantEasyPeel ||
    f.useJuice ||
    f.useBaby ||
    f.useGift;
  if (f.budget && nonBudgetSignals) {
    const basePrice = p.price || 0;
    if (basePrice <= f.budget) s += 1.2;
    const diff = Math.abs(basePrice - f.budget);
    s += Math.max(0, 1.2 - diff / 60000);
  }

  // mùa vụ nhẹ tay
  if (inSeason(p)) s += 1;

  return s;
}

function reasons(p, f) {
  const r = [];
  if (f.wantSweet && (p.taste?.sweet || 0) >= 4) r.push("ngọt");
  if (f.wantSour && (p.taste?.sour || 0) >= 2) r.push("hơi chua thanh");
  if (f.wantCrisp && (p.taste?.crisp || 0) >= 3) r.push("giòn");
  if (f.wantSeedless && p.seedless) r.push("không hạt");
  if (f.wantEasyPeel && (p.peelEase || 0) >= 4) r.push("vỏ dễ bóc");
  if (f.useJuice && p.useTags?.includes("ép nước")) r.push("hợp ép nước");
  if (f.useBaby && p.useTags?.includes("cho bé")) r.push("hợp cho bé");
  if (f.useGift && p.useTags?.includes("biếu tặng")) r.push("đẹp để biếu");
  if (inSeason(p)) r.push("đang mùa");
  return r.join(", ");
}

/* ========== Ollama (AI offline) ========== */
const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "mistral:7b-instruct";
const OLLAMA_MAX_TOKENS = Number(process.env.OLLAMA_MAX_TOKENS || 512);
const OLLAMA_TEMPERATURE = Number(process.env.OLLAMA_TEMPERATURE || 0.2);

// Gọi 1 lần
async function callOllamaOnce({
  system,
  user,
  maxTokens = OLLAMA_MAX_TOKENS,
  temperature = OLLAMA_TEMPERATURE,
}) {
  const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: `<s>[SYSTEM]\n${system}\n[/SYSTEM]\n[USER]\n${user}\n[/USER]\n[ASSISTANT]\n`,
      options: { temperature, num_predict: maxTokens },
      stream: false,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ollama error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return (data.response || "").trim();
}

// Nếu câu trả lời bị cắt (không kết thúc bằng dấu câu), gọi tiếp để nối
async function callOllama({ system, user }) {
  const first = await callOllamaOnce({ system, user });
  const trimmed = first.trim();

  if (/[.!?…]\s*$/.test(trimmed)) return trimmed; // đã kết thúc

  const continueUser = `${user}\n\nTiếp tục nốt phần còn lại, tổng kết gọn 1-2 câu.`;
  const second = await callOllamaOnce({
    system,
    user: continueUser,
    maxTokens: Math.max(128, Math.floor(OLLAMA_MAX_TOKENS / 2)),
  });

  let joined = (trimmed + " " + second).replace(/\s+/g, " ").trim();
  if (!/[.!?…]\s*$/.test(joined)) joined += ".";
  return joined;
}

/* ========== API chính (HYBRID) ========== */
fruitbotRouter.post("/chat", async (req, res) => {
  const { message } = req.body || {};
  if (!message) {
    return res.status(400).json({
      reply: "Mô tả nhu cầu: ngọt/chua, có cần không hạt, ngân sách nhé!",
    });
  }

  // 0) Phí ship (ưu tiên bắt trước vì là rule cụ thể)
  const shipIntent = detectShippingIntent(message);
  if (shipIntent) {
    return res.json({
      reply: shippingReplyByScope(shipIntent),
      quickReplies: ["Cho mình hỏi loại không hạt", "Ngọt ~60k/kg", "Mua để ép nước"],
    });
  }

  // 1) FAQ tĩnh
  const faq = matchFAQ(message);
  if (faq) return res.json({ reply: faq });

  // 2) Lấy sản phẩm từ MongoDB, enrich bằng BOT_CONFIG
  let PRODUCTS = [];
  try {
    const dbProducts = await Product.find(
      {},
      { name: 1, baseVariant: 1, variants: 1, displayVariant: 1 }
    ).limit(100);
    PRODUCTS = dbProducts.map(enrichProduct);
  } catch (e) {
    console.error("DB error:", e?.message || e);
  }

  // 3) Tư vấn rule-based + gating
  const prefs = extractPrefs(message);

  // Loại hàng hết sạch (không còn biến thể nào > 0)
  const availableProducts = PRODUCTS.filter((p) => {
    const anyInStock =
      p.stock > 0 || (Array.isArray(p.variants) && p.variants.some((v) => v.stock > 0));
    return anyInStock;
  });

  const productsRanked = availableProducts
    .map((p) => ({ p, s: score(p, prefs) }))
    .sort((a, b) => b.s - a.s);

  // Điều kiện để recommend theo rule
  const signals = countSignals(prefs);
  const topRanked = productsRanked.filter((x) => x.s >= MIN_SCORE_TO_RECOMMEND).slice(0, 3);

  if (signals >= MIN_SIGNALS_TO_RECOMMEND && topRanked.length > 0) {
    const results = topRanked.map(({ p }) => {
      // Nếu có ngân sách → chọn biến thể sát ngân sách nhất nhưng phải còn hàng
      const vBudget = pickVariantByBudget(p, prefs.budget);
      const price = vBudget ? vBudget.price : p.price;
      const stock = vBudget ? vBudget.stock : p.stock;
      const vLabel = vBudget
        ? [vBudget.weight, vBudget.ripeness].filter(Boolean).join(" • ")
        : [p?.variant?.weight, p?.variant?.ripeness].filter(Boolean).join(" • ");

      return {
        id: p.id,
        name: p.name,
        price,
        stock,
        origin: p.origin,
        reason: reasons(p, prefs),
        variant: vLabel || undefined,
      };
    });

    const bullet = results
      .map((r) => {
        const v = r.variant ? ` (${r.variant})` : "";
        const stockText = typeof r.stock === "number" ? ` • còn ${r.stock}` : "";
        return `• ${r.name}${v} ~ ${r.price.toLocaleString()}đ${stockText} — ${r.reason}`;
      })
      .join("\n");

    return res.json({
      reply: `Gợi ý cho bạn:\n${bullet}\nBạn muốn xem chi tiết không?`,
      results,
      quickReplies: ["Có loại không hạt khác không?", "Khoảng 60k/kg", "Mua cho bé ăn"],
    });
  }

  // 4) 🔥 Fallback sang Ollama
  const sys = `Bạn là chatbot tư vấn trái cây cho website bán hoa quả.
- Trả lời NGẮN GỌN, RÕ RÀNG: 3–6 câu, tiếng Việt.
- Không bịa dữ kiện: chỉ tham chiếu dữ liệu cung cấp (nếu thiếu hãy nói chưa có).
- Nếu khách hỏi giá/kg mà dữ liệu là /0.5kg thì quy đổi tương đương.
- Ưu tiên: gợi ý 1–3 lựa chọn phù hợp + lý do ngắn + tầm giá (nếu có).
DỮ LIỆU THAM CHIẾU: ${JSON.stringify(PRODUCTS)}`;

  const userPrompt = `Khách hỏi: "${message}". Hãy tư vấn phù hợp.`;

  try {
    const ai = await callOllama({ system: sys, user: userPrompt });
    return res.json({
      reply: ai,
      quickReplies: ["Gợi ý theo vị ngọt", "Có loại không hạt không?", "Tầm 60k/kg"],
    });
  } catch (e) {
    console.error("Ollama error:", e?.message || e);
    return res.json({
      reply: "AI offline đang bận. Bạn mô tả theo: ngọt/chua/không hạt/tầm giá nhé!",
      quickReplies: ["Ngọt, không hạt", "Khoảng 60k/kg", "Mua cho bé ăn"],
    });
  }
});
