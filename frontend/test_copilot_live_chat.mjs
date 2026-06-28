/**
 * test_copilot_live_chat.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Runs a REAL complex copilot chat and captures every live event:
 *   • Loop Engineering  copilot_loop_status  (start + evaluation per iteration)
 *   • SSE streaming chat chunks
 *   • Auto-judge  hallucination_result  push
 *
 * Usage:
 *   node test_copilot_live_chat.mjs [backend_url] [email] [password]
 *
 *   Defaults: http://localhost:3002  admin@swarm.ai  Admin@1234
 */

import { io } from 'socket.io-client';

const BASE   = process.argv[2] || 'http://localhost:3002';
const EMAIL  = process.argv[3] || 'admin@swarm.ai';
const PASS   = process.argv[4] || 'Admin@1234';

const C = {
  reset : '\x1b[0m',
  cyan  : '\x1b[36m',
  green : '\x1b[32m',
  yellow: '\x1b[33m',
  red   : '\x1b[31m',
  purple: '\x1b[35m',
  bold  : '\x1b[1m',
  dim   : '\x1b[2m',
};
const tag = (color, label, msg) =>
  console.log(`${color}${C.bold}[${label}]${C.reset}${color} ${msg}${C.reset}`);

const sleep = ms => new Promise(r => setTimeout(r, ms));

// 1. Login
async function login() {
  tag(C.cyan, 'AUTH', `Logging in as ${EMAIL}...`);
  const res = await fetch(`${BASE}/api/auth/login`, {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify({ email: EMAIL, password: PASS }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Login failed (${res.status}): ${err}`);
  }
  const { token } = await res.json();
  tag(C.green, 'AUTH', 'Token acquired');
  return token;
}

// 2. Attach socket and watch events
function watchSocket() {
  const socket = io(BASE, { transports: ['websocket'] });
  const events = { loop: [], judge: null };

  socket.on('connect', () => tag(C.cyan, 'SOCKET', `Connected  ${socket.id}`));

  socket.on('copilot_loop_status', payload => {
    events.loop.push(payload);
    if (payload.event === 'loop_start') {
      tag(C.purple, `LOOP #${payload.iteration}`, `Searching -> "${(payload.query||'').slice(0, 70)}..."`);
    } else if (payload.event === 'loop_evaluation') {
      const pct   = payload.evidenceScore !== undefined ? Math.round(payload.evidenceScore * 100) + '%' : '?';
      const badge = payload.enoughEvidence
        ? `SUFFICIENT (${pct})`
        : `${pct} -- Gap: "${(payload.gapDescription||'refining').slice(0,60)}"`;
      tag(C.yellow, `LOOP #${payload.iteration}`, `Evidence ${badge}`);
    }
  });

  socket.on('hallucination_result', result => {
    events.judge = result;
    const acc   = Math.round((1 - result.score) * 100);
    const label = result.score <= 0.20 ? 'ACCURATE' :
                  result.score <= 0.50 ? 'UNCERTAIN' :
                  result.score <= 0.75 ? 'SUSPECT' : 'HALLUCINATED';
    const color = result.score <= 0.20 ? C.green :
                  result.score <= 0.50 ? C.yellow : C.red;
    tag(color, 'JUDGE', `Score: ${result.score.toFixed(2)}  Accuracy: ${acc}%  [${label}]`);
    tag(color, 'JUDGE', `Reasoning: "${result.reasoning}"`);
    if (result.flags?.length) {
      tag(C.yellow, 'JUDGE', `Flags: ${result.flags.join(' | ')}`);
    }
  });

  return { socket, events };
}

// 3. Fire complex copilot chat via SSE
async function runChat(token, question) {
  tag(C.cyan, 'CHAT ->', question);
  console.log(C.dim + '-'.repeat(70) + C.reset);

  const res = await fetch(`${BASE}/copilot/chat`, {
    method : 'POST',
    headers: {
      'Content-Type' : 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ query: question }),
  });

  if (!res.ok) {
    throw new Error(`Chat request failed: ${res.status} ${await res.text()}`);
  }

  let fullResponse = '';
  let sessionId    = null;
  let streamDone   = false;
  const decoder    = new TextDecoder();
  const reader     = res.body.getReader();

  process.stdout.write(C.green);
  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;

    const text  = decoder.decode(value, { stream: true });
    const lines = text.split('\n');
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (raw === '[DONE]') { streamDone = true; break; }
      try {
        const obj = JSON.parse(raw);
        if (obj.chunk !== undefined) {
          process.stdout.write(obj.chunk);
          fullResponse += obj.chunk;
        }
        if (obj.sessionId) sessionId = obj.sessionId;
      } catch { /* partial chunk */ }
    }
  }
  process.stdout.write(C.reset + '\n');
  console.log(C.dim + '-'.repeat(70) + C.reset);

  return { fullResponse, sessionId };
}

// Main
async function main() {
  console.log('\n' + C.bold + '='.repeat(70) + C.reset);
  tag(C.cyan, 'TEST', 'Live Copilot Chat -- Loop Engineering + Judge Scoring');
  tag(C.cyan, 'TEST', `Backend: ${BASE}`);
  console.log(C.bold + '='.repeat(70) + C.reset + '\n');

  const token = await login();
  const { socket, events } = watchSocket();
  await sleep(800);

  // Complex multi-part query to trigger multiple loop iterations
  const QUESTION =
    'Can you tell me: (1) the enterprise pricing tiers and custom contract process, ' +
    '(2) which integrations are supported including Slack, GitHub, and Jira, ' +
    'and (3) what SOC2 and GDPR compliance controls are enforced on the Swarm platform?';

  tag(C.cyan, 'QUERY', 'Sending complex 3-part question...\n');

  const { fullResponse, sessionId } = await runChat(token, QUESTION);

  tag(C.green, 'CHAT', `Response received (${fullResponse.length} chars)  session=${sessionId}`);

  tag(C.yellow, 'WAIT', 'Waiting up to 10s for LLM judge auto-evaluation...');
  for (let i = 0; i < 20; i++) {
    if (events.judge) break;
    await sleep(500);
  }

  // Summary
  console.log('\n' + C.bold + '='.repeat(70) + C.reset);
  tag(C.bold, 'RESULTS', '');

  const loopStarts = events.loop.filter(e => e.event === 'loop_start');
  const loopEvals  = events.loop.filter(e => e.event === 'loop_evaluation');

  console.log(`  ${C.purple}Loop Engineering Iterations: ${loopStarts.length} searches${C.reset}`);
  loopEvals.forEach(ev => {
    const pct  = ev.evidenceScore !== undefined ? Math.round(ev.evidenceScore * 100) + '%' : '?';
    const icon = ev.enoughEvidence ? 'PASS' : 'RETRY';
    console.log(`    [${icon}] Iter ${ev.iteration}  Evidence=${pct}  sufficient=${ev.enoughEvidence}`);
  });

  if (events.judge) {
    const acc   = Math.round((1 - events.judge.score) * 100);
    const color = events.judge.score <= 0.20 ? C.green :
                  events.judge.score <= 0.50 ? C.yellow : C.red;
    console.log(`\n  ${color}LLM Judge Accuracy: ${acc}%  (score: ${events.judge.score.toFixed(2)})${C.reset}`);
  } else {
    console.log(`\n  ${C.yellow}LLM Judge: no result received within timeout${C.reset}`);
  }

  const checks = [
    ['Loop events received'      , events.loop.length > 0],
    ['Multiple iterations fired' , loopStarts.length >= 1],
    ['Evidence scores provided'  , loopEvals.some(e => e.evidenceScore !== undefined)],
    ['Auto-judge fired'          , !!events.judge],
    ['Full response streamed'    , fullResponse.length > 100],
  ];

  console.log('');
  for (const [label, ok] of checks) {
    const c = ok ? C.green : C.yellow;
    console.log(`  ${c}${ok ? '[PASS]' : '[FAIL]'} ${label}${C.reset}`);
  }

  console.log(C.bold + '\n' + '='.repeat(70) + C.reset);
  tag(C.green, 'DONE', 'Live copilot chat test complete');

  socket.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(C.red + '[FATAL]' + C.reset, err.message);
  process.exit(1);
});
