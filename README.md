# SWARM: Army of Agents 🤖🔥

Welcome to **SWARM**, the future of decentralized AI agent interaction. SWARM is an elite platform designed to orchestrate a fleet of autonomous AI voice agents, each with a distinct persona, skill set, and purpose.

Built on **LiveKit's** state-of-the-art SFU architecture, SWARM provides ultra-low latency voice interaction with AI entities that feel alive.

---

## 🤖 Active Agents

### 💖 Lina — Warm Personal Partner
Lina is a calm, emotionally close AI voice companion. She listens, reflects, and responds with warmth — making every conversation feel personal and human.

- **Stack**: Deepgram STT + GPT-4o-mini (via OpenRouter) + Deepgram Aura TTS
- **Voice**: Aura Luna (natural, feminine, warm)
- **Run**: `python agents/lina/lina.py dev`

### 🌦️ Weather Agent for India
A professional AI voice agent specializing in witty, localized weather reporting for India. From Bangalore's data-center heat to Mumbai's digital monsoons.

- **Stack**: Silero VAD + Mistral STT + Mistral Large LLM + Mistral TTS
- **Voice**: Paul Neutral (crisp, professional)
- **Run**: `python agents/weather_agent/weather_agent.py dev`

---

## 🌟 Key Features

- **Multi-Agent Architecture**: Run specialized agents independently in separate rooms.
- **Real-Time Voice Pipeline**: VAD → STT → LLM → TTS, all streaming in real-time.
- **Stable on Windows**: Tuned VAD endpointing and Deepgram integration for reliable Windows performance.
- **Scalable Design**: Add new agents by simply creating a new folder under `agents/`.

---

## 🏗 Project Structure

```text
livekit-video-app/
├── frontend/                    # React + Vite (SWARM Command Center UI)
├── backend/                     # Node.js (Agent Dispatch & Token Service)
├── python-agent/                # Python (SWARM AI Voice Pipeline)
│   ├── agents/
│   │   ├── lina/                # 💖 Lina Agent (Warm Personal Partner)
│   │   │   ├── lina.py
│   │   │   ├── trigger_lina.py
│   │   │   ├── create_lina_voice.py
│   │   │   └── assets/          # Voice samples & MP3 references
│   │   └── weather_agent/       # 🌦️ Weather Agent (India)
│   │       └── weather_agent.py
│   ├── tests/
│   │   ├── shared/              # Generic STT/TTS tests
│   │   ├── lina_specific/       # Lina brain & memory tests
│   │   └── weather_specific/    # Mistral & LLM tests
│   ├── .env                     # API keys (not committed)
│   └── requirements.txt
├── docker-compose.yml           # Infrastructure (Redis + LiveKit Server)
└── livekit.yaml                 # LiveKit Server Configuration
```

---

## 🛠 Installation & Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- Docker Desktop

### 1. Start the Infrastructure
```bash
docker-compose up -d
```

### 2. Configure Environment Variables
Create a `.env` file inside `python-agent/`:
```env
# LiveKit (dev defaults)
LIVEKIT_URL=ws://127.0.0.1:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret

# Deepgram (for Lina STT + TTS)
DEEPGRAM_API_KEY=your_deepgram_key

# OpenRouter (for Lina LLM)
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# Mistral (for Weather Agent)
MISTRAL_API_KEY=your_mistral_key
```

### 3. Start an Agent
```bash
cd python-agent
pip install -r requirements.txt

# Run Lina
python agents/lina/lina.py dev

# OR Run the Weather Agent
python agents/weather_agent/weather_agent.py dev
```

### 4. Start the Backend
```bash
cd backend
npm install
npm run dev
```

### 5. Start the Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## ⚙️ Default Ports
| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3002 |
| LiveKit Server | ws://localhost:7880 |

---

## 🎯 Upcoming Agents
- 🧠 Memory Agent (persistent long-term memory)
- 🦾 Tech Support Agent
- 📚 Study & Learning Guide
- 🎨 Creative Writing Companion
- ... and many more in the SWARM.

---
**Building the Future Gen with SWARM.**
