// controllers/momo.controller.js
import momoService from '../services/momo.service.js';
import Order from '../models/order.model.js';
import Address from '../models/address.model.js'; // ✅ THÊM: để tra địa chỉ khi FE chỉ gửi _id

const momoController = {
  // Tạo thanh toán MoMo
  createPayment: async (req, res) => {
    try {
      const { cartItems, voucher, address, shippingAddress } = req.body; // ✅ nhận thêm shippingAddress nếu FE có gửi
      const userId = req.user._id;

      console.log("📦 Dữ liệu từ FE gửi lên MoMo:", {
        cartItems,
        voucher,
        address,
        shippingAddress
      });

      // ✅ HỢP LỆ HOÁ ĐỊA CHỈ GIAO HÀNG (giữ nguyên logic, chỉ fix thiếu dữ liệu)
      let normalizedShipping = shippingAddress || null;

      // Nếu FE không gửi shippingAddress đầy đủ, tra DB từ address._id
      if (
        !normalizedShipping ||
        !normalizedShipping.addressLine ||
        !normalizedShipping.phone
      ) {
        const addrId = address?._id || address?.id;
        if (addrId) {
          const addrDoc = await Address.findById(addrId).lean();
          if (addrDoc) {
            normalizedShipping = {
              fullName: normalizedShipping?.fullName || addrDoc.fullName,
              phone: normalizedShipping?.phone || addrDoc.phone,
              addressLine:
                normalizedShipping?.addressLine ||
                addrDoc.detail || addrDoc.addressLine || addrDoc.address,
              wardName:
                normalizedShipping?.wardName ||
                addrDoc.wardName || addrDoc.ward,
              districtName:
                normalizedShipping?.districtName ||
                addrDoc.districtName || addrDoc.district,
              provinceName:
                normalizedShipping?.provinceName ||
                addrDoc.provinceName || addrDoc.province,
              // Nếu schema có code, giữ lại luôn
              wardCode: normalizedShipping?.wardCode || addrDoc.wardCode,
              districtCode: normalizedShipping?.districtCode || addrDoc.districtCode,
              provinceCode: normalizedShipping?.provinceCode || addrDoc.provinceCode,
            };
          }
        }
      }

      // Nếu vẫn thiếu tối thiểu -> trả 400 (đúng thông điệp cũ), tránh ném 500
      if (!normalizedShipping?.addressLine || !normalizedShipping?.phone) {
        return res.status(400).json({
          message: 'Lỗi tạo thanh toán MoMo',
          error: 'Thiếu thông tin địa chỉ giao hàng',
        });
      }

      // Tạo đơn hàng (TRỪ STOCK NGAY) — giữ nguyên
      const order = await momoService.createOrderTemp({
        userId,
        cartItems,
        voucher,
        shippingAddress: normalizedShipping, // ✅ truyền địa chỉ đã hợp lệ hoá
      });

      console.log("✅ Đơn hàng tạo thành công (đã trừ stock):", order._id);

      // Tạo link thanh toán MoMo — giữ nguyên
      const paymentUrl = await momoService.createMomoPayment(order);

      console.log("🔗 URL thanh toán MoMo:", paymentUrl);

      res.status(200).json({ paymentUrl });
    } catch (err) {
      console.error('❌ Lỗi khi tạo thanh toán MoMo:', err);
      res.status(500).json({
        message: 'Lỗi tạo thanh toán MoMo',
        error: err.message || 'Unknown error'
      });
    }
  },

  // Xử lý IPN từ MoMo (xác nhận thanh toán) — giữ nguyên
  handleIPN: async (req, res) => {
    try {
      const { resultCode, orderId } = req.body;
      console.log("📥 MoMo IPN received:", req.body);

      if (resultCode === 0) {
        await momoService.confirmMomoOrder(orderId);
        return res.status(200).json({ message: "Xác nhận thanh toán thành công" });
      } else {
        console.warn("⚠️ Giao dịch thất bại, đang hoàn stock...");
        await momoService.cancelMomoOrder(orderId);
        return res.status(200).json({ message: "Giao dịch thất bại, đã hoàn stock" });
      }
    } catch (err) {
      console.error("❌ Lỗi xử lý IPN:", err);
      return res.status(500).json({ message: "Lỗi xử lý IPN", error: err.message });
    }
  },

  // API hủy tay — giữ nguyên
  cancelOrder: async (req, res) => {
    try {
      const { orderId } = req.params;
      const userId = req.user._id;

      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
      }
      if (order.user.toString() !== userId.toString()) {
        return res.status(403).json({ message: "Không có quyền hủy đơn này" });
      }
      if (order.paymentStatus === 'paid') {
        return res.status(400).json({ message: "Không thể hủy đơn đã thanh toán" });
      }

      await momoService.cancelMomoOrder(orderId);
      res.json({ message: "Hủy đơn hàng thành công, đã hoàn stock" });
    } catch (err) {
      console.error("❌ Lỗi hủy đơn:", err);
      res.status(500).json({ message: "Lỗi hủy đơn hàng", error: err.message });
    }
  }
};

export default momoController;
