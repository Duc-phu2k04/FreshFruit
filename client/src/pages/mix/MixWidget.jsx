// client/src/pages/mix/MixWidget.jsx
import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import "./MixWidget.css";

/**
 * MixWidget
 * - Hiển thị giỏ Mix tạm (mixDraft), cho phép +/−/xóa từng dòng
 * - Cho phép chỉnh gram với mặt hàng bán theo kg (pricePerKg)
 * - Ghi chú cho giỏ mix
 * - "Đóng gói & thanh toán": tạo 1 dòng type:"mix" vào cartItems rồi điều hướng Checkout
 *
 * ✅ ĐÃ THÊM CÁC CLASS ĐỂ DỄ CSS:
 *   mix-widget, mix-widget--panel, mix-widget__header, mix-widget__list, mix-widget__item,
 *   mix-widget__thumb, mix-widget__info, mix-widget__title, mix-widget__note-line,
 *   mix-widget__unit, mix-widget__meta, mix-widget__qty, mix-widget__grams, mix-widget__chips,
 *   mix-widget__line, mix-widget__remove, mix-widget__note, mix-widget__footer, mix-widget__totals
 */
export default function MixWidget() {
  const navigate = useNavigate();
  const {
    mixDraft,
    mixDraftAddItem,
    mixDraftRemoveItem,
    mixDraftClear,
    mixDraftSetNote,
    mixDraftFinalize,
    computeMixDraftTotal,
  } = useCart();

  const items = Array.isArray(mixDraft?.items) ? mixDraft.items : [];

  const total = useMemo(
    () => computeMixDraftTotal(items),
    [items, computeMixDraftTotal]
  );

  // Tổng khối lượng các mặt hàng tính theo kg (tính cả qty)
  const totalGram = useMemo(
    () =>
      items.reduce((s, it) => {
        const isPerKg = !!it.pricePerKg && !it.unitPrice;
        const grams = isPerKg ? Number(it.weightGram || 0) * Number(it.qty || 0) : 0;
        return s + grams;
      }, 0),
    [items]
  );
  const totalKg = useMemo(() => Math.round((totalGram / 1000) * 1000) / 1000, [totalGram]);

  const formatPrice = (n) => (Number(n) || 0).toLocaleString("vi-VN") + "₫";

  // Tăng số lượng (giữ weightGram hiện tại)
  const inc = (line) => {
    const product = {
      _id: line.productId,
      name: line.name,
      price: line.unitPrice,
      pricePerKg: line.pricePerKg,
      thumbnail: line.thumbnail,
    };
    mixDraftAddItem(product, { qty: 1, weightGram: line.weightGram });
  };

  // Giảm số lượng: nếu còn >1 thì remove+re-add với qty-1, nếu =1 thì remove luôn
  const dec = (line) => {
    const newQty = Math.max(0, Number(line.qty || 0) - 1);
    mixDraftRemoveItem(line);
    if (newQty > 0) {
      const product = {
        _id: line.productId,
        name: line.name,
        price: line.unitPrice,
        pricePerKg: line.pricePerKg,
        thumbnail: line.thumbnail,
      };
      mixDraftAddItem(product, { qty: newQty, weightGram: line.weightGram });
    }
  };

  // Xoá hẳn một dòng
  const remove = (line) => mixDraftRemoveItem(line);

  // Đổi trọng lượng (gram) cho hàng tính theo kg:
  // do "key" của draft = productId + weightGram, nên phải remove dòng cũ rồi add lại với weightGram mới (giữ nguyên qty)
  const changeWeightGram = (line, nextGram) => {
    const grams = Math.max(50, Math.min(5000, Math.round(Number(nextGram) || 0))); // clamp 50g - 5000g
    const qty = Math.max(1, Number(line.qty || 1));
    mixDraftRemoveItem(line);
    const product = {
      _id: line.productId,
      name: line.name,
      price: line.unitPrice,
      pricePerKg: line.pricePerKg,
      thumbnail: line.thumbnail,
    };
    mixDraftAddItem(product, { qty, weightGram: grams });
  };

  // Nút đóng gói: finalize và chuyển tới checkout
  const finalizeAndCheckout = () => {
    if (!items.length) return;
    mixDraftFinalize(); // đẩy 1 dòng type:"mix" vào cartItems
    navigate("/checkout");
  };

  return (
    <div className="mix-widget mix-widget--panel rounded-2xl border bg-white p-4 shadow-sm">
      {/* Header */}
      <div className="mix-widget__header flex items-center justify-between">
        <div className="font-semibold text-lg">Giỏ Mix của bạn</div>
        {!!items.length && (
          <button
            onClick={mixDraftClear}
            className="text-sm text-red-600 hover:underline"
          >
            Xoá tất cả
          </button>
        )}
      </div>

      {/* Empty */}
      {!items.length ? (
        <div className="text-sm text-gray-500 mt-3">
          Chưa có món nào. Hãy bấm <b>“Thêm vào Mix”</b> ở trang sản phẩm để bắt đầu.
        </div>
      ) : (
        <div className="mix-widget__list mt-3 space-y-4">
          {items.map((it, idx) => {
            const isPerKg = !!it.pricePerKg && !it.unitPrice;

            // Tự tính linePrice dự phòng nếu chưa có
            const linePrice =
              it.linePrice ??
              (() => {
                const qty = Number(it.qty || 0);
                if (isPerKg && it.weightGram) {
                  const kg = Number(it.weightGram) / 1000;
                  return Math.round((Number(it.pricePerKg) || 0) * kg * qty);
                }
                return Math.round((Number(it.unitPrice) || 0) * qty);
              })();

            const unitExplain = isPerKg
              ? `${formatPrice(it.pricePerKg)}/kg`
              : `${formatPrice(it.unitPrice)} / cái`;

            const kgPerLine = isPerKg ? Math.round(((Number(it.weightGram || 0) * Number(it.qty || 0)) / 1000) * 1000) / 1000 : 0;

            return (
              <div
                key={`${it.productId}_${it.weightGram || 0}_${idx}`}
                className="mix-widget__item flex items-start gap-3"
              >
                {/* Thumb */}
                <img
                  src={it.thumbnail || "/noimg.png"}
                  alt={it.name}
                  className="mix-widget__thumb w-14 h-14 rounded-lg object-cover border flex-shrink-0"
                />

                {/* Info */}
                <div className="mix-widget__info min-w-0 flex-1">
                  <div className="mix-widget__title font-medium text-base truncate">
                    {it.name}
                  </div>

                  {/* Biến thể/ghi chú dòng (nếu có) */}
                  {it.noteLine ? (
                    <div className="mix-widget__note-line text-xs text-emerald-700 mt-0.5">
                      {it.noteLine}
                    </div>
                  ) : null}

                  {/* Đơn giá & meta */}
                  <div className="mix-widget__meta text-xs text-gray-500 mt-1">
                    {unitExplain}
                    {isPerKg && it.weightGram ? (
                      <>
                        {" "}
                        • {Number(it.weightGram)}g/đơn vị
                      </>
                    ) : null}
                  </div>

                  {/* Điều khiển khối lượng (theo kg) */}
                  {isPerKg ? (
                    <div className="mix-widget__grams mt-2 flex items-center gap-2">
                      <label className="text-xs text-gray-600">Gram/đơn vị:</label>
                      <input
                        type="number"
                        min={50}
                        max={5000}
                        step={50}
                        value={Number(it.weightGram || 0)}
                        onChange={(e) => changeWeightGram(it, e.target.value)}
                        className="w-24 border rounded-lg px-2 py-1 text-sm"
                      />
                      {/* Quick chips */}
                      <div className="mix-widget__chips flex items-center gap-1">
                        {[250, 500, 1000].map((g) => (
                          <button
                            key={g}
                            onClick={() => changeWeightGram(it, g)}
                            className={`px-2 py-0.5 rounded-lg border text-xs ${
                              Number(it.weightGram) === g
                                ? "bg-emerald-600 text-white border-emerald-600"
                                : "hover:bg-gray-50"
                            }`}
                            title={`Đổi sang ${g}g`}
                          >
                            {g}g
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Qty control */}
                  <div className="mix-widget__qty mt-2 flex items-center gap-2">
                    <button
                      className="px-2 py-1 rounded-lg border hover:bg-gray-50"
                      onClick={() => dec(it)}
                      title="Giảm 1"
                    >
                      −
                    </button>
                    <div className="w-10 text-center">{it.qty}</div>
                    <button
                      className="px-2 py-1 rounded-lg border hover:bg-gray-50"
                      onClick={() => inc(it)}
                      title="Tăng 1"
                    >
                      +
                    </button>
                    {/* Thông tin khối lượng dòng (nếu là/kg) */}
                    {isPerKg && kgPerLine > 0 ? (
                      <div className="text-xs text-gray-500 ml-2">
                        ≈ <b>{kgPerLine} kg</b> (theo dòng)
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Line total + Remove */}
                <div className="flex flex-col items-end gap-1">
                  <div className="mix-widget__line w-28 text-right font-semibold">
                    {formatPrice(linePrice)}
                  </div>
                  <button
                    className="mix-widget__remove text-xs text-gray-400 hover:text-red-600"
                    onClick={() => remove(it)}
                    title="Xoá"
                  >
                    ✕ Xoá
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Note */}
      <div className="mix-widget__note mt-4">
        <label className="text-sm text-gray-600">Ghi chú cho giỏ Mix</label>
        <textarea
          value={mixDraft.note || ""}
          onChange={(e) => mixDraftSetNote(e.target.value)}
          rows={3}
          placeholder="Ví dụ: trái chín vừa, bỏ hạt, thêm túi đá..."
          className="mt-1 w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {/* Footer */}
      <div className="mix-widget__footer mt-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="mix-widget__totals text-gray-600">
          <div>
            Tổng tạm tính:
            <span className="ml-2 font-semibold text-emerald-700">
              {formatPrice(total)}
            </span>
          </div>

          {!!items.length && (
            <div className="text-sm text-gray-500 mt-0.5">
              • {items.length} dòng
              {totalGram > 0 ? (
                <>
                  {" "}
                  • Khối lượng theo kg: <b>{totalKg} kg</b>
                </>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={finalizeAndCheckout}
            disabled={!items.length}
            className={`px-4 py-2 rounded-xl text-white ${
              items.length
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-gray-300 cursor-not-allowed"
            }`}
          >
            Đóng gói & thanh toán
          </button>
        </div>
      </div>
    </div>
  );
}
