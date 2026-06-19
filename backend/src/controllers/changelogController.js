import { query } from '../config/db.js';
import logger from '../config/logger.js';

// Derive a stable anonymous visitor ID from IP + User-Agent
function getVisitorId(req) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  const ua = req.headers['user-agent'] || '';
  // Simple hash — not crypto-secure, just stable across sessions
  let hash = 0;
  const str = ip + ua;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return `visitor_${Math.abs(hash).toString(36)}`;
}

// Ensure the changelog_likes table exists (called lazily)
async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS changelog_likes (
      sha         VARCHAR(40) PRIMARY KEY,
      like_count  INTEGER NOT NULL DEFAULT 0,
      liked_by    TEXT[]  NOT NULL DEFAULT '{}'
    );
  `);
}

/**
 * GET /api/changelog/likes
 * Returns all like counts as { sha: count } map, plus the current visitor's liked SHAs.
 */
export const getLikes = async (req, res) => {
  try {
    await ensureTable();
    const visitorId = getVisitorId(req);
    const result = await query(`SELECT sha, like_count, liked_by FROM changelog_likes`);

    const counts = {};
    const likedByMe = [];

    for (const row of result.rows) {
      counts[row.sha] = row.like_count;
      if (row.liked_by && row.liked_by.includes(visitorId)) {
        likedByMe.push(row.sha);
      }
    }

    return res.json({ counts, likedByMe, visitorId });
  } catch (err) {
    logger.error(`[CHANGELOG] getLikes error: ${err.message}`);
    return res.status(500).json({ error: 'Database error' });
  }
};

/**
 * POST /api/changelog/likes/:sha/toggle
 * Toggles the like state for the current visitor on a commit SHA.
 * Returns { sha, liked, count }
 */
export const toggleLike = async (req, res) => {
  const { sha } = req.params;
  if (!sha || !/^[a-f0-9]{7,40}$/i.test(sha)) {
    return res.status(400).json({ error: 'Invalid SHA' });
  }

  try {
    await ensureTable();
    const visitorId = getVisitorId(req);

    // Upsert the row if it doesn't exist yet
    await query(`
      INSERT INTO changelog_likes (sha, like_count, liked_by)
      VALUES ($1, 0, '{}')
      ON CONFLICT (sha) DO NOTHING
    `, [sha]);

    // Read current state
    const { rows } = await query(`SELECT like_count, liked_by FROM changelog_likes WHERE sha = $1`, [sha]);
    const current = rows[0];
    const alreadyLiked = current.liked_by && current.liked_by.includes(visitorId);

    let newCount, newLikedBy;
    if (alreadyLiked) {
      // Unlike — remove visitor from liked_by, decrement
      newLikedBy = current.liked_by.filter(v => v !== visitorId);
      newCount = Math.max(0, current.like_count - 1);
    } else {
      // Like — add visitor to liked_by, increment
      newLikedBy = [...(current.liked_by || []), visitorId];
      newCount = current.like_count + 1;
    }

    await query(`
      UPDATE changelog_likes SET like_count = $1, liked_by = $2 WHERE sha = $3
    `, [newCount, newLikedBy, sha]);

    logger.info(`[CHANGELOG] ${visitorId} ${alreadyLiked ? 'unliked' : 'liked'} ${sha.slice(0, 7)} → ${newCount} likes`);
    return res.json({ sha, liked: !alreadyLiked, count: newCount });
  } catch (err) {
    logger.error(`[CHANGELOG] toggleLike error: ${err.message}`);
    return res.status(500).json({ error: 'Database error' });
  }
};
