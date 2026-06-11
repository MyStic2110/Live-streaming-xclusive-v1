import express from 'express';
import * as roomController from '../controllers/roomController.js';
import { authenticateToken, requireRole } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Operator/Admin actions
router.post('/talk-to-ai', authenticateToken, requireRole(['admin', 'operator']), roomController.talkToAI);
router.post('/deploy-shadow', authenticateToken, requireRole(['admin', 'operator']), roomController.deployShadow);
router.post('/trigger-reels', authenticateToken, requireRole(['admin', 'operator']), roomController.triggerReels);
router.post('/copilot/chat', authenticateToken, requireRole(['admin', 'operator']), roomController.copilotChat);
router.post('/copilot/session/clear', authenticateToken, requireRole(['admin', 'operator']), roomController.clearCopilotSession);

// Shared/Viewer actions
router.get('/insights', roomController.getAstraInsights);
router.get('/weather', roomController.getWeather);

export default router;
