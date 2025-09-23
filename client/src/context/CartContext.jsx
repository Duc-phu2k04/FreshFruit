import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./useAuth";

const CartContext = createContext();

/* ========== Helpers riêng cho Mix (an toàn, không đụng luồng cũ) ========== */
const LS_MIX_KEY = "cart_mix_draft_v1";
const genId = (prefix = "mix") =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const round = (n, d = 0) => {
  const p = Math.pow(10, d);
  return Math.round((Number(n) || 0) * p) / p;
};

// Tạo khóa gom dòng theo sản phẩm + trọng lượng (nếu có)
const makeDraftKey = (it) =>
  [it.productId, it.weightGram ? `${it.weightGram}g` : "u"].join("|");

// Tính tiền cho 1 dòng trong mixDraft
function calcMixLinePrice(draftItem) {
  const qty = Number(draftItem.qty || 0);
  if (draftItem.pricePerKg && draftItem.weightGram) {
    const perKg = Number(draftItem.pricePerKg || 0);
    const kg = Number(draftItem.weightGram) / 1000;
    return round(perKg * kg * qty, 0);
  }
  const unit = Number(draftItem.unitPrice ?? draftItem.price ?? 0);
  return round(unit * qty, 0);
}

// Tổng tiền của mixDraft
function computeMixDraftTotal(items) {
  return round(items.reduce((s, it) => s + calcMixLinePrice(it), 0), 0);
}

/* ========== Helpers chung cho combo ========== */
const isComboProduct = (p) =>
  p?.isCombo === true || String(p?.type || "").toLowerCase() === "combo";

const buildComboItemsFromProduct = (p) => {
  const arr = Array.isArray(p?.comboItems)
    ? p.comboItems
    : Array.isArray(p?.combo?.items)
    ? p.combo.items
    : [];
  return arr
    .map((it) => ({
      productId: it?.product?._id || it?.product || it?.item?._id || it?.item || null,
      variantId: it?.variant?._id || it?.variant || null,
      qty: Number(it?.qty || 1),
    }))
    .filter((x) => x.productId && x.qty > 0);
};

export const CartProvider = ({ children }) => {
  const { user } = useAuth();
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // ========== Helpers ==========
  const getToken = () => localStorage.getItem("token");
  const loadGuest = () => {
    try {
      const raw = localStorage.getItem("cart");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };
  const saveGuest = (items) =>
    localStorage.setItem("cart", JSON.stringify(items));

  // ========== Mix Draft State (mới) ==========
  const [mixDraft, setMixDraft] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_MIX_KEY);
      return raw ? JSON.parse(raw) : { items: [], note: "" };
    } catch {
      return { items: [], note: "" };
    }
  });

  // Persist mixDraft
  useEffect(() => {
    localStorage.setItem(LS_MIX_KEY, JSON.stringify(mixDraft));
  }, [mixDraft]);

  // ========== Fetch cart ==========
  useEffect(() => {
    const fetchCart = async () => {
      setLoading(true);

      if (user?._id) {
        const token = getToken();
        if (!token) {
          setCartItems(loadGuest());
          setLoading(false);
          return;
        }

        try {
          console.log("🛒 [CartContext] Fetching cart from server...");
          const res = await fetch("http://localhost:3000/api/cart", {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (res.status === 401) {
            // Token lỗi hoặc hết hạn → fallback guest
            localStorage.removeItem("token");
            setCartItems(loadGuest());
            setLoading(false);
            return;
          }

          const data = await res.json();
          console.log("🛒 [CartContext] Server cart response:", data);
          console.log("🛒 [CartContext] Cart items count:", data.items?.length || 0);
          setCartItems(data.items || []);
        } catch (err) {
          console.error("Lỗi lấy giỏ hàng từ server:", err);
          setCartItems([]);
        }
      } else {
        // ✅ Xóa giỏ hàng khi đăng xuất
        setCartItems([]);
      }

      setLoading(false);
    };

    fetchCart();
  }, [user]);

  // ✅ Xóa giỏ hàng khi user logout (từ đăng nhập thành chưa đăng nhập)
  useEffect(() => {
    if (!user?._id) {
      setCartItems([]);
      // ✅ Xóa mix draft khi logout
      setMixDraft({ items: [], note: "" });
    }
  }, [user?._id]);

  // ========== Actions ==========
  /**
   * addToCart(product, options?)
   * options: { quantity, variantId, items }  // items dùng cho combo nếu muốn override
   */
  const addToCart = async (product, options = {}) => {
    // ✅ Bắt buộc đăng nhập để thêm vào giỏ hàng
    if (!user?._id) {
      // Redirect đến trang đăng nhập với returnUrl để quay lại sau khi đăng nhập
      const currentPath = window.location.pathname + window.location.search;
      window.location.href = `/login?returnUrl=${encodeURIComponent(currentPath)}`;
      return;
    }

    const quantity = Math.max(1, Number(options.quantity || 1));
    const combo = isComboProduct(product);

    // Luồng server
    if (user?._id && getToken()) {
      const token = getToken();

      const tryPost = async (tries) => {
        let lastErr;
        for (const t of tries) {
          try {
            const res = await fetch(`http://localhost:3000/api${t.url}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(t.body),
            });
            if (res.ok) return res;
            lastErr = await res.json().catch(() => ({}));
            // nếu 404 thì thử endpoint khác, nếu 400/401/422 thì dừng
            if (res.status !== 404) break;
          } catch (e) {
            lastErr = e;
            break;
          }
        }
        throw lastErr || new Error("Không thể thêm vào giỏ");
      };

      try {
        if (combo) {
          // build items từ product nếu chưa truyền options.items
          const items =
            Array.isArray(options.items) && options.items.length > 0
              ? options.items
              : buildComboItemsFromProduct(product);

          const res = await tryPost([
            // 1) BE yêu cầu items (tránh lỗi 400 thiếu items)
            {
              url: "/cart/add",
              body: {
                type: "combo",
                productId: product._id,
                quantity,
                items,
              },
            },
            // 2) BE mới không cần items
            {
              url: "/cart/add",
              body: {
                type: "combo",
                productId: product._id,
                quantity,
              },
            },
            // 3) BE cũ endpoint riêng
            {
              url: "/cart/add-combo",
              body: {
                productId: product._id,
                quantity,
                items,
              },
            },
            // 4) BE rất cũ: variantId="combo"
            {
              url: "/cart/add",
              body: { productId: product._id, variantId: "combo", quantity },
            },
          ]);

          const updated = await res.json().catch(() => ({}));
          if (updated?.cart?.items) setCartItems(updated.cart.items);
          return;
        }

        // HÀNG THƯỜNG
        const payload = {
          productId: product._id,
          quantity,
          ...(options.variantId ? { variantId: options.variantId } : {}),
        };

        const res = await fetch("http://localhost:3000/api/cart/add", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        if (res.status === 401) {
          localStorage.removeItem("token");
        } else if (res.ok) {
          const updated = await res.json();
          setCartItems(updated.cart.items || []);
          return;
        }
      } catch (err) {
        console.error("Lỗi thêm vào giỏ hàng:", err);
      }
    }

    // Guest (giữ nguyên luồng, thêm hỗ trợ combo)
    setCartItems((prev) => {
      if (combo) {
        const line = {
          _id: genId("combo"),
          type: "combo",
          product: { _id: product._id, name: product.name },
          // ưu tiên comboPrice nếu có, fallback price
          price: Number(product.comboPrice || product.price || 0),
          quantity,
        };
        return [...prev, line];
      }

      const existing = prev.find((i) => i._id === product._id);
      if (existing) {
        return prev.map((i) =>
          i._id === product._id ? { ...i, quantity: (i.quantity || 0) + quantity } : i
        );
      }
      return [...prev, { ...product, quantity }];
    });
  };

  // Nhận diện id có phải là một dòng mix trong cartItems (client-only)
  const findMixById = (id) =>
    cartItems.find((x) => x?.type === "mix" && x?._id === id);

  const removeFromCart = async (productId) => {
    // Nếu là dòng MIX (client-only), xoá cục bộ, không gọi server
    const mixLine = findMixById(productId);
    if (mixLine) {
      setCartItems((prev) => prev.filter((x) => x._id !== productId));
      return;
    }

    // Luồng server (giữ nguyên)
    if (user?._id && getToken()) {
      try {
        const res = await fetch(`http://localhost:3000/api/cart/${productId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${getToken()}` },
        });

        if (res.status === 401) {
          localStorage.removeItem("token");
        }

        setCartItems((prev) =>
          prev.filter((item) => item.product?._id !== productId)
        );
        return;
      } catch (err) {
        console.error("Lỗi xoá sản phẩm:", err);
      }
    }

    // Guest (giữ nguyên)
    setCartItems((prev) =>
      prev.filter((item) => item._id !== productId)
    );
  };

  const updateQuantity = async (productId, quantity) => {
    if (quantity <= 0) return removeFromCart(productId);

    // Nếu là dòng MIX (client-only): cập nhật local, không gọi server
    const mixLine = findMixById(productId);
    if (mixLine) {
      setCartItems((prev) =>
        prev.map((it) => {
          if (it._id !== productId) return it;
          const q = Number(quantity || 1);
          const base = Number(it.basePrice || it.price || 0);
          const basePrice = it.basePrice || it.price;
          return {
            ...it,
            quantity: q,
            basePrice,
            price: round(base * (q / Number(it.quantity || 1))),
          };
        })
      );
      return;
    }

    // Luồng server (giữ nguyên)
    if (user?._id && getToken()) {
      try {
        const res = await fetch("http://localhost:3000/api/cart/update", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({ productId, quantity }),
        });

        if (res.status === 401) {
          localStorage.removeItem("token");
        } else if (res.ok) {
          const updated = await res.json();
          setCartItems(updated.cart.items || []);
          return;
        }
      } catch (err) {
        console.error("Lỗi cập nhật:", err);
      }
    }

    // Guest (giữ nguyên)
    setCartItems((prev) =>
      prev.map((item) =>
        item._id === productId ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => {
    setCartItems([]);
    if (!user?._id) localStorage.removeItem("cart");
  };

  const removePurchasedItems = (purchasedIds) => {
    setCartItems((prev) =>
      prev.filter((item) => {
        const id = user?._id ? item.product?._id : item._id;
        return !purchasedIds.includes(id);
      })
    );

    if (!user?._id) {
      const updated = cartItems.filter((item) => !purchasedIds.includes(item._id));
      saveGuest(updated);
    }
  };

  // ✅ Dọn các dòng MIX (client-only) – dùng sau khi đặt hàng
  const clearMixLines = () => {
    setCartItems((prev) => prev.filter((it) => it?.type !== "mix"));
  };

  // ========== Totals ==========
  const totalItems = cartItems.reduce(
    (sum, item) => sum + (item.quantity || 0),
    0
  );

  const totalPrice = cartItems.reduce((sum, item) => {
    const price = item.product?.price || item.price || 0;
    return sum + price * (item.quantity || 0);
  }, 0);

  /* =============================
   * ========== MIX API ==========
   * ============================= */

  const mixDraftAddItem = (product, options = {}) => {
    const item = {
      productId: product._id,
      name: product.name,
      unitPrice: product.price,
      pricePerKg: product.pricePerKg,
      weightGram: options.weightGram,
      qty: Number(options.qty || 1),
      noteLine: options.noteLine || "",
      thumbnail: product.thumbnail || product.image || "",
    };

    const key = makeDraftKey(item);
    setMixDraft((prev) => {
      const map = new Map(prev.items.map((x) => [makeDraftKey(x), x]));
      if (map.has(key)) {
        const old = map.get(key);
        map.set(key, { ...old, qty: Number(old.qty || 0) + item.qty });
      } else {
        map.set(key, item);
      }
      return { ...prev, items: Array.from(map.values()) };
    });
  };

  const mixDraftUpdateItem = (productId, patch = {}) => {
    setMixDraft((prev) => {
      const items = prev.items.map((x) =>
        x.productId === productId
          ? { ...x, ...patch, qty: Number(patch.qty ?? x.qty) }
          : x
      );
      return { ...prev, items };
    });
  };

  const mixDraftRemoveItem = (target) => {
    setMixDraft((prev) => {
      const targetKey = makeDraftKey(target);
      const items = prev.items.filter((it) => makeDraftKey(it) !== targetKey);
      return { ...prev, items };
    });
  };

  const mixDraftClear = () => setMixDraft({ items: [], note: "" });
  const mixDraftSetNote = (note) =>
    setMixDraft((prev) => ({ ...prev, note: note ?? "" }));

  const mixDraftFinalize = () => {
    if (!mixDraft.items.length) return;

    const total = computeMixDraftTotal(mixDraft.items);
    const displayName = `Giỏ Mix (${mixDraft.items.length} món)`;

    const line = {
      _id: genId("mix"),
      type: "mix",
      quantity: 1,
      basePrice: total,
      price: total,
      displayName,
      note: mixDraft.note,
      mixItems: mixDraft.items.map((x) => ({
        productId: x.productId,
        name: x.name,
        qty: x.qty,
        unitPrice: x.unitPrice,
        pricePerKg: x.pricePerKg,
        weightGram: x.weightGram,
        linePrice: calcMixLinePrice(x),
        thumbnail: x.thumbnail,
        noteLine: x.noteLine,
      })),
    };

    setCartItems((prev) => [...prev, line]);
    mixDraftClear();
  };

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        removePurchasedItems,
        totalItems,
        totalPrice,
        loading,

        // mix draft
        mixDraft,
        mixDraftAddItem,
        mixDraftUpdateItem,
        mixDraftRemoveItem,
        mixDraftClear,
        mixDraftSetNote,
        mixDraftFinalize,
        computeMixDraftTotal,

        // ✅ mới
        clearMixLines,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
