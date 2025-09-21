// server/controllers/product.controller.js
import productService from "../services/product.service.js";
import { computeExpiryInfo } from "../utils/expiryHelpers.js";

// ✅ Import theo namespace để tránh mismatch named export
import * as inventory from "../services/inventory.service.js";
import * as pricing from "../services/pricing.service.js";

/* =========================================================
 * Safe helpers (chống nổ)
 * ======================================================= */

function toPlain(doc) {
  try {
    if (!doc) return doc;
    // Nếu service dùng lean() sẽ là plain object sẵn → không có toObject
    return typeof doc.toObject === "function" ? doc.toObject() : doc;
  } catch {
    return doc;
  }
}

// Bổ sung default object để các nhánh combo/mix/preorder không undefined
function normalizeFeatureFields(p) {
  if (!p || typeof p !== "object") return p;

  const safe = { ...p };

  // Flags/tính năng
  safe.preorder =
    safe.preorder && typeof safe.preorder === "object"
      ? safe.preorder
      : { enabled: false };
  safe.combo =
    safe.combo && typeof safe.combo === "object"
      ? safe.combo
      : { enabled: false };
  safe.mix =
    safe.mix && typeof safe.mix === "object" ? safe.mix : { enabled: false };

  // đảm bảo mảng
  if (!Array.isArray(safe.variants))
    safe.variants = Array.isArray(p?.variants) ? p.variants : [];
  if (!Array.isArray(safe.packagingOptions))
    safe.packagingOptions = Array.isArray(p?.packagingOptions)
      ? p.packagingOptions
      : [];
  if (!Array.isArray(safe.alternatives))
    safe.alternatives = Array.isArray(p?.alternatives) ? p.alternatives : [];

  return safe;
}

/* =========================================================
 * BOX VISIBILITY FILTER (quan trọng cho luồng THÙNG)
 *  - Chỉ expose biến thể kind='box' mà admin thực sự bật (isPublished !== false)
 *  - Không đụng đến loose/luồng khác
 *  - Sinh boxMaturityOptions để FE render đúng các tình trạng chín của THÙNG
 * ======================================================= */
function applyBoxVisibilityFilter(plain) {
  try {
    if (!plain || typeof plain !== "object") return plain;

    const variants = Array.isArray(plain?.variants) ? plain.variants : [];
    if (!variants.length) {
      return { ...plain, boxMaturityOptions: [] };
    }

    const visible = variants.filter((v) => {
      if (v?.kind === "box") {
        // Ẩn thùng mà admin không publish
        if (v?.isPublished === false) return false;
        // OPTIONAL: hide out-of-stock box variants
        // const st = Number(v?.stock || 0);
        // if (!Number.isFinite(st) || st <= 0) return false;
        return true;
      }
      return true; // giữ nguyên các biến thể loose
    });

    const boxMaturity = new Set(
      visible
        .filter((v) => v?.kind === "box")
        .map((v) => (v?.attributes?.ripeness || "").toString().trim())
        .filter(Boolean)
    );

    return {
      ...plain,
      variants: visible,
      boxMaturityOptions: Array.from(boxMaturity),
    };
  } catch {
    return plain;
  }
}

/**
 * NEW: Bơm tồn kho cho COMBO ở layer Controller (phòng khi service dùng .lean()
 * khiến transform ở Model không chạy).
 * - Không thay đổi dữ liệu gốc trong DB.
 * - Không đụng gì tới các luồng khác (single/mix).
 */
function ensureComboView(plain) {
  if (!plain || typeof plain !== "object") return plain;

  const isCombo =
    plain?.type === "combo" ||
    plain?.isCombo === true ||
    plain?.combo?.enabled === true;

  if (!isCombo) return plain;

  const ci = plain.comboInventory || {};
  // ✅ Ưu tiên comboInventory.stock; nếu không có thì fallback sang root stock
  const hasCiStock = Number.isFinite(Number(ci?.stock));
  const fallbackRoot = Number.isFinite(Number(plain?.stock))
    ? Number(plain.stock)
    : 0;
  const safeStock = Math.max(0, hasCiStock ? Number(ci.stock) : fallbackRoot);

  const patched = {
    ...plain,
    comboInventory: {
      stock: safeStock,
      ...(ci?.autoDeduct ? { autoDeduct: ci.autoDeduct } : {}),
    },
  };

  // Giá combo ưu tiên fixedPrice (hoặc comboPrice legacy)
  const fixedPrice =
    Number(patched?.comboPricing?.fixedPrice ?? patched?.comboPrice ?? 0) || 0;

  // Bơm displayVariant chỉ để FE đọc nhanh. Không ghi đè price nếu đã có.
  if (!patched.displayVariant) {
    patched.displayVariant = { price: fixedPrice, stock: safeStock };
  } else {
    if (
      typeof patched.displayVariant.stock !== "number" ||
      !Number.isFinite(patched.displayVariant.stock)
    ) {
      patched.displayVariant.stock = safeStock;
    }
  }

  return patched;
}

/**
 * Liên thông tồn kho cho biến thể "loose/box" (view-only).
 * BỎ QUA sản phẩm combo để không ảnh hưởng tồn kho combo.
 */
function safeLinkVariantsStock(plain) {
  try {
    const isCombo =
      plain?.type === "combo" ||
      plain?.isCombo === true ||
      plain?.combo?.enabled === true;

    if (isCombo) return plain; // ❗️Quan trọng: không link stock cho combo

    // service có thể chưa implement — phòng trường hợp undefined
    if (inventory && typeof inventory.linkVariantsStock === "function") {
      return inventory.linkVariantsStock(plain);
    }
  } catch {
    // fallback giữ nguyên dữ liệu gốc khi xảy ra lỗi
  }
  return plain;
}

function safeGetPreferredPrice(plain) {
  try {
    if (pricing && typeof pricing.getPreferredPrice === "function") {
      const v = pricing.getPreferredPrice(plain);
      return Number.isFinite(v) ? v : 0;
    }
  } catch {}
  // fallback lần 2: thử lấy từ một số field quen thuộc
  const guesses = [
    plain?.displayVariant?.price,
    plain?.price,
    plain?.salePrice,
    plain?.comboPricing?.fixedPrice,
    plain?.comboPrice,
    plain?.mix?.basePricePerKg,
    plain?.baseVariant?.price,
  ]
    .map((x) => Number(x))
    .filter((x) => Number.isFinite(x) && x > 0);
  return guesses.length ? guesses[0] : 0;
}

function safeComputeExpiry(plain, preferredPrice) {
  try {
    const info = computeExpiryInfo(plain, preferredPrice);
    return info ?? null;
  } catch {
    return null;
  }
}

/* =========================================================
 * Expiry + Stock view
 * ======================================================= */

function attachExpiryAndLinkedStockView(p) {
  if (!p) return p;

  // 1) toPlain + normalize fields
  let plain = normalizeFeatureFields(toPlain(p));

  // 2) Ensure combo view trước (để FE luôn có comboInventory/stock)
  plain = ensureComboView(plain);

  // 3) Liên thông tồn kho (view only) — bỏ qua combo
  plain = safeLinkVariantsStock(plain);

  // 3.5) ✅ Filter lại biến thể THÙNG theo publish (core của luồng Thùng)
  plain = applyBoxVisibilityFilter(plain);

  // 4) nếu đã có _expiry do service gắn sẵn thì giữ nguyên
  if (plain && plain._expiry) return plain;

  // 5) preferred price an toàn
  const preferredPrice = safeGetPreferredPrice(plain) || 0;

  // 6) gắn _expiry an toàn
  const info = safeComputeExpiry(plain, preferredPrice);

  return info ? { ...plain, _expiry: info } : plain;
}

function attachListExpiryAndLinkedStock(arr) {
  if (!Array.isArray(arr)) return arr;
  // map từng phần tử, không để 1 item lỗi làm hỏng cả danh sách
  return arr.map((it) => {
    try {
      return attachExpiryAndLinkedStockView(it);
    } catch {
      return toPlain(it);
    }
  });
}

/* =========================================================
 * Helpers cho CREATE/UPDATE combo (không ảnh hưởng luồng khác)
 * ======================================================= */

/**
 * Phát hiện có phải combo không dựa trên body/flags.
 */
function isComboByBody(b = {}) {
  return (
    b?.type === "combo" ||
    b?.isCombo === true ||
    b?.combo?.enabled === true ||
    typeof b?.comboInventory !== "undefined" ||
    typeof b?.comboPricing !== "undefined" ||
    typeof b?.comboItems !== "undefined"
  );
}

/**
 * Chuẩn hoá body trước khi gọi service.create/update:
 * - Nếu là combo: mirror comboInventory.stock → body.stock
 * - Giữ nguyên các keys khác.
 */
function buildPatchedBodyForCombo(originalBody = {}, currentDocIsCombo = false) {
  const b = { ...originalBody };
  const consideredCombo = isComboByBody(b) || currentDocIsCombo;

  if (!consideredCombo) {
    return { patched: b, consideredCombo: false };
  }

  // Đảm bảo flag
  b.type = "combo";
  b.isCombo = true;

  // Lấy tồn kho combo từ body nếu có, fallback root stock nếu FE gửi
  const ciStock = Number(b?.comboInventory?.stock);
  const haveCiStock = Number.isFinite(ciStock);
  const rootStockNum = Number(b?.stock);
  const haveRootStock = Number.isFinite(rootStockNum);

  const finalStock = Math.max(
    0,
    haveCiStock ? ciStock : haveRootStock ? rootStockNum : 0
  );

  // Mirror sang root.stock để không bị sanitizer bỏ sót comboInventory
  b.stock = finalStock;

  // Đảm bảo comboInventory tồn tại trong body trả qua service (nếu service có lưu thì tốt)
  b.comboInventory = {
    stock: finalStock,
    ...(b?.comboInventory?.autoDeduct
      ? { autoDeduct: b.comboInventory.autoDeduct }
      : {}),
  };

  // Không can thiệp comboItems/comboPricing nếu FE đã gửi
  // (giữ y nguyên để không ảnh hưởng luồng khác)
  // Thêm log debug
  console.log("[COMBO_BE] PATCH BODY → isCombo:", consideredCombo, {
    feCiStock: b?.comboInventory?.stock,
    feRootStock: originalBody?.stock,
    finalStock,
  });

  return { patched: b, consideredCombo: true };
}

/* =========================================================
 * Helpers: merge preorder sâu, tránh overwrite
 * ======================================================= */
function mergePreorderDeep(current = {}, incoming = {}) {
  if (!incoming || typeof incoming !== "object") return current || {};
  const cur = current && typeof current === "object" ? current : {};

  return {
    ...cur,
    ...incoming,
    cancelPolicy: {
      ...(cur.cancelPolicy || {}),
      ...(incoming.cancelPolicy || {}),
    },
    // giữ nguyên perVariantAllocations nếu FE không gửi
    perVariantAllocations:
      Array.isArray(incoming.perVariantAllocations)
        ? incoming.perVariantAllocations
        : cur.perVariantAllocations,
  };
}

/* =========================================================
 * Controller
 * ======================================================= */

const productController = {
  /* =========================
   * CRUD CƠ BẢN
   * ========================= */
  create: async (req, res) => {
    try {
      const { patched, consideredCombo } = buildPatchedBodyForCombo(req.body);

      // Debug giúp so sánh FE ↔ BE
      if (consideredCombo) {
        console.log("[COMBO_BE_CREATE] INCOMING FE BODY.comboInventory:", req.body?.comboInventory);
        console.log("[COMBO_BE_CREATE] PATCHED BODY.comboInventory:", patched?.comboInventory);
      }

      const created = await productService.createProduct(patched);

      // Lấy lại bản đầy đủ
      const full = await productService.getProductById(created._id);

      // Thêm log đối chiếu
      const plain = toPlain(full);
      console.log("[COMBO_BE_CREATE] AFTER CREATE stored stocks:", {
        rootStock: plain?.stock,
        comboStock: plain?.comboInventory?.stock,
      });

      return res.status(201).json(attachExpiryAndLinkedStockView(full));
    } catch (error) {
      return res
        .status(500)
        .json({ message: "Lỗi server", error: error?.message || String(error) });
    }
  },

  getAll: async (req, res) => {
    try {
      // 🔎 Nhánh dành riêng cho Coming Soon (preorder list cho Admin/FE)
      const wantPreorderOnly =
        String(req?.query?.preorder || "").toLowerCase() === "true";

      if (wantPreorderOnly) {
        let items = [];
        if (typeof productService.getComingSoonProducts === "function") {
          // Ưu tiên service chuyên dụng nếu có
          items = (await productService.getComingSoonProducts(req.query)) || [];
        } else {
          // Fallback: lấy tất cả rồi lọc
          const data = await productService.getAllProducts(req.query);
          const list = Array.isArray(data)
            ? data
            : Array.isArray(data?.products)
            ? data.products
            : [];
          items = list.filter((p) => p?.preorder?.enabled === true);
        }

        // Trả về dạng { ok:true, items } để FE ComingSoonAdmin đọc trực tiếp
        return res.json({
          ok: true,
          items: attachListExpiryAndLinkedStock(items),
        });
      }

      // Giữ nguyên cách gọi service để không ảnh hưởng luồng khác
      const data = await productService.getAllProducts(req.query);

      // Chuẩn hoá dữ liệu trả ra giống logic cũ
      if (Array.isArray(data)) {
        return res.json(attachListExpiryAndLinkedStock(data));
      }
      if (Array.isArray(data?.products)) {
        return res.json({
          ...data,
          products: attachListExpiryAndLinkedStock(data.products),
        });
      }
      if (data && typeof data === "object" && data._id) {
        return res.json(attachExpiryAndLinkedStockView(data));
      }
      return res.json(data);
    } catch (error) {
      return res.status(500).json({
        message: "Lỗi server tại product.getAll",
        error: error?.message || String(error),
      });
    }
  },

  getById: async (req, res) => {
    try {
      const product = await productService.getProductById(req.params.id);
      if (!product) {
        return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
      }
      return res.json(attachExpiryAndLinkedStockView(product));
    } catch (error) {
      return res
        .status(500)
        .json({ message: "Lỗi server", error: error?.message || String(error) });
    }
  },

  update: async (req, res) => {
    try {
      // Lấy doc hiện tại để biết có phải combo không, và để merge preorder
      let currentPlain = null;
      let currentIsCombo = false;
      try {
        const current = await productService.getProductById(req.params.id);
        currentPlain = toPlain(current);
        currentIsCombo =
          currentPlain?.type === "combo" ||
          currentPlain?.isCombo === true ||
          currentPlain?.combo?.enabled === true;
      } catch {
        // bỏ qua nếu không đọc được, xử lý tiếp bằng body
      }

      const { patched, consideredCombo } = buildPatchedBodyForCombo(
        req.body,
        currentIsCombo
      );

      // 🔧 Merge sâu PREORDER nếu body có gửi
      if (patched && patched.preorder) {
        const merged = mergePreorderDeep(currentPlain?.preorder, patched.preorder);
        patched.preorder = merged;
      }

      if (consideredCombo) {
        console.log("[COMBO_BE_UPDATE] INCOMING FE BODY.comboInventory:", req.body?.comboInventory);
        console.log("[COMBO_BE_UPDATE] PATCHED BODY.comboInventory:", patched?.comboInventory);
      }

      const updated = await productService.updateProduct(req.params.id, patched);
      if (!updated) {
        return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
      }

      const full = await productService.getProductById(updated._id);

      // Log đối chiếu sau update
      const plain = toPlain(full);
      console.log("[COMBO_BE_UPDATE] AFTER UPDATE stored stocks:", {
        rootStock: plain?.stock,
        comboStock: plain?.comboInventory?.stock,
      });

      return res.json(attachExpiryAndLinkedStockView(full));
    } catch (error) {
      return res
        .status(500)
        .json({ message: "Lỗi server", error: error?.message || String(error) });
    }
  },

  remove: async (req, res) => {
    try {
      const deletedProduct = await productService.deleteProduct(req.params.id);
      if (!deletedProduct) {
        return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
      }
      return res.json({ message: "Xoá sản phẩm thành công" });
    } catch (error) {
      return res
        .status(500)
        .json({ message: "Lỗi server", error: error?.message || String(error) });
    }
  },

  /* =========================
   * BIẾN THỂ
   * ========================= */
  removeVariants: async (req, res) => {
    try {
      const { attributesList } = req.body;
      if (!Array.isArray(attributesList) || attributesList.length === 0) {
        return res
          .status(400)
          .json({ message: "Cần truyền danh sách biến thể để xóa" });
      }
      const updatedProduct = await productService.deleteVariants(
        req.params.id,
        attributesList
      );
      if (!updatedProduct) {
        return res
          .status(404)
          .json({ message: "Không tìm thấy sản phẩm" });
      }
      return res.json({
        message: "Xóa biến thể thành công",
        product: attachExpiryAndLinkedStockView(updatedProduct),
      });
    } catch (error) {
      return res
        .status(500)
        .json({ message: "Lỗi server", error: error?.message || String(error) });
    }
  },

  updateVariant: async (req, res) => {
    try {
      const updatedProduct = await productService.updateVariant(
        req.params.id,
        req.params.variantId,
        req.body
      );
      if (!updatedProduct) {
        return res
          .status(404)
          .json({ message: "Không tìm thấy sản phẩm hoặc biến thể" });
      }
      return res.json(attachExpiryAndLinkedStockView(updatedProduct));
    } catch (error) {
      return res
        .status(500)
        .json({ message: "Lỗi server", error: error?.message || String(error) });
    }
  },

  removeVariantById: async (req, res) => {
    try {
      const updatedProduct = await productService.deleteVariantById(
        req.params.id,
        req.params.variantId
      );
      if (!updatedProduct) {
        return res
          .status(404)
          .json({ message: "Không tìm thấy sản phẩm hoặc biến thể" });
      }
      return res.json({
        message: "Xóa biến thể thành công",
        product: attachExpiryAndLinkedStockView(updatedProduct),
      });
    } catch (error) {
      return res
        .status(500)
        .json({ message: "Lỗi server", error: error?.message || String(error) });
    }
  },

  /* =========================
   * THEO CATEGORY
   * ========================= */
  getByCategoryName: async (req, res) => {
    try {
      const { categoryName } = req.params;
      const limit = parseInt(req.query.limit ?? 4, 10);

      const products =
        await productService.getLatestProductsByCategoryName(
          categoryName,
          limit
        );
      return res.json(attachListExpiryAndLinkedStock(products));
    } catch (error) {
      return res
        .status(500)
        .json({ message: "Lỗi server", error: error?.message || String(error) });
    }
  },

  getByCategoryWithFilter: async (req, res) => {
    try {
      const { categoryId } = req.params;
      const { limit, sort } = req.query;

      const products = await productService.getProductsByCategory(categoryId, {
        limit,
        sort,
      });
      return res.json(attachListExpiryAndLinkedStock(products));
    } catch (error) {
      return res
        .status(500)
        .json({ message: "Lỗi server", error: error?.message || String(error) });
    }
  },

  /* =========================================================
   *  COMING SOON
   * ========================================================= */
  getComingSoon: async (req, res) => {
    try {
      const items = await productService.getComingSoonProducts(req.query);
      return res.json(attachListExpiryAndLinkedStock(items));
    } catch (error) {
      return res
        .status(500)
        .json({ message: "Lỗi server", error: error?.message || String(error) });
    }
  },

  /* =========================================================
   *  THÙNG (BOX) / COMBO / MIX & GỢI Ý THAY THẾ
   * ========================================================= */

  // Danh sách COMBO
  getCombos: async (req, res) => {
    try {
      if (typeof productService.getCombos === "function") {
        const combos = await productService.getCombos(req.query);
        return res.json(attachListExpiryAndLinkedStock(combos || []));
      }
      const data = await productService.getAllProducts(req.query);
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.products)
        ? data.products
        : [];
      const filtered = list.filter(
        (p) =>
          p?.type === "combo" ||
          p?.isCombo === true ||
          p?.combo?.enabled === true
      );
      return res.json(attachListExpiryAndLinkedStock(filtered));
    } catch (error) {
      return res
        .status(500)
        .json({ message: "Lỗi server", error: error?.message || String(error) });
    }
  },

  // Tính giá COMBO
  comboQuote: async (req, res) => {
    try {
      const { comboProductId, items = [], discountPercent } = req.body || {};

      // Từ 1 combo product
      if (comboProductId) {
        const combo = await productService.getProductById(comboProductId);
        if (!combo)
          return res
            .status(404)
            .json({ message: "Không tìm thấy sản phẩm combo" });
        const isCombo =
          combo?.type === "combo" ||
          combo?.isCombo === true ||
          combo?.combo?.enabled === true;
        if (!isCombo)
          return res.status(400).json({ message: "Sản phẩm không phải combo" });

        const fx =
          Number(combo?.comboPricing?.fixedPrice || combo?.comboPrice || 0) ||
          0;
        if (fx > 0) return res.json({ subtotal: fx, discountPercent: 0, total: fx });

        let subtotal = 0;
        const comboItems = Array.isArray(combo.comboItems)
          ? combo.comboItems
          : [];
        for (const it of comboItems) {
          const pid = it?.product?._id || it?.product;
          if (!pid) continue;
          const p =
            it?.product && typeof it.product === "object"
              ? it.product
              : await productService.getProductById(pid);
          if (!p) continue;

          const pLinked = attachExpiryAndLinkedStockView(p);
          const unit = safeGetPreferredPrice(pLinked) || 0;
          subtotal += unit * (it.qty || 1);
        }

        const dc =
          combo?.comboPricing?.mode === "discount"
            ? Number(combo?.comboPricing?.discountPercent || 0)
            : Number(combo?.comboDiscountPercent || 0);
        const total = Math.max(
          0,
          Math.round(subtotal * (1 - (dc || 0) / 100))
        );
        return res.json({ subtotal, discountPercent: dc || 0, total });
      }

      // Client tự build danh sách items
      if (!Array.isArray(items) || items.length === 0) {
        return res
          .status(400)
          .json({ message: "Thiếu danh sách items để tính giá combo" });
      }

      let subtotal = 0;
      for (const it of items) {
        if (!it?.productId) continue;
        const p = await productService.getProductById(it.productId);
        if (!p) continue;
        const pLinked = attachExpiryAndLinkedStockView(p);
        const unit = safeGetPreferredPrice(pLinked) || 0;
        subtotal += unit * (it.qty || 1);
      }

      const dc = Number.isFinite(Number(discountPercent))
        ? Number(discountPercent)
        : 0;
      const total = Math.max(0, Math.round(subtotal * (1 - dc / 100)));
      return res.json({ subtotal, discountPercent: dc, total });
    } catch (error) {
      return res
        .status(500)
        .json({ message: "Lỗi server", error: error?.message || String(error) });
    }
  },

  // MIX builder candidates
  getMixCandidates: async (req, res) => {
    try {
      const { id } = req.params;
      const { category } = req.query;
      const product = await productService.getProductById(id);
      if (!product)
        return res
          .status(404)
          .json({ message: "Không tìm thấy sản phẩm" });

      const isMix =
        product?.type === "mix" ||
        product?.isMixBuilder === true ||
        product?.mix?.enabled === true;
      if (!isMix) return res.json({ data: [] });

      if (typeof productService.getMixCandidates === "function") {
        const data = await productService.getMixCandidates({
          product,
          category,
        });
        return res.json({ data: attachListExpiryAndLinkedStock(data || []) });
      }
      return res.json({ data: [] });
    } catch (error) {
      return res
        .status(500)
        .json({ message: "Lỗi server", error: error?.message || String(error) });
    }
  },

  // Lấy danh sách “thùng” (packaging)
  getPackagingOptions: async (req, res) => {
    try {
      const { id } = req.params;
      const product = await productService.getProductById(id);
      if (!product)
        return res
          .status(404)
          .json({ message: "Không tìm thấy sản phẩm" });

      // Áp dụng đầy đủ view filters (liên thông + publish box)
      const pLinked = attachExpiryAndLinkedStockView(product);

      // ✅ Chỉ lấy thùng đã publish (isPublished !== false)
      const fromBoxVariants = Array.isArray(pLinked?.variants)
        ? pLinked.variants
            .filter(
              (v) =>
                (v?.kind === "box" ||
                  /thùng/i.test(String(v?.attributes?.weight || ""))) &&
                v?.isPublished !== false
            )
            .map((v) => {
              const boxKg =
                Number(v?.attributes?.boxWeightKg || 0) ||
                (inventory && typeof inventory.kgFromWeight === "function"
                  ? inventory.kgFromWeight(v?.attributes?.weight) || 0
                  : 0);
              return {
                type: "box",
                unitLabel:
                  v?.attributes?.boxLabel ||
                  v?.attributes?.weight ||
                  "Thùng",
                unitSize: Number(boxKg || 0),
                price: Number(v?.price || 0),
                stock: Number(v?.stock || 0),
                _variantId: String(v?._id || ""),
              };
            })
        : [];

      const legacy = Array.isArray(pLinked?.packagingOptions)
        ? pLinked.packagingOptions
        : [];
      const data = [...fromBoxVariants, ...legacy];

      return res.json({ data });
    } catch (error) {
      return res
        .status(500)
        .json({ message: "Lỗi server", error: error?.message || String(error) });
    }
  },

  // Gợi ý sản phẩm thay thế
  getAlternatives: async (req, res) => {
    try {
      const { id } = req.params;
      const product = await productService.getProductById(id);
      if (!product)
        return res
          .status(404)
          .json({ message: "Không tìm thấy sản phẩm" });

      let altItems = [];
      if (Array.isArray(product.alternatives) && product.alternatives.length) {
        const populated = product.alternatives
          .map((a) =>
            a?.product && typeof a.product === "object" ? a.product : null
          )
          .filter(Boolean);
        altItems = populated;
      }

      if ((!altItems || altItems.length === 0) && Array.isArray(product.alternatives)) {
        const ids = product.alternatives
          .map((a) =>
            a?.product && typeof a.product === "string" ? a.product : null
          )
          .filter(Boolean);
        if (ids.length && typeof productService.getProductsByIds === "function") {
          const fetched = await productService.getProductsByIds(ids);
          altItems = fetched || [];
        }
      }

      if (!altItems || altItems.length === 0) {
        if (typeof productService.getRelatedProducts === "function") {
          const related = await productService.getRelatedProducts(product);
          return res.json({
            data: attachListExpiryAndLinkedStock(related || []),
          });
        }
        return res.json({ data: [] });
      }

      return res.json({ data: attachListExpiryAndLinkedStock(altItems) });
    } catch (error) {
      return res
        .status(500)
        .json({ message: "Lỗi server", error: error?.message || String(error) });
    }
  },
};

export default productController;
