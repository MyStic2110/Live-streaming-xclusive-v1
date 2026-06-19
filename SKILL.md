# Swarm Agentic Lab — Core Platform Skills

This file documents the specialized domain skills and integration protocols of the Swarm Agentic Lab platform, detailing how developers and AI models can invoke, debug, and monitor them.

---

## 1. WebRTC & LiveKit Dispatching Skill

### Overview
Every AI session is a real-time WebRTC audio/video room managed by a LiveKit server (running on port **7880**). The backend handles dispatching agents to rooms, and the frontend connects directly using WebRTC tokens.

### Invocation Flow
1. **Frontend Request**: The React SPA calls `POST /talk-to-ai` with `{ userId, agentId }`.
2. **Token Generation**: The Node.js server generates a LiveKit `AccessToken` with the user's identity and room permissions:
   * Identity format: `userId` (or `Guest_XXXX` for anonymous visitors).
   * Room Name format: e.g., `lina_session_<userId>` for Lina.
3. **Agent Dispatch**: The backend utilizes the LiveKit Node SDK `AgentDispatchClient` to dispatch the corresponding Python agent:
   ```javascript
   const dispatchClient = new AgentDispatchClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
   await dispatchClient.createDispatch(roomName, agentName);
   ```
4. **Python Agent Runtime**: The agent, running in `python-agent/venv/`, listens for the LiveKit room dispatch, joins, and initiates the STT -> LLM -> TTS voice loop.

---

## 2. Security & Compliance Auditing Skill

### Aivyuh Scanner (OWASP LLM Top 10)
* **Description**: Audits the agent python code blocks for LLM vulnerabilities, PII leaks, and jailbreak potential.
* **Database Target**: Writes findings to `agent_security_status` table.
* **HTTP Invocation**: `POST /security/aivyuh-scan` (Requires admin/operator role).
* **Terminal Trigger**:
  ```bash
  cd python-agent && venv/Scripts/python.exe agents/aivyuh/scanner.py
  ```

### NIST AI RMF Scanner
* **Description**: Automatically maps agent capabilities to the 211 NIST AI RMF control subcategories.
* **Database Target**: Populates `agent_analysis` and logs summaries to `compliance_logs`.
* **HTTP Invocation**: `POST /security/nist-scan` (Requires admin/operator role).
* **Terminal Trigger**:
  ```bash
  cd python-agent && venv/Scripts/python.exe agents/nist/scanner.py
  ```

---

## 3. Observability & LLM Tracing Skill

### Overview
If `ENABLE_LLM_TRACING=true` in `python-agent/.env`, agents will stream their prompt turns, token usage, and tool executions to the backend trace recorder.

### JSON Trace Schemas
Traces are posted as HTTP request bodies to `POST http://localhost:3002/api/llm-trace` using the following event formats:

1. **Start of turn (`llm_start`)**:
   ```json
   {
     "event": "llm_start",
     "run_id": "unique-uuid-v4",
     "data": {
       "agent": "NOVA",
       "model": "gemini-3.5-flash",
       "inputs": [{"role": "user", "content": "hello"}]
     }
   }
   ```
2. **Incremental completion chunks (`llm_chunk`)**:
   ```json
   {
     "event": "llm_chunk",
     "run_id": "unique-uuid-v4",
     "data": {
       "chunk": "Sure, I can "
     }
   }
   ```
3. **End of turn (`llm_end`)**:
   ```json
   {
     "event": "llm_end",
     "run_id": "unique-uuid-v4",
     "data": {
       "outputs": "Sure, I can help you with that.",
       "prompt_tokens": 150,
       "completion_tokens": 8,
       "total_latency": 1250,
       "ttft": 200
     }
   }
   ```

---

## 4. Securelytix PII Tokenization Skill
* **Description**: Preserves database privacy by tokenizing (vaulting) sensitive columns before storing them.
* **Port**: Securelytix API runs on port **8080**.
* **Detokenization**: The `BIRoom` component and Node backend use a proxy route `POST /detokenize` (mapped to Securelytix `POST /detokenize`) to decrypt valued columns for authorized operators.
