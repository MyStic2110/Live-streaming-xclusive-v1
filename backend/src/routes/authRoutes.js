import express from 'express';
import { register, login, getMe, forgotPassword, resetPassword } from '../controllers/authController.js';
import { authenticateToken, authRateLimiter } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/register', authRateLimiter(5, 15 * 60 * 1000), register);
router.post('/login', authRateLimiter(5, 15 * 60 * 1000), login);
router.get('/me', authenticateToken, getMe);
router.post('/forgot-password', authRateLimiter(3, 15 * 60 * 1000), forgotPassword);
router.post('/reset-password', authRateLimiter(3, 15 * 60 * 1000), resetPassword);

export default router;
