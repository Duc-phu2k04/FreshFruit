// src/pages/Product/ProductDetail.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { FaStar } from "react-icons/fa";

// ✅ ĐÚNG PATH + có đuôi .jsx
import PreorderWidget from "../../components/preoder/PreorderWidget";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const allowPreorder = searchParams.get("preorder") === "1"; // chỉ bật widget khi đi từ Sắp vào mùa

  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [comments, setComments] = useState([]);
  const [successMessage, setSuccessMessage] = useState("");

  const [selectedWeight, setSelectedWeight] = useState("");
  const [selectedRipeness, setSelectedRipeness] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [currentVariant, setCurrentVariant] = useState(null);

  // tiện ích ảnh (nếu BE trả sẵn absolute URL thì dùng luôn)
  const imgSrc = (path) => (path?.startsWith("http") ? path : `http://localhost:3000${path || ""}`);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetch(`http://localhost:3000/api/product/${id}`);
        if (!res.ok) throw new Error("Không tìm thấy sản phẩm");
        const data = await res.json();
        setProduct(data);

        // Sản phẩm liên quan: lọc theo category + loại bỏ Coming Soon
        const relatedRes = await fetch(
          `http://localhost:3000/api/product?category=${data.category?._id || ""}&preorder=false`
        );
        if (!relatedRes.ok) throw new Error("Không lấy được sản phẩm liên quan");
        const related = await relatedRes.json();
        const relatedArray = Array.isArray(related) ? related : (Array.isArray(related.data) ? related.data : []);
        setRelatedProducts(relatedArray.filter((item) => item._id !== id));

        // Default chọn theo baseVariant nếu có
        const bw = data?.baseVariant?.attributes?.weight || data?.weightOptions?.[0] || "";
        const br = data?.baseVariant?.attributes?.ripeness || data?.ripenessOptions?.[0] || "";
        setSelectedWeight(bw);
        setSelectedRipeness(br);
      } catch (err) {
        console.error("Lỗi khi lấy sản phẩm:", err);
      }
    };

    const fetchComments = async () => {
      try {
        const res = await fetch(`http://localhost:3000/api/review/products/${id}`);
        if (!res.ok) {
          console.warn("Không lấy được đánh giá, status:", res.status);
          setComments([]);
          return;
        }
        const json = await res.json();
        setComments(Array.isArray(json.data) ? json.data : []);
      } catch (err) {
        console.error("Lỗi khi lấy đánh giá:", err);
        setComments([]);
      }
    };

    setProduct(null);
    fetchProduct();
    fetchComments();
  }, [id]);

  // chọn biến thể
  const handleSelectVariant = (type, value) => {
    if (type === "weight") setSelectedWeight((prev) => (prev === value ? "" : value));
    if (type === "ripeness") setSelectedRipeness((prev) => (prev === value ? "" : value));
  };

  useEffect(() => {
    if (product && selectedWeight && selectedRipeness) {
      const found = Array.isArray(product.variants)
        ? product.variants.find(
            (v) =>
              v.attributes.weight === selectedWeight &&
              v.attributes.ripeness === selectedRipeness
          )
        : null;
      setCurrentVariant(found || null);
      setQuantity(1);
    } else {
      setCurrentVariant(null);
    }
  }, [selectedWeight, selectedRipeness, product]);

  // thêm giỏ
  const addToCartServer = async () => {
    if (!currentVariant) return alert("Vui lòng chọn biến thể trước khi thêm vào giỏ hàng");
    if (currentVariant.stock <= 0) return alert("Sản phẩm này đã hết hàng");

    try {
      const token = localStorage.getItem("token");
      if (!token) return alert("Bạn cần đăng nhập để thêm vào giỏ hàng.");

      const payload = {
        productId: product._id,
        variantId: currentVariant._id,
        quantity,
      };

      const res = await fetch("http://localhost:3000/api/cart/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Lỗi khi thêm vào giỏ hàng");

      setSuccessMessage("Đã thêm vào giỏ hàng ✔️");
      setTimeout(() => setSuccessMessage(""), 2500);
    } catch (error) {
      alert("Lỗi: " + error.message);
    }
  };

  // mua ngay
  const handleBuyNow = () => {
    if (!currentVariant) return alert("Vui lòng chọn biến thể trước khi mua");
    if (currentVariant.stock <= 0) return alert("Sản phẩm này đã hết hàng");

    navigate("/checkout", {
      state: {
        selectedItems: [
          {
            product: { _id: product._id, name: product.name },
            variant: {
              _id: currentVariant._id,
              price: currentVariant.price,
              attributes: currentVariant.attributes,
            },
            variantInfo: {
              weight: currentVariant.attributes.weight,
              ripeness: currentVariant.attributes.ripeness,
            },
            quantity,
          },
        ],
      },
    });
  };

  // rating TB
  const averageRating =
    comments.length > 0
      ? comments.reduce((sum, c) => sum + (c.rating || 0), 0) / comments.length
      : 0;

  if (!product)
    return <p className="text-center mt-10">Đang tải dữ liệu sản phẩm...</p>;

  const isComingSoon = !!product?.preorder?.enabled;
  const showPreorderWidget = isComingSoon && allowPreorder;
  const showBuySection = !isComingSoon; // nếu là Coming Soon thì ẩn mua ngay/giỏ

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {successMessage && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-green-600 text-white px-6 py-2 rounded-full shadow-lg">
          {successMessage}
        </div>
      )}

      {/* Thông tin sản phẩm */}
      <div className="grid md:grid-cols-2 gap-8 bg-white p-6 rounded shadow">
        <img
          src={imgSrc(product.image)}
          alt={product.name}
          className="w-full rounded-lg shadow"
        />
        <div>
          <h1 className="text-4xl font-bold mb-3">{product.name}</h1>
          <p className="text-gray-700 mb-4">{product.description}</p>

          {isComingSoon && !allowPreorder && (
            <div className="mb-4 p-3 rounded bg-yellow-50 border border-yellow-300 text-yellow-800">
              Sản phẩm <b>sắp vào mùa</b>. Đặt trước chỉ từ trang{" "}
              <Link to="/coming-soon" className="underline font-semibold">
                Sắp vào mùa
              </Link>
              .
            </div>
          )}

          {currentVariant ? (
            <p className="text-green-700 text-2xl font-semibold mb-2">
              {currentVariant.price.toLocaleString()}đ
            </p>
          ) : (
            <p className="text-gray-500 mb-2">Vui lòng chọn biến thể</p>
          )}

          {currentVariant && (
            <p className="mb-4 text-sm text-gray-600">
              Tồn kho:{" "}
              {currentVariant.stock > 0
                ? `${currentVariant.stock} sản phẩm`
                : "Hết hàng"}
            </p>
          )}

          {/* Chọn Weight */}
          <div className="mb-4">
            <p className="font-medium mb-1">Khối lượng:</p>
            <div className="flex flex-wrap gap-2">
              {Array.isArray(product.weightOptions) &&
                product.weightOptions.map((w) => (
                  <button
                    key={w}
                    onClick={() => handleSelectVariant("weight", w)}
                    className={`px-4 py-2 border rounded relative ${
                      selectedWeight === w
                        ? "border-green-600 text-green-600"
                        : "border-gray-300"
                    }`}
                  >
                    {w}
                    {selectedWeight === w && (
                      <span className="absolute top-0 right-0 text-green-600 font-bold">
                        ✓
                      </span>
                    )}
                  </button>
                ))}
            </div>
          </div>

          {/* Chọn Ripeness */}
          <div className="mb-4">
            <p className="font-medium mb-1">Tình trạng:</p>
            <div className="flex flex-wrap gap-2">
              {Array.isArray(product.ripenessOptions) &&
                product.ripenessOptions.map((r) => (
                  <button
                    key={r}
                    onClick={() => handleSelectVariant("ripeness", r)}
                    className={`px-4 py-2 border rounded relative ${
                      selectedRipeness === r
                        ? "border-green-600 text-green-600"
                        : "border-gray-300"
                    }`}
                  >
                    {r}
                    {selectedRipeness === r && (
                      <span className="absolute top-0 right-0 text-green-600 font-bold">
                        ✓
                      </span>
                    )}
                  </button>
                ))}
            </div>
          </div>

          {/* ✅ Preorder chỉ hiển thị khi đi từ trang Sắp vào mùa (?preorder=1) */}
          {showPreorderWidget && (
            <PreorderWidget
              product={{ ...product, id: product?._id || product?.id }}
              onSuccess={() => {}}
              requireLoginHint={true}
            />
          )}

          {/* Số lượng + Hành động mua (giữ logic cũ) — Ẩn nếu là Coming Soon */}
          {showBuySection && currentVariant && currentVariant.stock > 0 && (
            <>
              <div className="mb-4 flex items-center gap-3">
                <p className="font-medium">Số lượng:</p>
                <input
                  type="number"
                  value={quantity}
                  min={1}
                  max={currentVariant.stock}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="border rounded px-3 py-1 w-20"
                />
              </div>

              <div className="flex gap-3 mb-4">
                <button
                  className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 disabled:opacity-50"
                  onClick={addToCartServer}
                  disabled={!currentVariant || currentVariant.stock <= 0}
                >
                  Thêm vào giỏ
                </button>
                <button
                  className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 disabled:opacity-50"
                  onClick={handleBuyNow}
                  disabled={!currentVariant || currentVariant.stock <= 0}
                >
                  Mua ngay
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Đánh giá */}
      <div className="mt-10">
        <h3 className="text-2xl font-semibold mb-2">Đánh giá của khách hàng:</h3>
        {comments.length > 0 && (
          <div className="flex items-center mb-4">
            {[...Array(5)].map((_, i) => (
              <FaStar
                key={i}
                size={20}
                color={i < Math.round(averageRating) ? "#facc15" : "#e5e7eb"}
              />
            ))}
            <span className="ml-2 text-gray-600">
              ({averageRating.toFixed(1)} / 5)
            </span>
          </div>
        )}
        {comments.length === 0 ? (
          <p className="text-gray-500">Chưa có đánh giá nào.</p>
        ) : (
          <div className="space-y-6">
            {comments.map((cmt) => (
              <div
                key={cmt._id}
                className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition duration-300"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-full bg-blue-600 text-white flex items-center justify-center text-lg font-bold shadow-sm">
                      {(cmt.user?.username?.[0] || "?").toUpperCase()}
                    </div>
                    <div>
                      <p className="text-base font-semibold">
                        {cmt.user?.username || "Người dùng ẩn danh"}
                      </p>
                      <p className="text-sm text-gray-400">
                        {new Date(cmt.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <FaStar
                        key={i}
                        size={18}
                        color={i < (cmt.rating || 0) ? "#facc15" : "#e5e7eb"}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-gray-700 leading-relaxed">
                  {cmt.comment || "Không có nội dung"}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sản phẩm liên quan */}
      <div className="mt-12">
        <h3 className="text-2xl font-semibold mb-4">Sản phẩm liên quan:</h3>
        <div className="grid md:grid-cols-4 gap-6">
          {relatedProducts.map((item) => (
            <div
              key={item._id}
              className="border rounded p-4 cursor-pointer hover:shadow"
              onClick={() => navigate(`/san-pham/${item._id}`)}
            >
              <img
                src={imgSrc(item.image)}
                alt={item.name}
                className="w-full h-40 object-cover rounded"
              />
              <h4 className="mt-2 font-semibold text-lg">{item.name}</h4>
              <p className="text-green-700 font-semibold">
                {item.price?.toLocaleString
                  ? item.price.toLocaleString()
                  : (item.baseVariant?.price || 0).toLocaleString()}
                đ
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
