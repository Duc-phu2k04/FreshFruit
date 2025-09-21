// src/pages/admin/product/Edit.jsx
import { useState, useEffect, useMemo } from "react";
import axiosInstance from "../../../utils/axiosConfig";
import { useNavigate, useParams } from "react-router-dom";

export default function EditProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();

  // --- Cơ bản ---
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [imagePreview, setImagePreview] = useState("");

  // Base variant (giữ để không phá luồng cũ)
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");

  // Biến thể hiện có
  const [variants, setVariants] = useState([]);

  // Options & baseVariant attributes
  const [weightOptions, setWeightOptions] = useState([]);     // ví dụ ["0.5kg","1kg"]
  const [ripenessOptions, setRipenessOptions] = useState([]); // ví dụ ["Chín","Xanh","Chín vừa"]
  const [baseWeight, setBaseWeight] = useState("");
  const [baseRipeness, setBaseRipeness] = useState("");

  // --- Coming Soon / Preorder ---
  const [enablePreorder, setEnablePreorder] = useState(false);
  const [depositPercent, setDepositPercent] = useState(20);
  const [quota, setQuota] = useState(0);
  const [windowStart, setWindowStart] = useState("");
  const [windowEnd, setWindowEnd] = useState("");
  const [expectedHarvestStart, setExpectedHarvestStart] = useState("");
  const [expectedHarvestEnd, setExpectedHarvestEnd] = useState("");

  // --- Expiry ---
  const [enableExpiry, setEnableExpiry] = useState(false);
  const [expireDate, setExpireDate] = useState("");       // YYYY-MM-DD
  const [mfgDate, setMfgDate] = useState("");             // YYYY-MM-DD
  const [shelfLifeDays, setShelfLifeDays] = useState(""); // number
  const [nearActive, setNearActive] = useState(false);
  const [thresholdDays, setThresholdDays] = useState(0);
  const [discountPercentNear, setDiscountPercentNear] = useState(0);

  // --- Bán theo THÙNG (Packaging) — tồn kho theo TỪNG TÌNH TRẠNG ---
  const [packagingOptions, setPackagingOptions] = useState([
    // { type: "box", unitLabel: "Thùng 10kg", unitSize: 10, price: 450000, stockBy: { "Xanh": 0, "Chín vừa": 0, "Chín": 0 } }
  ]);

  const addPackaging = () =>
    setPackagingOptions((arr) => [
      ...arr,
      { type: "box", unitLabel: "", unitSize: 0, price: 0, stockBy: {} },
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
                  : v,
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

  // --- Combo (tách loại sản phẩm) ---
  const [isCombo, setIsCombo] = useState(false);
  const [comboItems, setComboItems] = useState([]);
  const [comboDiscountPercent, setComboDiscountPercent] = useState(0);
  const addComboItem = () => setComboItems((arr) => [...arr, { product: "", qty: 1 }]);
  const removeComboItem = (i) =>
    setComboItems((arr) => arr.filter((_, idx) => idx !== i));
  const updateComboItem = (i, k, v) =>
    setComboItems((arr) =>
      arr.map((it, idx) =>
        idx === i ? { ...it, [k]: k === "product" ? v : Number(v) || 1 } : it
      )
    );

  // --- Một số tuỳ chọn khác (giữ nguyên) ---
  const [isMixBuilder, setIsMixBuilder] = useState(false);
  const [mixRules, setMixRules] = useState({});
  const [alternatives, setAlternatives] = useState([]);
  const [certifications, setCertifications] = useState([]);
  const [origin, setOrigin] = useState({});
  const [storageTips, setStorageTips] = useState([]);

  // ====== Helpers chung ======
  const toISOorNull = (d) => (d ? new Date(d).toISOString() : null);
  const isoToDateInput = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");
  const normalizeImg = (p) =>
    p?.startsWith("http") ? p : p ? `http://localhost:3000${p}` : "";

  // Nhận dạng nhãn "thùng"
  const isPackagingWeight = (label = "") =>
    /(Thùng|Hộp|Box)\s*\d*(?:[\.,]\d+)?\s*kg/i.test(label || "");

  // ====== TỒN KHO DẠNG 1KG/ RIPENESS (mới) ======
  const weightMultiplier = useMemo(
    () => ({ "0.5kg": 0.5, "1kg": 1, "1.5kg": 1.5, "2kg": 2 }),
    []
  );

  const [stock1kgBy, setStock1kgBy] = useState({}); // string bind input

  const totalLooseKg = useMemo(() => {
    return (ripenessOptions || []).reduce((sum, r) => {
      const v = Number(stock1kgBy[r]) || 0;
      return sum + Math.max(0, v);
    }, 0);
  }, [ripenessOptions, stock1kgBy]);

  const initStock1kgFromVariants = (vs = [], rOpts = [], wMul = {}) => {
    const next = {};
    (rOpts || []).forEach((r) => {
      let totalKg = 0;
      vs
        .filter(
          (v) =>
            !isPackagingWeight(v?.attributes?.weight) &&
            (v?.attributes?.ripeness || "") === r &&
            wMul[v?.attributes?.weight]
        )
        .forEach((v) => {
          const w = v?.attributes?.weight;
          const mul = wMul[w] || 0;
          totalKg += (Number(v?.stock) || 0) * mul;
        });
      next[r] = String(Math.max(0, Math.floor(totalKg)));
    });
    return next;
  };

  const parsePackagingFromVariants = (vs = [], rOpts = []) => {
    const map = new Map(); // key: label
    vs.forEach((v) => {
      const label = v?.attributes?.weight || "";
      const ripeness = v?.attributes?.ripeness || "";
      const m = label.match(/(Thùng|Hộp|Box)\s*(\d+(?:[\.,]\d+)?)\s*kg/i);
      if (!m) return;
      const unitSize = Number(String(m[2]).replace(",", ".")) || 0;
      const key = label.trim();
      if (!map.has(key)) {
        map.set(key, {
          type: "box",
          unitLabel: key,
          unitSize,
          price: Number(v.price) || 0,
          stockBy: {},
        });
      }
      const it = map.get(key);
      if (!Number.isFinite(Number(it.price)) || it.price <= 0) {
        it.price = Number(v.price) || 0;
      }
      const prev = Number(it.stockBy?.[ripeness]) || 0;
      it.stockBy[ripeness] = prev + (Number(v.stock) || 0);
    });

    const arr = Array.from(map.values()).map((p) => {
      const stockByFilled = {};
      (rOpts || []).forEach((r) => {
        stockByFilled[r] = Number(p.stockBy?.[r]) || 0;
      });
      return { ...p, stockBy: stockByFilled };
    });
    return arr;
  };

  useEffect(() => {
    if (enablePreorder && enableExpiry) setEnableExpiry(false);
  }, [enablePreorder, enableExpiry]);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await axiosInstance.get(`/product/${id}`);
        const data = res.data || {};

        setName(data.name || "");
        setDescription(data.description || "");
        setImage(data.image || "");
        setImagePreview(normalizeImg(data.image));
        setCategory(data.category?._id || data.category || "");
        setLocation(data.location?._id || data.location || "");

        setPrice(data.baseVariant?.price ?? "");
        setStock(data.baseVariant?.stock ?? "");
        const vs = Array.isArray(data.variants) ? data.variants : [];
        setVariants(vs);

        const wOpts = Array.isArray(data.weightOptions) ? data.weightOptions : [];
        const rOpts = Array.isArray(data.ripenessOptions) ? data.ripenessOptions : [];
        setWeightOptions(wOpts);
        setRipenessOptions(rOpts);
        setBaseWeight(data.baseVariant?.attributes?.weight || "");
        setBaseRipeness(data.baseVariant?.attributes?.ripeness || "");

        const p = data.preorder || {};
        setEnablePreorder(!!p.enabled);
        setDepositPercent(typeof p.depositPercent === "number" ? p.depositPercent : 20);
        setQuota(typeof p.quota === "number" ? p.quota : 0);
        setWindowStart(isoToDateInput(p.windowStart));
        setWindowEnd(isoToDateInput(p.windowEnd));
        setExpectedHarvestStart(isoToDateInput(p.expectedHarvestStart));
        setExpectedHarvestEnd(isoToDateInput(p.expectedHarvestEnd));

        const e = data.expiry || {};
        const hasAnyExpiry =
          e.expireDate || e.mfgDate || Number.isFinite(Number(e.shelfLifeDays)) || e.discountNearExpiry;
        setEnableExpiry(!!hasAnyExpiry);
        setExpireDate(isoToDateInput(e.expireDate));
        setMfgDate(isoToDateInput(e.mfgDate));
        setShelfLifeDays(
          e.shelfLifeDays == null || Number.isNaN(Number(e.shelfLifeDays)) ? "" : String(e.shelfLifeDays)
        );
        const dne = e.discountNearExpiry || {};
        setNearActive(!!dne.active);
        setThresholdDays(Number.isFinite(Number(dne.thresholdDays)) ? Number(dne.thresholdDays) : 0);
        setDiscountPercentNear(Number.isFinite(Number(dne.percent)) ? Number(dne.percent) : 0);

        // >>> Khởi tạo tồn kho 1kg theo từng ripeness từ variants hiện có
        setStock1kgBy(initStock1kgFromVariants(vs, rOpts, weightMultiplier));

        // Packaging
        const pkgRaw = Array.isArray(data.packagingOptions) ? data.packagingOptions : [];
        const hasStockBy = pkgRaw.some((p0) => p0 && typeof p0.stockBy === "object");
        let pkg = [];
        if (hasStockBy) {
          pkg = pkgRaw.map((p0) => {
            const stockByFilled = {};
            (rOpts || []).forEach((r) => {
              stockByFilled[r] = Number(p0?.stockBy?.[r]) || 0;
            });
            return {
              type: p0.type || "box",
              unitLabel: p0.unitLabel || (p0.unitSize ? `Thùng ${p0.unitSize}kg` : "Thùng"),
              unitSize: Number(p0.unitSize) || 0,
              price: Number(p0.price) || 0,
              stockBy: stockByFilled,
            };
          });
        } else {
          pkg = parsePackagingFromVariants(vs, rOpts);
        }
        setPackagingOptions(pkg);
      } catch (err) {
        console.error("Lỗi khi lấy sản phẩm:", err);
        alert("Không tải được dữ liệu sản phẩm.");
      }
    };

    fetchProduct();
  }, [id, weightMultiplier]);

  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const [catRes, locRes] = await Promise.all([
          axiosInstance.get("/category"),
          axiosInstance.get("/locations"),
        ]);
        setCategories(catRes.data || []);
        setLocations(locRes.data || []);
      } catch (err) {
        console.error("Lỗi khi lấy danh mục/địa điểm:", err);
      }
    };
    fetchMeta();
  }, []);

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("image", file);
    try {
      const res = await axiosInstance.post("/upload", formData);
      const path = res.data?.imagePath || res.data?.url || "";
      if (!path) throw new Error("Không nhận được đường dẫn ảnh");
      setImage(path);
      setImagePreview(normalizeImg(path));
    } catch (err) {
      console.error("Lỗi upload ảnh:", err);
      alert("Upload ảnh thất bại.");
    }
  };

  // ===== Helpers cho Packaging như biến thể =====
  const packagingLabel = (p) => {
    const labelFromInput = (p?.unitLabel || "").trim();
    if (labelFromInput) return labelFromInput;
    const size = Number(p?.unitSize || 0);
    return size > 0 ? `Thùng ${size}kg` : "Thùng";
  };

  const suggestedBoxesFor = (pack) => {
    const size = Number(pack?.unitSize || 0);
    if (!(size > 0)) return 0;
    return Math.floor(Math.max(0, totalLooseKg) / size);
  };

  // ❗ Cập nhật variants: xoá các biến thể có weight là nhãn thùng đang cấu hình,
  // rồi thêm lại các biến thể THÙNG MỚI **chỉ cho ripeness có stock > 0**.
  const applyPackagingToVariants = (currentVariants, packs, rOpts) => {
    const labels = new Set((packs || []).map((p) => String(packagingLabel(p))));
    const remained = (currentVariants || []).filter(
      (v) => !labels.has(String(v?.attributes?.weight || ""))
    );

    const addeds = [];
    for (const p of packs || []) {
      const label = packagingLabel(p);
      const boxKg = Number(p?.unitSize || 0) || undefined;

      for (const r of (rOpts && rOpts.length ? rOpts : [""])) {
        const qty = Number(p?.stockBy?.[r]) || 0;
        if (qty <= 0) continue; // <<< tạo biến thể thùng CHỈ khi tồn > 0

        addeds.push({
          kind: "box",
          attributes: {
            weight: label,
            ripeness: r,
            boxLabel: label,
            boxWeightKg: boxKg,
          },
          price: Number(p.price) || 0,
          stock: qty,
        });
      }
    }
    return [...remained, ...addeds];
  };

  // ====== Tồn kho hàng lẻ ======
  const getDerivedStock = (totalKg, weightLabel) => {
    const k = weightMultiplier[weightLabel] ?? 0;
    if (!(k > 0)) return 0;
    const v = Math.floor((Number(totalKg) || 0) / k);
    return v < 0 ? 0 : v;
  };

  const findVariant = (vs, w, r) =>
    (vs || []).find(
      (x) =>
        (x?.attributes?.weight || "") === w && (x?.attributes?.ripeness || "") === r
    );

  const estimatePriceFor = (w) => {
    const baseMul = weightMultiplier[baseWeight] || 1;
    const targetMul = weightMultiplier[w] || 1;
    const basePrice = Number(price) || 0;
    return Math.round(basePrice * (targetMul / baseMul));
  };

  const buildLooseVariants = (currentVariants, wOpts, rOpts) => {
    const nonPackWeights = (wOpts || []).filter((w) => weightMultiplier[w]);
    const list = [];

    for (const r of rOpts || []) {
      const totalKg = Number(stock1kgBy[r]) || 0;
      for (const w of nonPackWeights) {
        const old = findVariant(currentVariants, w, r);
        const newStock = getDerivedStock(totalKg, w);
        list.push({
          kind: "loose",
          attributes: { weight: w, ripeness: r },
          price: Number(old?.price ?? estimatePriceFor(w)) || 0,
          stock: newStock,
        });
      }
    }
    return list;
  };

  // Submit cập nhật sản phẩm
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate nhanh
    if ((weightOptions?.length ?? 0) && !baseWeight) {
      return alert("Vui lòng chọn Base Weight.");
    }
    if ((ripenessOptions?.length ?? 0) && !baseRipeness) {
      return alert("Vui lòng chọn Base Ripeness.");
    }
    if (isCombo && !(comboItems || []).some((x) => x?.product)) {
      return alert("Combo đang bật. Vui lòng thêm ít nhất 1 sản phẩm.");
    }
    for (const r of ripenessOptions || []) {
      const v = stock1kgBy[r];
      if (v === "" || v == null || Number(v) < 0) {
        return alert(`Vui lòng nhập tồn kho 1kg (tổng kg) cho tình trạng: ${r}`);
      }
    }
    for (const p of packagingOptions || []) {
      for (const r of ripenessOptions || []) {
        const v = Number(p?.stockBy?.[r]);
        if (Number.isNaN(v) || v < 0) {
          return alert(
            `Packaging "${p.unitLabel || p.unitSize + "kg"}": tồn thùng cho tình trạng "${r}" không hợp lệ.`
          );
        }
      }
    }

    try {
      // 1) Upsert PACKAGING variants (theo stockBy, chỉ tạo khi >0)
      const withPackaging = applyPackagingToVariants(
        variants,
        packagingOptions,
        ripenessOptions
      );

      // 2) Rebuild HÀNG LẺ theo tồn kho 1kg
      const looseVariants = buildLooseVariants(
        withPackaging,
        weightOptions,
        ripenessOptions
      );

      // 3) Giữ lại các biến thể khác không thuộc hàng lẻ & không phải thùng (nếu có)
      const packLabels = new Set(
        (packagingOptions || []).map((p) => String(packagingLabel(p)))
      );
      const keepOthers = (withPackaging || []).filter(
        (v) =>
          !weightMultiplier[v?.attributes?.weight] &&
          !packLabels.has(String(v?.attributes?.weight || ""))
      );

      // 4) Ghép tất cả
      const nextVariants = [...keepOthers, ...looseVariants].filter(Boolean);

      // Weight options hiển thị:
      // chỉ cộng nhãn thùng nếu thực sự được tạo (ít nhất 1 ripeness có stock > 0)
      const createdPackLabels = new Set();
      for (const p of packagingOptions || []) {
        const label = String(packagingLabel(p));
        const anyStock =
          (ripenessOptions || []).some((r) => (Number(p?.stockBy?.[r]) || 0) > 0);
        if (anyStock) createdPackLabels.add(label);
      }

      const weightOptionsFinal = Array.from(
        new Set([...(weightOptions || []), ...Array.from(createdPackLabels)])
      );

      const payload = {
        name,
        description,
        image,
        category,
        location,

        baseVariant: {
          attributes: { weight: baseWeight || "", ripeness: baseRipeness || "" },
          price: Number(price) || 0,
          stock: Number(stock) || 0,
        },

        weightOptions: weightOptionsFinal,
        ripenessOptions: Array.isArray(ripenessOptions) ? ripenessOptions : [],

        variants: nextVariants,

        preorder: enablePreorder
          ? {
              enabled: true,
              depositPercent: Number(depositPercent) || 0,
              quota: Number(quota) || 0,
              windowStart: toISOorNull(windowStart),
              windowEnd: toISOorNull(windowEnd),
              expectedHarvestStart: toISOorNull(expectedHarvestStart),
              expectedHarvestEnd: toISOorNull(expectedHarvestEnd),
              priceLock: true,
            }
          : { enabled: false },

        expiry:
          enableExpiry && !enablePreorder
            ? {
                ...(expireDate
                  ? { expireDate: toISOorNull(expireDate) }
                  : {
                      ...(mfgDate ? { mfgDate: toISOorNull(mfgDate) } : {}),
                      ...(shelfLifeDays !== ""
                        ? { shelfLifeDays: Number(shelfLifeDays) || 0 }
                        : {}),
                    }),
                discountNearExpiry: {
                  active: !!nearActive,
                  thresholdDays: Number(thresholdDays) || 0,
                  percent: Number(discountPercentNear) || 0,
                },
              }
            : {},

        // Lưu lại cấu hình thùng (THEO stockBy)
        packagingOptions: (packagingOptions || []).map((p) => {
          const stockByFilled = {};
          (ripenessOptions || []).forEach((r) => {
            stockByFilled[r] = Number(p?.stockBy?.[r]) || 0;
          });
          return {
            type: p.type || "box",
            unitLabel: packagingLabel(p),
            unitSize: Number(p.unitSize) || 0,
            price: Number(p.price) || 0,
            stockBy: stockByFilled,
          };
        }),

        // Combo
        isCombo: !!isCombo,
        comboItems: (comboItems || [])
          .filter((it) => it.product)
          .map((it) => ({ product: it.product, qty: Number(it.qty) || 1 })),
        comboDiscountPercent: Number(comboDiscountPercent) || 0,

        // Mix & các field khác
        isMixBuilder: !!isMixBuilder,
        mixRules,
        alternatives,
        certifications,
        origin,
        storageTips,
      };

      await axiosInstance.put(`/product/${id}`, payload);
      alert("Cập nhật sản phẩm thành công!");
      navigate("/admin/products");
    } catch (err) {
      console.error("Lỗi cập nhật sản phẩm:", err?.response?.data || err);
      alert(err?.response?.data?.message || "Cập nhật thất bại!");
    }
  };

  // ===== UI =====
  const inputCls = "w-full border px-3 py-2 rounded";
  const sectionTitleCls = "text-lg font-semibold mt-6 mb-2";
  const chipCls = (active) =>
    `px-3 py-1 rounded-full border text-sm ${
      active
        ? "bg-green-100 border-green-500 text-green-700"
        : "bg-white border-gray-300 text-gray-700 hover:border-green-400"
    }`;

  const toggleInArray = (arr, val) =>
    arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];

  const defaultWeightChoices = ["0.5kg", "1kg", "1.5kg", "2kg"];
  const defaultRipenessChoices = ["Chín", "Xanh", "Chín vừa"];

  const show05 = weightOptions.includes("0.5kg");
  const show10 = weightOptions.includes("1kg");
  const show15 = weightOptions.includes("1.5kg");
  const show20 = weightOptions.includes("2kg");

  return (
    <div className="max-w-3xl mx-auto mt-6 bg-white shadow p-6 rounded">
      <h2 className="text-2xl font-bold mb-4">Cập nhật sản phẩm</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Thông tin cơ bản */}
        <div>
          <label className="block font-medium">Tên sản phẩm</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
        </div>

        <div>
          <label className="block font-medium">Mô tả</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} required className={inputCls} rows={4} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-medium">Giá base (VNĐ)</label>
            <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} required className={inputCls} />
          </div>
          <div>
            <label className="block font-medium">Tồn kho base</label>
            <input type="number" value={stock} onChange={(e) => setStock(e.target.value)} required className={inputCls} />
          </div>
        </div>

        {/* Options hiện hữu + chọn base attributes */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-medium">Base Weight</label>
            <select className={inputCls} value={baseWeight} onChange={(e) => setBaseWeight(e.target.value)}>
              <option value="">-- Chọn --</option>
              {weightOptions.map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
            <div className="flex flex-wrap gap-2 mt-2">
              {defaultWeightChoices.map((w) => (
                <button
                  key={w}
                  type="button"
                  className={chipCls(weightOptions.includes(w))}
                  onClick={() => setWeightOptions((prev) => toggleInArray(prev, w))}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block font-medium">Base Ripeness</label>
            <select className={inputCls} value={baseRipeness} onChange={(e) => setBaseRipeness(e.target.value)}>
              <option value="">-- Chọn --</option>
              {ripenessOptions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <div className="flex flex-wrap gap-2 mt-2">
              {defaultRipenessChoices.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={chipCls(ripenessOptions.includes(r))}
                  onClick={() => setRipenessOptions((prev) => toggleInArray(prev, r))}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Ảnh */}
        <div>
          <label className="block font-medium">Ảnh sản phẩm</label>
          <input type="file" accept="image/*" onChange={handleImageChange} />
          {imagePreview && (
            <img src={imagePreview} alt="Preview" className="mt-2 w-32 h-32 object-cover border rounded" />
          )}
        </div>

        {/* Danh mục & Địa điểm */}
        <div>
          <label className="block font-medium">Danh mục</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} required className={inputCls}>
            <option value="">-- Chọn danh mục --</option>
            {categories.map((cat) => (
              <option key={cat._id} value={cat._id}>{cat.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-medium">Địa điểm</label>
          <select value={location} onChange={(e) => setLocation(e.target.value)} required className={inputCls}>
            <option value="">-- Chọn địa điểm --</option>
            {locations.map((loc) => (
              <option key={loc._id} value={loc._id}>{loc.name}</option>
            ))}
          </select>
        </div>

        {/* ====== TỒN KHO — CHỈ NHẬP 1KG ====== */}
        <h3 className={sectionTitleCls}>📦 Tồn kho (nhập 1kg theo từng tình trạng)</h3>
        <p className="text-sm text-gray-600 -mt-1">
          Nhập <b>số lượng 1kg</b> cho mỗi tình trạng. Hệ thống sẽ tự tính tồn cho 0.5/1.5/2kg theo công thức
          <code className="ml-1 px-1 rounded bg-gray-100">floor(tổng_kg / weightKg)</code>.
          {totalLooseKg > 0 && (
            <span className="ml-2">Tổng kg lẻ hiện có: <b>{totalLooseKg}</b> kg</span>
          )}
        </p>

        {ripenessOptions.length === 0 ? (
          <p className="text-sm text-gray-500">Chưa có tình trạng nào. Thêm ở phần "Base Ripeness" / tùy chọn tình trạng.</p>
        ) : (
          <div className="space-y-3">
            {ripenessOptions.map((r) => {
              const totalKg = Number(stock1kgBy[r]) || 0;
              const s05 = show05 ? getDerivedStock(totalKg, "0.5kg") : null;
              const s15 = show15 ? getDerivedStock(totalKg, "1.5kg") : null;
              const s20 = show20 ? getDerivedStock(totalKg, "2kg") : null;

              return (
                <div key={r} className="border rounded-lg p-3">
                  <div className="font-semibold mb-2">{r}</div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    {show05 && (
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">0.5kg (tự tính)</label>
                        <div className="px-3 py-2 border border-dashed rounded-lg text-gray-700">
                          {s05}
                        </div>
                      </div>
                    )}
                    {show10 && (
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">1kg (nhập)</label>
                        <input
                          type="number"
                          min="0"
                          className={inputCls}
                          value={stock1kgBy[r] ?? ""}
                          onChange={(e) => setStock1kgBy((prev) => ({ ...prev, [r]: e.target.value }))}
                          placeholder="VD: 120"
                        />
                      </div>
                    )}
                    {show15 && (
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">1.5kg (tự tính)</label>
                        <div className="px-3 py-2 border border-dashed rounded-lg text-gray-700">
                          {s15}
                        </div>
                      </div>
                    )}
                    {show20 && (
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">2kg (tự tính)</label>
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

        {/* Packaging – bán theo thùng */}
        <h3 className={sectionTitleCls}>🧺 Bán theo thùng (Packaging)</h3>
        <p className="text-sm text-gray-600 -mt-1 mb-2">
          Mỗi cấu hình thùng sẽ sinh thành biến thể <i>weight</i> (VD: <b>Thùng 10kg</b>) theo từng tình trạng.
          Chỉ những tình trạng có <b>tồn &gt; 0</b> mới được tạo biến thể thùng.
        </p>

        {packagingOptions.length === 0 && (
          <p className="text-sm text-gray-500">Chưa có cấu hình. Nhấn “+ Thêm thùng”.</p>
        )}

        <div className="space-y-3">
          {packagingOptions.map((p, i) => {
            const suggested = suggestedBoxesFor(p);
            return (
              <div key={i} className="border p-3 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Nhãn</label>
                    <input
                      className={inputCls}
                      value={p.unitLabel}
                      onChange={(e) => updatePackaging(i, "unitLabel", e.target.value)}
                      placeholder="Thùng 10kg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Kiểu</label>
                    <input
                      className={inputCls}
                      value={p.type}
                      onChange={(e) => updatePackaging(i, "type", e.target.value)}
                      placeholder="box"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Size (kg)</label>
                    <input
                      type="number"
                      min="0"
                      className={inputCls}
                      value={p.unitSize}
                      onChange={(e) => updatePackaging(i, "unitSize", e.target.value)}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Ước tính tối đa: <b>{suggested}</b> thùng
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Giá (đ)</label>
                    <input
                      type="number"
                      min="0"
                      className={inputCls}
                      value={p.price}
                      onChange={(e) => updatePackaging(i, "price", e.target.value)}
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      className="px-3 py-2 rounded-lg border text-red-600 border-red-300 hover:bg-red-50"
                      onClick={() => removePackaging(i)}
                    >
                      Xoá
                    </button>
                  </div>
                </div>

                {/* stockBy theo từng tình trạng */}
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                  {(ripenessOptions.length ? ripenessOptions : ["Xanh","Chín vừa","Chín"]).map((r) => (
                    <div key={r}>
                      <label className="block text-sm text-gray-600 mb-1">
                        Tồn (thùng) – {r}
                      </label>
                      <input
                        type="number"
                        min="0"
                        className={inputCls}
                        value={p?.stockBy?.[r] ?? 0}
                        onChange={(e) => updatePackagingStockBy(i, r, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          className="mt-3 px-4 py-2 rounded-lg border"
          onClick={addPackaging}
        >
          + Thêm thùng
        </button>

        {/* Combo */}
        <h3 className={sectionTitleCls}>🧺 Combo</h3>
        <label className="flex items-center gap-2 mb-2">
          <input type="checkbox" checked={isCombo} onChange={(e) => setIsCombo(e.target.checked)} />
          Đánh dấu là sản phẩm combo
        </label>

        {isCombo && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-2">
              <div>
                <label className="block text-sm text-gray-600 mb-1">% giảm combo</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  className={inputCls}
                  value={comboDiscountPercent}
                  onChange={(e) => setComboDiscountPercent(e.target.value)}
                />
              </div>
            </div>

            {comboItems.length === 0 && (
              <p className="text-sm text-gray-500">Chưa có sản phẩm trong combo. Nhấn “+ Thêm sản phẩm”.</p>
            )}

            <div className="space-y-3">
              {comboItems.map((it, i) => (
                <div key={i} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end border p-3 rounded-lg">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Product ID</label>
                    <input
                      className={inputCls}
                      value={it.product}
                      onChange={(e) => updateComboItem(i, "product", e.target.value)}
                      placeholder="5f... (ID sản phẩm)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Số lượng</label>
                    <input
                      type="number"
                      min="1"
                      className={inputCls}
                      value={it.qty}
                      onChange={(e) => updateComboItem(i, "qty", e.target.value)}
                    />
                  </div>
                  <div>
                    <button
                      type="button"
                      className="px-3 py-2 rounded-lg border text-red-600 border-red-300 hover:bg-red-50 h-[42px] mt-auto"
                      onClick={() => removeComboItem(i)}
                    >
                      Xoá
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="mt-2 px-4 py-2 rounded-lg border"
              onClick={addComboItem}
            >
              + Thêm sản phẩm vào combo
            </button>
          </>
        )}

        {/* Mix builder (tuỳ chọn) */}
        <h3 className={sectionTitleCls}>🥗 Mix builder (tuỳ chọn)</h3>
        <label className="flex items-center gap-2 mb-2">
          <input type="checkbox" checked={isMixBuilder} onChange={(e) => setIsMixBuilder(e.target.checked)} />
          Cho phép khách tự mix
        </label>

        {/* Coming Soon */}
        <h3 className={sectionTitleCls}>⚡ Cấu hình Sản phẩm Sắp vào mùa</h3>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={enablePreorder} onChange={(e) => setEnablePreorder(e.target.checked)} />
          Bật chế độ đặt trước (Coming Soon)
        </label>

        {enablePreorder && (
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Đặt cọc (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={depositPercent}
                  onChange={(e) => setDepositPercent(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Hạn mức (quota)</label>
                <input
                  type="number"
                  min="0"
                  value={quota}
                  onChange={(e) => setQuota(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Cửa sổ đặt trước</label>
              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} className={inputCls} />
                <input type="date" value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} className={inputCls} />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Dự kiến mùa vụ (thời gian giao hàng)</label>
              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={expectedHarvestStart} onChange={(e) => setExpectedHarvestStart(e.target.value)} className={inputCls} />
                <input type="date" value={expectedHarvestEnd} onChange={(e) => setExpectedHarvestEnd(e.target.value)} className={inputCls} />
              </div>
            </div>
          </div>
        )}

        {/* Expiry */}
        <h3 className={sectionTitleCls}>🍏 Hạn sử dụng & Giảm giá cận hạn</h3>
        <label className="flex items-center gap-2 mb-2">
          <input
            type="checkbox"
            checked={enableExpiry}
            onChange={(e) => setEnableExpiry(e.target.checked)}
            disabled={!!enablePreorder}
            title={enablePreorder ? "Đang bật Coming Soon - không thể theo dõi HSD" : ""}
          />
          Theo dõi hạn & cấu hình giảm giá cận hạn
          {enablePreorder && <span className="text-xs text-red-600 ml-2">(Đang bật Coming Soon)</span>}
        </label>

        {enableExpiry && !enablePreorder && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Ngày hết hạn (expireDate)</label>
                <input type="date" value={expireDate} onChange={(e) => setExpireDate(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Ngày nhập kho (mfgDate)</label>
                <input type="date" value={mfgDate} onChange={(e) => setMfgDate(e.target.value)} className={inputCls} disabled={!!expireDate} />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Số ngày sử dụng (shelfLifeDays)</label>
                <input
                  type="number"
                  min="0"
                  value={shelfLifeDays}
                  onChange={(e) => setShelfLifeDays(e.target.value)}
                  className={inputCls}
                  disabled={!!expireDate}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={nearActive} onChange={(e) => setNearActive(e.target.checked)} />
                Kích hoạt giảm giá cận hạn
              </label>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Ngưỡng cận hạn (ngày)</label>
                <input
                  type="number"
                  min="0"
                  value={thresholdDays}
                  onChange={(e) => setThresholdDays(e.target.value)}
                  className={inputCls}
                  disabled={!nearActive}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">% giảm khi cận hạn</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={discountPercentNear}
                  onChange={(e) => setDiscountPercentNear(e.target.value)}
                  className={inputCls}
                  disabled={!nearActive}
                />
              </div>
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="pt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/admin/products")}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Hủy & quay về danh sách
          </button>
          <button
            type="submit"
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Cập nhật
          </button>
        </div>
      </form>
    </div>
  );
}
