import productService from "../services/product.service.js";

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
      const products = await productService.getAllProducts();
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

  // ✅ NEW: Lấy sản phẩm theo tên danh mục
  getByCategoryName: async (req, res) => {
    try {
      const { categoryName } = req.params;
      const { limit = 4 } = req.query;
      
      const products = await productService.getLatestProductsByCategoryName(
        categoryName, 
        parseInt(limit)
      );
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: "Lỗi server", error: error.message });
    }
  },

  // ✅ NEW: Lấy sản phẩm theo category ID với filter
  getByCategoryWithFilter: async (req, res) => {
    try {
      const { categoryId } = req.params;
      const { limit, sort } = req.query;
      
      const products = await productService.getProductsByCategory(categoryId, { 
        limit, 
        sort 
      });
      res.json(products);
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

  // ✅ Cập nhật tồn kho / giá cho 1 biến thể
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

  // ✅ Xóa 1 biến thể theo ID
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
  }
};

export default productController;