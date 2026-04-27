import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { config } from './src/config/livekit.js';
import * as roomController from './src/controllers/roomController.js';
import { setupPresenceSocket } from './src/sockets/presenceSocket.js';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
  transports: ["websocket"]
});

// --- HTTP Business Routes ---
app.post("/go-live", roomController.goLive);
app.post("/request-call", roomController.requestCall);
app.post("/end-room", roomController.endRoom);

// --- Real-time Socket Layer ---
setupPresenceSocket(io);

httpServer.listen(config.port, "0.0.0.0", () => {
  console.log(`[ENTERPRISE] Business Layers Active on ${config.port}`);
  console.log(`[ENTERPRISE] LiveKit Target: ${config.livekit.url}`);
});
