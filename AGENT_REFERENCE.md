# Swarm Agentic Lab — Agent Codebase Reference

> **Purpose**: This document is the authoritative technical reference for building, extending, and debugging the Swarm Agentic Lab platform. Read this before touching any code.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Directory Structure](#3-directory-structure)
4. [Infrastructure: Docker Services](#4-infrastructure-docker-services)
5. [Backend: Node.js API Server](#5-backend-nodejs-api-server)
6. [Frontend: React SPA](#6-frontend-react-spa)
7. [Python Agent Swarm](#7-python-agent-swarm)
8. [LiveKit Real-Time Video Layer](#8-livekit-real-time-video-layer)
9. [Compliance & Security Engine](#9-compliance--security-engine)
10. [Cost Telemetry & Analytics](#10-cost-telemetry--analytics)
11. [Key Env Variables Reference](#11-key-env-variables-reference)
12. [Launch Procedures](#12-launch-procedures)
13. [Coding Conventions & Critical Rules](#13-coding-conventions--critical-rules)
14. [Known Architecture Decisions & Gotchas](#14-known-architecture-decisions--gotchas)

---

## 1. Product Overview

**Swarm Agentic Lab** is a sovereign, self-hosted AI agent control plane. Operators deploy a fleet of specialized AI voice/chat agents through a SaaS console. Each agent connects to the operator's own databases, APIs, and knowledge bases — no data leaves their infrastructure.

**Key differentiator**: Every AI agent session is a real-time bidirectional WebRTC audio/video room powered by LiveKit. This is NOT a standard chatbot. Agents speak (STT/TTS) and interact with the browser UI in real time.

**Target users**: Founders, operators, and enterprise teams who want private AI agents wired to their internal data.

---

## 2. High-Level Architecture

```
Browser (React SPA)
  LiveList -> Room Component -> @livekit/components-react
  ConsoleLayout -> DashboardPage / ComplianceDashboard
        |                               |
        | HTTP/axios + Socket.io        | WebRTC (LiveKit)
        v                               v
Node.js Backend (port 3002)       LiveKit Server (port 7880)
Express + Socket.io               WebRTC rooms & dispatching
auth / traces / security                    |
crawler / copilot / rooms                   | AgentDispatchClient
        |                                   v
        | PostgreSQL (5433)       Python Agents (venv)
        | Redis (6379)            livekit-agents SDK
        v                         Mistral / Gemini / OpenAI
   swarm-postgres DB              Deepgram STT, Silero VAD
   securelytix-postgres           +custom tools per agent
        |
        | Securelytix SDK (port 8080)
        | SearXNG Search (port 8081)
        v
   External APIs: OpenRouter, WeatherUnion, GA4, GSC, Telegram
```

---

## 3. Directory Structure

```
livekit-video-app/
|-- backend/
|   |-- index.js                 # SERVER ENTRY POINT - init only, no routes
|   `-- src/
|       |-- app.js               # Express app + consolidated route mounting
|       |-- config/
|       |   |-- db.js            # PostgreSQL pool + connectDB()
|       |   |-- jwtConfig.js     # JWT secret generation/validation
|       |   |-- livekit.js       # LiveKit SDK config
|       |   |-- logger.js        # Pino structured JSON logger
|       |   |-- nist-rmf-core.json  # 211 NIST AI RMF subcategories (seed)
|       |   `-- owasp-llm-core.json # 10 OWASP LLM Top 10 entries (seed)
|       |-- controllers/
|       |   |-- authController.js       # register, login, getMe, password reset
|       |   |-- complianceController.js # compliance summary, logs, add log
|       |   |-- configController.js     # getWhitelabelConfig
|       |   |-- crawlerController.js    # crawler CRUD + trigger
|       |   |-- githubController.js     # github CRUD + trigger + tree
|       |   |-- roomController.js       # talkToAI, copilotChat, reels, security scans
|       |   `-- telemetryController.js  # LLM trace, hallucination eval, detokenize
|       |-- middlewares/
|       |   `-- authMiddleware.js       # authenticateToken, requireRole, authRateLimiter
|       |-- routes/
|       |   |-- authRoutes.js
|       |   |-- configRoutes.js
|       |   |-- crawlerRoutes.js
|       |   |-- githubRoutes.js
|       |   |-- roomRoutes.js
|       |   `-- telemetryRoutes.js
|       `-- services/
|           |-- copilotService.js  # Copilot LLM + session + retrieval
|           |-- dbBootstrap.js     # DB tables, NIST/OWASP seeding, async scanners
|           |-- emailService.js    # Nodemailer password reset email
|           `-- tokenService.js    # LiveKit AccessToken generation
|
|-- frontend/
|   `-- src/
|       |-- App.jsx              # Root: routing, auth state, room dispatch
|       |-- index.css            # Full design system
|       |-- components/
|       |   |-- auth/
|       |   |   |-- LoginPage.jsx
|       |   |   `-- ResetPasswordPage.jsx
|       |   |-- dashboard/
|       |   |   |-- DashboardPage.jsx       # LLM traces, cost, hallucination eval
|       |   |   |-- ComplianceDashboard.jsx # Security audits, NIST, CVE tracking
|       |   |   |-- GovernedDeployment.jsx  # Public governance page
|       |   |   `-- SwarmShortsPage.jsx     # Viral reel player
|       |   |-- layout/
|       |   |   |-- ConsoleLayout.jsx       # Sidebar nav for authenticated console
|       |   |   |-- LiveList.jsx            # MAIN LANDING: Guest portal + Agent grid
|       |   |   |-- SwarmCopilotPanel.jsx   # Copilot crawler/GitHub config drawer
|       |   |   |-- DevopsOrb.jsx           # Floating DevOps Geni orb
|       |   |   `-- BlogSection.jsx         # Insights blog posts (Astra-generated)
|       |   `-- rooms/
|       |       |-- VideoRoom.jsx           # Generic LiveKit room
|       |       |-- LinaRoom.jsx
|       |       |-- BIRoom.jsx              # Includes detokenize support
|       |       |-- NovaRoom.jsx
|       |       |-- AstraRoom.jsx
|       |       |-- RehearsalRoom.jsx
|       |       |-- SevaRoom.jsx
|       |       |-- MartechRoom.jsx
|       |       |-- OctaneRoom.jsx
|       |       |-- DevopsGeniRoom.jsx
|       |       `-- AivyuhRoom.jsx
|       `-- nova-sdk/                # Client-side capability SDK for Nova agent
|           |-- NovaClient.js        # Orchestrator: EventBus, ContextStore, TimelineSync
|           |-- core/                # EventBus, ContextStore, TimelineSync, NovaLogger
|           `-- react/               # React hooks/providers for Nova SDK
|
|-- python-agent/
|   |-- agents/
|   |   |-- aivyuh/              # OWASP security compliance + swarm coordinator
|   |   |-- astra/               # Public speaking coach + blog writer
|   |   |   `-- blogs/           # JSON blog posts generated by Astra
|   |   |-- bi/                  # Cortex BI: MySQL analytics
|   |   |-- bi2/                 # Cortex IPL: MongoDB IPL predictions
|   |   |-- devopsgeni/          # DevOps Geni: SRE/DevSecOps
|   |   |-- lina/                # Lina: wellness / cognitive therapy
|   |   |-- martech/             # Martech: SEO + GA4 + GSC analytics
|   |   |-- nist/
|   |   |   `-- scanner.py       # NIST AI RMF compliance scanner
|   |   |-- nova/                # Nova: SaaS copilot
|   |   |-- octane/              # Octane: telemetry (publishes Redis alerts)
|   |   |-- rehearsal/           # Rehearsal: presentation coach
|   |   |-- reels/               # Reels: blog-to-video (Wav2Lip)
|   |   |-- seva/                # Seva: customer onboarding
|   |   `-- swarm_copilot/       # Swarm Copilot: knowledge base manager
|   |-- integrations/
|   |   `-- securelytix.py       # Securelytix SDK client
|   |-- knowledge/               # Ingested crawl/GitHub knowledge
|   |-- prompts/                 # Shared prompt templates
|   |-- sessions/                # Copilot session JSON files
|   |-- swarm_logs/              # Per-agent log files
|   |-- run_scope_analyzer.py    # Outputs JSON: agent scope + NIST mapping
|   `-- requirements.txt
|
|-- scripts/
|   |-- tee.py                   # Stdin -> stdout + logfile pipe
|   `-- daily_log_cleaner.py     # Cleans rotated logs
|
|-- logs/
|   |-- backend_errors.log       # Uncaught exceptions + unhandled rejections
|   `-- swarm_master.log         # Aggregated process stdout
|
|-- docker-compose.yml
|-- livekit.yaml
|-- start_swarm.bat              # Windows interactive launcher
`-- package.json
```

---

## 4. Infrastructure: Docker Services

| Service | Image | Port | Purpose |
|---|---|---|---|
| `livekit` | `livekit/livekit-server:latest` | 7880, 7881, 7882/UDP | WebRTC signaling, room management, agent dispatch |
| `redis` | `redis:7-alpine` | 6379 | LiveKit pub/sub + Octane telemetry alerts |
| `swarm-postgres` | `postgres:15` | **5433** | Main app DB |
| `securelytix-postgres` | `postgres:15` | 5432 | Vault DB for Securelytix |
| `securelytix-sdk` | custom | 8080 | PII tokenization / detokenization API |
| `searxng` | `searxng/searxng:latest` | 8081 | Self-hosted web search |

**IMPORTANT**: `swarm-postgres` uses host port **5433** (not 5432). The backend connects to `postgresql://postgres@127.0.0.1:5433/swarm`. Port 5432 is `securelytix-postgres`.

---

## 5. Backend: Node.js API Server

**Tech stack**: Node.js ESM, Express 4, Socket.io 4, Pino logger, `node-postgres`, Redis, LiveKit Server SDK, bcryptjs, jsonwebtoken.

### 5.1 Startup & Lifecycle

`backend/index.js` is the ONLY entry point. Execution order:

1. Console override — all `console.*` rerouted to Pino JSON logger
2. HTTP server created from Express `app` (in `src/app.js`)
3. Socket.io attached to HTTP server
4. Redis connection attempted (non-blocking)
5. Redis subscription to `octane_telemetry_stream` — forwards to Socket.io
6. Global error handlers — writes to `logs/backend_errors.log`
7. `connectDB()` called — PostgreSQL pool + `bootstrapDB()`:
   - Tables created (if not exist)
   - `nist-rmf-core.json` + `owasp-llm-core.json` truncate/reseed
   - Python scanners launched **asynchronously in background** (server does not wait)
8. HTTP server listens on port 3002

**Critical rule**: Never await Python script execution in the startup critical path.

### 5.2 Authentication System

**Flow**: POST /api/auth/register or /api/auth/login -> returns `{ token, user }` (JWT TTL 2h) -> frontend stores in localStorage -> axios attaches as `Authorization: Bearer <token>` -> `authenticateToken` middleware verifies.

**Dev bypass**: Token `"mock-dev-token-bypass"` grants admin access without DB query (non-production only).

**Rate limiting**: `authRateLimiter` — sliding-window in-memory map, default 10 attempts/15 min.

**Password security**: bcrypt 10 rounds, complexity enforcement, timing-safe login (dummy bcrypt always runs).

**Password reset**: Raw token SHA-256 hashed before DB storage. Tokens expire 1 hour. Existing tokens invalidated on new request.

**First user rule**: First registered user gets `admin` role automatically.

### 5.3 API Routes Reference

#### Auth (`/api/auth/*`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | None | Create user account |
| POST | `/api/auth/login` | None | Login, returns JWT |
| GET | `/api/auth/me` | Yes | Get current user profile |
| POST | `/api/auth/forgot-password` | None | Send reset email |
| POST | `/api/auth/reset-password` | None | Reset password with token |

#### Config

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/whitelabel/config` | None | Client name, theme, enabled agents list |

#### Room & Agent (root `/`)

| Method | Path | Auth | Role | Description |
|---|---|---|---|---|
| POST | `/talk-to-ai` | Yes | admin, operator | Dispatch Python agent to LiveKit room |
| POST | `/trigger-reels` | Yes | admin, operator | Spawn reels agent in background |
| POST | `/copilot/chat` | Yes | admin, operator | SSE streaming copilot chat |
| POST | `/copilot/session/clear` | Yes | admin, operator | Delete session file |
| GET | `/insights` | None | - | Astra blog JSON files |
| GET | `/weather` | None | - | WeatherUnion proxy |

#### Telemetry & Security

| Method | Path | Auth | Role | Description |
|---|---|---|---|---|
| POST | `/api/llm-trace` | None | - | Ingest trace events |
| POST | `/api/llm-trace/tool-call` | None | - | Append tool call |
| GET | `/api/llm-traces` | Yes | all | Fetch last 100 traces |
| DELETE | `/api/llm-traces` | Yes | admin | Clear all traces |
| POST | `/api/evaluate-hallucination` | Yes | admin, operator | Run hallucination judge |
| GET | `/api/hallucination-results` | Yes | all | Get cached results |
| GET | `/security/status` | Yes | all | Agent security status |
| POST | `/security/scan` | Yes | admin, operator | Run Aivyuh scan |
| POST | `/security/aivyuh-scan` | Yes | admin, operator | Run Aivyuh scan (alias) |
| POST | `/security/nist-scan` | Yes | admin, operator | Run NIST compliance scan |
| POST | `/security/remediate` | Yes | admin | Update OWASP constraint status |
| POST | `/detokenize` | Yes | any | Proxy to Securelytix |
| GET | `/api/compliance/summary` | Yes | all | Jailbreaks/PII/CVE counts |
| GET | `/api/compliance/logs` | Yes | all | Paginated compliance logs |
| POST | `/api/compliance/log` | Yes | admin, operator | Add compliance log entry |

Crawler: `/api/crawler/*` — GET/POST config, POST run, GET status.
GitHub: `/api/github/*` — GET/POST config, POST run, GET status, GET tree.

### 5.4 Socket.io Real-Time Events

| Event | Direction | Payload |
|---|---|---|
| `llm_trace` | Server -> Client | `{ event, run_id, data }` |
| `hallucination_result` | Server -> Client | `{ run_id, score, reasoning, flags, evaluated_at }` |
| `llm_trace_clear` | Server -> Client | none |
| `backend_error` | Server -> Client | `{ type, message, timestamp }` |
| `reels_progress` | Server -> Client | `{ slug, data }` |

### 5.5 Database Schema (PostgreSQL)

Database: `swarm` on port 5433. Tables created by `dbBootstrap.js`.

```sql
-- Core identity
users (id, username, email, password_hash, role, company_name, created_at)
sessions (id, user_id, room_name, agent_type, started_at, ended_at, status)
password_reset_tokens (id, user_id, token_sha256, expires_at, used, created_at)

-- AI observability
traces (id, run_id[unique], input_id, output_id, agent, model,
        inputs[jsonb], outputs, prompt_tokens, completion_tokens,
        input_cost, output_cost, stt_cost, tts_cost, total_cost,
        status, timestamp, total_latency, ttft, tool_latency, otps,
        tool_calls[jsonb], error_details[jsonb])

-- Copilot
copilot_sessions (session_id[pk], session_data[jsonb], updated_at)

-- Knowledge ingestion
crawling_configs (id, start_url, include_pattern, exclude_pattern, ...)
github_configs (id, owner, name, token, branch_or_tag, file_types[], ...)

-- Compliance & security
compliance_logs (id, event_type, severity, agent, details[jsonb], timestamp)
nist_rmf_core (id, function, category, subcategory_id[unique], description)
owasp_llm_core (id, framework, control_id[unique], category, description)
agent_analysis (id, agent_name[unique], agent_type, business_function,
                autonomy, risk_tier, capabilities[], data_classes[],
                applicable_controls[], non_applicable_controls[],
                applicable_count, non_applicable_count, control_map[jsonb])
agent_security_status (agent_name[pk], timestamp, critical_count, warning_count,
                       report_summary[jsonb], nist_score, nist_risk, nist_controls[jsonb])
```

Indexes: `idx_traces_timestamp`, `idx_traces_agent`, `idx_traces_run_id`

### 5.6 LLM Trace Lifecycle

```
llm_start  -> Creates trace row (streaming status, STT cost if voice)
llm_chunk  -> Appends to outputs, recalculates TTS cost for voice agents
llm_end    -> Finalizes costs, tokens, latency, sets status=completed
llm_error  -> Records failure details, sets status=failed
tool_call  -> Appends to tool_calls[], accumulates tool_latency
```

TTS cost: `estimateSpokenChars()` strips code blocks, markdown, emojis, truncates at 800 chars. Formula: `(chars / 1000) * $0.015`.

input_id: deterministic SHA-256 of messages array (same prompt = same ID).
output_id: always unique UUID-based.

---

## 6. Frontend: React SPA

**Tech stack**: React 18, Vite, axios, @livekit/components-react, framer-motion, lucide-react. **No React Router.**

### 6.1 Routing Strategy

Custom hash/pathname routing in `App.jsx` via `window.history.pushState` + `window.location.hash`.

```
/              -> LiveList (guest portal or authenticated fleet)
/login         -> LoginPage
/reset-password -> ResetPasswordPage
/dashboard     -> DashboardPage (protected)
/compliance    -> ComplianceDashboard (protected)
/governed-deployment -> GovernedDeployment (public)
/sneak-peak    -> SwarmShortsPage (public)
/insights      -> BlogSection (public)
```

Hash routes (`#/login`, `#/dashboard`) also work for static hosting.

Route detection pattern (copy verbatim when adding routes):
```js
const isNewPath =
  currentPath.replace(/\/$/, "") === "/new-path" ||
  window.location.hash.replace(/\/$/, "") === "#/new-path";
```

### 6.2 Authentication State

- `localStorage.getItem("token")` — JWT string
- `localStorage.getItem("user")` — JSON stringified user object
- Axios global header: `Authorization: Bearer <token>`
- Axios interceptor: auto-logout on 401/403

### 6.3 Agent Fleet & Room Components

**Session flow**:
1. Click agent card in `LiveList` -> `initiateAITalk(agentId)`
2. `POST /talk-to-ai` -> backend dispatches Python agent to LiveKit room
3. Response: `{ token, roomName, identity, isAI: true }`
4. `handleJoin()` sets `roomData` state
5. `roomData.creatorId` determines which Room component renders

| creatorId | Component |
|---|---|
| `"LINA"` | LinaRoom |
| `"BI"`, `"BI2"` | BIRoom |
| `"NOVA"` | NovaRoom |
| `"AIVYUH"` | AivyuhRoom |
| `"ASTRA"` | AstraRoom |
| `"REHEARSAL"` | RehearsalRoom |
| `"SEVA"` | SevaRoom |
| `"MARTECH"` | MartechRoom |
| `"OCTANE"` | OctaneRoom |
| `"DEVOPS_GENI"` | DevopsGeniRoom |
| (default) | VideoRoom |

When `roomData` is set, App.jsx renders ONLY the room component (full-screen).

### 6.4 Whitelabel Config System

`GET /api/whitelabel/config` response:
```json
{
  "clientName": "Swarm Agentic Lab",
  "theme": { "primary": "#3b82f6", "accent": "#10b981", "logo": "/favicon.svg" },
  "enabledAgents": ["DEVOPS_GENI", "BI", "LINA", "NOVA", "ASTRA", "REHEARSAL", "SEVA", "MARTECH", "OCTANE", "AIVYUH"]
}
```

Env vars: `CLIENT_NAME`, `THEME_PRIMARY`, `THEME_ACCENT`, `LOGO_URL`, `ENABLED_AGENTS`.

### 6.5 Nova SDK (`frontend/src/nova-sdk/`)

Enables Nova agent to control browser UI via LiveKit data channels.

- `novaClient` (singleton): orchestrates EventBus, ContextStore, TimelineSync
- `registerCapability({ name, description, execute })`: registers a named UI action
- `executeCapability(name, payload)`: executes and ACKs back via `topic: "ui_control"` data channel

```js
novaClient.registerCapability({
  name: 'openModal',
  description: 'Opens the onboarding modal',
  execute: (payload) => setModalOpen(true)
});
```

---

## 7. Python Agent Swarm

**Runtime**: Python 3.10+ in `python-agent/venv/`. All agents use `livekit-agents` SDK.

Key deps: `livekit-agents`, `livekit-plugins-mistralai`, `livekit-plugins-silero`, `google-genai`, `openai`, `deepgram`, `redis`, `bandit`.

### 7.1 Agent Registry

| Agent ID | Name | Specialty |
|---|---|---|
| `LINA` | Lina Wellness | Empathetic companion, cognitive wellness |
| `BI` | Cortex BI | MySQL analytics + business intelligence |
| `CORTEX2` | Cortex IPL | MongoDB IPL prediction analysis |
| `NOVA` | Nova Copilot | SaaS engineering copilot, UI automation |
| `ASTRA` | Astra Coach | Public speaking coach, writes insight blogs |
| `REHEARSAL` | Rehearsal Coach | Presentation pacing analysis |
| `SEVA` | Seva Support | Customer onboarding + live API integration |
| `MARTECH` | Martech Dynamo | SEO, GA4, GSC analytics |
| `OCTANE` | Octane Telemetry | Network telemetry, publishes Redis alerts |
| `DEVOPS_GENI` | DevOps Geni | DevSecOps, SAST, system diagnostics |
| `AIVYUH` | Aivyuh Agent | OWASP security compliance, swarm logic |

### 7.2 LiveKit Integration Pattern

1. Start agent: `python agents/<name>/<file>.py dev`
2. Agent registers with LiveKit using env vars
3. Backend calls `AgentDispatchClient.createDispatch(roomName, agentName)`
4. Agent joins room, STT -> LLM -> TTS pipeline starts
5. Agent POSTs to `/api/llm-trace` for each LLM call

LLM trace example:
```python
# POST http://localhost:3002/api/llm-trace
{"event": "llm_start", "run_id": "...", "data": {"agent": "NOVA", "model": "...", "inputs": [...]}}
{"event": "llm_chunk", "run_id": "...", "data": {"chunk": "..."}}
{"event": "llm_end", "run_id": "...", "data": {"outputs": "...", "prompt_tokens": 120, ...}}
```

### 7.3 Compliance Scanners

**`run_scope_analyzer.py`**: Scans agent `.py` files, maps to NIST AI RMF controls, outputs JSON to stdout. Backend ingests to `agent_analysis`.

**`agents/nist/scanner.py`**: Runtime OWASP LLM Top 10 audit, writes `audit_history.json`, outputs JSON. Backend ingests to `agent_security_status`.

**`agents/aivyuh/scanner.py`**: OWASP vulnerability scanner. Output: `{ success, history, total_agents, critical_issues, warning_issues, compliance_score }`. Called via `runScanner(["aivyuh-scan"])`.

---

## 8. LiveKit Real-Time Video Layer

**Ports**: 7880 (HTTP/WS), 7881 (TURN), 7882/UDP (WebRTC)

**Room naming** (in `roomController.js`):

```
lina_session_<userId>         # Lina
bi_session_<userId>           # Cortex BI
nova_session_<userId>         # Nova
growth_session_<userId>       # Astra
rehearsal_session_<userId>    # Rehearsal
seva_session_<userId>         # Seva
martech_session_<userId>      # Martech
security_session_<userId>     # Aivyuh
telemetry_session_<userId>    # Octane
devopsgeni_session_<userId>   # DevOps Geni
```

**Token**: identity = userId or `Guest_XXXX`, grants roomJoin+canPublish+canSubscribe, TTL 2h.

---

## 9. Compliance & Security Engine

**Layer 1 — OWASP LLM Top 10 (Aivyuh Scanner)**: Scans Python files. Results in `agent_security_status`. `POST /security/aivyuh-scan`.

**Layer 2 — NIST AI RMF (NIST Scanner)**: Maps agent capabilities to 211 subcategories. Produces `nist_score` + `nist_risk`. Stored in `agent_analysis` + `agent_security_status`. `POST /security/nist-scan`.

**Layer 3 — Compliance Event Logging**: All audits log to `compliance_logs`. Events: `aivyuh_swarm_audit_completed`, `nist_compliance_audit_completed`, `security_constraint_updated`, `jailbreak_intercepted`, `pii_blocked`.

**Layer 4 — Securelytix PII Tokenization**: Sensitive BI data tokenized via SDK (port 8080). `POST /detokenize` proxies for recovery.

---

## 10. Cost Telemetry & Analytics

| Metric | Formula |
|---|---|
| `input_cost` | prompt_tokens / 1,000,000 * $0.15 |
| `output_cost` | completion_tokens / 1,000,000 * $0.60 |
| `stt_cost` | Deepgram cost (from agent) |
| `tts_cost` | spokenChars / 1,000 * $0.015 (estimated per chunk) |
| `total_cost` | sum of all above |
| `total_latency` | ms end-to-end |
| `ttft` | ms to first token |
| `otps` | output tokens per second |

Hallucination evaluation: OpenRouter `openai/gpt-4o-mini` judge. Score 0-1. Manual trigger only.

---

## 11. Key Env Variables Reference

### Backend (`backend/.env`)

| Variable | Default | Required | Description |
|---|---|---|---|
| `PORT` | `3002` | No | HTTP server port |
| `LIVEKIT_URL` | `ws://127.0.0.1:7880` | Yes | LiveKit WebSocket URL |
| `LIVEKIT_API_KEY` | `devkey` | Yes | LiveKit API key |
| `LIVEKIT_API_SECRET` | `secret` | Yes | LiveKit API secret |
| `DATABASE_URL` | `postgresql://postgres@127.0.0.1:5433/swarm` | Yes | PostgreSQL connection |
| `REDIS_URL` | `redis://localhost:6379` | No | Redis URL |
| `JWT_SECRET` | (auto-generated in dev) | YES in prod | JWT signing secret |
| `OPENROUTER_API_KEY` | - | For hallucination eval | OpenRouter key |
| `EMAIL_USER` | - | For password reset | Gmail address |
| `EMAIL_PASS` | - | For password reset | Gmail app password |
| `FRONTEND_URL` | `http://localhost:5173` | No | Used in reset link |
| `CLIENT_NAME` | `Swarm Agentic Lab` | No | Whitelabel name |
| `THEME_PRIMARY` | `#3b82f6` | No | Whitelabel color |
| `ENABLED_AGENTS` | (all) | No | Comma-separated enabled agents |
| `SECURELYTIX_URL` | `http://localhost:8080` | No | Securelytix API |
| `NODE_ENV` | `development` | No | Set `production` for strict JWT |

### Frontend (`frontend/.env.local`)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `""` (same origin) | Backend base URL. Set to `http://localhost:3002` in dev |

### Python Agent (`python-agent/.env`)

| Variable | Required | Description |
|---|---|---|
| `LIVEKIT_URL` | Yes | Must match backend |
| `LIVEKIT_API_KEY` | Yes | Must match backend |
| `LIVEKIT_API_SECRET` | Yes | Must match backend |
| `MISTRAL_API_KEY` | Most agents | Mistral LLM |
| `DEEPGRAM_API_KEY` | Voice agents | STT transcription |
| `OPENROUTER_API_KEY` | Some agents | OpenRouter multi-model |
| `ENABLE_LLM_TRACING` | No | Set `true` to enable trace posting |
| `MYSQL_HOST/USER/PASSWORD/DB/PORT` | BI agent | MySQL for Cortex BI |
| `MONGO_URI`, `DB_NAME` | BI2 agent | MongoDB for IPL |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | HITL agents | Telegram commander |
| `GA4_PROPERTY_ID`, `GSC_SITE` | Martech | Analytics APIs |

---

## 12. Launch Procedures

### Full Stack (Windows)

```batch
rem Interactive launcher
start_swarm.bat

rem All at once
npm run core       :: Docker + DevOps Geni + Node backend + Vite frontend
npm run swarm-all  :: ALL agents simultaneously (3GB+ RAM required)
```

### Individual Services

```batch
:: Docker infrastructure
docker-compose up

:: Node.js backend
cd backend && npm run dev

:: React frontend
cd frontend && npm run dev

:: Single Python agent
cd python-agent && venv\Scripts\python.exe agents\lina\lina.py dev
```

### Log Maintenance

```batch
python-agent\venv\Scripts\python.exe scripts\daily_log_cleaner.py
```

---

## 13. Coding Conventions & Critical Rules

### Backend

1. **Never add routes to `index.js`** — routes go in `src/app.js` via router files
2. **Never block startup** — Python processes in `dbBootstrap.js` must be async
3. **Use `logger` (Pino) always** — `console.*` is already remapped in `index.js`
4. **Use `query()` from `src/config/db.js`** — never instantiate a new pool
5. **DB upserts**: always use `ON CONFLICT ... DO UPDATE` for idempotency
6. **RBAC on state-mutating endpoints**: `authenticateToken` + `requireRole([...])`
7. **Compliance events**: always log to `compliance_logs` table

### Frontend

1. **API base URL**: always `const API = import.meta.env.VITE_API_URL || ""`
2. **Root-level paths** (`/talk-to-ai`, `/security/*`, `/detokenize`) are NOT `/api/` prefixed — intentional
3. **Auth check**: `const isAuthenticated = !!(token && user)`
4. **Route detection**: match both `currentPath` AND `window.location.hash` (see Section 6.1)
5. **Room exit**: always call `onLeave()` on disconnect to clear `roomData` in App.jsx

### Python Agents

1. **LiveKit env vars required**: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
2. **Agent name in dispatch must match exactly** the string in `roomController.js` `talkToAI()`
3. **LLM traces**: POST to `http://localhost:3002/api/llm-trace` if `ENABLE_LLM_TRACING=true`
4. **No hardcoded credentials** — always use `python-dotenv`

---

## 14. Known Architecture Decisions & Gotchas

### 1. Mixed Route Prefixes (Root vs /api)
Some routes are at root level (`/talk-to-ai`, `/security/*`, `/detokenize`) while others use `/api/`. This is deliberate legacy design. **Do not move root routes under `/api/` without updating all frontend references**.

### 2. No Redis = No Octane Alerts
Server boots normally if Redis is down, but `octane_telemetry_stream` alerts won't reach frontend. Reconnects with exponential backoff.

### 3. PostgreSQL Port 5433
`swarm-postgres` uses host port **5433**. Port 5432 belongs to `securelytix-postgres`. Always verify.

### 4. Python Agent Dispatch Name Must Match Exactly
`AgentDispatchClient.createDispatch(roomName, agentName)` requires the exact agent name as registered by the Python process. Mismatches cause silent dispatch failure.

### 5. Dev Bypass Token
`"mock-dev-token-bypass"` grants admin without DB user. Never in production. Ensure `NODE_ENV=production`.

### 6. Copilot Sessions on Disk
Session state in `python-agent/sessions/<sessionId>.json`. Persists across restarts. Monitor disk.

### 7. Astra Blogs on Disk
Blog posts are JSON files in `python-agent/agents/astra/blogs/`. The `/insights` endpoint reads files directly — no database involved.

### 8. JWT Secret in Dev
If `JWT_SECRET` is missing, server auto-generates a random key. **All JWTs invalidated on every server restart.** Set `JWT_SECRET` in `.env` to persist sessions.

### 9. Hallucination Judge Costs Real API Credits
Evaluation calls OpenRouter (GPT-4o-mini). Manual trigger only — not automatic per trace.

### 10. SSG Build for SEO
`frontend/ssg-build.js` pre-renders public pages. Run separately from dev server. Output to `frontend/dist/`.
