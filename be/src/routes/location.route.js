import express from "express";
import * as locationController from "../controllers/location.controller.js";
import { verifyToken, isAdmin } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Public
router.get("/", locationController.getAllLocations);

// Admin
router.post("/", verifyToken, isAdmin, locationController.createLocation);
router.delete("/:id", verifyToken, isAdmin, locationController.deleteLocation);
router.put("/:id", verifyToken, isAdmin, locationController.updateLocation);


export default router;
