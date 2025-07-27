import productService from '../services/product.service.js';

const productController = {
  create: async (req, res) => {
    try {
      const {
        name,
        description,
        image, // ✅ THÊM DÒNG NÀY
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
        image, // ✅ ĐÃ ĐƯỢC KHAI BÁO VÀ TRUYỀN VÀO
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
      console.error("Error in create product:", error);
      res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
  },

  getAll: async (req, res) => {
    try {
      const products = await productService.getAllProducts();
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
  },

  getById: async (req, res) => {
    try {
      const product = await productService.getProductById(req.params.id);
      if (!product) {
        return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
      }
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
  },

  update: async (req, res) => {
    try {
      const updatedProduct = await productService.updateProduct(req.params.id, req.body);
      if (!updatedProduct) {
        return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
      }
      res.json(updatedProduct);
    } catch (error) {
      res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
  },

  remove: async (req, res) => {
    try {
      const deletedProduct = await productService.deleteProduct(req.params.id);
      if (!deletedProduct) {
        return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
      }
      res.json({ message: 'Xoá sản phẩm thành công' });
    } catch (error) {
      res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
  },
};

export default productController;
