# XCLUSIVE PRO - Elite Live Streaming Suite

XCLUSIVE PRO is a professional-grade, high-performance video calling and live streaming platform built on top of **LiveKit**. It features a premium "Azure & White" design system and is optimized for maximum connection stability.

## 🚀 Key Features

- **Stable WebRTC Core**: Powered by LiveKit's SFU architecture for low-latency, high-reliability video.
- **Elite Design System**: Sleek glassmorphism UI with "Azure" branding.
- **Active Speaker Detection**: Automatically highlights the current speaker with a glowing border.
- **Real-time Signal HUD**: Color-coded indicators for connection health (Green/Blue/Red).
- **Session Clock**: Built-in timer for professional tracking.
- **Enterprise Ready**: Scalable backend with JWT token authentication and real-time presence tracking.

## 🏗 Project Structure

```text
livekit-video-app/
├── frontend/          # React + Vite (Web Interface)
├── backend/           # Node.js + Socket.io (Identity & Token Service)
├── livekit/            # Go (Media Server)
└── docker-compose.yml  # Infrastructure (Redis + LiveKit)
```

## 🛠 Installation & Setup

### 1. Start the LiveKit Engine (Go)
Navigate to the `livekit` directory and start the server in development mode:
```bash
cd livekit
go run ./cmd/server --dev
```

### 2. Start the Backend (Node)
Install dependencies and start the identity service:
```bash
cd backend
npm install
npm run dev
```

### 3. Start the Frontend (Vite)
Start the web interface:
```bash
cd frontend
npm install
npm run dev
```

## ⚙️ Configuration

The app is pre-configured to work locally using a Vite WebSocket proxy:
- **Frontend Port**: 5173
- **Backend Port**: 3002
- **LiveKit Port**: 7880

## 📄 License
Private Repository - All rights reserved.
