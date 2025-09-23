// src/pages/admin/product/Add.jsx  (PART 1/3)
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../../../utils/axiosConfig";

export default function Add() {
  const navigate = useNavigate();

  /* ========== CƠ BẢN ========== */
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [preview, setPreview] = useState(null);

  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);

  // Loại SP: normal | combo
  const [productType, setProductType] = useState("normal");
  const onChangeProductType = (val) => {
    setProductType(val);
    // reset combo khi rời khỏi combo
    if (val !== "combo") {
      setComboItems([]);
      setComboPricingMode("fixed");
      setComboFixedPrice(0);
      setComboDiscountPercent(0);
      setComboStock(0);
    }
  };

  // Origin (chuỗi tương thích BE cũ)
  const [originCountry, setOriginCountry] = useState("");
  const [originProvince, setOriginProvince] = useState("");
  const [originFarmName, setOriginFarmName] = useState("");
  const [originCertNo, setOriginCertNo] = useState("");
  const [storageText, setStorageText] = useState("");

  // Biến thể cơ bản (CHỈ dùng cho normal)
  const weightOptions = ["0.5kg", "1kg", "1.5kg", "2kg"];
  const ripenessOptions = ["Xanh", "Chín vừa", "Chín"];
  const [selectedWeights, setSelectedWeights] = useState([]);
  const [selectedRipeness, setSelectedRipeness] = useState([]);
  const [baseWeight, setBaseWeight] = useState("");

  // Giá theo tình trạng (chỉ hiển thị cho tình trạng đã chọn)
  const [ripenessPrices, setRipenessPrices] = useState({
    Xanh: "",
    "Chín vừa": "",
    Chín: "",
  });

  // Tồn kho lẻ theo 1kg / tình trạng (chỉ hiển thị cho tình trạng đã chọn)
  const [stock1kgBy, setStock1kgBy] = useState({
    Xanh: "",
    "Chín vừa": "",
    Chín: "",
  });

  const [submitting, setSubmitting] = useState(false);

  /* ========== PREORDER / EXPIRY ========== */
  const [enablePreorder, setEnablePreorder] = useState(false);
  const [depositPercent, setDepositPercent] = useState(20);
  const [quota, setQuota] = useState(0);
  const [windowStart, setWindowStart] = useState("");
  const [windowEnd, setWindowEnd] = useState("");
  const [expectedHarvestStart, setExpectedHarvestStart] = useState("");
  const [expectedHarvestEnd, setExpectedHarvestEnd] = useState("");

  const [enableExpiry, setEnableExpiry] = useState(false);
  const [expireDate, setExpireDate] = useState("");
  const [mfgDate, setMfgDate] = useState("");
  const [shelfLifeDays, setShelfLifeDays] = useState("");
  const [nearActive, setNearActive] = useState(false);
  const [thresholdDays, setThresholdDays] = useState(0);
  const [discountPercentNear, setDiscountPercentNear] = useState(0);

  /* ========== PACKAGING (THÙNG) – CHỈ normal ========== */
  // Tạo stockBy ban đầu theo danh sách tình trạng đã chọn
  const makeStockBy = (rList) =>
    (rList || []).reduce((m, r) => ({ ...m, [r]: 0 }), {});

  const [packagingOptions, setPackagingOptions] = useState([]);
  const addPackaging = () =>
    setPackagingOptions((arr) => [
      ...arr,
      {
        type: "box",
        unitLabel: "",
        unitSize: 0,
        price: 0,
        // ✅ chỉ khởi tạo key cho các tình trạng đã chọn
        stockBy: makeStockBy(selectedRipeness),
      },
    ]);
  const removePackaging = (i) =>
    setPackagingOptions((arr) => arr.filter((_, idx) => idx !== i));
  const updatePackaging = (i, k, v) =>
    setPackagingOptions((arr) =>
      arr.map((it, idx) =>
        idx === i
          ? {
              ...it,
              [k]:
                k === "type" || k === "unitLabel"
                  ? v
                  : Number.isFinite(Number(v))
                  ? Number(v)
                  : 0,
            }
          : it
      )
    );
  const updatePackagingStockBy = (i, ripeness, value) =>
    setPackagingOptions((arr) =>
      arr.map((it, idx) =>
        idx === i
          ? {
              ...it,
              stockBy: {
                ...(it.stockBy || {}),
                [ripeness]: Math.max(0, Number(value) || 0),
              },
            }
          : it
      )
    );

  /* ========== COMBO (chọn sản phẩm & định giá & tồn kho) ========== */
  const [allProducts, setAllProducts] = useState([]);
  const [comboSearch, setComboSearch] = useState("");
  // mỗi item: { product, qty, ripeness, weight }
  const [comboItems, setComboItems] = useState([]);

  // tồn kho combo tách riêng (đơn vị combo)
  const [comboStock, setComboStock] = useState(0);

  const removeComboItem = (i) =>
    setComboItems((arr) => arr.filter((_, idx) => idx !== i));

  // KHÓA nhập tay số lượng: số lượng của từng SP = comboStock
  const updateComboQty = () => {}; // no-op

  const updateComboRipeness = (i, r) =>
    setComboItems((arr) =>
      arr.map((it, idx) => {
        if (idx !== i) return it;
        const weights = getWeightOptionsFromProduct(it.product, r);
        const nextWeight = weights.includes(it.weight)
          ? it.weight
          : weights[0] || "";
        return {
          ...it,
          ripeness: r,
          weight: nextWeight,
          qty: Math.max(0, Number(comboStock) || 0), // giữ = comboStock
        };
      })
    );

  const updateComboWeight = (i, w) =>
    setComboItems((arr) =>
      arr.map((it, idx) =>
        idx === i
          ? { ...it, weight: w, qty: Math.max(0, Number(comboStock) || 0) }
          : it
      )
    );

  // Đồng bộ tất cả item.qty = comboStock mỗi khi comboStock đổi
  useEffect(() => {
    setComboItems((arr) =>
      arr.map((it) => ({ ...it, qty: Math.max(0, Number(comboStock) || 0) }))
    );
  }, [comboStock]);

  // Pricing mode: fixed | discount (hiện dùng fixed)
  const [comboPricingMode, setComboPricingMode] = useState("fixed");
  const [comboFixedPrice, setComboFixedPrice] = useState(0);
  const [comboDiscountPercent, setComboDiscountPercent] = useState(0);

  /* ========== HELPERS ========== */
  const weightMultiplier = useMemo(
    () => ({ "0.5kg": 0.5, "1kg": 1, "1.5kg": 1.5, "2kg": 2 }),
    []
  );
  const totalLooseKg = useMemo(() => {
    return (selectedRipeness || []).reduce((sum, r) => {
      const v = Number(stock1kgBy[r]) || 0;
      return sum + Math.max(0, v);
    }, 0);
  }, [selectedRipeness, stock1kgBy]);

  // Lấy danh mục / địa điểm / sản phẩm để build combo
  useEffect(() => {
    (async () => {
      try {
        const [catRes, locRes, prodRes] = await Promise.all([
          axiosInstance.get("/category"),
          axiosInstance.get("/locations"),
          axiosInstance.get("/product", { params: { limit: 500 } }),
        ]);
        setCategories(catRes.data || []);
        setLocations(locRes.data || []);
        const plist = Array.isArray(prodRes.data)
          ? prodRes.data
          : prodRes.data?.products || prodRes.data?.items || [];
        setAllProducts(plist);
      } catch (e) {
        console.error("[AdminAdd] load refs error:", e);
      }
    })();
  }, []);

  useEffect(() => {
    if (enablePreorder && enableExpiry) setEnableExpiry(false);
  }, [enablePreorder, enableExpiry]);

  const toggleWeight = (w) =>
    setSelectedWeights((prev) =>
      prev.includes(w) ? prev.filter((x) => x !== w) : [...prev, w]
    );
  const toggleRipeness = (r) =>
    setSelectedRipeness((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]
    );

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("image", file);
    try {
      const res = await axiosInstance.post("/upload", formData);
      const imagePath = res.data?.imagePath || res.data?.url;
      if (!imagePath) throw new Error("Không nhận được đường dẫn ảnh");
      setImage(imagePath);
      setPreview(
        imagePath.startsWith("http")
          ? imagePath
          : `http://localhost:3000${imagePath}`
      );
    } catch (err) {
      console.error("[AdminAdd] upload error:", err?.response?.data || err);
      alert("Không thể tải ảnh lên.");
    }
  };

  const toISOorNull = (d) => {
    if (!d) return null;
    const dt = new Date(d);
    return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
  };

  const computePriceFor = (ripeness, weight, baseWeightForCalc) => {
    const baseRipenessPrice = Number(ripenessPrices[ripeness]) || 0;
    const baseMul = weightMultiplier[baseWeightForCalc] ?? 1;
    const targetMul = weightMultiplier[weight] ?? 1;
    return Math.round(baseRipenessPrice * (targetMul / baseMul));
  };
  const getDerivedStock = (stock1kg, weight) => {
    const totalKg = Number(stock1kg) || 0;
    const weightKg = weightMultiplier[weight] ?? 1;
    if (weightKg <= 0) return 0;
    return Math.floor(totalKg / weightKg);
  };
  const getStockFor = (ripeness, weight) => {
    const s1 = Number(stock1kgBy[ripeness]) || 0;
    return getDerivedStock(s1, weight);
  };
  const packagingLabel = (p) => {
    const labelFromInput = (p?.unitLabel || "").trim();
    if (labelFromInput) return labelFromInput;
    const size = Number(p?.unitSize || 0);
    return size > 0 ? `Thùng ${size}kg` : "Thùng";
  };
// src/pages/admin/product/Add.jsx  (PART 2/3)
  /* ==== COMBO search + hiển thị ripeness ==== */
  const filteredForCombo = useMemo(() => {
    const kw = comboSearch.trim().toLowerCase();
    const arr = allProducts.filter((p) => !p.isCombo); // bỏ kiểm tra mix
    if (!kw) return arr.slice(0, 30);
    return arr.filter(
      (p) =>
        String(p.name || "").toLowerCase().includes(kw) ||
        String(p._id || "").toLowerCase().includes(kw)
    );
  }, [comboSearch, allProducts]);

  const getRipenessFromProduct = (p) => {
    const s = new Set();
    if (Array.isArray(p?.ripenessOptions)) {
      p.ripenessOptions.forEach((r) => r && s.add(String(r)));
    }
    if (Array.isArray(p?.variants)) {
      p.variants.forEach((v) => {
        const r = v?.attributes?.ripeness;
        if (r != null) s.add(String(r));
      });
    }
    if (s.size === 0) s.add("");
    return Array.from(s);
  };

  // Lấy danh sách weight theo sản phẩm + (tùy) ripeness (GIỮ NGUYÊN)
  const getWeightOptionsFromProduct = (p, r) => {
    const s = new Set();
    if (Array.isArray(p?.variants)) {
      p.variants.forEach((v) => {
        const w = v?.attributes?.weight;
        const vr = v?.attributes?.ripeness;
        if (!w) return;
        if (!r || vr === r) s.add(String(w));
      });
    }
    if (p?.baseVariant?.attributes?.weight) {
      const w = p.baseVariant.attributes.weight;
      const vr = p.baseVariant.attributes.ripeness;
      if (!r || vr === r) s.add(String(w));
    }
    return Array.from(s);
  };

  // Lấy giá đơn vị theo tình trạng & weight đã chọn (nếu có)
  const getUnitPriceForComboItem = (p, r, w) => {
    const v1 = Array.isArray(p?.variants)
      ? p.variants.find(
          (x) => x?.attributes?.ripeness === r && x?.attributes?.weight === w
        )
      : null;
    if (v1?.price != null) return Number(v1.price) || 0;

    const v2 = Array.isArray(p?.variants)
      ? p.variants.find((x) => x?.attributes?.ripeness === r)
      : null;
    if (v2?.price != null) return Number(v2.price) || 0;

    if (
      p?.baseVariant?.attributes?.ripeness === r &&
      p?.baseVariant?.price != null
    ) {
      return Number(p.baseVariant.price) || 0;
    }

    return (
      Number(p?.baseVariant?.price) ||
      Number(p?.price) ||
      Number(p?.variants?.[0]?.price) ||
      0
    );
  };

  /* ==== Tính tồn kho theo (ripeness[, weight]) ==== */
  const getVariantKey = (v) =>
    `${v?.attributes?.weight || ""}__${v?.attributes?.ripeness ?? ""}`;

  const getVariantStockInfo = (p, r, w /* optional */) => {
    const raw = [];
    const seen = new Set();

    if (Array.isArray(p?.variants)) {
      p.variants.forEach((v) => {
        const key = getVariantKey(v);
        if (!seen.has(key)) {
          seen.add(key);
          raw.push(v);
        }
      });
    }
    if (p?.baseVariant?.attributes) {
      const key = getVariantKey(p.baseVariant);
      if (!seen.has(key)) {
        seen.add(key);
        raw.push(p.baseVariant);
      }
    }

    let total = 0;
    const perMap = new Map(); // label(weight) -> stock

    raw.forEach((v) => {
      const vr = v?.attributes?.ripeness ?? "";
      const vw = v?.attributes?.weight || "Mặc định";
      if ((r ?? "") !== (vr ?? "")) return;
      if (w && vw !== w) return;
      const st = Number(v?.stock) || 0;
      total += st;
      perMap.set(vw, (perMap.get(vw) || 0) + st);
    });

    const per = Array.from(perMap, ([label, stock]) => ({ label, stock }));
    return { total, per };
  };

  const comboSubtotal = useMemo(() => {
    return comboItems.reduce((sum, it) => {
      const unit = getUnitPriceForComboItem(it.product, it.ripeness, it.weight);
      return sum + unit * (Number(it?.qty) || 1);
    }, 0);
  }, [comboItems]);

  const comboQuoteTotal =
    comboPricingMode === "fixed"
      ? Math.max(0, Number(comboFixedPrice) || 0)
      : Math.max(
          0,
          Math.round(
            comboSubtotal * (1 - (Number(comboDiscountPercent) || 0) / 100)
          )
        );

  /* ========== FIXED DEDUCT: need = qty = comboStock ========== */
  const fixedDeductBreakdown = useMemo(() => {
    const map = new Map(); // key -> { productId, name, ripeness, weight, need }
    (comboItems || [])
      .filter((it) => it?.product?._id)
      .forEach((it) => {
        const key = `${it.product._id}__${it.ripeness || ""}__${it.weight || ""}`;
        const prev =
          map.get(key) || {
            productId: it.product._id,
            name: it.product.name,
            ripeness: it.ripeness || "",
            weight: it.weight || "",
            need: 0,
          };
        const qty = Math.max(0, Number(it?.qty) || 0);
        prev.need += qty;
        map.set(key, prev);
      });
    return Array.from(map.values());
  }, [comboItems]);

  const fixedNeedMap = useMemo(() => {
    const m = Object.create(null);
    fixedDeductBreakdown.forEach((d) => {
      m[`${d.productId}__${d.ripeness || ""}__${d.weight || ""}`] = d.need;
    });
    return m;
  }, [fixedDeductBreakdown]);

  /* ========== BUILD PAYLOAD ========== */
  const buildPayload = () => {
    // ===== COMBO =====
    if (productType === "combo") {
      const qtyForAll = Math.max(0, Number(comboStock) || 0);
      return {
        name: String(name || "").trim(),
        description: String(description || ""),
        image: String(image || ""),
        category: category || null,
        location: location || null,
        origin: [originCountry, originProvince, originFarmName, originCertNo]
          .map((s) => String(s || "").trim())
          .filter(Boolean)
          .join(" | "),
        storage: String(storageText || "").trim(),

        type: "combo",
        isCombo: true,

        // Pool sản phẩm cố định (để hiển thị/tra cứu)
        comboItems: (comboItems || [])
          .filter((it) => it.product?._id)
          .map((it) => ({
            product: it.product._id,
            qty: qtyForAll, // số lượng mỗi SP = tồn kho combo
            ripeness: it.ripeness || null,
            weight: it.weight || null,
          })),

        // Pricing
        comboPricing: {
          mode: comboPricingMode, // fixed (đang dùng)
          fixedPrice: Number(comboFixedPrice) || 0,
          discountPercent: Number(comboDiscountPercent) || 0,
        },

        // Inventory combo (tồn kho do admin nhập) — TÁCH RIÊNG
        comboInventory: {
          stock: qtyForAll,
          autoDeduct: {
            strategy: "fixed",
            pool: (comboItems || [])
              .filter((it) => it?.product?._id)
              .map((it) => ({
                product: it.product._id,
                ripeness: it.ripeness || null,
                weight: it.weight || null,
                qty: qtyForAll,
              })),
            aggregatedBreakdown: fixedDeductBreakdown.map((d) => ({
              product: d.productId,
              ripeness: d.ripeness || null,
              weight: d.weight || null,
              need: Math.max(0, Number(d.need) || 0),
            })),
          },
        },
      };
    }

    // ===== NORMAL =====
    const firstRipeness = selectedRipeness[0];

    const baseVariant = {
      attributes: { weight: baseWeight || "", ripeness: firstRipeness || "" },
      price: firstRipeness
        ? computePriceFor(firstRipeness, baseWeight, baseWeight)
        : 0,
      stock: firstRipeness ? getStockFor(firstRipeness, baseWeight) : 0,
    };

    const variants = [];

    // HÀNG LẺ (kind="loose")
    for (const w of selectedWeights) {
      for (const r of selectedRipeness) {
        variants.push({
          kind: "loose",
          attributes: { weight: w, ripeness: r },
          price: computePriceFor(r, w, baseWeight),
          stock: getStockFor(r, w),
        });
      }
    }

    // THÙNG (kind="box") — CHỈ TẠO CHO RIPENESS ĐƯỢC BÁN (stockBy[r] > 0)
    const validPacks = (packagingOptions || []).filter(
      (p) => (p.unitLabel || p.unitSize > 0) && Number(p.price) >= 0
    );

    const createdPackLabels = new Set();
    for (const p of validPacks) {
      const label = packagingLabel(p);
      const boxKg = Number(p?.unitSize || 0) || undefined;

      for (const r of selectedRipeness) {
        const stockByR = Number(p?.stockBy?.[r]) || 0;
        if (stockByR <= 0) continue;

        variants.push({
          kind: "box",
          attributes: {
            weight: label,
            ripeness: r,
            boxLabel: label,
            boxWeightKg: boxKg,
          },
          price: Number(p.price) || 0,
          stock: stockByR,
        });

        createdPackLabels.add(label);
      }
    }

    const payload = {
      name: String(name || "").trim(),
      description: String(description || ""),
      image: String(image || ""),
      category: category || null,
      location: location || null,
      origin: [originCountry, originProvince, originFarmName, originCertNo]
        .map((s) => String(s || "").trim())
        .filter(Boolean)
        .join(" | "),
      storage: String(storageText || "").trim(),

      // Chỉ đưa những weight thật sự tồn tại trong variants
      weightOptions: [
        ...new Set([...(selectedWeights || []), ...Array.from(createdPackLabels)]),
      ],
      ripenessOptions: [...selectedRipeness],

      baseVariant,
      variants,
    };

    // Coming soon
    if (enablePreorder) {
      payload.preorder = {
        enabled: true,
        depositPercent: Number(depositPercent) || 0,
        quota: Number(quota) || 0,
        windowStart: toISOorNull(windowStart),
        windowEnd: toISOorNull(windowEnd),
        expectedHarvestStart: toISOorNull(expectedHarvestStart),
        expectedHarvestEnd: toISOorNull(expectedHarvestEnd),
        soldPreorder: 0,
        priceLock: true,
        cancelPolicy: { feePercent: 10 },
      };
    }

    // Expiry
    if (enableExpiry && !enablePreorder) {
      const exp = {};
      if (expireDate) {
        exp.expireDate = toISOorNull(expireDate);
      } else {
        exp.mfgDate = toISOorNull(mfgDate);
        exp.shelfLifeDays = shelfLifeDays === "" ? null : Number(shelfLifeDays) || 0;
      }
      exp.discountNearExpiry = {
        active: !!nearActive,
        thresholdDays: Number(thresholdDays) || 0,
        percent: Number(discountPercentNear) || 0,
      };
      payload.expiry = exp;
    }

    return payload;
  };

  /* ========== SUBMIT ========== */
  const handleSubmit = async (e) => {
    e.preventDefault();

    // ===== VALIDATION THEO LOẠI =====
    if (productType === "combo") {
      if (!comboItems.length || !comboItems.some((x) => x.product?._id)) {
        alert("❌ Combo: Vui lòng thêm ít nhất 1 sản phẩm vào combo.");
        return;
      }
      if (comboPricingMode === "fixed" && Number(comboFixedPrice) <= 0) {
        alert("❌ Combo: Nhập giá cố định hợp lệ (>0).");
        return;
      }
      if (Number(comboStock) < 0) {
        alert("❌ Combo: Tồn kho combo không hợp lệ.");
        return;
      }
      for (const it of comboItems) {
        if (!it?.product?._id) continue;
        if (!it?.ripeness) {
          alert(`❌ Combo: Sản phẩm "${it.product.name}" chưa chọn tình trạng.`);
          return;
        }
        if (!it?.weight) {
          alert(`❌ Combo: Sản phẩm "${it.product.name}" chưa chọn khối lượng.`);
          return;
        }
      }
      const shortages = fixedDeductBreakdown.filter((d) => {
        const p = allProducts.find((x) => x._id === d.productId);
        if (!p) return false;
        const stockVariant = getVariantStockInfo(
          p,
          d.ripeness || "",
          d.weight || ""
        );
        return stockVariant.total < d.need;
      });
      if (shortages.length) {
        const msg =
          "⚠️ Cảnh báo: Một số biến thể không đủ tồn để trừ theo SỐ LƯỢNG.\n" +
          shortages
            .map(
              (s) =>
                `- ${s.name} • ${s.ripeness}${
                  s.weight ? " • " + s.weight : ""
                }: cần ${s.need}`
            )
            .join("\n") +
          "\nBạn vẫn muốn tiếp tục lưu?";
        if (!window.confirm(msg)) return;
      }
    } else {
      // normal
      if (selectedWeights.length === 0 && packagingOptions.length === 0) {
        alert("❌ Vui lòng chọn ít nhất 1 khối lượng hoặc thêm thùng (Packaging).");
        return;
      }
      if (selectedRipeness.length === 0) {
        alert("❌ Vui lòng chọn ít nhất 1 tình trạng.");
        return;
      }
      if (!baseWeight) {
        alert("❌ Vui lòng chọn Khối lượng chuẩn (Base Weight).");
        return;
      }
      for (const r of selectedRipeness) {
        const v = ripenessPrices[r];
        if (v === "" || v === null || Number(v) <= 0) {
          alert(`❌ Vui lòng nhập giá (theo ${baseWeight}) cho tình trạng: ${r}`);
          return;
        }
      }
      for (const r of selectedRipeness) {
        const v1 = stock1kgBy[r];
        if (v1 === "" || v1 === null || Number(v1) < 0) {
          alert(`❌ Vui lòng nhập tồn kho 1kg cho tình trạng: ${r}`);
          return;
        }
      }
      for (const p of packagingOptions) {
        for (const r of selectedRipeness) {
          const v = Number(p?.stockBy?.[r]);
          if (Number.isNaN(v) || v < 0) {
            alert(
              `❌ Packaging "${p.unitLabel || p.unitSize + "kg"}": tồn thùng cho tình trạng "${r}" không hợp lệ.`
            );
            return;
          }
        }
      }
    }

    const payload = buildPayload();

    try {
      setSubmitting(true);
      await axiosInstance.post("/product/add", payload);
      alert("✅ Thêm sản phẩm thành công!");
      window.location.assign("/admin/products");
    } catch (err) {
      console.error("[AdminAdd] /product/add error:", err?.response?.data || err);
      alert(err?.response?.data?.message || "❌ Lỗi khi thêm sản phẩm.");
    } finally {
      setSubmitting(false);
    }
  };

  /* ========== CSS helpers ========== */
  const chipCls = (active) =>
    `AdminAdd__chip px-3 py-1 rounded-full border text-sm ${
      active
        ? "bg-green-100 border-green-500 text-green-700"
        : "bg-white border-gray-300 text-gray-700 hover:border-green-400"
    }`;
  const inputStyle =
    "AdminAdd__input border border-gray-300 rounded-lg px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500";
  const cardCls =
    "AdminAdd__card bg-white rounded-xl border border-gray-200 shadow-sm p-4 md:p-5";
  const sectionTitleCls =
    "AdminAdd__sectionTitle text-lg font-semibold mb-3 flex items-center gap-2";
// src/pages/admin/product/Add.jsx  (PART 3/3)
  /* ========== RENDER ========== */
  return (
    <div className="AdminAdd container max-w-5xl mx-auto py-6 px-4">
      {/* header */}
      <div className="AdminAdd__header flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/admin/products")}
            className="AdminAdd__backBtn inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            <span className="text-lg">←</span>
            <span>Quay về danh sách</span>
          </button>
          <h1 className="AdminAdd__title text-2xl font-bold">Thêm sản phẩm</h1>
        </div>

        <div className="AdminAdd__status text-sm text-gray-500">
          Trạng thái:{" "}
          {enablePreorder ? (
            <span className="text-amber-700 font-medium">Coming Soon</span>
          ) : enableExpiry ? (
            <span className="text-green-700 font-medium">Theo dõi hạn sử dụng</span>
          ) : (
            <span className="text-gray-600">Thông thường</span>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="AdminAdd__form space-y-6">
        {/* Thông tin cơ bản */}
        <section className={`AdminAdd__section AdminAdd__section--basic ${cardCls}`}>
          <h2 className={sectionTitleCls}>🧾 Thông tin cơ bản</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Tên sản phẩm"
              className={inputStyle}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <select
              className={inputStyle}
              value={productType}
              onChange={(e) => onChangeProductType(e.target.value)}
            >
              <option value="normal">Loại: Thông thường</option>
              <option value="combo">Loại: Combo</option>
            </select>
          </div>

          <textarea
            placeholder="Mô tả"
            className={`${inputStyle} mt-3`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            required
          />

          {/* Origin + Storage */}
          <div className="AdminAdd__originStorage grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div className="AdminAdd__origin grid grid-cols-1 gap-2">
              <label className="block text-sm text-gray-600">Nguồn gốc</label>
              <input
                className={inputStyle}
                value={originCountry}
                onChange={(e) => setOriginCountry(e.target.value)}
                placeholder="Quốc gia"
              />
              <input
                className={inputStyle}
                value={originProvince}
                onChange={(e) => setOriginProvince(e.target.value)}
                placeholder="Tỉnh/Thành"
              />
              <input
                className={inputStyle}
                value={originFarmName}
                onChange={(e) => setOriginFarmName(e.target.value)}
                placeholder="Trang trại"
              />
              <input
                className={inputStyle}
                value={originCertNo}
                onChange={(e) => setOriginCertNo(e.target.value)}
                placeholder="Số chứng nhận"
              />
              <p className="text-xs text-gray-500">Sẽ ghép thành 1 chuỗi khi lưu.</p>
            </div>

            <div className="AdminAdd__storage">
              <label className="block text-sm text-gray-600 mb-1">
                Cách bảo quản (mỗi dòng 1 tip)
              </label>
              <textarea
                className={inputStyle}
                rows={6}
                value={storageText}
                onChange={(e) => setStorageText(e.target.value)}
                placeholder={`VD:
Bảo quản mát 5–10°C
Tránh ánh nắng trực tiếp
Không rửa trước khi cất`}
              />
            </div>
          </div>

          <div className="AdminAdd__image grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-start mt-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Ảnh sản phẩm</label>
              <input type="file" accept="image/*" onChange={handleImageUpload} />
              <p className="text-xs text-gray-500 mt-1">.jpg, .png. Tỉ lệ 1:1 hoặc 4:3.</p>
            </div>
            {preview && (
              <img
                src={preview}
                alt="preview"
                className="w-28 h-28 object-cover rounded-lg border mx-auto"
              />
            )}
          </div>

          <div className="AdminAdd__taxonomy grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Danh mục</label>
              <select
                className={inputStyle}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
              >
                <option value="">-- Chọn danh mục --</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Khu vực / Nơi bán
              </label>
              <select
                className={inputStyle}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
              >
                <option value="">-- Chọn địa điểm --</option>
                {locations.map((l) => (
                  <option key={l._id} value={l._id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Biến thể, Giá & Tồn kho – ẨN khi combo */}
        {productType !== "combo" && (
          <section
            className={`AdminAdd__section AdminAdd__section--variants ${cardCls}`}
          >
            <h2 className={sectionTitleCls}>🧬 Biến thể, Giá & Tồn kho</h2>

            <div className="mb-3">
              <h3 className="font-medium text-sm text-gray-700">Chọn khối lượng</h3>
              <div className="flex flex-wrap gap-2 mt-2">
                {weightOptions.map((w) => (
                  <button
                    type="button"
                    key={w}
                    className={chipCls(selectedWeights.includes(w))}
                    onClick={() => toggleWeight(w)}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <h3 className="font-medium text-sm text-gray-700">Chọn tình trạng</h3>
              <div className="flex flex-wrap gap-2 mt-2">
                {ripenessOptions.map((r) => (
                  <button
                    type="button"
                    key={r}
                    className={chipCls(selectedRipeness.includes(r))}
                    onClick={() => toggleRipeness(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Khối lượng chuẩn (Base Weight)
                </label>
                <select
                  className={inputStyle}
                  value={baseWeight}
                  onChange={(e) => setBaseWeight(e.target.value)}
                  required
                >
                  <option value="">-- Chọn --</option>
                  {selectedWeights.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Giá theo tình trạng — CHỈ hiển thị cho các tình trạng đã chọn */}
            <div className="AdminAdd__pricing mt-4 border rounded-lg p-3">
              <div className="font-medium mb-2">
                Giá theo tình trạng (bắt buộc) — cho{" "}
                <u>{baseWeight || "base weight"}</u>
              </div>

              {selectedRipeness.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Chọn tình trạng để nhập giá.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {selectedRipeness.map((r) => (
                    <div key={r}>
                      <label className="block text-sm text-gray-600 mb-1">
                        Giá ({r})
                      </label>
                      <input
                        type="number"
                        min="0"
                        className={inputStyle}
                        value={ripenessPrices[r] ?? ""}
                        onChange={(e) =>
                          setRipenessPrices((prev) => ({
                            ...prev,
                            [r]: e.target.value,
                          }))
                        }
                        placeholder={`Giá cho ${r} tại ${baseWeight || "base"}`}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tồn kho 1kg */}
            <div className="AdminAdd__stock mt-4 border rounded-lg p-3">
              <div className="font-medium mb-2">
                Tồn kho theo từng tình trạng (nhập cho 1kg)
                {totalLooseKg > 0 && (
                  <span className="ml-2 text-xs text-gray-500">
                    • Tổng kg lẻ: <b>{totalLooseKg}</b> kg
                  </span>
                )}
              </div>

              {selectedRipeness.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Chọn tình trạng để nhập tồn kho.
                </p>
              ) : (
                <div className="space-y-3">
                  {selectedRipeness.map((r) => {
                    const s05 = getDerivedStock(stock1kgBy[r] || 0, "0.5kg");
                    const s15 = getDerivedStock(stock1kgBy[r] || 0, "1.5kg");
                    const s20 = getDerivedStock(stock1kgBy[r] || 0, "2kg");
                    return (
                      <div key={r} className="border rounded-lg p-2">
                        <div className="font-semibold mb-2">{r}</div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                          {selectedWeights.includes("0.5kg") && (
                            <div>
                              <label className="block text-sm text-gray-600 mb-1">
                                0.5kg (tự tính)
                              </label>
                              <div className="px-3 py-2 border border-dashed rounded-lg text-gray-700">
                                {s05}
                              </div>
                            </div>
                          )}
                          {selectedWeights.includes("1kg") && (
                            <div>
                              <label className="block text-sm text-gray-600 mb-1">
                                1kg (nhập)
                              </label>
                              <input
                                type="number"
                                min="0"
                                className={inputStyle}
                                value={stock1kgBy[r] ?? ""}
                                onChange={(e) =>
                                  setStock1kgBy((prev) => ({
                                    ...prev,
                                    [r]: e.target.value,
                                  }))
                                }
                                placeholder="VD: 100"
                              />
                            </div>
                          )}
                          {selectedWeights.includes("1.5kg") && (
                            <div>
                              <label className="block text-sm text-gray-600 mb-1">
                                1.5kg (tự tính)
                              </label>
                              <div className="px-3 py-2 border border-dashed rounded-lg text-gray-700">
                                {s15}
                              </div>
                            </div>
                          )}
                          {selectedWeights.includes("2kg") && (
                            <div>
                              <label className="block text-sm text-gray-600 mb-1">
                                2kg (tự tính)
                              </label>
                              <div className="px-3 py-2 border border-dashed rounded-lg text-gray-700">
                                {s20}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {/* THÙNG – ẨN khi combo */}
        {productType !== "combo" && (
          <section
            className={`AdminAdd__section AdminAdd__section--packaging ${cardCls}`}
          >
            <h2 className={sectionTitleCls}>📦 Bán theo thùng (Packaging)</h2>
            {packagingOptions.length === 0 && (
              <p className="text-sm text-gray-500 mb-2">
                Chưa có cấu hình. Nhấn “+ Thêm thùng”.
              </p>
            )}

            <div className="AdminAdd__packList space-y-3">
              {packagingOptions.map((p, i) => (
                <div key={i} className="AdminAdd__packItem border p-3 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Nhãn</label>
                      <input
                        className={inputStyle}
                        value={p.unitLabel}
                        onChange={(e) =>
                          updatePackaging(i, "unitLabel", e.target.value)
                        }
                        placeholder="Thùng 10kg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Kiểu</label>
                      <input
                        className={inputStyle}
                        value={p.type}
                        onChange={(e) => updatePackaging(i, "type", e.target.value)}
                        placeholder="box"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        Size (kg)
                      </label>
                      <input
                        type="number"
                        min="0"
                        className={inputStyle}
                        value={p.unitSize}
                        onChange={(e) =>
                          updatePackaging(i, "unitSize", e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Giá (đ)</label>
                      <input
                        type="number"
                        min="0"
                        className={inputStyle}
                        value={p.price}
                        onChange={(e) => updatePackaging(i, "price", e.target.value)}
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        className="AdminAdd__btn AdminAdd__btn--danger px-3 py-2 rounded-lg border text-red-600 border-red-300 hover:bg-red-50"
                        onClick={() => removePackaging(i)}
                      >
                        Xoá
                      </button>
                    </div>
                  </div>

                  {/* ✅ TỒN KHO THÙNG THEO TÌNH TRẠNG: chỉ hiện theo các tình trạng đã chọn */}
                  {selectedRipeness.length === 0 ? (
                    <div className="mt-3 text-sm text-gray-500">
                      Chọn tình trạng ở phần trên để nhập tồn thùng theo tình trạng.
                    </div>
                  ) : (
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                      {selectedRipeness.map((r) => (
                        <div key={r}>
                          <label className="block text-sm text-gray-600 mb-1">
                            Tồn (thùng) – {r}
                          </label>
                          <input
                            type="number"
                            min="0"
                            className={inputStyle}
                            value={p?.stockBy?.[r] ?? 0}
                            onChange={(e) =>
                              updatePackagingStockBy(i, r, e.target.value)
                            }
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              className="AdminAdd__btn AdminAdd__btn--ghost mt-3 px-4 py-2 rounded-lg border"
              onClick={addPackaging}
            >
              + Thêm thùng
            </button>
          </section>
        )}

        {/* COMBO – chỉ khi productType=combo */}
        {productType === "combo" && (
          <section className={`AdminAdd__section AdminAdd__section--combo ${cardCls}`}>
            <h2 className={sectionTitleCls}>🧺 Combo (chọn sản phẩm + định giá + tồn kho)</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Cách định giá</label>
                <select
                  className={inputStyle}
                  value={comboPricingMode}
                  onChange={(e) => setComboPricingMode(e.target.value)}
                >
                  <option value="fixed">Giá cố định</option>
                </select>
              </div>

              {comboPricingMode === "fixed" ? (
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Giá combo (đ)
                  </label>
                  <input
                    type="number"
                    min="0"
                    className={inputStyle}
                    value={comboFixedPrice}
                    onChange={(e) => setComboFixedPrice(e.target.value)}
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    % giảm trên tổng
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className={inputStyle}
                    value={comboDiscountPercent}
                    onChange={(e) => setComboDiscountPercent(e.target.value)}
                  />
                </div>
              )}

              <div className="md:col-span-3">
                <div className="text-sm text-gray-600 mt-2">
                  Tạm tính tổng SP:{" "}
                  <b>{comboSubtotal.toLocaleString("vi-VN")}đ</b> • Giá combo:{" "}
                  <b>{comboQuoteTotal.toLocaleString("vi-VN")}đ</b>
                </div>
              </div>
            </div>

            {/* Tìm & thêm SP vào combo */}
            <div className="mt-4">
              <label className="block text-sm text-gray-600 mb-1">
                Tìm sản phẩm để thêm vào combo
              </label>
              <input
                className={inputStyle}
                value={comboSearch}
                onChange={(e) => setComboSearch(e.target.value)}
                placeholder="Nhập tên hoặc ID sản phẩm"
              />
              <div className="mt-2 max-h-56 overflow-auto border rounded-lg divide-y">
                {filteredForCombo.map((p) => {
                  const rs = getRipenessFromProduct(p);
                  const defaultRipeness = rs[0] || "";
                  const ws = getWeightOptionsFromProduct(p, defaultRipeness);
                  const defaultWeight = ws[0] || "";
                  return (
                    <button
                      type="button"
                      key={p._id}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50"
                      onClick={() =>
                        setComboItems((arr) => [
                          ...arr,
                          {
                            product: p,
                            qty: Math.max(0, Number(comboStock) || 0), // = comboStock
                            ripeness: defaultRipeness,
                            weight: defaultWeight,
                          },
                        ])
                      }
                    >
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-gray-500">ID: {p._id}</div>
                      {rs.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {rs.map((r) => (
                            <span
                              key={r}
                              className="inline-block text-[11px] px-2 py-[2px] rounded-full border border-gray-300 text-gray-700"
                            >
                              {r || "Không ghi"}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
                {filteredForCombo.length === 0 && (
                  <div className="px-3 py-2 text-sm text-gray-400">
                    Không có kết quả
                  </div>
                )}
              </div>
            </div>

            {/* Danh sách item của combo */}
            <div className="AdminAdd__comboList space-y-3 mt-4">
              {comboItems.length === 0 && (
                <p className="text-sm text-gray-500">
                  Chưa có sản phẩm trong combo.
                </p>
              )}
              {comboItems.map((it, i) => {
                const rs = getRipenessFromProduct(it.product);
                const weights = getWeightOptionsFromProduct(
                  it.product,
                  it.ripeness || ""
                );
                const r = it.ripeness || "";
                const w = it.weight || "";

                const stockRipeness = getVariantStockInfo(it.product, r, null);
                const stockVariant = getVariantStockInfo(it.product, r, w);
                const available = w ? stockVariant.total : stockRipeness.total;
                const needKey = `${it.product?._id}__${r}__${w}`;
                const need = fixedNeedMap[needKey] || Math.max(0, Number(comboStock) || 0);
                const shortage = available - need;

                return (
                  <div
                    key={i}
                    className="AdminAdd__comboItem grid grid-cols-1 md:grid-cols-6 gap-3 items-start border p-3 rounded-lg"
                  >
                    <div className="md:col-span-3">
                      <div className="font-medium">
                        {it.product?.name || "(chưa chọn)"}
                      </div>
                      <div className="text-xs text-gray-500">
                        ID: {it.product?._id}
                      </div>

                      <div className="mt-2 text-xs">
                        <div>
                          Tồn ({r || "Không ghi"}
                          {w ? ` • ${w}` : ""}): <b>{available}</b>
                          {" • "}Dự kiến trừ: <b>{need}</b>{" "}
                          {shortage >= 0 ? (
                            <span className="text-green-600">• Đủ</span>
                          ) : (
                            <span className="text-red-600">
                              • Thiếu {Math.abs(shortage)}
                            </span>
                          )}
                        </div>
                        {stockRipeness.per.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-1">
                            {stockRipeness.per.map((v, idx) => (
                              <span
                                key={idx}
                                className={`inline-block px-2 py-[2px] rounded-full border ${
                                  v.label === w
                                    ? "border-blue-400 text-blue-700"
                                    : "text-gray-700"
                                }`}
                              >
                                {v.label}: {v.stock}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        Tình trạng
                      </label>
                      <select
                        className={inputStyle}
                        value={it.ripeness || ""}
                        onChange={(e) => updateComboRipeness(i, e.target.value)}
                      >
                        {rs.length === 0 && (
                          <option value="">(Không có dữ liệu)</option>
                        )}
                        {rs.map((rVal) => (
                          <option key={rVal} value={rVal}>
                            {rVal || "Không ghi"}
                          </option>
                        ))}
                      </select>

                      <label className="block text-sm text-gray-600 mb-1 mt-2">
                        Khối lượng
                      </label>
                      <select
                        className={inputStyle}
                        value={it.weight || ""}
                        onChange={(e) => updateComboWeight(i, e.target.value)}
                      >
                        {weights.length === 0 && (
                          <option value="">(Không có dữ liệu)</option>
                        )}
                        {weights.map((wVal) => (
                          <option key={wVal} value={wVal}>
                            {wVal}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        Số lượng ( = Tồn kho Combo )
                      </label>
                      <input
                        type="number"
                        className={`${inputStyle} bg-gray-50`}
                        value={Math.max(0, Number(comboStock) || 0)}
                        disabled
                        readOnly
                      />
                      <p className="text-[11px] text-gray-500 mt-1">
                        * Tự đồng bộ = <b>Tồn kho Combo</b> (need = qty = comboStock).
                      </p>
                    </div>

                    <div className="md:col-span-1 flex items-end">
                      <button
                        type="button"
                        className="AdminAdd__btn AdminAdd__btn--danger px-3 py-2 rounded-lg border text-red-600 border-red-300 hover:bg-red-50 h-[42px] mt-auto"
                        onClick={() => removeComboItem(i)}
                      >
                        Xoá
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Tồn kho combo */}
            <div className="mt-5 border rounded-lg p-3">
              <h3 className="font-semibold mb-2">📦 Tồn kho Combo (tách riêng)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Tồn hiện có (đơn vị combo)
                  </label>
                  <input
                    type="number"
                    min="0"
                    className={inputStyle}
                    value={comboStock}
                    onChange={(e) => setComboStock(e.target.value)}
                    placeholder="VD: 10"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    * Đây là tồn của <b>chính combo</b>, độc lập với tồn của các sản phẩm con.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* COMING SOON */}
        <section className={`AdminAdd__section AdminAdd__section--preorder ${cardCls}`}>
          <h2 className={sectionTitleCls}>⚡ Sản phẩm Sắp vào mùa</h2>
          <label className="flex items-center gap-2 mb-3">
            <input
              type="checkbox"
              checked={enablePreorder}
              onChange={(e) => setEnablePreorder(e.target.checked)}
            />
            <span>Bật chế độ đặt trước (Coming Soon)</span>
          </label>

          {enablePreorder && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Phần trăm cọc (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className={inputStyle}
                    value={depositPercent}
                    onChange={(e) => setDepositPercent(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Số lượng tối đa
                  </label>
                  <input
                    type="number"
                    min="0"
                    className={inputStyle}
                    value={quota}
                    onChange={(e) => setQuota(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Thời gian mở đặt trước
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="date"
                    className={inputStyle}
                    value={windowStart}
                    onChange={(e) => setWindowStart(e.target.value)}
                  />
                  <input
                    type="date"
                    className={inputStyle}
                    value={windowEnd}
                    onChange={(e) => setWindowEnd(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Dự kiến mùa vụ (thời gian giao)
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="date"
                    className={inputStyle}
                    value={expectedHarvestStart}
                    onChange={(e) => setExpectedHarvestStart(e.target.value)}
                  />
                  <input
                    type="date"
                    className={inputStyle}
                    value={expectedHarvestEnd}
                    onChange={(e) => setExpectedHarvestEnd(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </section>

        {/* EXPIRY */}
        <section className={`AdminAdd__section AdminAdd__section--expiry ${cardCls}`}>
          <h2 className={sectionTitleCls}>🍏 Hạn sử dụng & Giảm giá cận hạn</h2>
          <label className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              checked={enableExpiry}
              onChange={(e) => setEnableExpiry(e.target.checked)}
              disabled={!!enablePreorder}
              title={
                enablePreorder
                  ? "Đang bật Coming Soon - không thể theo dõi HSD"
                  : ""
              }
            />
            <span>Theo dõi HSD / Giảm giá cận hạn</span>
            {enablePreorder && (
              <span className="text-xs text-red-600 ml-2">
                (Đang bật Coming Soon)
              </span>
            )}
          </label>

          {enableExpiry && !enablePreorder && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Ngày hết hạn
                  </label>
                  <input
                    type="date"
                    className={inputStyle}
                    value={expireDate}
                    onChange={(e) => setExpireDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Ngày nhập kho
                  </label>
                  <input
                    type="date"
                    className={inputStyle}
                    value={mfgDate}
                    onChange={(e) => setMfgDate(e.target.value)}
                    disabled={!!expireDate}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Số ngày sử dụng
                  </label>
                  <input
                    type="number"
                    min="0"
                    className={inputStyle}
                    value={shelfLifeDays}
                    onChange={(e) => setShelfLifeDays(e.target.value)}
                    disabled={!!expireDate}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={nearActive}
                    onChange={(e) => setNearActive(e.target.checked)}
                  />
                  <span>Kích hoạt giảm giá cận hạn</span>
                </label>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Ngưỡng cận hạn (ngày)
                  </label>
                  <input
                    type="number"
                    min="0"
                    className={inputStyle}
                    value={thresholdDays}
                    onChange={(e) => setThresholdDays(e.target.value)}
                    disabled={!nearActive}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    % giảm khi cận hạn
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className={inputStyle}
                    value={discountPercentNear}
                    onChange={(e) => setDiscountPercentNear(e.target.value)}
                    disabled={!nearActive}
                  />
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ACTIONS */}
        <div className="AdminAdd__footer flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/admin/products")}
            className="AdminAdd__btn AdminAdd__btn--ghost w-full md:w-auto px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Hủy & quay về danh sách
          </button>
          <button
            type="submit"
            className="AdminAdd__btn AdminAdd__btn--primary w-full md:w-auto bg-blue-600 text-white font-semibold py-2 px-5 rounded-lg hover:bg-blue-700 disabled:opacity-60"
            disabled={submitting}
          >
            {submitting ? "Đang thêm..." : "Thêm sản phẩm"}
          </button>
        </div>
      </form>
    </div>
  );
}
