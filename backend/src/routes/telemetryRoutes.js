import express from 'express';
import * as telemetryController from '../controllers/telemetryController.js';
import * as roomController from '../controllers/roomController.js';
import * as complianceController from '../controllers/complianceController.js';
import { authenticateToken, requireRole } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Trace collection (public or internal key recommended, but for compatibility keep JWT or basic auth)
// Since LLM traces come from agent processes, we allow authenticated requests.
router.post('/llm-trace', telemetryController.handleLlmTrace);
router.post('/llm-trace/tool-call', telemetryController.handleToolCall);

// Trace management (Operator / Admin / Viewer RBAC)
router.get('/llm-traces', authenticateToken, requireRole(['admin', 'operator', 'viewer']), telemetryController.getTraces);
router.delete('/llm-traces', authenticateToken, requireRole(['admin']), telemetryController.clearTraces);

// Hallucination evaluation (Operator / Admin / Viewer RBAC)
router.post('/evaluate-hallucination', authenticateToken, requireRole(['admin', 'operator']), telemetryController.evaluateHallucination);
router.get('/hallucination-results', authenticateToken, requireRole(['admin', 'operator', 'viewer']), telemetryController.getHallucinations);

// Security audits (Operator / Admin / Viewer RBAC)
router.get('/security/status', authenticateToken, requireRole(['admin', 'operator', 'viewer']), roomController.getSecurityStatus);
router.post('/security/scan', authenticateToken, requireRole(['admin', 'operator']), roomController.runSecurityScan);
router.post('/security/aivyuh-scan', authenticateToken, requireRole(['admin', 'operator']), roomController.runAivyuhScan);
router.post('/security/nist-scan', authenticateToken, requireRole(['admin', 'operator']), roomController.runNistScan);
router.post('/security/remediate', authenticateToken, requireRole(['admin']), roomController.updateSecurityConstraint);
router.post('/detokenize', authenticateToken, telemetryController.detokenize);

// Compliance audits (Operator / Admin / Viewer RBAC)
router.get('/compliance/summary', authenticateToken, requireRole(['admin', 'operator', 'viewer']), complianceController.getComplianceSummary);
router.get('/compliance/logs', authenticateToken, requireRole(['admin', 'operator', 'viewer']), complianceController.getComplianceLogs);
router.post('/compliance/log', authenticateToken, requireRole(['admin', 'operator']), complianceController.addComplianceLog);

export default router;


