import express from 'express';
import { query as dbQuery } from '../config/db.js';
import { getTopLeaderboard } from '../sockets/battleSocket.js';
import logger from '../config/logger.js';

const router = express.Router();

// Helper to mask emails
const maskEmail = (email) => {
  if (!email || !email.includes('@')) return 'anonymous@gmail.com';
  const [username, domain] = email.split('@');
  if (username.length <= 3) {
    return `${username.slice(0, 1)}***@${domain}`;
  }
  return `${username.slice(0, 3)}***@${domain}`;
};

/**
 * POST /api/battle/verify-token
 * Validates a battle token and returns basic details (without marking it as used).
 * This is used by the frontend to confirm token validity before initiating the socket connection.
 */
router.post('/verify-token', async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'Token is required.' });
  }

  try {
    const dbResult = await dbQuery(
      `SELECT name, email, role_title, battle_token_used 
       FROM careers_applications 
       WHERE battle_token = $1`,
      [token]
    );

    if (dbResult.rows.length === 0) {
      return res.status(404).json({ error: 'Battle Token not found.' });
    }

    const candidate = dbResult.rows[0];

    return res.json({
      success: true,
      name: candidate.name,
      maskedEmail: maskEmail(candidate.email),
      role: candidate.role_title
    });
  } catch (err) {
    logger.error(`[BATTLE_ROUTES] Token verification error: ${err.message}`);
    return res.status(500).json({ error: 'Internal database error during verification.' });
  }
});

/**
 * GET /api/battle/leaderboard
 * Fetches the top 10 players ranked on the Redis ZSET leaderboard.
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const leaderboard = await getTopLeaderboard();
    return res.json({ success: true, leaderboard });
  } catch (err) {
    logger.error(`[BATTLE_ROUTES] Leaderboard fetch error: ${err.message}`);
    return res.status(500).json({ error: 'Internal server error while fetching leaderboard.' });
  }
});

export default router;
