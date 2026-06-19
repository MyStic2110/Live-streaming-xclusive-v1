# Swarm Agentic Lab — Custom Swarm Agents Registry

This file documents the specialized AI agents configured within the `python-agent/agents/` directory, detailing their purpose, path, room names, and specific capabilities.

---

## Agent Registry & Fleet Details

### 1. LINA (Lina Wellness)
* **Specialty**: Empathetic wellness companion & cognitive wellness therapy.
* **Path**: [`python-agent/agents/lina/`](file:///d:/Antigravity%20Workspace/livekit-video-app/python-agent/agents/lina)
* **LiveKit Room Match**: `lina_session_<userId>`
* **Features**: Voice-driven conversational agent utilizing empathetic tone matching.

### 2. BI (Cortex BI)
* **Specialty**: SQL analytics & business intelligence.
* **Path**: [`python-agent/agents/bi/`](file:///d:/Antigravity%20Workspace/livekit-video-app/python-agent/agents/bi)
* **LiveKit Room Match**: `bi_session_<userId>`
* **Features**: Connects to the primary application database to run queries, build report metrics, and detokenize PII data securely via Securelytix.

### 3. BI2 / CORTEX2 (Cortex IPL)
* **Specialty**: NoSQL/MongoDB-based IPL (Indian Premier League) prediction analysis.
* **Path**: [`python-agent/agents/bi2/`](file:///d:/Antigravity%20Workspace/livekit-video-app/python-agent/agents/bi2)
* **LiveKit Room Match**: `bi_session_<userId>` (Shared creator/room mapping context)
* **Features**: Parses historical IPL sports stats from MongoDB, running predictive trends and forecasting.

### 4. NOVA (Nova Copilot)
* **Specialty**: SaaS engineering copilot & browser UI controller.
* **Path**: [`python-agent/agents/nova/`](file:///d:/Antigravity%20Workspace/livekit-video-app/python-agent/agents/nova)
* **LiveKit Room Match**: `nova_session_<userId>`
* **Features**: Integrates with the React frontend using the `Nova SDK` to execute client-side capability functions (e.g. open modal, change page layout) directly via LiveKit data channels.

### 5. ASTRA (Astra Coach)
* **Specialty**: Public speaking presentation coach & insight blog writer.
* **Path**: [`python-agent/agents/astra/`](file:///d:/Antigravity%20Workspace/livekit-video-app/python-agent/agents/astra)
* **LiveKit Room Match**: `growth_session_<userId>`
* **Features**: Runs vocal cadence/speech clarity reviews, saves insight reports, and outputs static blog posts (JSON format) directly to `blogs/` to drive the frontend Blog Section.

### 6. REHEARSAL (Rehearsal Coach)
* **Specialty**: Presentation pacing analyzer.
* **Path**: [`python-agent/agents/rehearsal/`](file:///d:/Antigravity%20Workspace/livekit-video-app/python-agent/agents/rehearsal)
* **LiveKit Room Match**: `rehearsal_session_<userId>`
* **Features**: Listens to speech during video presentations to analyze speech speed (WPM) and word-filler rate.

### 7. SEVA (Seva Support)
* **Specialty**: Customer onboarding & API support guide.
* **Path**: [`python-agent/agents/seva/`](file:///d:/Antigravity%20Workspace/livekit-video-app/python-agent/agents/seva)
* **LiveKit Room Match**: `seva_session_<userId>`
* **Features**: Interactively walks clients through app settings, answers FAQs, and triggers test onboarding tasks.

### 8. MARTECH (Martech Dynamo)
* **Specialty**: SEO, Google Analytics (GA4), & Google Search Console (GSC) analyzer.
* **Path**: [`python-agent/agents/martech/`](file:///d:/Antigravity%20Workspace/livekit-video-app/python-agent/agents/martech)
* **LiveKit Room Match**: `martech_session_<userId>`
* **Features**: Ingests search analytics data, audits SEO structure, and drafts marketing advice reports.

### 9. OCTANE (Octane Telemetry)
* **Specialty**: Real-time network telemetry analyzer.
* **Path**: [`python-agent/agents/octane/`](file:///d:/Antigravity%20Workspace/livekit-video-app/python-agent/agents/octane)
* **LiveKit Room Match**: `telemetry_session_<userId>`
* **Features**: Monitors background metrics, publishing alerts to a Redis `octane_telemetry_stream` which the backend propagates to the browser via Socket.io.

### 10. DEVOPS_GENI (DevOps Geni)
* **Specialty**: SRE diagnostics, terminal commander, & SAST.
* **Path**: [`python-agent/agents/devopsgeni/`](file:///d:/Antigravity%20Workspace/livekit-video-app/python-agent/agents/devopsgeni)
* **LiveKit Room Match**: `devopsgeni_session_<userId>`
* **Features**: Automated diagnostic orb helper that connects to system logs and can recommend terminal cleanups or infrastructure patches.

### 11. AIVYUH (Aivyuh Compliance Scanner)
* **Specialty**: OWASP LLM security compliance scanner & swarm coordinator.
* **Path**: [`python-agent/agents/aivyuh/`](file:///d:/Antigravity%20Workspace/livekit-video-app/python-agent/agents/aivyuh)
* **LiveKit Room Match**: `security_session_<userId>`
* **Features**: Audits agent source files for security flaws (jailbreak vulnerabilities, data leaks, hardcoded keys) and coordinates mitigation workflows across other agents.

### 12. SWARM COPILOT (Swarm Copilot)
* **Specialty**: Context/knowledge base manager.
* **Path**: [`python-agent/agents/swarm_copilot/`](file:///d:/Antigravity%20Workspace/livekit-video-app/python-agent/agents/swarm_copilot)
* **Features**: Manages crawled knowledge files and file retrieval context.

---

## 3. Compliance Scanners & Analyzers
* **`run_scope_analyzer.py`**: Reads all Python agent configurations and logs their capabilities mapped to the NIST AI RMF framework.
* **`agents/nist/scanner.py`**: Auditor that checks compliance against NIST controls and writes to `audit_history.json`.
