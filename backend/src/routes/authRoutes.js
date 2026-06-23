import express from 'express';
import { register, login, getMe, forgotPassword, resetPassword } from '../controllers/authController.js';
import { authenticateToken, authRateLimiter } from '../middlewares/authMiddleware.js';
import { validate } from '../middlewares/validate.js';
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from '../validation/schemas.js';

const router = express.Router();

router.post('/register', authRateLimiter(5, 15 * 60 * 1000), validate(registerSchema), register);
router.post('/login', authRateLimiter(5, 15 * 60 * 1000), validate(loginSchema), login);
router.get('/me', authenticateToken, getMe);
router.post('/forgot-password', authRateLimiter(3, 15 * 60 * 1000), validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', authRateLimiter(3, 15 * 60 * 1000), validate(resetPasswordSchema), resetPassword);

export default router;
