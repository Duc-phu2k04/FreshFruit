// src/controllers/cart.controller.js
import Cart from "../models/cart.model.js";
import Product from "../models/product.model.js";

// Thêm sản phẩm vào giỏ hàng
export const addToCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId, quantity } = req.body;

    // Kiểm tra dữ liệu đầu vào
    if (!productId || !quantity) {
      return res.status(400).json({ message: "Thiếu productId hoặc quantity" });
    }

    const parsedQuantity = parseInt(quantity);
    if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
      return res.status(400).json({ message: "Số lượng không hợp lệ" });
    }

    // Tìm giỏ hàng theo user
    let cart = await Cart.findOne({ user: userId });

    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
    }

    // Kiểm tra sản phẩm đã có trong giỏ chưa
    const existingItemIndex = cart.items.findIndex(
      item => item.product.toString() === productId
    );

    if (existingItemIndex >= 0) {
      cart.items[existingItemIndex].quantity += parsedQuantity;
    } else {
      cart.items.push({ product: productId, quantity: parsedQuantity });
    }

    await cart.save();

    res.status(200).json({ message: "Đã thêm vào giỏ hàng", cart });
  } catch (error) {
    console.error("Lỗi khi thêm vào giỏ:", error.message);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// Cập nhật số lượng hoặc xoá sản phẩm trong giỏ hàng
export const updateCartItem = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId, quantity } = req.body;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) return res.status(404).json({ message: "Giỏ hàng không tồn tại" });

    const itemIndex = cart.items.findIndex(
      item => item.product.toString() === productId
    );

    if (itemIndex === -1) return res.status(404).json({ message: "Sản phẩm không có trong giỏ" });

    if (quantity > 0) {
      cart.items[itemIndex].quantity = quantity;
    } else {
      cart.items.splice(itemIndex, 1); // xoá sản phẩm
    }

    await cart.save();
    res.status(200).json({ message: "Đã cập nhật giỏ hàng", cart });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// Lấy giỏ hàng theo user
export const getCartByUser = async (req, res) => {
  try {
    const userId = req.user._id;
    const cart = await Cart.findOne({ user: userId }).populate("items.product");

    if (!cart) return res.status(200).json({ message: "Giỏ hàng trống", items: [] });

    res.status(200).json(cart);
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};