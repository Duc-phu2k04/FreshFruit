// ✅ controllers/cart.controller.js
import Cart from "../models/cart.model.js";
import Product from "../models/product.model.js";

export const addToCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId, variantId, quantity } = req.body;

    if (!productId || !variantId || quantity === undefined || quantity === null) {
      return res.status(400).json({ message: "Thiếu productId, variantId hoặc quantity" });
    }

    const parsedQuantity = parseInt(quantity);
    if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
      return res.status(400).json({ message: "Số lượng không hợp lệ" });
    }

    let cart = await Cart.findOne({ user: userId });

    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
    }

    const existingItemIndex = cart.items.findIndex(
      (item) =>
        item.product.toString() === productId &&
        item.variantId.toString() === variantId
    );

    if (existingItemIndex >= 0) {
      cart.items[existingItemIndex].quantity += parsedQuantity;
    } else {
      cart.items.push({ product: productId, variantId, quantity: parsedQuantity });
    }

    await cart.save();
    const updatedCart = await Cart.findOne({ user: userId }).populate("items.product");

    res.status(200).json({ message: "Đã thêm vào giỏ hàng", items: updatedCart.items });
  } catch (error) {
    console.error("Lỗi khi thêm vào giỏ:", error.message);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

export const updateCartItem = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId, variantId, quantity } = req.body;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) return res.status(404).json({ message: "Giỏ hàng không tồn tại" });

    const itemIndex = cart.items.findIndex(
      (item) =>
        item.product.toString() === productId &&
        item.variantId.toString() === variantId
    );

    if (itemIndex === -1) {
      return res.status(404).json({ message: "Sản phẩm không có trong giỏ" });
    }

    if (quantity > 0) {
      cart.items[itemIndex].quantity = quantity;
    } else {
      cart.items.splice(itemIndex, 1);
    }

    await cart.save();
    const updatedCart = await Cart.findOne({ user: userId }).populate("items.product");

    res.status(200).json({ message: "Cập nhật thành công", items: updatedCart.items });
  } catch (error) {
    console.error("Lỗi khi cập nhật giỏ hàng:", error.message);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

export const getCartByUser = async (req, res) => {
  try {
    const userId = req.user._id;

    const cart = await Cart.findOne({ user: userId }).populate("items.product");

    if (!cart || cart.items.length === 0) {
      return res.status(200).json({ message: "Giỏ hàng trống", items: [] });
    }

    // Tìm thông tin variant tương ứng cho từng item
    const enrichedItems = cart.items.map((item) => {
      const product = item.product;

      // Tìm biến thể khớp với variantId
      const variant = product.variants.find(
        (v) => v._id.toString() === item.variantId.toString()
      );

      return {
        ...item.toObject(),
        variant, // gắn thêm thông tin variant vào item
      };
    });

    res.status(200).json({ items: enrichedItems });
  } catch (error) {
    console.error("Lỗi khi lấy giỏ hàng:", error.message);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

export const removeCartItem = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId, variantId } = req.params;

    console.log("🟢 API DELETE CART");
    console.log("👉 productId từ FE:", productId);
    console.log("👉 variantId từ FE:", variantId);

    const cart = await Cart.findOneAndUpdate(
      { user: userId },
      {
        $pull: {
          items: {
            product: productId,
            variantId: variantId,
          },
        },
      },
      { new: true }
    ).populate("items.product");

    if (!cart) {
      return res.status(404).json({ message: "Giỏ hàng không tồn tại" });
    }

    res.status(200).json({ message: "Đã xoá sản phẩm", items: cart.items });
  } catch (error) {
    console.error("❌ Lỗi khi xoá sản phẩm:", error);
    res.status(500).json({
      message: "Lỗi server khi xoá sản phẩm",
      error: error.message,
    });
  }
};

export const clearCart = async (req, res) => {
  try {
    const userId = req.user._id;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(200).json({ message: "Không có gì để xoá" });
    }

    cart.items = [];
    await cart.save();

    res.status(200).json({ message: "Đã xoá toàn bộ giỏ hàng" });
  } catch (error) {
    console.error("Lỗi khi xoá toàn bộ giỏ hàng:", error.message);
    res.status(500).json({ message: "Lỗi server khi xoá toàn bộ giỏ hàng", error: error.message });
  }
};
