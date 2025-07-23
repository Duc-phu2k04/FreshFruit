import productService from '../services/product.service.js';

const productController = {
  create: async (req, res) => {
    try {
      const {
        name,
        description,
        category,
        location,
        gradeOptions,
        weightOptions,
        ripenessOptions,
        baseVariant
      } = req.body;

      if (!name || !category || !location || !gradeOptions || !weightOptions || !ripenessOptions || !baseVariant) {
        return res.status(400).json({ message: "Thiếu thông tin bắt buộc." });
      }

      const newProduct = await productService.createProduct({
        name,
        description,
        category,
        location,
        gradeOptions,
        weightOptions,
        ripenessOptions,
        baseVariant
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
