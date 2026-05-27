import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import { config } from './src/config/livekit.js';
import * as roomController from './src/controllers/roomController.js';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {
  console.log(`[SOCKET] Client connected: ${socket.id}`);
  socket.on("disconnect", () => {
    console.log(`[SOCKET] Client disconnected: ${socket.id}`);
  });
});

// Inject io instance into the controller
roomController.setSocketIO(io);

// --- HTTP Business Routes ---
app.post("/talk-to-ai", roomController.talkToAI);
app.post("/deploy-shadow", roomController.deployShadow);
app.get("/insights", roomController.getAstraInsights);
app.get("/weather", roomController.getWeather);
app.post("/trigger-reels", roomController.triggerReels);

// --- aivyuh Security Console Routes ---
app.get("/security/status", roomController.getSecurityStatus);
app.post("/security/scan", roomController.runSecurityScan);
app.post("/security/remediate", roomController.updateSecurityConstraint);

httpServer.listen(config.port, "0.0.0.0", () => {
  console.log(`[ENTERPRISE] Business Layers Active on ${config.port}`);
  console.log(`[ENTERPRISE] LiveKit Target: ${config.livekit.url}`);
});
