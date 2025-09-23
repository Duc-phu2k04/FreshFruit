// src/pages/Product/ProductDetail.jsx  (PART 1/3)
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { FaStar } from "react-icons/fa";
import PreorderWidget from "../../components/preoder/PreorderWidget";
import "./ProductDetail.css";
import { computeExpiryInfo, fmtDate } from "../../utils/expiryHelpers";
import axiosInstance from "../../utils/axiosConfig";

/* ===== Helpers FE cho “thùng” (box) ===== */
const imgSrc = (path) =>
  path?.startsWith?.("http") ? path : `http://localhost:4000${path || ""}`;

const parseKgFromLabel = (label = "") => {
  const s = String(label || "").toLowerCase().replace(",", ".").replace(/\s+/g, "");
  const m = s.match(/([\d.]+)kg/);
  if (m && Number.isFinite(Number(m[1]))) return Number(m[1]);
  const m2 = s.match(/([\d.]+)/);
  if (m2 && Number.isFinite(Number(m2[1]))) return Number(m2[1]);
  return NaN;
};

const isBoxVariant = (variant) => {
  if (!variant) return false;
  if (variant?.kind === "box") return true;
  if (Number(variant?.attributes?.boxWeightKg || 0) > 0) return true;
  const w = String(variant?.attributes?.weight || "").toLowerCase();
  return /thùng|crate|box/.test(w);
};

const computeTotalLooseKg = (p) => {
  const variants = Array.isArray(p?.variants) ? p.variants : [];
  let totalKg = 0;
  for (const v of variants) {
    if (isBoxVariant(v)) continue; // chỉ cộng hàng lẻ
    const wKg = parseKgFromLabel(v?.attributes?.weight || "");
    const unitKg = Number.isFinite(wKg) && wKg > 0 ? wKg : 1;
    const stock = Number(v?.stock || 0);
    totalKg += unitKg * Math.max(0, stock);
  }
  return Math.max(0, Math.floor(totalKg * 1000) / 1000);
};

const kgPerBox = (variant) => {
  const metaKg = Number(variant?.attributes?.boxWeightKg || 0);
  if (metaKg > 0) return metaKg;
  const fromLabel = parseKgFromLabel(variant?.attributes?.weight || "");
  if (Number.isFinite(fromLabel) && fromLabel > 0) return fromLabel;
  return 1;
};

/** Tồn kho hiệu dụng: lẻ → stock; thùng → floor(totalLooseKg / kg/thùng) (min với stock DB nếu có) */
const effectiveStockForVariant = (p, v) => {
  if (!v) return 0;
  if (!isBoxVariant(v)) return Math.max(0, Number(v?.stock || 0));
  const totalLooseKg = computeTotalLooseKg(p);
  const perBox = kgPerBox(v);
  const derivedBoxes = Math.floor(Math.max(0, totalLooseKg) / Math.max(1e-9, perBox));
  const stored = Number(v?.stock || 0);
  return stored > 0 ? Math.min(derivedBoxes, stored) : derivedBoxes;
};

/* ===== Helpers giá cho “liên quan” (đảm bảo lấy được giá combo) ===== */
const toNum = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};
const isComboProduct = (p) => {
  if (!p || typeof p !== "object") return false;
  if (p.isCombo === true) return true;
  const type = (p.type || "").toString().toLowerCase();
  if (type === "combo") return true;
  const anyComboPrice = [
    p?.comboPricing?.fixedPrice,
    p?.combo?.finalPrice,
    p?.combo?.price,
    p?.combo?.fixedPrice,
    p?.comboPrice,
  ]
    .map((x) => toNum(x, NaN))
    .some((n) => Number.isFinite(n) && n > 0);
  return anyComboPrice;
};
const getRelatedDisplayPrice = (p) => {
  if (isComboProduct(p)) {
    return (
      toNum(p?.comboPricing?.fixedPrice) ||
      toNum(p?.combo?.finalPrice) ||
      toNum(p?.combo?.price) ||
      toNum(p?.combo?.fixedPrice) ||
      toNum(p?.comboPrice) ||
      0
    );
  }
  return (
    toNum(p?.priceView?.base?.finalPrice) ||
    toNum(p?.price) ||
    toNum(p?.baseVariant?.price) ||
    toNum(p?.variants?.[0]?.price) ||
    0
  );
};

/* ===== Helper build danh sách items combo (nếu BE cần) ===== */
const buildComboItemsFromProduct = (p) => {
  const arr = Array.isArray(p?.comboItems) ? p.comboItems : Array.isArray(p?.combo?.items) ? p.combo.items : [];
  return arr
    .map((it) => ({
      productId: it?.product?._id || it?.product || it?.item?._id || it?.item || null,
      variantId: it?.variant?._id || it?.variant || null,
      qty: Number(it?.qty || 1),
    }))
    .filter((x) => x.productId && x.qty > 0);
};

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const allowPreorder = searchParams.get("preorder") === "1";

  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [comments, setComments] = useState([]);
  const [successMessage, setSuccessMessage] = useState("");

  // State chọn biến thể
  const [selectedWeight, setSelectedWeight] = useState("");
  const [selectedRipeness, setSelectedRipeness] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [currentVariant, setCurrentVariant] = useState(null);

  // Combo
  const [comboQuote, setComboQuote] = useState(null);
  const [comboLoading, setComboLoading] = useState(false);
  const [comboAvailability, setComboAvailability] = useState(null);
  const [comboAvailabilityLoading, setComboAvailabilityLoading] = useState(false);

  /* ===== Tồn kho combo (đọc từ BE đã chuẩn hoá) ===== */
  const comboStock = useMemo(() => {
    const s =
      Number(product?.comboInventory?.stock) ||
      Number(product?.comboStock) ||
      0;
    return Number.isFinite(s) ? Math.max(0, s) : 0;
  }, [product]);

  /* =========================
   * Fetch dữ liệu
   * ========================= */
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const { data } = await axiosInstance.get(`/product/${id}`);
        if (!data) throw new Error("Không tìm thấy sản phẩm");

        // chuẩn hoá isCombo nếu BE dùng type
        const normalized = {
          ...data,
          isCombo: data?.isCombo === true || String(data?.type || "").toLowerCase() === "combo",
        };

        setProduct(normalized);

        // Sản phẩm liên quan (cùng category, không preorder)
        try {
          const { data: related } = await axiosInstance.get(`/product`, {
            params: { category: data.category?._id || "", preorder: false },
          });
          const relatedArray = Array.isArray(related)
            ? related
            : Array.isArray(related?.data)
            ? related.data
            : Array.isArray(related?.products)
            ? related.products
            : [];
          setRelatedProducts(relatedArray.filter((item) => item._id !== id));
        } catch {
          setRelatedProducts([]);
        }

        // Defaults (không áp dụng cho combo)
        if (!(normalized?.isCombo)) {
          const variants = Array.isArray(normalized.variants) ? normalized.variants : [];
          let defWeight = "";
          let defRipeness = "";

          if (
            normalized?.baseVariant?.attributes?.weight &&
            normalized?.baseVariant?.attributes?.ripeness &&
            variants.some(
              (v) =>
                v?.attributes?.weight === normalized.baseVariant.attributes.weight &&
                v?.attributes?.ripeness === normalized.baseVariant.attributes.ripeness
            )
          ) {
            defWeight = normalized.baseVariant.attributes.weight;
            defRipeness = normalized.baseVariant.attributes.ripeness;
          } else if (variants.length) {
            defWeight = variants[0]?.attributes?.weight || "";
            defRipeness = variants[0]?.attributes?.ripeness || "";
          }

          setSelectedWeight(defWeight);
          setSelectedRipeness(defRipeness);
          setQuantity(1);
        } else {
          // Combo
          setQuantity(1);
          if (!(Number(normalized?.comboPrice) > 0)) {
            fetchComboQuote(normalized._id);
          } else {
            setComboQuote({
              subtotal: Number(normalized.comboPrice),
              discountPercent: 0,
              total: Number(normalized.comboPrice),
            });
          }
        }
      } catch (err) {
        console.error("Lỗi khi lấy sản phẩm:", err?.response?.data || err?.message);
      }
    };

    const fetchComments = async () => {
      try {
        const { data } = await axiosInstance.get(`/review/products/${id}`);
        setComments(Array.isArray(data?.data) ? data.data : []);
      } catch (err) {
        console.error("Lỗi khi lấy đánh giá:", err?.response?.data || err?.message);
        setComments([]);
      }
    };

    setProduct(null);
    setCurrentVariant(null);
    setComboQuote(null);
    fetchProduct();
    fetchComments();
  }, [id]);
// src/pages/Product/ProductDetail.jsx  (PART 2/3)
  /* =========================
   * Tập biến thể hợp lệ theo lựa chọn hiện tại
   * ========================= */
  const variants = Array.isArray(product?.variants) ? product.variants : [];

  // Weight options chỉ gồm các weight có biến thể thật sự
  const weightOptions = useMemo(() => {
    return Array.from(
      new Set(
        variants
          .map((v) => v?.attributes?.weight)
          .filter((x) => typeof x === "string" && x.trim())
      )
    );
  }, [variants]);

  // Ripeness options phụ thuộc weight đang chọn
  const ripenessOptionsForWeight = useMemo(() => {
    if (!selectedWeight) return [];
    const ripes = variants
      .filter((v) => v?.attributes?.weight === selectedWeight)
      .map((v) => v?.attributes?.ripeness)
      .filter((x) => typeof x === "string" && x.trim());
    return Array.from(new Set(ripes));
  }, [variants, selectedWeight]);

  // Khi đổi weight → nếu ripeness hiện tại không hợp lệ, auto pick ripeness đầu tiên hợp lệ
  useEffect(() => {
    if (product?.isCombo) return;
    if (!selectedWeight) return;

    if (selectedRipeness && ripenessOptionsForWeight.includes(selectedRipeness)) {
      return;
    }
    const nextRipeness = ripenessOptionsForWeight[0] || "";
    setSelectedRipeness(nextRipeness);
    setQuantity(1);
  }, [product?.isCombo, selectedWeight, ripenessOptionsForWeight]); // eslint-disable-line

  // Gắn currentVariant theo lựa chọn (chỉ hàng thường)
  useEffect(() => {
    if (product?.isCombo) return;
    if (product && selectedWeight && selectedRipeness) {
      const found = variants.find(
        (v) =>
          v?.attributes?.weight === selectedWeight &&
          v?.attributes?.ripeness === selectedRipeness
      );
      setCurrentVariant(found || null);
      setQuantity(1);
    } else {
      setCurrentVariant(null);
    }
  }, [product, variants, selectedWeight, selectedRipeness]);

  /* =========================
   * HSD & giảm giá cận hạn
   * ========================= */
  const isComingSoon = !!product?.preorder?.enabled;
  const expiryInfo = useMemo(() => (product ? computeExpiryInfo(product) : null), [product]);

  const discountPercent =
    expiryInfo?.isNearExpiry && !isComingSoon ? Number(expiryInfo.discountPercent || 0) : 0;
  const showExpiryUI = Boolean(discountPercent > 0 && expiryInfo?.isNearExpiry && !isComingSoon);

  const getFinalVariantPrice = (variant) => {
    const base = Number(variant?.price || 0);
    if (discountPercent > 0) return Math.max(0, Math.round(base * (1 - discountPercent / 100)));
    return base;
  };

  /* =========================
   * Combo quote helper
   * ========================= */
  const fetchComboQuote = async (comboProductId) => {
    try {
      setComboLoading(true);
      const { data: json } = await axiosInstance.post("/product/combo-quote", {
        comboProductId,
      });
      if (json) {
        setComboQuote({
          subtotal: Number(json.subtotal || 0),
          discountPercent: Number(json.discountPercent || 0),
          total: Number(json.total || 0),
        });
      } else {
        setComboQuote(null);
      }
    } catch {
      setComboQuote(null);
    } finally {
      setComboLoading(false);
    }
  };

  /* =========================
   * Combo availability helper
   * ========================= */
  const checkComboAvailability = async (comboProductId, qty = 1) => {
    try {
      setComboAvailabilityLoading(true);
      const { data: json } = await axiosInstance.post("/product/check-combo-availability", {
        comboProductId,
        quantity: qty,
      });
      setComboAvailability(json);
    } catch (error) {
      console.error("Error checking combo availability:", error);
      setComboAvailability({
        available: false,
        reason: "error",
        message: "Lỗi khi kiểm tra combo availability"
      });
    } finally {
      setComboAvailabilityLoading(false);
    }
  };

  // Kiểm tra combo availability khi product hoặc quantity thay đổi
  useEffect(() => {
    if (product?.isCombo && product._id) {
      checkComboAvailability(product._id, quantity);
    } else {
      setComboAvailability(null);
    }
  }, [product, quantity]);

  /* =========================
   * Price block
   * ========================= */
  const priceBlock = (() => {
    if (product?.isCombo) {
      if (comboLoading) return <p className="muted">Đang tính giá combo…</p>;
      const total = Number(comboQuote?.total || product?.comboPrice || 0) || 0;
      const subtotal = Number(comboQuote?.subtotal || total) || 0;
      const dc = Number.isFinite(Number(comboQuote?.discountPercent))
        ? Number(comboQuote?.discountPercent)
        : Number(product?.comboDiscountPercent || 0);

      if (dc > 0 && total > 0 && subtotal > total) {
        return (
          <div className="price-block">
            <span className="price-final">{total.toLocaleString()}đ</span>
            <span className="price-base">{subtotal.toLocaleString()}đ</span>
            <span className="pill pill-success">Combo -{dc}%</span>
          </div>
        );
      }
      return <p className="price-single">{total.toLocaleString()}đ</p>;
    }

    if (!currentVariant) return <p className="muted">Vui lòng chọn biến thể</p>;
    const basePrice = Number(currentVariant.price || 0);
    const final = getFinalVariantPrice(currentVariant);

    if (discountPercent > 0) {
      return (
        <div className="price-block">
          <span className="price-final">{final.toLocaleString()}đ</span>
          <span className="price-base">{basePrice.toLocaleString()}đ</span>
          <span className="pill pill-danger">Cận hạn -{discountPercent}%</span>
        </div>
      );
    }
    return <p className="price-single">{basePrice.toLocaleString()}đ</p>;
  })();

  /* =========================
   * Tồn kho hiện tại của biến thể đang chọn
   * ========================= */
  const effectiveStock = useMemo(
    () => (product && currentVariant ? effectiveStockForVariant(product, currentVariant) : 0),
    [product, currentVariant]
  );
  const unitLabel = useMemo(
    () => (currentVariant && isBoxVariant(currentVariant) ? "thùng" : "sản phẩm"),
    [currentVariant]
  );

  /* =========================
   * Add to cart / Buy now
   * ========================= */
  const addToCartServer = async () => {
    try {
      // Token check nhanh để báo sớm
      const token =
        (typeof localStorage !== "undefined" &&
          (localStorage.getItem("accessToken") || localStorage.getItem("token"))) ||
        "";
      if (!token) {
        alert("Bạn cần đăng nhập để thêm vào giỏ hàng.");
        return;
      }

      const tryPost = async (tries) => {
        let lastErr;
        for (const t of tries) {
          try {
            const res = await axiosInstance.post(t.url, t.body);
            if (res && res.status < 400) return res;
          } catch (e) {
            lastErr = e;
            const st = e?.response?.status;
            if (st && st !== 404) break; // 400/401/422 thì dừng
          }
        }
        throw lastErr || new Error("Không thể thêm vào giỏ");
      };

      // ====== COMBO ======
      if (product?.isCombo) {
        if (comboStock <= 0) return alert("Combo này đã hết hàng");
        const qty = Math.max(1, Math.min(Number(quantity || 1), comboStock));
        if (qty !== quantity) setQuantity(qty);

        const comboItems = buildComboItemsFromProduct(product);

        const res = await tryPost([
          { url: "/cart/add", body: { type: "combo", productId: String(product._id), quantity: qty, items: comboItems } },
          { url: "/cart/add", body: { type: "combo", productId: String(product._id), quantity: qty } },
          { url: "/cart/add-combo", body: { productId: String(product._id), quantity: qty, items: comboItems } },
          { url: "/cart/add", body: { productId: String(product._id), variantId: "combo", quantity: qty } },
        ]);

        if (!res || res.status >= 400) {
          throw new Error(res?.data?.message || "Không thể thêm combo vào giỏ");
        }

        setSuccessMessage("Đã thêm combo vào giỏ ✔️");
        setTimeout(() => setSuccessMessage(""), 2500);
        return;
      }

      // ====== HÀNG THƯỜNG ======
      if (!currentVariant) return alert("Vui lòng chọn biến thể trước khi thêm vào giỏ hàng");
      if (effectiveStock <= 0) return alert("Sản phẩm này đã hết hàng");

      const qty = Math.max(1, Math.min(Number(quantity || 1), effectiveStock));
      if (qty !== quantity) {
        setQuantity(qty);
        alert(`Số lượng đã được điều chỉnh về ${qty} theo tồn kho hiện tại.`);
      }

      const payloadMain = {
        productId: String(product._id),
        variantId: String(currentVariant._id || currentVariant.id || ""),
        quantity: qty,
      };

      const res = await tryPost([
        { url: "/cart/add", body: payloadMain },
        { url: "/cart/add", body: { ...payloadMain, variant: payloadMain.variantId } },
      ]);

      if (!res || res.status >= 400) {
        throw new Error(res?.data?.message || "Lỗi khi thêm vào giỏ hàng");
      }

      setSuccessMessage("Đã thêm vào giỏ hàng ✔️");
      setTimeout(() => setSuccessMessage(""), 2500);
    } catch (error) {
      const msg =
        error?.response?.status === 401
          ? "Bạn cần đăng nhập để thêm vào giỏ hàng."
          : error?.response?.data?.message || error?.message || "Không thể thêm vào giỏ hàng";
      alert(msg);
    }
  };

  const handleBuyNow = () => {
    // COMBO
    if (product?.isCombo) {
      if (comboStock <= 0) return alert("Combo này đã hết hàng");
      const qty = Math.max(1, Math.min(quantity, comboStock));
      if (qty !== quantity) setQuantity(qty);

      const comboTotal = Number(comboQuote?.total || product?.comboPrice || 0) || 0;

      navigate("/checkout", {
        state: {
          selectedItems: [
            {
              product: { _id: product._id, name: product.name, isCombo: true },
              variant: { price: comboTotal, attributes: {} },
              quantity: qty,
            },
          ],
        },
      });
      return;
    }

    // HÀNG THƯỜNG
    if (!currentVariant) return alert("Vui lòng chọn biến thể trước khi mua");
    if (effectiveStock <= 0) return alert("Sản phẩm này đã hết hàng");

    const qty = Math.max(1, Math.min(quantity, effectiveStock));
    if (qty !== quantity) setQuantity(qty);

    const finalPrice = getFinalVariantPrice(currentVariant);

    navigate("/checkout", {
      state: {
        selectedItems: [
          {
            product: { _id: product._id, name: product.name },
            variant: {
              _id: currentVariant._id,
              price: finalPrice,
              attributes: currentVariant.attributes,
            },
            variantInfo: {
              weight: currentVariant.attributes.weight,
              ripeness: currentVariant.attributes.ripeness,
            },
            quantity: qty,
          },
        ],
      },
    });
  };

  /* =========================
   * Ratings
   * ========================= */
  const averageRating =
    comments.length > 0
      ? comments.reduce((sum, c) => sum + (c.rating || 0), 0) / comments.length
      : 0;

  if (!product) return <p className="loading">Đang tải dữ liệu sản phẩm...</p>;

  const showPreorderWidget = !!product?.preorder?.enabled && allowPreorder;
  const showBuySection = !product?.preorder?.enabled;

  const VietGAPBadge = () => (
    <div className="vietgap-badge" title="Tiêu chuẩn VietGAP">
      <span className="leaf">🌱</span> Chứng nhận VietGAP
    </div>
  );
// src/pages/Product/ProductDetail.jsx  (PART 3/3)
  const OriginSection = () => {
    const raw = product?.origin;

    if (typeof raw === "string" && raw.trim()) {
      const parts = raw.split("|").map((s) => s.trim()).filter(Boolean);
      return (
        <div className="block">
          <h3 className="block-title">Nguồn gốc</h3>
          {parts.length ? (
            <ul className="meta-list">
              {parts.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">{raw}</p>
          )}
        </div>
      );
    }

    const o = raw || {};
    const hasOrigin =
      o.country || o.province || o.farmName || o.certificateNo || o.region || o.area;
    if (!hasOrigin) return null;

    return (
      <div className="block">
        <h3 className="block-title">Nguồn gốc</h3>
        <ul className="meta-list">
          {o.farmName && (
            <li>
              <b>Trang trại:</b> {o.farmName}
            </li>
          )}
          {(o.region || o.province) && (
            <li>
              <b>Khu vực:</b> {o.region || o.province}
            </li>
          )}
          {o.country && (
            <li>
              <b>Quốc gia:</b> {o.country}
            </li>
          )}
          {o.certificateNo && (
            <li>
              <b>Số chứng nhận:</b> {o.certificateNo}
            </li>
          )}
        </ul>
      </div>
    );
  };

  const StorageSection = () => {
    const storageStr = typeof product?.storage === "string" ? product.storage.trim() : "";
    const tipsArr = Array.isArray(product?.storageTips) ? product.storageTips : [];

    if (!storageStr && tipsArr.length === 0) return null;

    if (tipsArr.length > 0) {
      return (
        <div className="block">
          <h3 className="block-title">Cách bảo quản</h3>
          <div className="tips-grid">
            {tipsArr.map((t, i) => (
              <div key={i} className="tip-card">
                <div className="tip-head">
                  <span className="tip-icon" aria-hidden>
                    {t.icon || "🧊"}
                  </span>
                  <div>
                    <div className="tip-title">{t.title || "Bảo quản"}</div>
                    {(t.tempC || t.shelfLifeDays) && (
                      <div className="tip-sub">
                        {t.tempC ? `Nhiệt độ: ${t.tempC}` : ""}
                        {t.tempC && t.shelfLifeDays ? " • " : ""}
                        {t.shelfLifeDays ? `Dùng trong: ${t.shelfLifeDays} ngày` : ""}
                      </div>
                    )}
                  </div>
                </div>
                {Array.isArray(t.instructions) && t.instructions.length > 0 && (
                  <ul className="tip-list">
                    {t.instructions.map((ins, k) => (
                      <li key={k}>• {ins}</li>
                    ))}
                  </ul>
                )}
                {Array.isArray(t.avoid) && t.avoid.length > 0 && (
                  <div className="tip-avoid">
                    <b>Tránh:</b> {t.avoid.join(", ")}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }

    const lines = storageStr
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);

    return (
      <div className="block">
        <h3 className="block-title">Cách bảo quản</h3>
        {lines.length ? (
          <ul className="meta-list">
            {lines.map((line, idx) => (
              <li key={idx}>• {line}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">{storageStr}</p>
        )}
      </div>
    );
  };

  const ComboIncludesInline = () => {
    if (!product?.isCombo) return null;
    const items = Array.isArray(product?.comboItems) ? product.comboItems : [];
    const dc =
      Number.isFinite(Number(product?.comboDiscountPercent)) && Number(product.comboDiscountPercent) > 0
        ? Number(product.comboDiscountPercent)
        : Number(comboQuote?.discountPercent || 0);

    return (
      <div className="combo-includes">
        <div className="combo-includes__title">
          <span className="combo-includes__label">Combo bao gồm</span>
          {dc > 0 && <span className="pill pill-success combo-includes__badge">Giảm {dc}%</span>}
        </div>

        {items.length === 0 ? (
          <p className="muted">Combo chưa có danh sách sản phẩm.</p>
        ) : (
          <ul className="combo-includes__list">
            {items.map((it, idx) => {
              const pid = it?.product?._id || it?.product;
              const name = it?.product?.name || `Sản phẩm ${pid}`;
              const attrs = [
                it?.ripeness ? `${it.ripeness}` : "",
                it?.weight ? `Khối lượng: ${it.weight}` : "",
              ]
                .filter(Boolean)
                .join(" • ");

              return (
                <li key={idx} className="combo-includes__item">
                  <Link className="combo-includes__link" to={`/san-pham/${pid}`}>
                    {name}
                  </Link>
                  {attrs ? <span className="combo-includes__attrs"> — {attrs}</span> : null}
                  {it.qty ? <span className="combo-includes__qty">× {it.qty}</span> : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  };

  /* =========================
   * Render
   * ========================= */
  return (
    <div className={`product-detail ${product?.isCombo ? "product-detail--combo" : ""}`}>
      {successMessage && <div className="toast-success">{successMessage}</div>}

      {/* Card sản phẩm */}
      <div className="product-card">
        <div className="product-gallery">
          <img src={imgSrc(product.image)} alt={product.name} />
        </div>

        <div className="product-info">
          <div className="title-row">
            <h1 className="title">{product.name}</h1>
            {showExpiryUI && <span className="pill pill-danger">Cận hạn -{discountPercent}%</span>}
            {product?.preorder?.enabled && <span className="pill pill-warn">Sắp vào mùa</span>}
            {product?.isCombo && <span className="pill pill-success combo-badge">Combo</span>}
          </div>

          <VietGAPBadge />
          <p className="desc">{product.description}</p>

          {showExpiryUI && (
            <div className="expiry-box">
              <div className="expiry-title">Hạn sử dụng</div>
              <div className="expiry-line">
                Ngày hết hạn: <b>{fmtDate(expiryInfo.expireAt)}</b>{" "}
                {typeof expiryInfo.daysLeft === "number" && expiryInfo.daysLeft >= 0 && (
                  <span>— còn {expiryInfo.daysLeft} ngày</span>
                )}
              </div>
              <div className="expiry-line">
                Giảm giá cận hạn: <b>-{discountPercent}%</b> (đã áp dụng)
              </div>
            </div>
          )}

          {product?.preorder?.enabled && !allowPreorder && (
            <div className="note">
              Sản phẩm <b>sắp vào mùa</b>. Đặt trước tại{" "}
              <Link to="/coming-soon" className="link">
                trang Sắp vào mùa
              </Link>
              .
            </div>
          )}

          {/* Giá */}
          {priceBlock}

          {/* Tồn kho */}
          {!product?.isCombo && currentVariant && (
            <p className={`stock ${effectiveStock > 0 ? "is-available" : "is-oos"}`}>
              Tồn kho: {effectiveStock > 0 ? <><b>{effectiveStock}</b> {unitLabel}</> : "Hết hàng"}
            </p>
          )}
          {product?.isCombo && (
            <>
              <p className={`stock ${comboStock > 0 ? "is-available" : "is-oos"}`}>
                Tồn kho: {comboStock > 0 ? <><b>{comboStock}</b> combo</> : "Hết hàng"}
              </p>
              {comboAvailability?.available === false && comboAvailability?.reason === "insufficient-child-stock" && (
                <p className="stock is-oos">
                  ⚠️ Một số sản phẩm trong combo đã hết hàng
                </p>
              )}
            </>
          )}

          {/* Combo includes */}
          {product?.isCombo && <ComboIncludesInline />}

          {/* Chọn biến thể (chỉ cho hàng thường) */}
          {!product?.isCombo && (
            <>
              {/* Weight */}
              {weightOptions.length > 0 && (
                <div className="variant-group variant-group--weight">
                  <div className="variant-label">Khối lượng / Đơn vị</div>
                  <div className="variant-options">
                    {weightOptions.map((w) => (
                      <button
                        key={w}
                        onClick={() => setSelectedWeight((prev) => (prev === w ? "" : w))}
                        className={`variant-option ${selectedWeight === w ? "active" : ""}`}
                      >
                        {w}
                        {selectedWeight === w && <span className="check">✓</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Ripeness phụ thuộc weight */}
              {selectedWeight && ripenessOptionsForWeight.length > 0 && (
                <div className="variant-group variant-group--ripeness">
                  <div className="variant-label">Tình trạng</div>
                  <div className="variant-options">
                    {ripenessOptionsForWeight.map((r) => (
                      <button
                        key={r}
                        onClick={() =>
                          setSelectedRipeness((prev) => (prev === r ? "" : r))
                        }
                        className={`variant-option ${selectedRipeness === r ? "active" : ""}`}
                      >
                        {r}
                        {selectedRipeness === r && <span className="check">✓</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Preorder widget */}
          {showPreorderWidget && (
            <div className="preorder-wrap">
              <PreorderWidget
                product={{ ...product, id: product?._id || product?.id }}
                onSuccess={() => {}}
                requireLoginHint={true}
              />
            </div>
          )}

          {/* Actions */}
          {showBuySection && (
            <>
              {(!product?.isCombo && currentVariant && effectiveStock > 0) ||
              (product?.isCombo && comboStock > 0 && comboAvailability?.available !== false) ? (
                <>
                  <div className="qty-row">
                    <label>Số lượng</label>
                    <input
                      type="number"
                      value={
                        product?.isCombo
                          ? Math.min(quantity, Math.max(1, comboStock))
                          : Math.min(quantity, Math.max(1, effectiveStock))
                      }
                      min={1}
                      max={product?.isCombo ? Math.max(1, comboStock) : Math.max(1, effectiveStock)}
                      onChange={(e) => {
                        const val = Number(e.target.value || 1);
                        const cap = product?.isCombo ? Math.max(1, comboStock) : Math.max(1, effectiveStock);
                        const clamped = Math.max(1, Math.min(val, cap));
                        setQuantity(clamped);
                      }}
                    />
                  </div>

                  <div className="actions">
                    <button
                      className="btn btn-amber"
                      onClick={addToCartServer}
                      disabled={
                        product?.isCombo
                          ? comboStock <= 0
                          : !currentVariant || effectiveStock <= 0
                      }
                    >
                      Thêm vào giỏ
                    </button>
                    <button
                      className="btn btn-red"
                      onClick={handleBuyNow}
                      disabled={
                        product?.isCombo
                          ? comboStock <= 0
                          : !currentVariant || effectiveStock <= 0
                      }
                    >
                      Mua ngay
                    </button>
                  </div>
                </>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* Nguồn gốc */}
      <OriginSection />

      {/* Cách bảo quản */}
      <StorageSection />

      {/* Gợi ý thay thế */}
      {/* (giữ nguyên như bản trước; không liên quan Mix) */}

      {/* Đánh giá */}
      <div className="block">
        <h3 className="block-title">Đánh giá của khách hàng</h3>
        {comments.length > 0 && (
          <div className="rating-inline">
            {[...Array(5)].map((_, i) => (
              <FaStar
                key={i}
                size={18}
                color={i < Math.round(averageRating) ? "#f5c518" : "#e5e7eb"}
              />
            ))}
            <span className="rating-text">({averageRating.toFixed(1)} / 5)</span>
          </div>
        )}
        {comments.length === 0 ? (
          <p className="muted">Chưa có đánh giá nào.</p>
        ) : (
          <div className="review-list">
            {comments.map((cmt) => (
              <div key={cmt._id} className="review-card">
                <div className="review-head">
                  <div className="avatar">
                    {(cmt.user?.username?.[0] || "?").toUpperCase()}
                  </div>
                  <div className="who">
                    <p className="name">{cmt.user?.username || "Người dùng ẩn danh"} </p>
                    <p className="time">{new Date(cmt.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="stars">
                    {[...Array(5)].map((_, i) => (
                      <FaStar
                        key={i}
                        size={16}
                        color={i < (cmt.rating || 0) ? "#f5c518" : "#e5e7eb"}
                      />
                    ))}
                  </div>
                </div>
                <p className="review-body">{cmt.comment || "Không có nội dung"}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sản phẩm liên quan */}
      <div className="block">
        <h3 className="block-title">Sản phẩm liên quan</h3>
        <div className="related-grid">
          {relatedProducts.map((item) => (
            <div
              key={item._id}
              className="related-card"
              onClick={() => navigate(`/san-pham/${item._id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && navigate(`/san-pham/${item._id}`)}
            >
              <div className="related-thumb">
                <img src={imgSrc(item.image)} alt={item.name} />
              </div>
              <div className="related-info">
                <h4 className="related-title">{item.name}</h4>
                <p className="related-price">
                  {getRelatedDisplayPrice(item).toLocaleString("vi-VN")}đ
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
