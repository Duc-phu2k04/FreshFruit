// server/controllers/shipping.controller.js
import ShippingZone from "../models/ShippingZone.model.js";

// Lấy tất cả zones
export const getZones = async (req, res) => {
  try {
    const zones = await ShippingZone.find().sort({ priority: -1 });
    res.json({ ok: true, data: zones });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
};

// Tạo mới zone
export const createZone = async (req, res) => {
  try {
    const zone = new ShippingZone(req.body);
    await zone.save();
    res.json({ ok: true, data: zone });
  } catch (e) {
    res.status(400).json({ ok: false, message: e.message });
  }
};

// Cập nhật zone
export const updateZone = async (req, res) => {
  try {
    const { id } = req.params;
    const zone = await ShippingZone.findByIdAndUpdate(id, req.body, { new: true });
    if (!zone) return res.status(404).json({ ok: false, message: "Not found" });
    res.json({ ok: true, data: zone });
  } catch (e) {
    res.status(400).json({ ok: false, message: e.message });
  }
};

// Xoá zone
export const deleteZone = async (req, res) => {
  try {
    const { id } = req.params;
    const zone = await ShippingZone.findByIdAndDelete(id);
    if (!zone) return res.status(404).json({ ok: false, message: "Not found" });
    res.json({ ok: true, message: "Deleted" });
  } catch (e) {
    res.status(400).json({ ok: false, message: e.message });
  }
};
