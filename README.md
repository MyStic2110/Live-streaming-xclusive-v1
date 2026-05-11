# SWARM: Army of Agents 🤖🔥

Welcome to **SWARM**, the future of decentralized AI agent orchestration. SWARM is an elite platform designed to coordinate a fleet of autonomous AI agents, each with a distinct persona, database native skill set, and mission-critical purpose.

Built on **LiveKit's** state-of-the-art SFU architecture, SWARM provides ultra-low latency voice and vision interaction with AI entities that feel alive and deeply integrated into your data ecosystem.

---

## 🤖 The Swarm Fleet

### 👁️ V-One — Biometric Gatekeeper (NEW)
V-One is a vision-first security agent. It performs 100% local biometric face verification using OpenCV's DNN engine. Perfect for secure attendance logging and identity-controlled access without a database.
- **Stack**: OpenCV (YuNet + SFace) + Deepgram TTS + GPT-4o-mini
- **Run**: `python agents/vision/vision_agent.py dev`

### 📊 Cortex BI — SQL Intelligence
Your conversational MySQL analyst. Capable of querying complex relational schemas to provide real-time business insights on revenue, operations, and anomalies.
- **Stack**: MySQL Connector + GPT-4o-mini + Deepgram Aura TTS
- **Run**: `python agents/bi/bi_agent.py dev`

### 🍃 Cortex II — NoSQL Nexus
The MongoDB-native evolution of Cortex. Specialized in real-time schema discovery and aggregation for the IPL Nexus ecosystem (predictions, leaderboards, and user streaks).
- **Stack**: Motor (Async MongoDB) + GPT-4o-mini + Deepgram Aura TTS
- **Run**: `python agents/bi2/bi2_agent.py dev`

### 🚀 Nova — Autonomous Copilot
An advanced SaaS copilot designed for autonomous UI navigation. Nova helps users explore the Nexus platform, explain match multipliers, and manage their profiles.
- **Stack**: Tool-Calling GPT-4o-mini + Deepgram TTS
- **Run**: `python agents/nova/nova_agent.py dev`

### 💖 Lina — Empathetic Partner
Lina is a calm, emotionally intelligent AI voice companion. She specializes in conversational therapy patterns and mental wellness support.
- **Stack**: GPT-4o-mini + Deepgram Aura Luna TTS
- **Run**: `python agents/lina/lina.py dev`

### 🛡️ Vigil — Cybersecurity Auditor
A professional, authoritative AI auditor that conducts deep IR maturity assessments and security governance audits.
- **Stack**: Structured Audit Logic + GPT-4o-mini + Deepgram Aura Hera TTS
- **Run**: `python agents/vigil/vigil.py dev`

---

## 🏗 Project Structure

```text
livekit-video-app/
├── frontend/                    # React + Vite (OperateAI-Inspired Hub UI)
│   └── src/components/
│       ├── VisionRoom.jsx       # 👁️ Biometric UI
│       └── LiveList.jsx         # 🚁 Swarm Command Center
├── backend/                     # Node.js (Agent Dispatch & Token Service)
├── python-agent/                # Python (The Swarm Intelligence Layer)
│   ├── agents/
│   │   ├── vision/              # 👁️ V-One (Face Recognition)
│   │   ├── bi2/                 # 🍃 Cortex II (MongoDB)
│   │   ├── nova/                # 🚀 Nova (SaaS Copilot)
│   │   ├── lina/                # 💖 Lina (Wellness)
│   │   └── vigil/               # 🛡️ Vigil (Security)
│   ├── .env                     # Multi-provider credentials
│   └── requirements.txt
```

---

## 🛠 Installation & Setup

### 1. Initialize Vision Models
Before running **V-One**, you must download the local ONNX models:
```bash
cd python-agent
python agents/vision/setup_models.py
```

### 2. Start the Swarm
The Swarm is a microservice ecosystem. Each layer must be active:
- **Infrastructure**: `docker-compose up -d`
- **Intelligence**: `python main.py dev` (Main worker)
- **Specialized Units**: `python agents/vision/vision_agent.py dev`
- **Command Center**: `npm run dev` (in /frontend)

---

## 🎯 Swarm Roadmap
- [x] **V-One Biometrics**: Local-first identity verification.
- [x] **Cortex II**: NoSQL native intelligence.
- [ ] **Aura v2**: Real-time satellite data integration.
- [ ] **Swarm Memory**: Cross-agent long-term memory sync.

**Building the Future of Autonomous Intelligence with SWARM.**
