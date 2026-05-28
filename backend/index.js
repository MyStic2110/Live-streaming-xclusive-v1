import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from 'redis';
import { config } from './src/config/livekit.js';
import * as roomController from './src/controllers/roomController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// --- REDIS TELEMETRY BRIDGE ---
const redisClient = createClient({ url: 'redis://localhost:6379' });
redisClient.on('error', (err) => console.error('Redis Client Error', err));
await redisClient.connect();

await redisClient.subscribe('octane_telemetry_stream', (message) => {
  try {
    const payload = JSON.parse(message);
    if (payload.alert === true) {
      console.log("[REDIS ALERT] Forwarding alert to frontend clients.");
      io.emit("backend_error", { type: "RUNTIME_ALERT", message: payload.line, timestamp: payload.timestamp });
    }
  } catch(e) {
    // ignore parse error
  }
});

// --- GLOBAL ERROR TELEMETRY ---
const logBackendError = (type, error) => {
  const timestamp = new Date().toISOString();
  const errorMsg = error instanceof Error ? error.stack || error.message : String(error);
  
  const logEntry = `[${timestamp}] [${type}] ${errorMsg}\n`;
  const logPath = path.resolve(__dirname, "../backend_errors.log");
  
  try {
    fs.appendFileSync(logPath, logEntry);
    console.error(`[TELEMETRY] ${type} appended to backend_errors.log`);
    io.emit("backend_error", { type, message: errorMsg, timestamp });
  } catch (err) {
    console.error(`[TELEMETRY] Failed to write error log:`, err);
  }
};

process.on("uncaughtException", (err) => {
  logBackendError("UNCAUGHT_EXCEPTION", err);
});

process.on("unhandledRejection", (reason) => {
  logBackendError("UNHANDLED_REJECTION", reason);
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
