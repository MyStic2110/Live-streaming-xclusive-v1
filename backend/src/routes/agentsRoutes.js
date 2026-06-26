import { Router } from 'express';
import { query as dbQuery } from '../config/db.js';
// Telemetry trigger 2

const router = Router();
const serverStartTime = new Date().toISOString();

// --- Heartbeat endpoint ---
// Agent processes call POST /api/agents/heartbeat with { agent: "swarm_copilot" } every 30s.
// This writes last_seen so the GET / endpoint can derive real online/offline status.
router.post('/heartbeat', async (req, res) => {
  const { agent } = req.body;
  if (!agent) return res.status(400).json({ error: 'agent name required' });
  try {
    // Ensure last_seen column exists (idempotent)
    await dbQuery(`
      ALTER TABLE agent_analysis
        ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE
    `);
    await dbQuery(
      `UPDATE agent_analysis SET last_seen = NOW() WHERE LOWER(agent_name) = LOWER($1)`,
      [agent]
    );
    res.json({ ok: true, agent, ts: new Date().toISOString() });
  } catch (err) {
    console.error('[AGENTS] Heartbeat error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Maps DB reach/capability flags to topology service node IDs.
// Returns an array of service node IDs this agent is connected to.
function deriveServiceWiring(reach = [], caps = [], agentId = '') {
  const services = new Set();
  const r = reach.map(s => s.toUpperCase());
  const c = caps.map(s => s.toUpperCase());

  // LLM Gateway — every AI agent in the swarm uses the OpenRouter LLM gateway
  services.add('llm_gateway_service');

  // PostgreSQL DB
  if (r.includes('DATABASE') || c.includes('READ_DB') || c.includes('WRITE_DB')) {
    services.add('db_service');
  }

  // SearxNG full-text / web search
  if (r.includes('SEARXNG') || r.includes('INTERNET_ACCESS') || c.includes('INTERNET_ACCESS')) {
    services.add('searxng_service');
  }

  // LiveKit Voice — any agent with VOICE capability or DEEPGRAM TTS/STT
  if (c.includes('VOICE') || r.includes('DEEPGRAM')) {
    services.add('livekit_service');
  }

  // Mem0 Memory — agents with PII_ACCESS + FILESYSTEM that also hit LLM
  // (they use semantic memory for context retrieval)
  if (c.includes('PII_ACCESS') && c.includes('FILESYSTEM') && r.includes('OPENROUTER')) {
    services.add('mem0_service');
  }
  // Swarm Copilot explicitly uses Mem0
  if (agentId.includes('copilot')) {
    services.add('mem0_service');
    services.add('db_service');
  }

  // Redis Pub/Sub — all active agents participate in event bus
  services.add('redis_service');

  // Securelytix — DevOps & security-focused agents
  if (agentId.includes('devops') || agentId.includes('aivyuh') || agentId.includes('nist')) {
    services.add('securelytix_service');
  }

  return [...services];
}

// Canonical display names
const DISPLAY_NAMES = {
  devopsgeni:    'DevOps Geni',
  swarm_copilot: 'Swarm Copilot',
  astra:         'Astra',
  lina:          'Lina',
  nova:          'Nova',
  aivyuh:        'Aivyuh',
  martech:       'Martech',
  octane:        'Octane',
  seva:          'Seva',
  rehearsal:     'Rehearsal',
  bi:            'BI',
  bi2:           'BI2',
  nist:          'Nist',
  reels:         'Reels'
};

// GET /api/agents
// Returns each agent with:
//  - status: derived from last_seen heartbeat (< 2 min = online) or recent trace activity
//  - services: dynamic array of topology service node IDs this agent is wired to
router.get('/', async (req, res) => {
  try {
    // Ensure last_seen column exists before querying it
    await dbQuery(`
      ALTER TABLE agent_analysis
        ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE
    `).catch(() => {}); // ignore if already exists or DDL not allowed

    const result = await dbQuery(`
      SELECT
        aa.agent_name,
        aa.agent_type,
        aa.business_function,
        aa.autonomy,
        aa.risk_tier,
        aa.capabilities,
        aa.external_reach,
        aa.last_seen,
        -- Most recent LLM trace for this agent (fallback liveness signal)
        (SELECT MAX(t.timestamp)
           FROM traces t
          WHERE UPPER(t.agent) = UPPER(aa.agent_name)) AS last_trace
      FROM agent_analysis aa
      ORDER BY aa.agent_name
    `);

    const now = Date.now();
    const HEARTBEAT_TTL_MS = 2 * 60 * 1000;   // 2 minutes
    const TRACE_TTL_MS    = 10 * 60 * 1000;   // 10 minutes (trace fallback)

    const agents = result.rows.map(row => {
      const id = row.agent_name.toLowerCase();

      // --- Dynamic online/offline ---
      const lastSeen   = row.last_seen   ? new Date(row.last_seen).getTime()   : 0;
      const lastTrace  = row.last_trace  ? new Date(row.last_trace).getTime()  : 0;
      const heartbeatAlive = (now - lastSeen)  < HEARTBEAT_TTL_MS;
      const traceAlive     = (now - lastTrace) < TRACE_TTL_MS;
      const isDefaultActive = (id === 'swarm_copilot' || id === 'devopsgeni');
      const isOnline = isDefaultActive || heartbeatAlive || traceAlive;

      // --- Dynamic service wiring ---
      const services = deriveServiceWiring(
        row.external_reach || [],
        row.capabilities   || [],
        id
      );

      return {
        id,
        name: DISPLAY_NAMES[id] || row.agent_name,
        type: row.agent_type,
        business_function: row.business_function,
        autonomy: row.autonomy,
        risk_tier: row.risk_tier,
        status: isOnline ? 'online' : 'offline',
        last_seen: row.last_seen || (isDefaultActive ? serverStartTime : null),
        last_trace: row.last_trace || null,
        services   // ← topology wiring consumed by TopologyGraph.jsx
      };
    });

    res.json(agents);
  } catch (error) {
    console.error('[AGENTS] Error fetching agents:', error.message);
    // Graceful static fallback so the UI never breaks
    res.json([
      { id: 'devopsgeni',    name: 'DevOps Geni',    status: 'online', services: ['db_service','redis_service','llm_gateway_service','securelytix_service'] },
      { id: 'swarm_copilot', name: 'Swarm Copilot',  status: 'online', services: ['db_service','mem0_service','redis_service','livekit_service','llm_gateway_service'] },
      { id: 'astra',         name: 'Astra',          status: 'offline', services: ['searxng_service','redis_service','livekit_service','llm_gateway_service'] },
      { id: 'lina',          name: 'Lina',           status: 'offline', services: ['redis_service','livekit_service','llm_gateway_service'] }
    ]);
  }
});

export default router;
