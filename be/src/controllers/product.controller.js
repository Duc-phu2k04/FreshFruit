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

  // ✅ Xóa 1 hoặc nhiều biến thể
  removeVariants: async (req, res) => {
    try {
      const { attributesList } = req.body; // mảng [{ weight, ripeness }]
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
  }
};

export default productController;
