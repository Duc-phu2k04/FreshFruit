// src/controllers/category.controller.js
import  Category  from "../models/category.model.js";

export const getAllCategories = async (req, res) => {
  const categories = await Category.find();
  res.json(categories);
};

export const getCategoryById = async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) return res.status(404).json({ message: "Not found" });
  res.json(category);
};

export const createCategory = async (req, res) => {
  const newCategory = new Category(req.body);
  const saved = await newCategory.save();
  res.status(201).json(saved);
};

export const updateCategory = async (req, res) => {
  const updated = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!updated) return res.status(404).json({ message: "Not found" });
  res.json(updated);
};

export const deleteCategory = async (req, res) => {
  const deleted = await Category.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ message: "Not found" });
  res.json({ message: "Deleted successfully" });
};
