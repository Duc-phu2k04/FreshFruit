import mongoose from "mongoose";

const locationSchema = new mongoose.Schema({
  name: { type: String, required: true }, // VD: "Hà Nội", "Thái Lan"
  type: { type: String, enum: ["province", "country"], required: true },
}, { timestamps: true });

const Location = mongoose.model("Location", locationSchema);
export default Location;
