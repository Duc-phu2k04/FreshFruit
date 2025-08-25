// controllers/product.controller.js
import productService from "../services/product.service.js";
import Product from "../models/product.model.js"; // dùng cho getComingSoon

const productController = {
  create: async (req, res) => {
    try {
      const newProduct = await productService.createProduct(req.body);
      res.status(201).json(newProduct);
    } catch (error) {
      res.status(500).json({ message: "Lỗi server", error: error.message });
    }
  },

  getAll: async (req, res) => {
    try {
      // Quan trọng: truyền req.query để service có thể lọc preorder=true/false
      const products = await productService.getAllProducts(req.query);
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: "Lỗi server", error: error.message });
    }
  },

  getById: async (req, res) => {
    try {
      const product = await productService.getProductById(req.params.id);
      if (!product) {
        return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
      }
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: "Lỗi server", error: error.message });
    }
  },

  update: async (req, res) => {
    try {
      const updatedProduct = await productService.updateProduct(req.params.id, req.body);
      if (!updatedProduct) {
        return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
      }
      res.json(updatedProduct);
    } catch (error) {
      res.status(500).json({ message: "Lỗi server", error: error.message });
    }
  },

  remove: async (req, res) => {
    try {
      const deletedProduct = await productService.deleteProduct(req.params.id);
      if (!deletedProduct) {
        return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
      }
      res.json({ message: "Xoá sản phẩm thành công" });
    } catch (error) {
      res.status(500).json({ message: "Lỗi server", error: error.message });
    }
  },

  // Xóa nhiều biến thể theo attributesList
  removeVariants: async (req, res) => {
    try {
      const { attributesList } = req.body;
      if (!Array.isArray(attributesList) || attributesList.length === 0) {
        return res.status(400).json({ message: "Cần truyền danh sách biến thể để xóa" });
      }
      const updatedProduct = await productService.deleteVariants(req.params.id, attributesList);
      if (!updatedProduct) {
        return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
      }
      res.json({ message: "Xóa biến thể thành công", product: updatedProduct });
    } catch (error) {
      res.status(500).json({ message: "Lỗi server", error: error.message });
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
        return res.status(404).json({ message: "Không tìm thấy sản phẩm hoặc biến thể" });
      }
      res.json(updatedProduct);
    } catch (error) {
      res.status(500).json({ message: "Lỗi server", error: error.message });
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
        return res.status(404).json({ message: "Không tìm thấy sản phẩm hoặc biến thể" });
      }
      res.json({ message: "Xóa biến thể thành công", product: updatedProduct });
    } catch (error) {
      res.status(500).json({ message: "Lỗi server", error: error.message });
    }
  },

  /* =========================================================
   *  MỚI: Danh sách "Sắp vào mùa" (Coming Soon)
   * Route: GET /api/product/coming-soon?limit=24&category=<id>
   * Trả về sản phẩm có preorder.enabled = true
   * và (còn trong windowEnd hoặc chưa tới expectedHarvestStart
   *     hoặc không cấu hình ngày nhưng đã bật preorder)
   * ========================================================= */
  getComingSoon: async (req, res) => {
    try {
      const now = new Date();
      const { limit = 24, category } = req.query;

      const filter = {
        "preorder.enabled": true,
        $or: [
          { "preorder.windowEnd": { $gte: now } },
          { "preorder.expectedHarvestStart": { $gte: now } },
          { "preorder.windowEnd": { $exists: false } }
        ]
      };
      if (category) filter.category = category;

      const items = await Product.find(filter)
        .sort({ "preorder.expectedHarvestStart": 1, createdAt: -1 })
        .limit(Number(limit))
        .populate("category", "name")
        .populate("location", "name");

      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Lỗi server", error: error.message });
    }
  }
};

export default productController;
