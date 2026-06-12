import { query } from '../config/db.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AUDIT_PATH = path.resolve(__dirname, "../../../python-agent/agents/aivyuh/audit_history.json");

export const getComplianceSummary = async (req, res) => {
  try {
    const logRes = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE event_type = 'jailbreak_intercepted') as jailbreak_count,
        COUNT(*) FILTER (WHERE event_type = 'pii_blocked') as pii_count,
        COUNT(*) as total_events
      FROM compliance_logs
    `);
    
    const counts = logRes.rows[0] || {};
    
    let criticalCVEs = 0;
    let warningCVEs = 0;
    
    if (fs.existsSync(AUDIT_PATH)) {
      try {
        const history = JSON.parse(fs.readFileSync(AUDIT_PATH, "utf-8"));
        Object.values(history).forEach(agent => {
          criticalCVEs += (agent.critical_count || 0);
          warningCVEs += (agent.warning_count || 0);
        });
      } catch (e) {
        console.error("[COMPLIANCE_CONTROLLER] Error parsing audit path:", e.message);
      }
    }

    res.json({
      jailbreaksBlocked: parseInt(counts.jailbreak_count || 0, 10),
      piiBlocked: parseInt(counts.pii_count || 0, 10),
      criticalCVEs,
      warningCVEs,
      complianceScore: criticalCVEs === 0 ? "100%" : `${Math.max(0, 100 - criticalCVEs * 10)}%`
    });
  } catch (err) {
    console.error("[COMPLIANCE_CONTROLLER] Error fetching summary:", err.message);
    res.status(500).json({ error: err.message });
  }
};

export const getComplianceLogs = async (req, res) => {
  const page = parseInt(req.query.page || 1, 10);
  const limit = parseInt(req.query.limit || 10, 10);
  const offset = (page - 1) * limit;

  try {
    const logRes = await query(
      `SELECT * FROM compliance_logs ORDER BY timestamp DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const countRes = await query(`SELECT COUNT(*) FROM compliance_logs`);
    
    res.json({
      logs: logRes.rows,
      total: parseInt(countRes.rows[0].count || 0, 10),
      page,
      limit
    });
  } catch (err) {
    console.error("[COMPLIANCE_CONTROLLER] Error fetching logs:", err.message);
    res.status(500).json({ error: err.message });
  }
};

export const addComplianceLog = async (req, res) => {
  const { event_type, severity, agent, details } = req.body;
  try {
    const result = await query(
      `INSERT INTO compliance_logs (event_type, severity, agent, details)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [event_type, severity, agent, details ? JSON.stringify(details) : '{}']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("[COMPLIANCE_CONTROLLER] Error adding log:", err.message);
    res.status(500).json({ error: err.message });
  }
};
