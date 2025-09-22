// src/controllers/cart.controller.js
import Cart from "../models/cart.model.js";
import productService from "../services/product.service.js";
import { computeExpiryInfo } from "../utils/expiryHelpers.js";

/* =========================================================
 * Common helpers
 * ======================================================= */
const getUserId = (req) => req.userId || req.user?._id;
const toStr = (v) => (v === undefined || v === null ? "" : String(v));
const isComboMarker = (v) => {
  const s = toStr(v).trim().toLowerCase();
  return s === "" || s === "null" || s === "undefined" || s === "combo";
};

/** MIGRATION: sửa dữ liệu giỏ legacy trước khi .save() */
function migrateLegacyItems(cart) {
  if (!cart || !Array.isArray(cart.items)) return;
  cart.items.forEach((it) => {
    if (!it) return;
    if (!it.type) it.type = isComboMarker(it.variantId) ? "combo" : "variant";
    if (it.type === "combo" && isComboMarker(it.variantId)) it.variantId = null;
    if (!it.snapshot || typeof it.snapshot !== "object") it.snapshot = {};
  });
}

/* =========================================================
 * Helpers HÀNG THƯỜNG / VARIANT
 * ======================================================= */
function findVariant(product, variantId) {
  if (!product || !Array.isArray(product.variants)) return null;
  const id = toStr(variantId);
  return product.variants.find((v) => toStr(v._id) === id) || null;
}

function getVariantUnitPrice(product, variant) {
  const pvList = product?.priceView?.variants || [];
  const pv = pvList.find((r) => toStr(r._id) === toStr(variant?._id));
  if (pv && Number.isFinite(Number(pv.finalPrice))) return Number(pv.finalPrice);
  const base = Number(variant?.price || 0);
  try {
    const info = computeExpiryInfo(product, base);
    if (info && typeof info.finalPrice === "number") return Number(info.finalPrice);
  } catch {}
  return base;
}

function getVariantEffectiveStock(variant) {
  return Math.max(0, Number(variant?.stock || 0));
}

function getExistingQtyInCart(cart, productId, variantId) {
  if (!cart || !Array.isArray(cart.items)) return 0;
  return cart.items
    .filter(
      (it) =>
        it.type === "variant" &&
        toStr(it.product) === toStr(productId) &&
        toStr(it.variantId) === toStr(variantId)
    )
    .reduce((s, it) => s + Number(it.quantity || 0), 0);
}

function upsertVariantItem(cart, newItem) {
  const idx = cart.items.findIndex(
    (it) =>
      it.type === "variant" &&
      toStr(it.product) === toStr(newItem.product) &&
      toStr(it.variantId) === toStr(newItem.variantId)
  );
  if (idx >= 0) {
    cart.items[idx].quantity = Math.max(
      1,
      Number(cart.items[idx].quantity || 0) + Number(newItem.quantity || 1)
    );
    cart.items[idx].snapshot = newItem.snapshot || cart.items[idx].snapshot || {};
  } else {
    cart.items.push(newItem);
  }
}

function enrichItem(itemDoc) {
  const item = itemDoc?.toObject ? itemDoc.toObject() : itemDoc;
  if (!item?.product) return item;

  if (item.type === "variant") {
    const variant =
      item?.product?.variants?.find((v) => toStr(v._id) === toStr(item.variantId)) || null;
    const unit = Number(item?.snapshot?.unitPrice ?? variant?.price ?? 0);
    let info = null;
    try {
      info = computeExpiryInfo(item.product, unit);
    } catch {}
    return { ...item, variant, _expiry: info || null };
  }
  return item; // combo không có _expiry
}
const enrichItems = (items = []) => items.map(enrichItem);

/* =========================================================
 * Helpers COMBO / MIX
 * ======================================================= */
function getPreferredUnitPriceForProduct(p) {
  if (!p) return 0;
  const pvBaseFinal = Number(p?.priceView?.base?.finalPrice || 0);
  if (pvBaseFinal > 0) return pvBaseFinal;

  let base =
    Number(p?.displayVariant?.price || 0) ||
    (Array.isArray(p?.variants) && p.variants.length
      ? Math.min(
          ...p.variants
            .map((v) => Number(v?.price || 0))
            .filter((n) => Number.isFinite(n) && n > 0)
        )
      : 0) ||
    Number(p?.baseVariant?.price || 0) ||
    0;

  if (!Number.isFinite(base) || base <= 0) base = 0;

  try {
    const info = computeExpiryInfo(p, base);
    if (info && typeof info.finalPrice === "number") return Number(info.finalPrice);
  } catch {}
  return base;
}

async function quoteFromComboProduct(comboProduct) {
  let subtotal = 0;
  const items = Array.isArray(comboProduct?.comboItems) ? comboProduct.comboItems : [];
  for (const it of items) {
    const pid = it?.product?._id || it?.product;
    const qty = Number(it?.qty || 1);
    if (!pid || qty <= 0) continue;
    const p =
      it?.product && typeof it.product === "object"
        ? it.product
        : await productService.getProductById(pid);
    if (!p) continue;
    subtotal += (getPreferredUnitPriceForProduct(p) || 0) * qty;
  }
  const dc =
    Number(comboProduct?.comboPricing?.discountPercent || 0) ||
    Number(comboProduct?.comboDiscountPercent || 0);
  const total = Math.max(0, Math.round(subtotal * (1 - dc / 100)));
  return {
    subtotal,
    discountPercent: dc,
    total,
    items: items.map((x) => ({
      productId: x?.product?._id || x?.product,
      qty: Number(x?.qty || 1),
    })),
  };
}

async function quoteFromClientItems(payloadItems = [], discountPercent = 0) {
  let subtotal = 0;
  const normalized = [];
  for (const it of payloadItems) {
    const pid = it?.productId;
    const qty = Number(it?.qty || it?.quantity || 1);
    if (!pid || qty <= 0) continue;
    const p = await productService.getProductById(pid);
    if (!p) continue;
    subtotal += (getPreferredUnitPriceForProduct(p) || 0) * qty;
    normalized.push({ productId: pid, qty });
  }
  const dc = Number.isFinite(Number(discountPercent)) ? Number(discountPercent) : 0;
  const total = Math.max(0, Math.round(subtotal * (1 - dc / 100)));
  return { subtotal, discountPercent: dc, total, items: normalized };
}

function buildComboSnapshot({ title, image, breakdown, discountPercent }) {
  return {
    title: title || "",
    image: image || "",
    unitPrice: Number(breakdown?.total || 0),
    discountPercent: Number(discountPercent || breakdown?.discountPercent || 0),
    items: Array.isArray(breakdown?.items)
      ? breakdown.items.map((x) => ({ productId: x.productId, qty: x.qty }))
      : [],
  };
}

/* =========================================================
 * Controllers
 * ======================================================= */
/** POST /api/cart/add */
export const addToCart = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const {
      productId,
      variantId,
      quantity,
      comboProductId,
      items: comboItems,
      discountPercent,
      title,
      type,
    } = req.body || {};

    const qty = Math.max(1, parseInt(quantity || 1, 10));
    if (!Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ message: "Số lượng không hợp lệ" });
    }

    // Nhận diện combo theo nhiều cách để tương thích FE
    let wantCombo =
      toStr(type).toLowerCase() === "combo" ||
      !!comboProductId ||
      isComboMarker(variantId);

    // Nếu truyền productId, kiểm tra xem sản phẩm có phải combo không
    let productDoc = null;
    if (productId) {
      productDoc = await productService.getProductById(productId);
      if (productDoc?.isCombo || String(productDoc?.type || "").toLowerCase() === "combo") {
        wantCombo = true;
      }
    }

    /* ---------- COMBO ---------- */
    if (wantCombo) {
      let comboProduct = null;
      let breakdown = null;

      // Ưu tiên comboProductId; nếu không có, dùng productId đã xác định là combo
      if (comboProductId) {
        comboProduct = await productService.getProductById(comboProductId);
        if (!comboProduct)
          return res.status(404).json({ message: "Không tìm thấy sản phẩm combo" });
      } else if (productDoc && (productDoc.isCombo || String(productDoc.type || "").toLowerCase() === "combo")) {
        comboProduct = productDoc;
      }

      // 3 trường hợp tính/áp giá:
      // A) Combo fixedPrice → dùng luôn
      // B) Có comboProduct nhưng không fixed → quote theo comboItems trong product
      // C) Không có comboProduct (hoặc FE override) → quote từ client items
      if (comboProduct) {
        const fx =
          Number(comboProduct?.comboPricing?.fixedPrice || 0) ||
          Number(comboProduct?.comboPrice || 0);
        if (fx > 0) {
          breakdown = {
            subtotal: fx,
            discountPercent: 0,
            total: fx,
            items: Array.isArray(comboProduct?.comboItems)
              ? comboProduct.comboItems.map((x) => ({
                  productId: x?.product?._id || x?.product,
                  qty: Number(x?.qty || 1),
                }))
              : [],
          };
        } else {
          breakdown = await quoteFromComboProduct(comboProduct);
        }
      } else {
        // Cho phép client gửi items để quote (không còn trả lỗi thiếu items nếu productId là combo)
        if (!Array.isArray(comboItems) || comboItems.length === 0) {
          return res.status(400).json({ message: "Thiếu danh sách items cho combo" });
        }
        breakdown = await quoteFromClientItems(comboItems, discountPercent);
      }

      let cart = await Cart.findOne({ user: userId });
      if (!cart) cart = new Cart({ user: userId, items: [] });
      migrateLegacyItems(cart);

      cart.items.push({
        type: "combo",
        product: comboProduct?._id || productDoc?._id || null,
        variantId: null,
        snapshot: buildComboSnapshot({
          title: title || comboProduct?.name || productDoc?.name || "Combo",
          image: comboProduct?.image || productDoc?.image || "",
          breakdown,
          discountPercent,
        }),
        quantity: qty,
      });

      await cart.save();

      const populated = await Cart.findOne({ user: userId }).populate("items.product");
      const enriched = enrichItems(populated.items);

      // ✅ Trả về cả 2 dạng để tương thích FE cũ/mới
      return res
        .status(200)
        .json({ message: "Đã thêm combo vào giỏ hàng", items: enriched, cart: { items: enriched } });
    }

    /* ---------- VARIANT ---------- */
    if (!productId || !variantId) {
      return res.status(400).json({ message: "Thiếu productId hoặc variantId" });
    }

    const product = productDoc || (await productService.getProductById(productId));
    if (!product) return res.status(404).json({ message: "Không tìm thấy sản phẩm" });

    const variant = findVariant(product, variantId);
    if (!variant) return res.status(404).json({ message: "Không tìm thấy biến thể" });

    const effectiveStock = getVariantEffectiveStock(variant);
    if (effectiveStock <= 0)
      return res.status(400).json({ message: "Biến thể đã hết hàng" });

    let cart = await Cart.findOne({ user: userId });
    if (!cart) cart = new Cart({ user: userId, items: [] });
    migrateLegacyItems(cart);

    const existingQty = getExistingQtyInCart(cart, productId, variantId);
    const wantTotal = existingQty + qty;
    if (wantTotal > effectiveStock) {
      return res.status(400).json({
        message: `Chỉ còn ${effectiveStock} sản phẩm cho biến thể đã chọn`,
      });
    }

    const unitPrice = getVariantUnitPrice(product, variant);

    upsertVariantItem(cart, {
      type: "variant",
      product: product._id,
      variantId: variant._id,
      snapshot: {
        name: product.name || "",
        image:
          product.image ||
          product?.images?.[0]?.url ||
          product?.images?.[0] ||
          "",
        attributes: variant?.attributes || {},
        unitPrice,
      },
      quantity: qty,
    });

    await cart.save();

    const populated = await Cart.findOne({ user: userId }).populate("items.product");
    const enriched = enrichItems(populated.items);
    return res
      .status(200)
      .json({ message: "Đã thêm vào giỏ hàng", items: enriched, cart: { items: enriched } });
  } catch (error) {
    console.error("addToCart failed:", error);
    return res
      .status(500)
      .json({ message: "Lỗi server khi thêm vào giỏ", error: error?.message });
  }
};

/** PATCH /api/cart/item */
export const updateCartItem = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { itemId, quantity, productId, variantId } = req.body || {};
    const q = parseInt(quantity, 10);
    if (!Number.isFinite(q)) return res.status(400).json({ message: "Số lượng không hợp lệ" });

    const cart = await Cart.findOne({ user: userId });
    if (!cart) return res.status(404).json({ message: "Giỏ hàng không tồn tại" });
    migrateLegacyItems(cart);

    let idx = -1;

    if (itemId) {
      idx = cart.items.findIndex((it) => toStr(it._id) === toStr(itemId));
    } else if (productId && variantId) {
      idx = cart.items.findIndex(
        (it) =>
          it.type === "variant" &&
          toStr(it.product) === toStr(productId) &&
          toStr(it.variantId) === toStr(variantId)
      );
    } else {
      return res
        .status(400)
        .json({ message: "Thiếu itemId hoặc (productId & variantId)" });
    }

    if (idx < 0) return res.status(404).json({ message: "Không tìm thấy item trong giỏ" });

    if (q <= 0) {
      cart.items.splice(idx, 1);
      await cart.save();
      const populatedDel = await Cart.findOne({ user: userId }).populate("items.product");
      const enrichedDel = enrichItems(populatedDel.items);
      return res.status(200).json({ message: "Đã xoá sản phẩm", items: enrichedDel, cart: { items: enrichedDel } });
    }

    const item = cart.items[idx];

    if (item.type === "variant") {
      const product = await productService.getProductById(item.product);
      if (!product) return res.status(404).json({ message: "Không tìm thấy sản phẩm" });

      const variant = findVariant(product, item.variantId);
      if (!variant) return res.status(404).json({ message: "Không tìm thấy biến thể" });

      const effectiveStock = getVariantEffectiveStock(variant);
      if (effectiveStock <= 0)
        return res.status(400).json({ message: "Biến thể đã hết hàng" });

      if (q > effectiveStock) {
        return res
          .status(400)
          .json({ message: `Chỉ còn ${effectiveStock} sản phẩm cho biến thể đã chọn` });
      }

      const latestUnit = getVariantUnitPrice(product, variant);
      item.snapshot = { ...(item.snapshot || {}), unitPrice: latestUnit };
    }

    cart.items[idx].quantity = q;
    await cart.save();

    const populated = await Cart.findOne({ user: userId }).populate("items.product");
    const enriched = enrichItems(populated.items);
    return res.status(200).json({ message: "Cập nhật thành công", items: enriched, cart: { items: enriched } });
  } catch (error) {
    console.error("updateCartItem failed:", error);
    return res.status(500).json({ message: "Lỗi server khi cập nhật giỏ", error: error?.message });
  }
};

/** GET /api/cart | /api/cart/me */
export const getCartByUser = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const cart = await Cart.findOne({ user: userId }).populate("items.product");
    if (!cart || !cart.items || cart.items.length === 0) {
      return res.status(200).json({ message: "Giỏ hàng trống", items: [], cart: { items: [] } });
    }

    const items = enrichItems(cart.items);
    return res.status(200).json({ items, cart: { items } });
  } catch (error) {
    console.error("getCartByUser failed:", error);
    return res.status(500).json({ message: "Lỗi server khi lấy giỏ", error: error?.message });
  }
};

/**
 * DELETE:
 *  - /api/cart/item/:id
 *  - /api/cart/variant/:productId/:variantId     (legacy)
 *  - /api/cart/:productId/:variantId             (legacy rất cũ)
 *  - hoặc query/body
 */
export const removeCartItem = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const id =
      req.params?.id || req.query?.itemId || req.body?.itemId || null;

    const productId =
      req.params?.productId ??
      req.query?.productId ??
      req.body?.productId ??
      null;

    const variantId =
      req.params?.variantId ??
      req.query?.variantId ??
      req.body?.variantId ??
      null;

    let updated;

    if (id) {
      updated = await Cart.findOneAndUpdate(
        { user: userId },
        { $pull: { items: { _id: id } } },
        { new: true }
      ).populate("items.product");
    } else if (productId) {
      const isCombo = isComboMarker(variantId);
      const match = isCombo
        ? { type: "combo", product: productId }
        : { type: "variant", product: productId, variantId: variantId };

      updated = await Cart.findOneAndUpdate(
        { user: userId },
        { $pull: { items: match } },
        { new: true }
      ).populate("items.product");
    } else {
      return res
        .status(400)
        .json({ message: "Thiếu itemId hoặc (productId & variantId) để xoá" });
    }

    if (!updated) return res.status(404).json({ message: "Giỏ hàng không tồn tại" });

    const enriched = enrichItems(updated.items);
    return res.status(200).json({ message: "Đã xoá sản phẩm", items: enriched, cart: { items: enriched } });
  } catch (error) {
    console.error("removeCartItem failed:", error);
    return res.status(500).json({ message: "Lỗi server khi xoá item", error: error?.message });
  }
};

/** DELETE /api/cart/clear */
export const clearCart = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    await Cart.updateOne({ user: userId }, { $set: { items: [] } });
    return res.status(200).json({ message: "Đã xoá toàn bộ giỏ hàng", items: [], cart: { items: [] } });
  } catch (error) {
    console.error("clearCart failed:", error);
    return res
      .status(500)
      .json({ message: "Lỗi server khi xoá toàn bộ giỏ hàng", error: error?.message });
  }
};
