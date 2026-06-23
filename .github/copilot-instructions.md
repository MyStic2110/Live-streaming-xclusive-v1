# Swarm Agentic Lab — AI Coding Instructions

This file provides system context, tech stack rules, and conventions for GitHub Copilot, Antigravity, and other AI coding assistants working in the `livekit-video-app` workspace.

---

## 1. System Persona & Guidelines
* **Role**: You are a Senior Full-Stack Engineer and Architect specializing in sovereign AI agent fleets, WebRTC real-time systems, and Node.js/React/Python development.
* **Tone**: Technical, concise, and architectural-first.
* **Rule**: Adhere strictly to the codebase conventions below. Never introduce standard patterns (like React Router or default PostgreSQL ports) that conflict with the established architecture.

---

## 2. Technology Stack & Ports
* **Frontend**: React 19, Vite, TailwindCSS (for styling utilities), `@livekit/components-react`, Framer Motion.
  * **Routing**: Custom hash/pathname routing in `App.jsx` via `window.history.pushState` + `window.location.hash`. **Do not introduce React Router.**
* **Backend**: Node.js (ESM), Express 4, Socket.io 4, Pino logger, `node-postgres` pool, Redis.
* **AI Swarm**: Python 3.10+, `livekit-agents` SDK, Deepgram STT, OpenAI / Mistral / Gemini.
* **Services & Ports**:
  * `swarm-postgres` (Main App DB): Host Port **5433** (URL: `postgresql://postgres@127.0.0.1:5433/swarm`).
  * `securelytix-postgres` (PII Vault DB): Host Port **5432**.
  * `livekit-server`: Port **7880** (HTTP/WS), **7881** (TURN), **7882** (WebRTC/UDP).
  * `securelytix-sdk` (PII Tokenizer): Port **8080**.
  * `searxng` (Self-hosted search): Port **8081**.
  * Redis: Port **6379**.

---

## 3. Coding Conventions & Critical Rules

### Backend
1. **Single entrypoint is `index.js`**: All routers are mounted in `backend/index.js` (port 3002). Add a feature by creating `src/routes/<x>Routes.js` + `src/controllers/<x>Controller.js` and mounting it in `index.js`. (The old `src/app.js` duplicate router has been removed — do not recreate it or reference it.)
2. **Three coexisting route shapes**: `/api/<resource>`, root-level paths with **no** `/api` prefix (`/talk-to-ai`, `/security/*`, `/detokenize`, `/copilot/*`, `/insights`, `/weather`), and additive `/api/v1/...` aliases. The frontend calls the first two; never add `/api` to root-level paths.
3. **Error handling**: Wrap async controllers in `asyncHandler` and `throw ApiError.*` (`src/utils/ApiError.js`, `src/middlewares/errorHandler.js`). The central handler emits one envelope `{ error, code, traceId }` and masks 5xx messages. Validate input with Zod via `validate(schema)` (`src/middlewares/validate.js`, schemas in `src/validation/schemas.js`). Migrate any older `res.status(500).json({ error: err.message })` controllers to this pattern when you touch them. Preserve the exact auth-failure phrasing (e.g. "session expired", "access token required") that the frontend interceptor keys logout off. `GET /api/llm-traces` must keep returning a plain array (pagination via `?limit/offset/agent/status`).
4. **Don't block startup unnecessarily**: Prefer running Python scanners asynchronously rather than blocking the boot path. Note: `src/config/db.js` currently `await`s some Python execution and `DROP`/`TRUNCATE`s tables during boot/seed — be deliberate when changing this. All schema DDL lives inline in `db.js`; there are no migration files in use.
5. **Use structured Pino logger**: Always use the imported `logger` from `src/config/logger.js`. Do not use plain `console.*` statements (which are re-routed to Pino in `index.js`).
6. **Use global DB pool query**: Always import `query` from `src/config/db.js`. Never create new Pool instances.
7. **Idempotency**: Use `ON CONFLICT ... DO UPDATE` (or similar upserts) for database bootstraps and logs.
8. **State-mutating security**: Protect mutative endpoints using the `authenticateToken` middleware and `requireRole([...])`.
9. **Compliance**: Log all major audit events (such as scanner finishes or PII blockings) to the `compliance_logs` table.
10. **API docs**: Swagger UI + OpenAPI 3.1 are served at `/api/docs` and `/api/openapi.json`. The spec in `src/docs/openapi.js` is hand-maintained — update it whenever you add or change an endpoint.

### Frontend
1. **API base URL**: Always use `const API = import.meta.env.VITE_API_URL || ""`.
2. **Root-level path prefixes**: Root-level paths (`/talk-to-ai`, `/security/*`, `/detokenize`) do not have the `/api/` prefix. Do not add it.
3. **Authentication Check**: Verify state using `const isAuthenticated = !!(token && user)`.
4. **Routing checks**: When checking routes, match both pathnames and hash routing:
   ```javascript
   const isNewPath = 
     currentPath.replace(/\/$/, "") === "/new-path" || 
     window.location.hash.replace(/\/$/, "") === "#/new-path";
   ```
5. **Room Disconnections**: Ensure `onLeave()` is called when a user leaves or is disconnected from a LiveKit room to clear the `roomData` state in `App.jsx`.

### Python Agents
1. **LiveKit Env Requirements**: Always ensure `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` are read from `.env` via `dotenv` (no hardcoded keys).
2. **Dispatch Matches**: Agent names in the dispatch client must match the exact registration name used by the agent in `roomController.js`.
3. **LLM Tracing**: POST traces to `http://localhost:3002/api/llm-trace` using the proper event schema (`llm_start`, `llm_chunk`, `llm_end`, `llm_error`, `tool_call`) if `ENABLE_LLM_TRACING=true`.
