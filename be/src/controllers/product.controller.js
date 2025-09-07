// server/controllers/product.controller.js
import productService from "../services/product.service.js";
import { computeExpiryInfo } from "../utils/expiryHelpers.js";

/** Gắn _expiry vào 1 product (dựa trên giá của variant đầu tiên hoặc baseVariant) */
function attachExpiryView(p) {
  if (!p) return p;
  // Nếu service đã gắn sẵn _expiry thì giữ nguyên
  if (p._expiry) return p;

  // Lưu ý: p có thể là document mongoose hoặc plain object
  const plain = typeof p.toObject === "function" ? p.toObject() : p;
  const firstPrice =
    plain?.variants?.[0]?.price ??
    plain?.baseVariant?.price ??
    0;

  const info = computeExpiryInfo(plain, firstPrice);
  return { ...plain, _expiry: info };
}

/** Gắn _expiry cho mảng sản phẩm */
function attachExpiryList(arr) {
  if (!Array.isArray(arr)) return arr;
  return arr.map(attachExpiryView);
}

const productController = {
  create: async (req, res) => {
    try {
      // Cho phép gửi kèm "expiry" trong body; service chịu trách nhiệm merge/sanitize
      const created = await productService.createProduct(req.body);

      // Lấy lại theo service để có dữ liệu đầy đủ rồi đảm bảo _expiry
      const full = await productService.getProductById(created._id);
      return res.status(201).json(attachExpiryView(full));
    } catch (error) {
      return res.status(500).json({ message: "Lỗi server", error: error.message });
    }
  },

  getAll: async (req, res) => {
    try {
      // Truyền req.query để service có thể lọc (vd: preorder=true/false, sort, limit, ...)
      const data = await productService.getAllProducts(req.query);

      // Trường hợp service trả { products } hoặc trả mảng trực tiếp — chuẩn hoá để gắn _expiry
      if (Array.isArray(data)) {
        return res.json(attachExpiryList(data));
      }
      if (Array.isArray(data?.products)) {
        return res.json({ ...data, products: attachExpiryList(data.products) });
      }
      // Data không theo chuẩn trên -> vẫn trả về, cố gắng gắn _expiry nếu là 1 item
      if (data && typeof data === "object" && data._id) {
        return res.json(attachExpiryView(data));
      }
      return res.json(data);
    } catch (error) {
      return res.status(500).json({ message: "Lỗi server", error: error.message });
    }
  },

  getById: async (req, res) => {
    try {
      const product = await productService.getProductById(req.params.id);
      if (!product) {
        return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
      }
      return res.json(attachExpiryView(product));
    } catch (error) {
      return res.status(500).json({ message: "Lỗi server", error: error.message });
    }
  },

  //  Lấy sản phẩm theo tên danh mục (mới)
  getByCategoryName: async (req, res) => {
    try {
      const { categoryName } = req.params;
      const limit = parseInt(req.query.limit ?? 4, 10);

      const products = await productService.getLatestProductsByCategoryName(
        categoryName,
        limit
      );
      return res.json(attachExpiryList(products));
    } catch (error) {
      return res.status(500).json({ message: "Lỗi server", error: error.message });
    }
  },

  //  Lấy sản phẩm theo category ID với filter (mới)
  getByCategoryWithFilter: async (req, res) => {
    try {
      const { categoryId } = req.params;
      const { limit, sort } = req.query;

      const products = await productService.getProductsByCategory(categoryId, {
        limit,
        sort,
      });
      return res.json(attachExpiryList(products));
    } catch (error) {
      return res.status(500).json({ message: "Lỗi server", error: error.message });
    }
  },

  update: async (req, res) => {
    try {
      // Cho phép cập nhật kèm "expiry" trong body; service merge/sanitize
      const updated = await productService.updateProduct(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
      }

      // Lấy lại để có dữ liệu đầy đủ rồi gắn _expiry
      const full = await productService.getProductById(updated._id);
      return res.json(attachExpiryView(full));
    } catch (error) {
      return res.status(500).json({ message: "Lỗi server", error: error.message });
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
      return res.status(500).json({ message: "Lỗi server", error: error.message });
    }
  },

  // Xóa nhiều biến thể theo attributesList
  removeVariants: async (req, res) => {
    try {
      const { attributesList } = req.body;
      if (!Array.isArray(attributesList) || attributesList.length === 0) {
        return res.status(400).json({ message: "Cần truyền danh sách biến thể để xóa" });
      }
      const updatedProduct = await productService.deleteVariants(
        req.params.id,
        attributesList
      );
      if (!updatedProduct) {
        return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
      }
      return res.json({
        message: "Xóa biến thể thành công",
        product: attachExpiryView(updatedProduct),
      });
    } catch (error) {
      return res.status(500).json({ message: "Lỗi server", error: error.message });
    }
  },

  //  Cập nhật tồn kho / giá cho 1 biến thể
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
      // Trả lại product kèm _expiry mới
      return res.json(attachExpiryView(updatedProduct));
    } catch (error) {
      return res.status(500).json({ message: "Lỗi server", error: error.message });
    }
  },

  //  Xóa 1 biến thể theo ID
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
        product: attachExpiryView(updatedProduct),
      });
    } catch (error) {
      return res.status(500).json({ message: "Lỗi server", error: error.message });
    }
  },

  /* =========================================================
   *  MỚI: Danh sách "Sắp vào mùa" (Coming Soon)
   *  GET /api/product/coming-soon?limit=24&category=<id>
   * ========================================================= */
  getComingSoon: async (req, res) => {
    try {
      const items = await productService.getComingSoonProducts(req.query);
      return res.json(attachExpiryList(items));
    } catch (error) {
      return res.status(500).json({ message: "Lỗi server", error: error.message });
    }
  },
};

export default productController;
