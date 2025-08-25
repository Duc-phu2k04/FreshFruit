import mongoose from "mongoose";

/* ====== Giữ nguyên schema biến thể cũ ====== */
const variantSchema = new mongoose.Schema({
  attributes: {
    weight: { type: String, required: true },
    ripeness: { type: String, required: true }
  },
  price: { type: Number, required: true },
  stock: { type: Number, default: 0 }
});

/* ====== (Mới) Phân bổ đặt trước theo biến thể - hoàn toàn tùy chọn ======
   Dùng khi bạn muốn giới hạn quota đặt trước cụ thể theo cặp (weight, ripeness).
   Không dùng cũng không sao; để trống mặc định. */
const preorderVariantAllocationSchema = new mongoose.Schema({
  attributes: {
    weight: { type: String, required: true },
    ripeness: { type: String, required: true }
  },
  quota: { type: Number, default: 0 },        // hạn mức đặt trước cho biến thể này
  soldPreorder: { type: Number, default: 0 }  // số đã giữ chỗ qua đặt trước
}, { _id: false });

/* ====== Schema sản phẩm (đã bổ sung khối preorder) ====== */
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  image: String,
  category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
  location: { type: mongoose.Schema.Types.ObjectId, ref: "Location" },
  weightOptions: [String],
  ripenessOptions: [String],

  baseVariant: {
    attributes: {
      weight: String,
      ripeness: String
    },
    price: Number,
    stock: Number
  },

  variants: [variantSchema],

  displayVariant: {
    type: Object, // lưu biến thể hiển thị ngoài FE
    default: null
  },

  /* ====== (Mới) Cấu hình ĐẶT TRƯỚC ======
     - Hoàn toàn tùy chọn; nếu không bật, mọi thứ hoạt động như cũ.
     - Dùng quota tổng hoặc theo biến thể (perVariantAllocations). */
  preorder: {
    enabled: { type: Boolean, default: false },      // bật/tắt đặt trước
    // Cửa sổ mở đặt trước
    windowStart: { type: Date, default: null },
    windowEnd:   { type: Date, default: null },

    // Thời gian dự kiến có hàng/giao
    expectedHarvestStart: { type: Date, default: null },
    expectedHarvestEnd:   { type: Date, default: null },

    // Hạn mức tổng đặt trước (không phân biệt biến thể)
    quota: { type: Number, default: 0 },
    soldPreorder: { type: Number, default: 0 }, // đã giữ chỗ tổng

    // Cọc mặc định (%)
    depositPercent: { type: Number, default: 20 },

    // Chính sách hủy
    cancelPolicy: {
      untilDate: { type: Date, default: null },     // hủy trước ngày này: hoàn 100%
      feePercent: { type: Number, default: 0 }      // sau hạn: thu phí %
    },

    // Khóa giá cho khách đã đặt cọc dù giá niêm yết có thay đổi
    priceLock: { type: Boolean, default: true },

    // (Tuỳ chọn) phân bổ theo biến thể
    perVariantAllocations: {
      type: [preorderVariantAllocationSchema],
      default: []
    }
  }

}, { timestamps: true });

export default mongoose.model("Product", productSchema);
