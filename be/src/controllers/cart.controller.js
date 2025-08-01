import Cart from "../models/cart.model.js";
import Product from "../models/product.model.js";

// Thêm sản phẩm vào giỏ hàng
export const addToCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId, quantity, weight, ripeness } = req.body;

    if (!productId || quantity === undefined || quantity === null) {
      return res.status(400).json({ message: "Thiếu productId hoặc quantity" });
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
        item.weight === weight &&
        item.ripeness === ripeness
    );

    if (existingItemIndex >= 0) {
      cart.items[existingItemIndex].quantity += parsedQuantity;
    } else {
      cart.items.push({
        product: productId,
        quantity: parsedQuantity,
        weight,
        ripeness,
      });
    }

    await cart.save();
    const updatedCart = await Cart.findOne({ user: userId }).populate({
      path: "items.product",
      select: "name image variants",
    });

    const enrichedItems = updatedCart.items
      .filter((item) => item.product)
      .map((item) => {
        const variant = item.product.variants?.find(
          (v) => v.weight === item.weight && v.ripeness === item.ripeness
        );
        return {
          ...item.toObject(),
          price: variant?.price ?? null,
        };
      });

    res.status(200).json({ message: "Đã thêm vào giỏ hàng", items: enrichedItems });
  } catch (error) {
    console.error("Lỗi khi thêm vào giỏ:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// Cập nhật số lượng sản phẩm trong giỏ
export const updateCartItem = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId, quantity, weight, ripeness } = req.body;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) return res.status(404).json({ message: "Giỏ hàng không tồn tại" });

    const itemIndex = cart.items.findIndex(
      (item) =>
        item.product.toString() === productId &&
        item.weight === weight &&
        item.ripeness === ripeness
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
    const updatedCart = await Cart.findOne({ user: userId }).populate({
      path: "items.product",
      select: "name image variants",
    });

    const enrichedItems = updatedCart.items
      .filter((item) => item.product)
      .map((item) => {
        const variant = item.product.variants?.find(
          (v) => v.weight === item.weight && v.ripeness === item.ripeness
        );
        return {
          ...item.toObject(),
          price: variant?.price ?? null,
        };
      });

    res.status(200).json({ message: "Cập nhật thành công", items: enrichedItems });
  } catch (error) {
    console.error("Lỗi khi cập nhật giỏ hàng:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// Lấy giỏ hàng theo người dùng
export const getCartByUser = async (req, res) => {
  try {
    const userId = req.user._id;
    const cart = await Cart.findOne({ user: userId }).populate({
      path: "items.product",
      select: "name image variants",
    });

    if (!cart || cart.items.length === 0) {
      return res.status(200).json({ message: "Giỏ hàng trống", items: [] });
    }

    const enrichedItems = cart.items
      .filter((item) => item.product)
      .map((item) => {
        const variant = item.product.variants?.find(
          (v) => v.weight === item.weight && v.ripeness === item.ripeness
        );
        return {
          ...item.toObject(),
          price: variant?.price ?? null,
        };
      });

    res.status(200).json({ items: enrichedItems });
  } catch (error) {
    console.error("Lỗi khi lấy giỏ hàng:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// Xoá một sản phẩm khỏi giỏ hàng
export const removeCartItem = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId } = req.params;
    const { weight, ripeness } = req.query;

    if (!weight || !ripeness) {
      return res.status(400).json({ message: "Thiếu thông tin biến thể (weight hoặc ripeness)" });
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({ message: "Giỏ hàng không tồn tại" });
    }

    const initialLength = cart.items.length;
    cart.items = cart.items.filter(
      (item) =>
        item.product.toString() !== productId ||
        item.weight !== weight ||
        item.ripeness !== ripeness
    );

    if (cart.items.length === initialLength) {
      return res.status(404).json({ message: "Không tìm thấy biến thể sản phẩm để xoá" });
    }

    await cart.save();

    const updatedCart = await Cart.findOne({ user: userId }).populate({
      path: "items.product",
      select: "name image variants",
    });

    const enrichedItems = updatedCart.items
      .filter((item) => item.product)
      .map((item) => {
        const variant = item.product.variants?.find(
          (v) => v.weight === item.weight && v.ripeness === item.ripeness
        );
        return {
          ...item.toObject(),
          price: variant?.price ?? null,
        };
      });

    res.status(200).json({ message: "Đã xoá sản phẩm khỏi giỏ hàng", items: enrichedItems });
  } catch (error) {
    console.error("Lỗi khi xoá sản phẩm:", error);
    res.status(500).json({ message: "Lỗi server khi xoá sản phẩm", error: error.message });
  }
};

// Xoá toàn bộ giỏ hàng
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
    console.error("Lỗi khi xoá toàn bộ giỏ hàng:", error);
    res.status(500).json({ message: "Lỗi server khi xoá toàn bộ giỏ hàng", error: error.message });
  }
};
