// server/services/inventory.service.js
import mongoose from "mongoose";
import Product from "../models/product.model.js";

/**
 * Helpers parse trọng lượng từ text:
 * Hỗ trợ: "10kg", "1 kg", "0.5kg", "500g", "250 g", ...
 */
export function kgFromWeight(w) {
  if (!w) return null;
  const s = String(w).toLowerCase().trim();

  const mKg = s.match(/(\d+(?:[.,]\d+)?)\s*kg/);
  if (mKg) {
    const v = parseFloat(mKg[1].replace(",", "."));
    return Number.isFinite(v) ? v : null;
  }

  const mG = s.match(/(\d+(?:[.,]\d+)?)\s*g/);
  if (mG) {
    const v = parseFloat(mG[1].replace(",", "."));
    return Number.isFinite(v) ? v / 1000 : null;
  }

  return null;
}

function eq(a, b) {
  return String(a ?? "").trim() === String(b ?? "").trim();
}

/** Xác định biến thể là BOX (thùng) */
export function isBoxVariant(variant) {
  if (!variant) return false;
  if ((variant?.kind || "").toLowerCase() === "box") return true;
  if (Number(variant?.attributes?.boxWeightKg || 0) > 0) return true;

  const w = String(variant?.attributes?.weight || "");
  const lbl = String(variant?.attributes?.boxLabel || "");
  return /thùng|box|crate/i.test(w) || /thùng|box|crate/i.test(lbl);
}

/** Tìm biến thể 1kg (ưu tiên loose 1kg, sau đó boxWeightKg=1) */
export function findOneKgVariant(product) {
  const vs = Array.isArray(product?.variants) ? product.variants : [];

  // Ưu tiên: loose 1kg
  const vLoose1 =
    vs.find(
      (v) =>
        ((v.kind || "") === "loose" || !v.kind) &&
        (kgFromWeight(v?.attributes?.weight) || 0) === 1
    ) || null;
  if (vLoose1) return vLoose1;

  // Chấp nhận: biến thể có boxWeightKg = 1 (hiếm)
  const vBox1 =
    vs.find((v) => Number(v?.attributes?.boxWeightKg || 0) === 1) || null;
  if (vBox1) return vBox1;

  return null;
}

/** Tìm biến thể lẻ nhỏ nhất theo kg (ví dụ 0.5kg nếu không có 1kg) */
function findSmallestLooseVariant(product) {
  const vs = Array.isArray(product?.variants) ? product.variants : [];
  const loose = vs
    .filter((v) => !isBoxVariant(v))
    .map((v) => ({ v, kg: kgFromWeight(v?.attributes?.weight) || 1 }))
    .filter((x) => x.kg > 0);
  if (!loose.length) return null;
  loose.sort((a, b) => a.kg - b.kg);
  return loose[0]; // { v, kg }
}

/** Tính tổng kg “lẻ” còn lại từ các biến thể không phải BOX */
export function computeTotalLooseKg(product) {
  const p = product?.toObject ? product.toObject() : product;
  if (!Array.isArray(p?.variants)) return 0;

  let totalKg = 0;
  for (const v of p.variants) {
    if (isBoxVariant(v)) continue;
    const wKg = kgFromWeight(v?.attributes?.weight) || 1;
    const stock = Math.max(0, Number(v?.stock || 0));
    totalKg += wKg * stock;
  }
  // làm tròn 3 chữ số thập phân để tránh nhiễu
  return Math.max(0, Math.floor(totalKg * 1000) / 1000);
}

/** Số kg/thùng của 1 biến thể BOX */
export function kgPerBox(variant) {
  const meta = Number(variant?.attributes?.boxWeightKg || 0);
  if (meta > 0) return meta;
  const fromText = kgFromWeight(variant?.attributes?.weight);
  if (fromText && fromText > 0) return fromText;
  return 1; // fallback
}

/**
 * Tồn kho hiệu dụng cho 1 variant (dùng cho view/validate):
 * - loose → v.stock
 * - box  → floor(totalLooseKg / kgPerBox)
 *   (nếu DB đã có stock >0 thì lấy min(derived, v.stock) để an toàn)
 */
export function computeEffectiveStockForVariant(product, variant, opts = {}) {
  if (!variant) return 0;

  // Hàng lẻ: dùng stock hiện có
  if (!isBoxVariant(variant)) return Math.max(0, Number(variant?.stock || 0));

  // Thùng: derive từ tổng kg lẻ (có thể truyền sẵn totalLooseKg qua opts để tránh tính nhiều lần)
  const totalLooseKg =
    typeof opts.totalLooseKg === "number"
      ? Math.max(0, opts.totalLooseKg)
      : computeTotalLooseKg(product);

  const perBox = Math.max(kgPerBox(variant), 1e-9);
  const derived = Math.floor(totalLooseKg / perBox);

  const stored = Math.max(0, Number(variant?.stock || 0));
  // Nếu đã cấu hình số thùng trong DB, ưu tiên không vượt quá số đó
  return stored > 0 ? Math.min(derived, stored) : derived;
}

/**
 * Liên thông tồn kho giữa biến thể lẻ và thùng (VIEW-ONLY):
 * - KHÔNG thay đổi dữ liệu gốc trong DB
 * - Trả về object mới, trong đó các biến thể BOX có `stock` là số hiệu dụng (derived)
 * - Biến thể LOOSE giữ nguyên stock
 * - Packaging legacy (nếu có) cũng được derive tương tự
 */
export function linkVariantsStock(product) {
  if (!product || typeof product !== "object") return product;

  const plain = product?.toObject ? product.toObject() : { ...product };
  const variants = Array.isArray(plain?.variants) ? plain.variants : [];
  const packaging = Array.isArray(plain?.packagingOptions)
    ? plain.packagingOptions
    : [];

  // Tính tổng kg "lẻ" một lần để dùng cho tất cả BOX
  const totalLooseKg = computeTotalLooseKg(plain);

  // Patch variants: derive stock cho BOX, giữ nguyên LOOSE
  const patchedVariants = variants.map((v) => {
    if (!isBoxVariant(v)) return v;
    const eff = computeEffectiveStockForVariant(plain, v, { totalLooseKg });
    return { ...v, stock: eff };
  });

  // Patch legacy packagingOptions: derive như BOX
  const patchedPackaging = packaging.map((p) => {
    const isBox =
      String(p?.type || "").toLowerCase() === "box" ||
      /thùng|box|crate/i.test(String(p?.unitLabel || ""));
    if (!isBox) return p;

    const kg =
      Number(p?.unitSize || 0) > 0
        ? Number(p.unitSize)
        : kgFromWeight(p?.unitLabel) || 0;

    const derived =
      kg > 0 ? Math.floor(Math.max(0, totalLooseKg) / Math.max(kg, 1e-9)) : 0;

    const stored = Math.max(0, Number(p?.stock || 0));
    const eff = stored > 0 ? Math.min(derived, stored) : derived;

    return { ...p, stock: eff };
  });

  return {
    ...plain,
    variants: patchedVariants,
    packagingOptions: patchedPackaging,
    _stockLinked: {
      mode: "derived-from-loose-kg",
      totalLooseKg,
      at: new Date().toISOString(),
    },
  };
}

/* ========================================================================
 * NEW: Các hàm trừ kho chuẩn (có hỗ trợ transaction)
 * ===================================================================== */

/** tìm biến thể theo id hoặc (weight,ripeness) */
function pickVariant(product, { variantId, weight, ripeness }) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  if (!variants.length) return null;

  if (variantId) {
    return variants.find((v) => String(v._id) === String(variantId)) || null;
  }

  const candidates = variants.filter(
    (v) =>
      eq(v?.attributes?.weight, weight) &&
      eq(v?.attributes?.ripeness, ripeness)
  );
  if (candidates.length <= 1) return candidates[0] || null;

  // ưu tiên "box" khi nhãn gợi ý thùng
  const boxFirst = /thùng|box|crate/i.test(String(weight || ""))
    ? candidates.find((v) => v.kind === "box")
    : candidates.find((v) => v.kind !== "box");
  return boxFirst || candidates[0] || null;
}

/** giảm theo variantId (có session) */
async function decVariantById(productId, variantId, qty, session, ProductModel = Product) {
  const res = await ProductModel.updateOne(
    { _id: productId },
    { $inc: { "variants.$[elem].stock": -qty } },
    {
      session,
      arrayFilters: [
        { "elem._id": new mongoose.Types.ObjectId(String(variantId)), "elem.stock": { $gte: qty } },
      ],
    }
  );
  if (res.modifiedCount !== 1) {
    throw new Error(`Không đủ tồn kho cho biến thể (${productId}::${variantId})`);
  }
}

/** giảm theo attributes (có session) */
async function decVariantByAttrs(productId, { weight, ripeness }, qty, session, ProductModel = Product) {
  const res = await ProductModel.updateOne(
    { _id: productId },
    { $inc: { "variants.$[elem].stock": -qty } },
    {
      session,
      arrayFilters: [
        {
          "elem.attributes.weight": String(weight || ""),
          "elem.attributes.ripeness": String(ripeness || ""),
          "elem.stock": { $gte: qty },
        },
      ],
    }
  );
  if (res.modifiedCount !== 1) {
    throw new Error(
      `Không đủ tồn kho cho biến thể ${weight || "(weight?)"} / ${
        ripeness || "(ripeness?)"
      } (${productId})`
    );
  }
}

/** giảm theo row bất kỳ: ưu tiên variantId → attrs → fallback nhỏ nhất/1kg */
async function decVariantSmart(productId, row, qty, session, ProductModel = Product) {
  const variantId =
    row?.variantId || row?.variant || row?.variant?._id || null;
  const weight = row?.weight || row?.attributes?.weight || "";
  const ripeness = row?.ripeness || row?.attributes?.ripeness || "";

  // 1) variantId
  if (variantId) {
    try {
      await decVariantById(productId, variantId, qty, session, ProductModel);
      return;
    } catch (e) {
      // fall through to attrs
    }
  }

  // 2) attrs
  if (weight || ripeness) {
    try {
      await decVariantByAttrs(productId, { weight, ripeness }, qty, session, ProductModel);
      return;
    } catch (e) {
      // fall through to fallback
    }
  }

  // 3) fallback: chọn biến thể 1kg hoặc lẻ nhỏ nhất
  const p = await ProductModel.findById(productId, { variants: 1 }).lean();
  if (!p) throw new Error("Sản phẩm con không tồn tại");

  const v1 = findOneKgVariant(p);
  const chosen = v1?.v || v1 || findSmallestLooseVariant(p)?.v || null;
  if (!chosen) throw new Error("Không tìm thấy biến thể phù hợp để trừ tồn");

  await decVariantById(productId, chosen._id, qty, session, ProductModel);
}

/** Trừ 1 dòng hàng thường (variant) */
export async function deductVariantLine(line, session, ProductModel = Product) {
  // line: { productId, variantId?, variant:{weight,ripeness}, quantity }
  const product = await ProductModel.findById(line.productId)
    .select({ variants: 1, type: 1, isCombo: 1 })
    .lean();

  if (!product) throw new Error("Sản phẩm không tồn tại");
  const qty = Math.max(1, Number(line.quantity || 0));

  // chặn nhầm combo
  if (product.type === "combo" || product.isCombo === true) {
    throw new Error("Sản phẩm combo không thể mua như biến thể thường");
  }

  // ưu tiên theo id
  if (line.variantId) {
    await decVariantById(product._id, line.variantId, qty, session, ProductModel);
    return;
  }

  // match theo attributes
  const v = pickVariant(product, {
    variantId: null,
    weight: line?.variant?.weight,
    ripeness: line?.variant?.ripeness,
  });
  if (!v) {
    throw new Error(
      `Không tìm thấy biến thể (${line?.variant?.weight} / ${line?.variant?.ripeness})`
    );
  }
  await decVariantById(product._id, v._id, qty, session, ProductModel);
}

/** Gộp breakdown fallback từ comboItems khi thiếu aggregatedBreakdown */
function buildComboAggregatedFallback(comboProduct) {
  const map = new Map();
  for (const it of comboProduct?.comboItems || []) {
    const productId = it?.product?._id || it?.product;
    const ripeness = it?.ripeness || it?.variant?.attributes?.ripeness || null;
    const weight = it?.weight || it?.variant?.attributes?.weight || null;
    const variantId = it?.variant?._id || it?.variantId || it?.variant || null;

    const key = [String(productId || ""), String(ripeness || ""), String(weight || ""), String(variantId || "")].join("__");

    const prev = map.get(key) || {
      product: productId,
      ripeness,
      weight,
      variantId, // ✅ giữ variantId nếu có để trừ chính xác
      need: 0,
    };
    prev.need += Math.max(1, Number(it.qty || 0));
    map.set(key, prev);
  }
  return Array.from(map.values());
}

/** Trừ 1 dòng combo (stock combo + stock biến thể con) */
export async function deductComboLine(line, session, ProductModel = Product) {
  // line: { productId (combo), quantity }
  const combosQty = Math.max(1, Number(line.quantity || 0));

  const combo = await ProductModel.findById(line.productId)
    .select({
      type: 1,
      isCombo: 1,
      "comboInventory.autoDeduct.aggregatedBreakdown": 1,
      "comboInventory.stock": 1,
      comboStock: 1, // ✅ legacy support
      comboItems: 1,
    })
    .lean();

  if (!combo) throw new Error("Combo không tồn tại");
  if (!(combo.type === "combo" || combo.isCombo === true)) {
    throw new Error("Sản phẩm không phải combo");
  }

  // 1) Trừ tồn của chính combo (ưu tiên comboInventory.stock, fallback comboStock)
  let decComboDone = false;

  if (typeof combo?.comboInventory?.stock === "number") {
    const r = await ProductModel.updateOne(
      { _id: combo._id, "comboInventory.stock": { $gte: combosQty } },
      { $inc: { "comboInventory.stock": -combosQty } },
      { session }
    );
    if (r.modifiedCount === 1) decComboDone = true;
  }

  if (!decComboDone && typeof combo?.comboStock === "number") {
    const r2 = await ProductModel.updateOne(
      { _id: combo._id, comboStock: { $gte: combosQty } },
      { $inc: { comboStock: -combosQty } },
      { session }
    );
    if (r2.modifiedCount === 1) decComboDone = true;
  }

  if (!decComboDone) {
    throw new Error("Không đủ tồn kho combo");
  }

  // 2) Trừ tồn các biến thể con theo aggregatedBreakdown (hoặc fallback từ comboItems)
  const agg =
    combo?.comboInventory?.autoDeduct?.aggregatedBreakdown &&
    combo.comboInventory.autoDeduct.aggregatedBreakdown.length
      ? combo.comboInventory.autoDeduct.aggregatedBreakdown
      : buildComboAggregatedFallback(combo);

  const childrenDone = [];
  try {
    for (const row of agg) {
      const productId = row.product;
      const need = Math.max(0, Number(row.need || 0));
      if (!productId || need <= 0) continue;

      const qty = need * combosQty;

      // ✅ ưu tiên variantId nếu có, sau đó attrs, sau nữa là fallback 1kg/nhỏ nhất
      await decVariantSmart(productId, row, qty, session, ProductModel);

      childrenDone.push({
        productId,
        weight: row.weight || "",
        ripeness: row.ripeness || "",
        variantId: row.variantId || null,
        qty,
      });
    }
  } catch (e) {
    // rollback combo stock vừa trừ
    if (typeof combo?.comboInventory?.stock === "number") {
      await ProductModel.updateOne(
        { _id: combo._id },
        { $inc: { "comboInventory.stock": combosQty } },
        { session }
      );
    } else if (typeof combo?.comboStock === "number") {
      await ProductModel.updateOne(
        { _id: combo._id },
        { $inc: { comboStock: combosQty } },
        { session }
      );
    }

    // rollback các child đã trừ
    for (const done of childrenDone.reverse()) {
      if (done.variantId) {
        await ProductModel.updateOne(
          { _id: done.productId },
          { $inc: { "variants.$[elem].stock": done.qty } },
          {
            session,
            arrayFilters: [{ "elem._id": new mongoose.Types.ObjectId(String(done.variantId)) }],
          }
        );
      } else {
        await ProductModel.updateOne(
          { _id: done.productId },
          { $inc: { "variants.$[elem].stock": done.qty } },
          {
            session,
            arrayFilters: [
              {
                "elem.attributes.weight": String(done.weight || ""),
                "elem.attributes.ripeness": String(done.ripeness || ""),
              },
            ],
          }
        );
      }
    }

    throw e;
  }
}

/** Trừ toàn bộ order (mix variant + combo) */
export async function deductForOrder(orderDoc, session, ProductModel = Product) {
  const items = Array.isArray(orderDoc?.cartItems) ? orderDoc.cartItems : [];
  for (const it of items) {
    const t = String(it?.type || "variant");
    if (t === "combo") {
      await deductComboLine(it, session, ProductModel);
    } else {
      await deductVariantLine(it, session, ProductModel);
    }
  }
}

/* ========================================================================
 * API cũ (non-transaction) – đã NÂNG CẤP để hỗ trợ combo + mix
 * ===================================================================== */

/** Tính số “đơn vị biến thể” cần trừ từ tổng kg (làm tròn lên để không bán âm) */
function unitsFromKg(totalKg, perUnitKg) {
  const eps = 1e-9;
  return Math.max(1, Math.ceil(totalKg / Math.max(perUnitKg, eps) - eps));
}

/**
 * Lấy danh sách các biến thể LOOSE sẵn sàng trừ kho, sắp xếp theo kg/đơn vị (desc)
 */
function getLooseVariantsSorted(productDoc) {
  const vs = Array.isArray(productDoc?.variants) ? productDoc.variants : [];
  const loose = [];
  for (const v of vs) {
    if (isBoxVariant(v)) continue;
    const perUnit = kgFromWeight(v?.attributes?.weight) || 1; // fallback 1kg nếu thiếu nhãn
    const stockUnits = Math.max(0, Number(v?.stock || 0));
    if (perUnit > 0 && stockUnits > 0) {
      loose.push({
        variant: v,
        kgPerUnit: perUnit,
        stockUnits,
        stockKg: perUnit * stockUnits,
      });
    }
  }
  // Ưu tiên biến thể có kg lớn hơn để giảm số đơn vị phải trừ
  loose.sort((a, b) => b.kgPerUnit - a.kgPerUnit);
  return loose;
}

/**
 * Trừ kho cho MIX (non-tx) — phiên bản mới:
 * - Tổng hợp nhu cầu theo kg cho từng sản phẩm.
 * - Dàn trải trừ qua nhiều biến thể LOOSE (ưu tiên biến thể có kg lớn hơn).
 * - Nếu tổng kg lẻ của sản phẩm không đủ → fail.
 * - Entry theo “cái” (không có weightGram) **KHÔNG** trừ ở đây (tránh double-count).
 * Return: { ok:true, mode:"mix", logs:[{productId, variantId, units}] }
 */
export async function decMixEntriesNonTx(mixSnap, ProductModel = Product) {
  try {
    const eps = 1e-9;
    const boxQty = Math.max(1, Number(mixSnap?.quantity || 1));
    const entries = Array.isArray(mixSnap?.mix?.items) ? mixSnap.mix.items : [];

    // Gom tổng kg theo product (bỏ qua entry theo cái)
    const needKgByProduct = new Map(); // productId -> totalKg
    for (const e of entries) {
      const pid = String(e?.productId || e?.product || "");
      if (!pid) continue;
      const grams = Number(e?.weightGram || 0);
      const qty = Math.max(0, Number(e?.qty || 0));
      if (grams <= 0 || qty <= 0) continue; // là "cái" → bỏ qua
      const kg = (grams / 1000) * qty * boxQty;
      needKgByProduct.set(pid, (needKgByProduct.get(pid) || 0) + kg);
    }

    // Không có entry theo kg → coi như OK (units-only sẽ do hook/order khác xử lý)
    if (needKgByProduct.size === 0) {
      return { ok: true, mode: "mix", logs: [], skipped: "units-only" };
    }

    // Lấy products 1 lần
    const ids = [...needKgByProduct.keys()];
    const docs = await ProductModel.find(
      { _id: { $in: ids } },
      { variants: 1 }
    ).lean();
    const byId = new Map(docs.map((d) => [String(d._id), d]));

    const allLogs = []; // logs cho toàn mix (dùng rollback khi cần)

    // Xử lý từng sản phẩm
    for (const [pid, totalNeedKgRaw] of needKgByProduct.entries()) {
      const pDoc = byId.get(pid);
      if (!pDoc) {
        // rollback những gì đã trừ trước đó
        for (const log of allLogs.reverse()) {
          await ProductModel.updateOne(
            { _id: log.productId, "variants._id": log.variantId },
            { $inc: { "variants.$.stock": log.units } }
          );
        }
        return { ok: false, reason: "mix-product-not-found", productId: pid };
      }

      const loose = getLooseVariantsSorted(pDoc);
      if (loose.length === 0) {
        for (const log of allLogs.reverse()) {
          await ProductModel.updateOne(
            { _id: log.productId, "variants._id": log.variantId },
            { $inc: { "variants.$.stock": log.units } }
          );
        }
        return { ok: false, reason: "no-loose-variant-for-kg", productId: pid };
      }

      const totalAvailKg = loose.reduce((s, x) => s + x.stockKg, 0);
      const totalNeedKg = Math.max(0, totalNeedKgRaw);

      // Tổng kg lẻ không đủ
      if (totalAvailKg + eps < totalNeedKg) {
        for (const log of allLogs.reverse()) {
          await ProductModel.updateOne(
            { _id: log.productId, "variants._id": log.variantId },
            { $inc: { "variants.$.stock": log.units } }
          );
        }
        return {
          ok: false,
          reason: "insufficient-mix-kg-total",
          productId: pid,
          needKg: totalNeedKg,
          availKg: Math.floor(totalAvailKg * 1000) / 1000,
        };
      }

      // Phân bổ trừ qua nhiều biến thể
      let remainKg = totalNeedKg;
      const perProductLogs = [];

      for (const bucket of loose) {
        if (remainKg <= eps) break;

        const perUnitKg = bucket.kgPerUnit;
        const canUnits = Math.max(0, Math.floor(bucket.stockUnits));
        if (canUnits <= 0 || perUnitKg <= 0) continue;

        const unitsNeeded = Math.min(
          canUnits,
          Math.max(1, Math.ceil((remainKg - eps) / perUnitKg))
        );

        if (unitsNeeded <= 0) continue;

        const r = await ProductModel.updateOne(
          {
            _id: pid,
            "variants._id": bucket.variant._id,
            "variants.stock": { $gte: unitsNeeded },
          },
          { $inc: { "variants.$.stock": -unitsNeeded } }
        );

        if (r.modifiedCount !== 1) {
          // fail — rollback
          for (const d of perProductLogs.reverse()) {
            await ProductModel.updateOne(
              { _id: d.productId, "variants._id": d.variantId },
              { $inc: { "variants.$.stock": d.units } }
            );
          }
          for (const d of allLogs.reverse()) {
            await ProductModel.updateOne(
              { _id: d.productId, "variants._id": d.variantId },
              { $inc: { "variants.$.stock": d.units } }
            );
          }
          return {
            ok: false,
            reason: "insufficient-mix-kg",
            productId: pid,
            variantId: String(bucket.variant._id),
            needUnits: unitsNeeded,
          };
        }

        perProductLogs.push({
          productId: pid,
          variantId: String(bucket.variant._id),
          units: unitsNeeded,
        });

        remainKg -= unitsNeeded * perUnitKg;
      }

      if (remainKg > eps) {
        // Không cover đủ dù đã đi hết loose (hiếm)
        for (const d of perProductLogs.reverse()) {
          await ProductModel.updateOne(
            { _id: d.productId, "variants._id": d.variantId },
            { $inc: { "variants.$.stock": d.units } }
          );
        }
        for (const d of allLogs.reverse()) {
          await ProductModel.updateOne(
            { _id: d.productId, "variants._id": d.variantId },
            { $inc: { "variants.$.stock": d.units } }
          );
        }
        return {
          ok: false,
          reason: "insufficient-mix-kg",
          productId: pid,
          remainKg: Math.max(0, Math.round(remainKg * 1000) / 1000),
        };
      }

      allLogs.push(...perProductLogs);
    }

    return { ok: true, mode: "mix", logs: allLogs };
  } catch (e) {
    return { ok: false, reason: "mix-error", error: e?.message || String(e) };
  }
}

/**
 * Trừ kho (non-transaction):
 * - THÙNG (box) → quy đổi sang 1kg: decUnits = ROUND(qty * kgPerBox - 1e-9)
 * - HÀNG LẺ (loose) → trừ trực tiếp đúng biến thể đó (không quy đổi)
 * - COMBO → trừ stock combo + các biến thể con
 * - MIX (kg) → dùng decMixEntriesNonTx; entry “cái” bỏ qua (tránh double-count)
 */
export async function decOneStockNonTx(snap, ProductModel = Product) {
  const isCombo =
    snap?.type === "combo" || snap?.isCombo === true || snap?.combo === true;

  const isMix =
    snap?.type === "mix" || snap?.isMix === true || !!snap?.mix;

  // ========== MIX ==========
  if (isMix) {
    return decMixEntriesNonTx(snap, ProductModel);
  }

  // ========== COMBO ==========
  if (isCombo) {
    const combosQty = Math.max(1, Number(snap?.quantity || 1));
    const combo = await ProductModel.findById(snap.product)
      .select({
        type: 1,
        isCombo: 1,
        "comboInventory.autoDeduct.aggregatedBreakdown": 1,
        "comboInventory.stock": 1,
        comboStock: 1, // ✅ legacy support
        comboItems: 1,
      })
      .lean();

    if (!combo) return { ok: false, reason: "combo-not-found" };
    if (!(combo.type === "combo" || combo.isCombo === true)) {
      return { ok: false, reason: "not-a-combo" };
    }

    // 1) trừ tồn combo (ưu tiên comboInventory, fallback comboStock)
    let decComboDone = false;
    if (typeof combo?.comboInventory?.stock === "number") {
      const r = await ProductModel.updateOne(
        { _id: combo._id, "comboInventory.stock": { $gte: combosQty } },
        { $inc: { "comboInventory.stock": -combosQty } }
      );
      if (r.modifiedCount === 1) decComboDone = true;
    }
    if (!decComboDone && typeof combo?.comboStock === "number") {
      const r2 = await ProductModel.updateOne(
        { _id: combo._id, comboStock: { $gte: combosQty } },
        { $inc: { comboStock: -combosQty } }
      );
      if (r2.modifiedCount === 1) decComboDone = true;
    }
    if (!decComboDone) {
      return { ok: false, reason: "insufficient-combo" };
    }

    // 2) trừ tồn các biến thể con
    const agg =
      combo?.comboInventory?.autoDeduct?.aggregatedBreakdown &&
      combo.comboInventory.autoDeduct.aggregatedBreakdown.length
        ? combo.comboInventory.autoDeduct.aggregatedBreakdown
        : buildComboAggregatedFallback(combo);

    const childrenDone = [];
    for (const row of agg) {
      const productId = row.product;
      const need = Math.max(0, Number(row.need || 0));
      if (!productId || need <= 0) continue;

      const qty = need * combosQty;

      try {
        await decVariantSmart(productId, row, qty, null, ProductModel);
      } catch (e) {
        // rollback những gì đã trừ trước đó (bao gồm stock combo)
        if (typeof combo?.comboInventory?.stock === "number") {
          await ProductModel.updateOne(
            { _id: combo._id },
            { $inc: { "comboInventory.stock": combosQty } }
          );
        } else if (typeof combo?.comboStock === "number") {
          await ProductModel.updateOne(
            { _id: combo._id },
            { $inc: { comboStock: combosQty } }
          );
        }

        for (const done of childrenDone.reverse()) {
          if (done.variantId) {
            await ProductModel.updateOne(
              { _id: done.productId },
              { $inc: { "variants.$[elem].stock": done.qty } },
              {
                arrayFilters: [{ "elem._id": new mongoose.Types.ObjectId(String(done.variantId)) }],
              }
            );
          } else {
            await ProductModel.updateOne(
              { _id: done.productId },
              { $inc: { "variants.$[elem].stock": done.qty } },
              {
                arrayFilters: [
                  {
                    "elem.attributes.weight": String(done.weight || ""),
                    "elem.attributes.ripeness": String(done.ripeness || ""),
                  },
                ],
              }
            );
          }
        }
        return { ok: false, reason: "insufficient-child-variant" };
      }

      childrenDone.push({
        productId,
        weight: row.weight || "",
        ripeness: row.ripeness || "",
        variantId: row.variantId || null,
        qty,
      });
    }

    return {
      ok: true,
      mode: "combo",
      combo: { comboId: combo._id, qty: combosQty },
      children: childrenDone,
    };
  }

  // ========== HÀNG THƯỜNG ==========
  const qty = Math.max(1, Number(snap?.quantity || 1));
  const pDoc = await ProductModel.findById(snap.product).lean();
  if (!pDoc) return { ok: false, reason: "product-not-found" };

  // Xác định biến thể người dùng chọn
  let chosen =
    (pDoc.variants || []).find((v) => String(v._id) === String(snap.variantId)) ||
    (pDoc.variants || []).find(
      (v) =>
        String(v?.attributes?.weight || "") === String(snap?.variant?.weight || "") &&
        String(v?.attributes?.ripeness || "") === String(snap?.variant?.ripeness || "")
    ) ||
    null;

  // Nếu không tìm thấy (dữ liệu thay đổi), thử trừ trực tiếp theo id
  if (!chosen && snap.variantId) {
    const res = await ProductModel.updateOne(
      { _id: snap.product, "variants._id": snap.variantId, "variants.stock": { $gte: qty } },
      { $inc: { "variants.$.stock": -qty } }
    );
    return res.modifiedCount > 0
      ? { ok: true, mode: "variantsById-fallback" }
      : { ok: false, reason: "variant-not-found" };
  }

  if (!chosen) return { ok: false, reason: "variant-not-found" };

  // ✅ CHỈ quy đổi về 1kg khi biến thể là THÙNG
  if (isBoxVariant(chosen)) {
    const base1kg = findOneKgVariant(pDoc);
    if (!base1kg?._id) return { ok: false, reason: "no-1kg-base" };

    const perBoxKg = kgPerBox(chosen);
    // dùng ROUND - 1e-9 để diệt sai số floating (vd 4.999999999 → 5)
    const decUnits = Math.max(1, Math.round(qty * perBoxKg - 1e-9));

    const resBase = await ProductModel.updateOne(
      {
        _id: snap.product,
        "variants._id": base1kg._id,
        "variants.stock": { $gte: decUnits },
      },
      { $inc: { "variants.$.stock": -decUnits } }
    );
    if (resBase.modifiedCount > 0) {
      return { ok: true, mode: "base1kg", baseId: base1kg._id, decUnits };
    }
    return { ok: false, reason: "insufficient-1kg" };
  }

  // HÀNG LẺ: trừ trực tiếp đúng biến thể (không quy đổi)
  const resChosen = await ProductModel.updateOne(
    { _id: snap.product, "variants._id": chosen._id, "variants.stock": { $gte: qty } },
    { $inc: { "variants.$.stock": -qty } }
  );
  return resChosen.modifiedCount > 0
    ? { ok: true, mode: "variantsById", chosenId: chosen._id }
    : { ok: false, reason: "insufficient-stock" };
}

/**
 * Rollback theo info trả về từ decOneStockNonTx / decMixEntriesNonTx
 */
export async function rollbackOneStock(snap, info, ProductModel = Product) {
  if (!info?.ok) return;

  // MIX rollback (kg)
  if (info.mode === "mix") {
    for (const d of info.logs || []) {
      await ProductModel.updateOne(
        { _id: d.productId, "variants._id": d.variantId },
        { $inc: { "variants.$.stock": Number(d.units || 0) } }
      );
    }
    return;
  }

  // COMBO rollback
  if (info.mode === "combo") {
    // trả lại stock combo
    if (info?.combo?.comboId && info?.combo?.qty) {
      // thử comboInventory trước, nếu không có thì comboStock
      const r = await ProductModel.updateOne(
        { _id: info.combo.comboId },
        { $inc: { "comboInventory.stock": Number(info.combo.qty) } }
      );
      if (r.modifiedCount !== 1) {
        await ProductModel.updateOne(
          { _id: info.combo.comboId },
          { $inc: { comboStock: Number(info.combo.qty) } }
        );
      }
    }
    // trả lại từng biến thể con
    for (const done of info.children || []) {
      if (done.variantId) {
        await ProductModel.updateOne(
          { _id: done.productId },
          { $inc: { "variants.$[elem].stock": Number(done.qty || 0) } },
          {
            arrayFilters: [{ "elem._id": new mongoose.Types.ObjectId(String(done.variantId)) }],
          }
        );
      } else {
        await ProductModel.updateOne(
          { _id: done.productId },
          { $inc: { "variants.$[elem].stock": Number(done.qty || 0) } },
          {
            arrayFilters: [
              {
                "elem.attributes.weight": String(done.weight || ""),
                "elem.attributes.ripeness": String(done.ripeness || ""),
              },
            ],
          }
        );
      }
    }
    return;
  }

  // HÀNG THƯỜNG rollback
  const qty = Math.max(1, Number(snap.quantity || 1));

  if (info.mode === "base1kg") {
    const incUnits = Math.max(1, Number(info.decUnits || 0));
    await ProductModel.updateOne(
      { _id: snap.product, "variants._id": info.baseId },
      { $inc: { "variants.$.stock": incUnits } }
    );
    return;
  }

  if (info.mode === "variantsById" || info.mode === "variantsById-fallback") {
    await ProductModel.updateOne(
      { _id: snap.product, "variants._id": snap.variantId },
      { $inc: { "variants.$.stock": qty } }
    );
    return;
  }

  // (hiếm) fallback theo attributes nếu cần mở rộng trong tương lai
}
