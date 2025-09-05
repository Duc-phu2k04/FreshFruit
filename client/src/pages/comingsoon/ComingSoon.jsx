import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import "./ComingSoon.css"; // ✅ CSS riêng

export default function ComingSoon() {
  const [rawProducts, setRawProducts] = useState([]);
  const [serverPaged, setServerPaged] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();

  const category = searchParams.get("category") || "";
  const limit = Number(searchParams.get("limit") || "24"); // giữ lại để BE vẫn dùng được
  const page = Number(searchParams.get("page") || "1");

  useEffect(() => {
    const fetchPreorderProducts = async () => {
      try {
        setLoading(true);
        const url = new URL("http://localhost:3000/api/product/coming-soon");
        if (category) url.searchParams.set("category", category);
        if (limit) url.searchParams.set("limit", String(limit));
        if (page) url.searchParams.set("page", String(page));

        const res = await fetch(url.toString());
        if (!res.ok) throw new Error("Không lấy được sản phẩm sắp vào mùa");
        const data = await res.json();

        if (Array.isArray(data)) {
          setServerPaged(false);
          setRawProducts(data);
          setTotal(data.length);
        } else {
          setServerPaged(true);
          setRawProducts(Array.isArray(data.data) ? data.data : []);
          setTotal(Number(data.total || 0));
        }
      } catch (err) {
        console.error("Lỗi khi lấy danh sách preorder:", err);
        setServerPaged(false);
        setRawProducts([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    };

    fetchPreorderProducts();
  }, [category, limit, page]);

  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");
  const resolveImg = (img) => {
    if (!img) return null;
    if (img.startsWith("http://") || img.startsWith("https://")) return img;
    return `http://localhost:3000${img}`;
  };

  const clientPagedProducts = useMemo(() => {
    if (serverPaged) return rawProducts;
    const start = (page - 1) * limit;
    const end = start + limit;
    return rawProducts.slice(start, end);
  }, [serverPaged, rawProducts, page, limit]);

  const products = clientPagedProducts;
  const pageCount = Math.max(1, Math.ceil((total || products.length || 0) / limit));

  const gotoPage = (p) => {
    const safe = Math.max(1, Math.min(pageCount, p));
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("page", String(safe));
      if (category) next.set("category", category);
      else next.delete("category");
      return next;
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (loading) {
    return (
      <div className="csn-container">
        <div className="csn-header">
          <h1 className="csn-title">Trái cây sắp vào mùa 🍊</h1>
        </div>
        <p className="csn-loading">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="csn-container">
      <div className="csn-header">
        <h1 className="csn-title">Trái cây sắp vào mùa 🍊</h1>
      </div>

      {products.length === 0 ? (
        <p className="csn-empty">Hiện chưa có sản phẩm nào sắp vào mùa.</p>
      ) : (
        <>
          <div className="csn-grid">
            {products.map((p) => {
              const imgSrc = resolveImg(p.image);
              return (
                <div key={p._id} className="csn-card">
                  <Link to={`/san-pham/${p._id}?preorder=1`} className="csn-card-link">
                    {imgSrc ? (
                      <img src={imgSrc} alt={p.name || "Sản phẩm"} className="csn-card-img" />
                    ) : (
                      <div className="csn-card-img csn-card-img--placeholder" />
                    )}

                    <div className="csn-card-body">
                      <div className="csn-card-head">
                        <h2 className="csn-card-title">{p.name}</h2>
                        <span className="tag-preorder">ĐẶT TRƯỚC</span>
                      </div>

                      <p className="csn-card-desc">{p.description || "Trái cây sắp vào mùa"}</p>

                      <p className="csn-card-price">
                        {p?.baseVariant?.price
                          ? `${Number(p.baseVariant.price).toLocaleString()}đ`
                          : "Liên hệ"}
                      </p>

                      <div className="csn-card-meta">
                        <div>
                          Dự kiến:{" "}
                          <b>
                            {fmtDate(p?.preorder?.expectedHarvestStart)} –{" "}
                            {fmtDate(p?.preorder?.expectedHarvestEnd)}
                          </b>
                        </div>
                        {p?.preorder?.windowEnd && (
                          <div>
                            Hạn đặt trước: <b>{fmtDate(p.preorder.windowEnd)}</b>
                          </div>
                        )}
                      </div>

                      <div className="csn-card-cta">
                        <span className="btn-preorder">Đặt trước ngay</span>
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>

          {/* PHÂN TRANG */}
          <div className="csn-pagination">
            <button
              className="csn-page-btn"
              disabled={page <= 1}
              onClick={() => gotoPage(page - 1)}
            >
              ← Prev
            </button>

            <div className="csn-page-list">
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((pNum) => {
                const active = pNum === page;
                return (
                  <button
                    key={pNum}
                    className={active ? "csn-page-num csn-page-num--active" : "csn-page-num"}
                    onClick={() => gotoPage(pNum)}
                  >
                    {pNum}
                  </button>
                );
              })}
            </div>

            <button
              className="csn-page-btn"
              disabled={page >= pageCount}
              onClick={() => gotoPage(page + 1)}
            >
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
