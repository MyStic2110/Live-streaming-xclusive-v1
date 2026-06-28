/**
 * test_loop_engineering.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * End-to-end validation for the Loop Engineering node + score pipeline.
 * 
 * What it tests:
 *  1. Emits  copilot_loop_status  socket events (loop_start + loop_evaluation)
 *     → confirms the frontend will receive iteration scores in real-time.
 *  2. Sends a full llm_start → llm_end trace sequence via HTTP.
 *  3. Waits 3 s then queries /api/hallucination-results to confirm the
 *     auto-judge evaluation has run and stored a score.
 *  4. Listens for the  hallucination_result  WebSocket push and prints it.
 * 
 * Usage:
 *   node test_loop_engineering.mjs [backend_url] [token]
 * 
 *   backend_url  defaults to  http://localhost:3002
 *   token        a valid JWT (needed for /api/hallucination-results GET).
 *                If omitted the GET is still attempted (may 401).
 */

import { io } from 'socket.io-client';

// ─── Config ──────────────────────────────────────────────────────────────────
const BASE_URL = process.argv[2] || 'http://localhost:3002';
const TOKEN    = process.argv[3] || null;
const run_id   = 'test_loop_' + Math.random().toString(36).slice(2, 9);
const AGENT    = 'SWARM_COPILOT';

const sleep = ms => new Promise(r => setTimeout(r, ms));

const COLOUR = {
  reset : '\x1b[0m',
  cyan  : '\x1b[36m',
  green : '\x1b[32m',
  yellow: '\x1b[33m',
  red   : '\x1b[31m',
  bold  : '\x1b[1m',
};
const log = (colour, tag, msg) =>
  console.log(`${colour}${COLOUR.bold}[${tag}]${COLOUR.reset}${colour} ${msg}${COLOUR.reset}`);

// ─── Socket Listener ──────────────────────────────────────────────────────────
function attachSocketListeners() {
  const socket = io(BASE_URL, { transports: ['websocket'] });

  const received = {
    llm_trace_start     : false,
    llm_trace_end       : false,
    hallucination_result: false,
    copilot_loop_status : [],
  };

  socket.on('connect', () => log(COLOUR.cyan, 'SOCKET', `Connected  id=${socket.id}`));
  socket.on('disconnect', () => log(COLOUR.yellow, 'SOCKET', 'Disconnected'));

  socket.on('llm_trace', ({ event, run_id: rid, data }) => {
    if (rid !== run_id) return;
    if (event === 'llm_start') {
      received.llm_trace_start = true;
      log(COLOUR.cyan, 'SOCKET ←', `llm_trace  event=llm_start  model=${data?.model}`);
    } else if (event === 'llm_end') {
      received.llm_trace_end = true;
      log(COLOUR.green, 'SOCKET ←', `llm_trace  event=llm_end  tokens=${data?.prompt_tokens}+${data?.completion_tokens}  cost=$${data?.total_cost}`);
    }
  });

  socket.on('hallucination_result', result => {
    if (result.run_id !== run_id) return;
    received.hallucination_result = true;
    const acc = Math.round((1 - result.score) * 100);
    const label = result.score <= 0.20 ? 'ACCURATE' : result.score <= 0.50 ? 'UNCERTAIN' : result.score <= 0.75 ? 'SUSPECT' : 'HALLUCINATED';
    log(COLOUR.green, 'SOCKET ←', `hallucination_result  score=${result.score.toFixed(2)}  accuracy=${acc}%  label=${label}`);
    log(COLOUR.green, 'SOCKET ←', `  reasoning: "${result.reasoning}"`);
    if (result.flags?.length) {
      log(COLOUR.yellow, 'SOCKET ←', `  flags: ${result.flags.join(' | ')}`);
    }
  });

  socket.on('copilot_loop_status', payload => {
    if (payload.run_id !== run_id) return;
    received.copilot_loop_status.push(payload);
    if (payload.event === 'loop_start') {
      log(COLOUR.cyan, 'SOCKET ←', `copilot_loop_status  event=loop_start  iter=${payload.iteration}  query="${(payload.query||'').slice(0,60)}"`);
    } else if (payload.event === 'loop_evaluation') {
      const pct = payload.evidenceScore !== undefined ? Math.round(payload.evidenceScore * 100) + '%' : '?';
      const suffix = payload.enoughEvidence
        ? `✅ sufficient`
        : `⚠️  gap="${payload.gapDescription||'?'}"`;
      log(COLOUR.yellow, 'SOCKET ←', `copilot_loop_status  event=loop_evaluation  iter=${payload.iteration}  evidenceScore=${pct}  ${suffix}`);
    }
  });

  return { socket, received };
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
async function post(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function get(path) {
  const headers = { 'Content-Type': 'application/json' };
  if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;
  const res = await fetch(`${BASE_URL}${path}`, { headers });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

// ─── Simulate Loop Engineering socket events ──────────────────────────────────
async function emitLoopEvents(socket) {
  // These would normally come from the backend; we emit directly so the test
  // is self-contained even if the real copilot isn't running.
  log(COLOUR.cyan, 'EMIT →', 'Simulating copilot_loop_status  iter=1  loop_start');
  socket.emit('copilot_loop_status', {
    run_id,
    event    : 'loop_start',
    iteration: 1,
    query    : 'What are Swarm enterprise pricing tiers and plans?',
    timestamp: Date.now(),
  });
  await sleep(800);

  log(COLOUR.cyan, 'EMIT →', 'Simulating copilot_loop_status  iter=1  loop_evaluation  evidenceScore=0.45');
  socket.emit('copilot_loop_status', {
    run_id,
    event           : 'loop_evaluation',
    iteration       : 1,
    enoughEvidence  : false,
    explanation     : 'Pricing page found but enterprise contract details missing.',
    gapDescription  : 'No enterprise custom contract pricing found.',
    suggestedQuery  : 'enterprise custom contract pricing Swarm',
    suggestedVerticals: ['pricing'],
    evidenceScore   : 0.45,
    timestamp       : Date.now(),
  });
  await sleep(800);

  log(COLOUR.cyan, 'EMIT →', 'Simulating copilot_loop_status  iter=2  loop_start');
  socket.emit('copilot_loop_status', {
    run_id,
    event    : 'loop_start',
    iteration: 2,
    query    : 'enterprise custom contract pricing Swarm',
    timestamp: Date.now(),
  });
  await sleep(800);

  log(COLOUR.cyan, 'EMIT →', 'Simulating copilot_loop_status  iter=2  loop_evaluation  evidenceScore=1.0');
  socket.emit('copilot_loop_status', {
    run_id,
    event          : 'loop_evaluation',
    iteration      : 2,
    enoughEvidence : true,
    explanation    : 'Full enterprise pricing with custom contract details found.',
    evidenceScore  : 1.0,
    timestamp      : Date.now(),
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n' + COLOUR.bold + '═'.repeat(70) + COLOUR.reset);
  log(COLOUR.cyan, 'TEST', `Loop Engineering + Score Pipeline  run_id=${run_id}`);
  log(COLOUR.cyan, 'TEST', `Backend: ${BASE_URL}`);
  console.log(COLOUR.bold + '═'.repeat(70) + COLOUR.reset + '\n');

  const { socket, received } = attachSocketListeners();
  await sleep(1000); // let socket connect

  // ── Step 1: Simulate loop events (frontend topology reaction) ───────────────
  log(COLOUR.cyan, 'STEP 1', 'Simulating Loop Engineering socket events...');
  await emitLoopEvents(socket);
  await sleep(500);

  // ── Step 2: Send LLM trace (triggers auto-judge after 1.5 s) ───────────────
  log(COLOUR.cyan, 'STEP 2', 'Sending llm_start trace...');
  const startRes = await post('/api/llm-trace', {
    event : 'llm_start',
    run_id,
    data  : {
      agent : AGENT,
      model : 'openai/gpt-4o-mini',
      inputs: [
        { role: 'system', content: 'You are the Swarm Customer Success Copilot.' },
        { role: 'user',   content: 'What are the enterprise pricing tiers and custom contract options?' },
      ],
    },
  });
  log(startRes.status === 200 ? COLOUR.green : COLOUR.red, 'HTTP', `llm_start  status=${startRes.status}`);
  await sleep(800);

  log(COLOUR.cyan, 'STEP 3', 'Sending llm_end trace (triggers auto-judge in 1.5 s)...');
  const endRes = await post('/api/llm-trace', {
    event : 'llm_end',
    run_id,
    data  : {
      agent             : AGENT,
      outputs           : 'Swarm offers three enterprise tiers: Starter at $499/mo, Business at $1,499/mo, and Enterprise with custom contract pricing negotiated directly with Murali Dharan (CTO). All plans include unlimited agents, priority support, and dedicated onboarding.',
      prompt_tokens     : 180,
      completion_tokens : 92,
      input_cost        : 0.000027,
      output_cost       : 0.0000552,
      total_cost        : 0.0000822,
      total_latency     : 2340,
      ttft              : 320,
      tool_latency      : 0,
      otps              : 39.3,
    },
  });
  log(endRes.status === 200 ? COLOUR.green : COLOUR.red, 'HTTP', `llm_end  status=${endRes.status}`);

  // ── Step 4: Wait for auto-judge to fire (1.5 s delay + API round-trip) ──────
  log(COLOUR.yellow, 'STEP 4', 'Waiting 5 s for auto-judge evaluation to complete...');
  await sleep(5000);

  // ── Step 5: Poll /api/hallucination-results to confirm persistence ───────────
  log(COLOUR.cyan, 'STEP 5', 'Querying /api/hallucination-results...');
  const hrRes = await get('/api/hallucination-results');
  if (hrRes.status === 200 && hrRes.body[run_id]) {
    const r   = hrRes.body[run_id];
    const acc = Math.round((1 - r.score) * 100);
    log(COLOUR.green, 'HTTP GET', `hallucination stored  score=${r.score.toFixed(2)}  accuracy=${acc}%`);
    log(COLOUR.green, 'HTTP GET', `  reasoning: "${r.reasoning}"`);
  } else {
    log(COLOUR.yellow, 'HTTP GET', `hallucination not yet stored (status=${hrRes.status}) — may need OPENROUTER_API_KEY`);
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  await sleep(500);
  console.log('\n' + COLOUR.bold + '═'.repeat(70) + COLOUR.reset);
  log(COLOUR.bold, 'SUMMARY', '');
  const checks = [
    ['llm_trace socket (start)' , received.llm_trace_start],
    ['llm_trace socket (end)'   , received.llm_trace_end],
    ['copilot_loop_status events', received.copilot_loop_status.length >= 4],
    ['hallucination_result push' , received.hallucination_result],
  ];
  let allPassed = true;
  for (const [label, ok] of checks) {
    const c = ok ? COLOUR.green : COLOUR.red;
    console.log(`  ${c}${ok ? '✅' : '❌'} ${label}${COLOUR.reset}`);
    if (!ok) allPassed = false;
  }
  console.log(COLOUR.bold + '═'.repeat(70) + COLOUR.reset);
  log(allPassed ? COLOUR.green : COLOUR.yellow, 'RESULT', allPassed
    ? 'All checks passed — Loop Engineering pipeline is live ✅'
    : 'Some checks pending — ensure backend is running with OPENROUTER_API_KEY set'
  );

  socket.disconnect();
  process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
  console.error(COLOUR.red + '[FATAL]' + COLOUR.reset, err.message);
  process.exit(1);
});
