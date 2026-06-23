# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A three-tier, real-time **multi-agent voice/AI platform** ("Swarm") built on LiveKit. A Node/Express
orchestrator mints LiveKit tokens, dispatches Python voice agents into rooms, and bridges telemetry to a
React SPA. The "intelligence" lives in ~13 independent Python LiveKit agents (LINA, BI, NOVA, ASTRA,
AIVYUH, OCTANE, etc. — see `AGENTS.md` for the authoritative registry, personas, and room-name mapping).

```
frontend/      React 19 + Vite SPA (custom routing, LiveKit client, Socket.io client)
backend/       Node ESM + Express 4 orchestrator (token service, agent dispatch, telemetry, REST API)
python-agent/  Python LiveKit agents + compliance scanners + reels pipeline (each agent is its own worker)
```

## Commands

All three tiers run as separate processes. Infra (LiveKit, Redis, Postgres ×2, SearxNG, Securelytix) runs via Docker.

```bash
# One-shot dev stack (infra + devopsgeni agent + backend + frontend), from repo root:
npm run swarm           # alias of `npm run core` — uses concurrently; Windows-oriented (venv\Scripts\python.exe)
npm run swarm-all       # launch the 10 specialized voice agents together

# Infra only
docker-compose up -d

# Backend (port 3002)
cd backend && npm run dev      # node --watch index.js   (use `npm start` for plain node)

# Frontend (port 5173, strictPort)
cd frontend && npm run dev
cd frontend && npm run build   # vite build THEN node ssg-build.js (static prerender step — required)
cd frontend && npm run lint    # eslint . — the only automated check in the repo

# A single Python agent (the normal way to run/iterate one agent)
cd python-agent && .\venv\Scripts\python.exe agents/lina/lina.py dev

# Python "tests" are standalone async scripts (NO pytest, no test runner) — run them directly:
cd python-agent && python tests/agent_integration/test_lina.py
cd python-agent && python agents/aivyuh/test_evals.py   # Aivyuh scanner evals
```

There is **no backend or frontend test framework**. Python test scripts insert the repo onto `sys.path` and
require an active `python-agent/venv`, installed `requirements.txt`, and real provider creds in `python-agent/.env`.

### API docs
Backend serves an OpenAPI 3.1 spec + Swagger UI: `GET /api/docs` and `GET /api/openapi.json`
(disable with `ENABLE_API_DOCS=false`). The spec in `backend/src/docs/openapi.js` is **hand-maintained** —
update it when you add/change endpoints.

## Architecture — the big picture

**Agent dispatch flow (the core loop).** Frontend `POST /talk-to-ai {agentType}` → `roomController.talkToAI`
derives a room name (`<agent>_session_<userId>`), mints a LiveKit token via `tokenService`, then uses
LiveKit's `AgentDispatchClient` to dispatch a named agent into that room. The agent name passed to dispatch
**must exactly match** the registration name inside each Python agent and the `agentType→agentName` map in
`roomController.js`. The frontend then joins the room over WebRTC with the returned token. Some operations
instead **spawn Python subprocesses** directly (reels generation, NIST/Aivyuh scanners) using the hardcoded
venv path from `getPythonPath()` — so the backend host needs `python-agent/venv` present.

**Telemetry bridge.** Python agents POST LLM traces to `http://localhost:3002/api/llm-trace`
(events: `llm_start`/`llm_chunk`/`llm_end`/`llm_error`/`tool_call`) which `telemetryController` persists to the
`traces` table and re-emits over Socket.io. Separately, the OCTANE agent publishes to a Redis channel
`octane_telemetry_stream`; `index.js` subscribes and forwards alerts to browsers via Socket.io (`backend_error`).

**Securelytix PII tokenization.** A separate vault service (Docker, port 8080) tokenizes sensitive data
*before* it reaches the LLM and detokenizes on the way back. Backend `/detokenize` and
`python-agent/integrations/securelytix.py` are the integration points.

**Swarm Copilot** (`POST /copilot/chat`) is a **Server-Sent Events** stream, not JSON — it uses a JS-side
semantic router + file-based RAG (`python-agent/knowledge/crawled_knowledge.json`, populated by the crawler)
and in-process embeddings via `@huggingface/transformers`.

**Database bootstrap.** `backend/src/config/db.js` is the schema source of truth: on every boot it
`CREATE TABLE IF NOT EXISTS` + seeds (NIST/OWASP/battle questions) and runs Python scanners. ⚠️ It also
`DROP TABLE agent_analysis` / `TRUNCATE` some tables on boot, and `connectDB()` is `await`ed before the server
listens — be careful changing this path. There are **no migration files in use**; all DDL is inline here.

## Backend conventions (enforced — match existing code)

- **Single entrypoint is `backend/index.js`** (port 3002). All routers are mounted there. Add a new feature by
  creating `src/routes/<x>Routes.js` + `src/controllers/<x>Controller.js` and mounting it in `index.js`.
  (Note: a dead `src/app.js` duplicate router was removed — ignore older docs that say routes live in `src/app.js`.)
- **Route surface has three shapes**, all valid simultaneously: `/api/<resource>` (auth, crawler, github,
  careers, battle, changelog, config, telemetry), **root-level paths with no `/api` prefix** (`/talk-to-ai`,
  `/security/*`, `/detokenize`, `/copilot/*`, `/insights`, `/weather`), and additive **`/api/v1/...`** aliases.
  Frontend calls the legacy shapes; do not add `/api` to root-level paths.
- **Error handling (newer pattern, prefer it):** wrap async controllers in `asyncHandler` and `throw ApiError.*`
  (`src/utils/ApiError.js`, `src/middlewares/errorHandler.js`). The central handler renders one envelope
  `{ error, code, traceId }` and **masks 5xx messages**. Validate input with Zod via
  `validate(schema)` (`src/middlewares/validate.js`, schemas in `src/validation/schemas.js`). Several older
  controllers still self-handle with `res.status(500).json({ error: err.message })` — migrate these when you touch them.
- The frontend axios interceptor (`App.jsx`) auto-logs-out on 401/403 **only** when the error message contains
  phrases like "session expired" / "access token required". Preserve those exact auth messages.
- `GET /api/llm-traces` must return a **plain array** (frontend maps it directly); pagination is via optional
  `?limit/offset/agent/status` query params, not an envelope.
- **Logging:** always use the Pino `logger` from `src/config/logger.js`. `console.*` is globally rerouted to Pino
  in `index.js` — don't rely on raw console formatting.
- **DB access:** always `import { query } from '../config/db.js'`. Never create a new `pg.Pool`. Use
  `ON CONFLICT ... DO UPDATE` upserts for any bootstrap/idempotent writes.
- **Auth:** protect mutating endpoints with `authenticateToken` + `requireRole([...])` (`src/middlewares/authMiddleware.js`).
  Log significant audit events to the `compliance_logs` table.

## Frontend conventions

- **Custom routing only** — `App.jsx` drives navigation with `window.history.pushState` + `window.location.hash`.
  **Do not introduce React Router.** Route checks compare both pathname and hash (with trailing-slash normalization).
- API base URL is always `const API = import.meta.env.VITE_API_URL || ""`. Auth state is `!!(token && user)`,
  with JWT + user in `localStorage`.
- Call `onLeave()` whenever a user leaves/disconnects a LiveKit room to clear `roomData` state in `App.jsx`.
- NOVA controls the UI from the agent side via the in-repo **Nova SDK** (`frontend/src/nova-sdk/`) over LiveKit
  data channels (event bus + context store), not HTTP.

## Python agent conventions

- Each agent reads `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` from `python-agent/.env` via `dotenv`.
  Never hardcode keys.
- The agent's dispatch/registration name **must** match the name `roomController.js` dispatches.
- Emit LLM traces in the documented event schema to `/api/llm-trace` when `ENABLE_LLM_TRACING=true`.
- `run_scope_analyzer.py` and `agents/nist/scanner.py` map agent configs to NIST AI RMF controls and write
  `agents/aivyuh/audit_history.json`; the backend ingests their stdout JSON.

## Critical environment facts / footguns

- **Two Postgres instances:** main app DB `swarm-postgres` on host port **5433**
  (`postgresql://postgres@127.0.0.1:5433/swarm`, `trust` auth — passwordless); Securelytix PII vault DB on **5432**.
  LiveKit: 7880 (HTTP/WS), 7881, 7882/udp. Securelytix SDK: 8080. SearxNG: 8081. Redis: 6379.
- Secrets live in `python-agent/.env` and root `.env` (gitignored). `livekit.js` and some controllers fall back to
  dev defaults (`devkey`/`secret`) when env is missing — don't rely on those in real deployments.
- `authMiddleware.js` honors a `mock-dev-token-bypass` token granting **admin** when `NODE_ENV !== 'production'`,
  and the frontend has a matching mock login. Keep this in mind when reasoning about auth in dev.
- The repo is Windows-oriented (npm scripts use `.\venv\Scripts\python.exe`); on POSIX use `venv/bin/python`.
