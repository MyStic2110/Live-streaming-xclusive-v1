import express from 'express';
import { getWhitelabelConfig } from '../controllers/configController.js';

const router = express.Router();

// Publicly accessible to style the login page before user signs in
router.get('/whitelabel/config', getWhitelabelConfig);

export default router;
