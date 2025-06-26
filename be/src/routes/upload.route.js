import express from 'express';
import { upload, uploadImage } from '../controllers/image.controller.js';

const router = express.Router();

// POST /api/upload
router.post('/', upload, uploadImage);

export default router;
