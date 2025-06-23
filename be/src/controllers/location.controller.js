import Location from "../models/location.model.js";

export const getAllLocations = async (req, res) => {
  const locations = await Location.find();
  res.json(locations);
};

export const createLocation = async (req, res) => {
  const location = new Location(req.body);
  const saved = await location.save();
  res.status(201).json(saved);
};

export const deleteLocation = async (req, res) => {
  const deleted = await Location.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ message: "Not found" });
  res.json({ message: "Deleted successfully" });
};

// Cập nhật location theo ID
export const updateLocation = async (req, res) => {
  try {
    const updated = await Location.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({ message: "Location not found" });
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

