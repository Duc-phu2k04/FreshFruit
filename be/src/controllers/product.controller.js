import productService from "../services/product.service.js";

const productController = {
  create: async (req, res) => {
    try {
      const {
        name,
        description,
        image,
        category,
        location,
        gradeOptions,
        weightOptions,
        ripenessOptions,
        baseVariant,
        variants,
      } = req.body;

      if (!name || !category || !location || !gradeOptions || !weightOptions || !ripenessOptions) {
        return res.status(400).json({ message: "Thiếu thông tin bắt buộc." });
      }

      if (!baseVariant && (!variants || variants.length === 0)) {
        return res.status(400).json({ message: "Phải có baseVariant hoặc ít nhất 1 biến thể trong variants." });
      }

      const newProduct = await productService.createProduct({
        name,
        description,
        image,
        category,
        location,
        gradeOptions,
        weightOptions,
        ripenessOptions,
        baseVariant,
        variants,
      });
      res.status(201).json(newProduct);
    } catch (error) {
      res.status(500).json({ message: "Lỗi server", error: error.message });
    }
  },

  getAll: async (req, res) => {
    try {
      const products = await productService.getAllProducts();

      // Gắn thêm trường price từ displayVariant hoặc baseVariant
      const transformedProducts = products.map((product) => {
        const price = product.displayVariant?.price ?? product.baseVariant?.price ?? 0;
        return {
          ...product.toObject?.() || product,
          price,
        };
      });

      res.json(transformedProducts);
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

      // Gắn thêm trường price vào sản phẩm đơn lẻ
      const price = product.displayVariant?.price ?? product.baseVariant?.price ?? 0;
      const transformedProduct = {
        ...product.toObject?.() || product,
        price,
      };

      res.json(transformedProduct);
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
