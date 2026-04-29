# SWARM: Army of Agents 🤖🔥

Welcome to **SWARM**, the future of decentralized AI agent interaction. SWARM is an elite platform designed to orchestrate a massive fleet of autonomous agents, starting with our flagship **Weather Agent for India**.

Built on **LiveKit's** state-of-the-art SFU architecture, SWARM provides ultra-low latency video and voice interaction with AI entities that feel alive.

## 🚀 The Mission: Weather Agent for India 🇮🇳

Our first active agent in the SWARM is the **Weather Agent for India**. 
- **Personalized Insights**: Real-time weather data generated with a witty, Indian-centric twist.
- **Mistral AI Powered**: Leverages `Mistral-Large` for intelligence and high-fidelity TTS for natural speech.
- **Localized Humor**: From Bangalore's data centers to Mumbai's digital monsoons, the agent knows the vibe.

## 🌟 Key Features

- **One-Click Dispatch**: Seamlessly join an encrypted video session with our active swarm agents.
- **Real-Time Voice Pipeline**: Manual audio publication ensures zero-lag, high-quality 24kHz audio streaming.
- **Electric Blue (Azure) UI**: A premium, futuristic interface designed for the next generation of AI users.
- **Scalable Architecture**: Designed to support 50+ specialized agents in the upcoming phases.

## 🏗 Project Structure

```text
livekit-video-app/
├── frontend/          # React + Vite (The SWARM Command Center)
├── backend/           # Node.js (Agent Dispatch & Token Service)
├── python-agent/      # Python (SWARM Worker Logic & AI Voice Pipeline)
├── docker-compose.yml # Infrastructure (Redis + LiveKit Server)
└── livekit.yaml       # LiveKit Server Configuration
```

## 🛠 Installation & Setup

### 1. Start the Infrastructure (Docker)
Ensure you have Docker installed and running, then start the media server:
```bash
docker-compose up -d
```

### 2. Start the AI Agent (Python)
Navigate to the `python-agent` directory, install dependencies, and start the worker:
```bash
cd python-agent
pip install -r requirements.txt
python agent.py dev
```

### 3. Start the Backend (Node)
Start the identity and dispatch service:
```bash
cd backend
npm install
npm run dev
```

### 4. Start the Frontend (Vite)
Launch the web interface:
```bash
cd frontend
npm install
npm run dev
```

## ⚙️ Default Configuration
- **Lobby URL**: http://localhost:5173
- **API Port**: 3002
- **LiveKit Port**: 7880

## 🎯 Upcoming Agents
- 🦾 Tech Support Swarm
- 📚 Educational Guides
- 🎨 Creative Companions
- ... and 47 more.

---
**Building the Future Gen with SWARM.**
