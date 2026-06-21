import express from 'express';
import { applyToRole } from '../controllers/careersController.js';

const router = express.Router();

router.post('/apply', applyToRole);

export default router;
