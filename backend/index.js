import express from 'express';
// Trigger DB Reconnect 4
import http from 'http';
import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from 'redis';
import { config } from './src/config/livekit.js';
import * as roomController from './src/controllers/roomController.js';
import * as telemetryController from './src/controllers/telemetryController.js';
import * as copilotService from './src/services/copilotService.js';
import logger from './src/config/logger.js';
import { connectDB } from './src/config/db.js';

// Route Imports
import authRoutes from './src/routes/authRoutes.js';
import configRoutes from './src/routes/configRoutes.js';
import roomRoutes from './src/routes/roomRoutes.js';
import telemetryRoutes from './src/routes/telemetryRoutes.js';
import crawlerRoutes from './src/routes/crawlerRoutes.js';
import githubRoutes from './src/routes/githubRoutes.js';
import careersRoutes from './src/routes/careersRoutes.js';
import battleRoutes from './src/routes/battleRoutes.js';
import changelogRoutes from './src/routes/changelogRoutes.js';
import docsRoutes from './src/routes/docsRoutes.js';
import delhiveryRoutes from './src/routes/delhiveryRoutes.js';
import { registerBattleSockets } from './src/sockets/battleSocket.js';
import agentsRoutes from './src/routes/agentsRoutes.js';
import { startMetricsMonitor } from './src/services/monitorService.js';

// API platform middleware
import { requestContext } from './src/middlewares/requestContext.js';
import { securityHeaders, corsPolicy, globalRateLimiter } from './src/middlewares/httpSecurity.js';
import { notFoundHandler, errorHandler } from './src/middlewares/errorHandler.js';

// Global console redirection to Pino structured JSON logger for high-throughput enterprise performance
console.log = (...args) => logger.info(args.join(' '));
console.info = (...args) => logger.info(args.join(' '));
console.warn = (...args) => logger.warn(args.join(' '));
console.error = (...args) => {
  if (args[0] instanceof Error) {
    logger.error({ err: args[0] }, args[0].message);
  } else {
    logger.error(args.join(' '));
  }
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Trust proxy only when explicitly configured (e.g. behind a load balancer)
// so client IPs for rate limiting cannot be spoofed via X-Forwarded-For.
app.set('trust proxy', process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) : false);
app.use(securityHeaders);
app.use(requestContext);
app.use(corsPolicy());
app.use(globalRateLimiter);
app.use(express.json({ limit: '10mb' }));

const httpServer = http.createServer(app);
const socketOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const io = new Server(httpServer, {
  cors: {
    origin: socketOrigins.length ? socketOrigins : "*",
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
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => {
      // Reconnect indefinitely with backoff, max 3 seconds delay
      return Math.min(retries * 100, 3000);
    }
  }
});
redisClient.on('error', (err) => {
  if (err.code !== 'ECONNREFUSED') {
    console.error('Redis Client Error', err.message);
  }
});

try {
  await redisClient.connect();
  logger.info('[REDIS] ✅ Connected to Redis successfully.');
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
} catch (redisErr) {
  logger.warn(`[REDIS] ⚠️  Redis connection failed: ${redisErr.message}`);
  logger.warn('[REDIS] Octane telemetry bridge is offline. Server continues without real-time Redis alerts.');
}


// --- GLOBAL ERROR TELEMETRY ---
const logBackendError = (type, error) => {
  const timestamp = new Date().toISOString();
  const errorMsg = error instanceof Error ? error.stack || error.message : String(error);
  
  const logEntry = `[${timestamp}] [${type}] ${errorMsg}\n`;
  const logPath = path.resolve(__dirname, "../backend_errors.log");
  
  // Asynchronous append to avoid event loop blocking
  fs.appendFile(logPath, logEntry, 'utf8', (err) => {
    if (err) {
      console.error(`[TELEMETRY] Failed to write error log:`, err);
    } else {
      console.error(`[TELEMETRY] ${type} appended to backend_errors.log`);
    }
  });
  io.emit("backend_error", { type, message: errorMsg, timestamp });
};

process.on("uncaughtException", (err) => {
  logBackendError("UNCAUGHT_EXCEPTION", err);
  // Graceful exit for enterprise reliability (PM2 or Kubernetes restarts the process)
  setTimeout(() => process.exit(1), 1000);
});

process.on("unhandledRejection", (reason) => {
  logBackendError("UNHANDLED_REJECTION", reason);
});

// Inject io instance into the controllers
roomController.setSocketIO(io);
telemetryController.setSocketIO(io);
copilotService.setSocketIO(io);
registerBattleSockets(io);
startMetricsMonitor(io);

// Connect to Database
await connectDB();

// --- ROUTE MOUNTINGS (legacy/stable surface — preserved for backward compatibility) ---
app.use('/api/auth', authRoutes);
app.use('/api/crawler', crawlerRoutes);
app.use('/api/github', githubRoutes);
app.use('/api/careers', careersRoutes);
app.use('/api/battle', battleRoutes);
app.use('/api/changelog', changelogRoutes); // Reconciled: was only mounted in the dead src/app.js
app.use('/api', configRoutes);
app.use('/api', telemetryRoutes); // Mounts /api/llm-trace, /api/llm-traces, /api/evaluate-hallucination, etc.
app.use('/', telemetryRoutes);   // Mounts root-level routes: /security/status, /security/scan, /security/remediate, /detokenize
app.use('/', roomRoutes);        // Mounts root-level routes: /talk-to-ai, /trigger-reels, /copilot/chat, /copilot/session/clear
app.use('/api/delhivery', delhiveryRoutes);
app.use('/api/agents', agentsRoutes);


// --- VERSIONED SURFACE (/api/v1) — additive aliases for new clients; legacy paths above remain valid ---
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/crawler', crawlerRoutes);
app.use('/api/v1/github', githubRoutes);
app.use('/api/v1/careers', careersRoutes);
app.use('/api/v1/battle', battleRoutes);
app.use('/api/v1/changelog', changelogRoutes);
app.use('/api/v1', configRoutes);
app.use('/api/v1', telemetryRoutes);
app.use('/api/v1', roomRoutes);
app.use('/api/v1/delhivery', delhiveryRoutes);


// --- API DOCUMENTATION (Swagger UI + raw OpenAPI 3.1 spec) ---
if (process.env.ENABLE_API_DOCS !== 'false') {
  app.use('/api', docsRoutes); // GET /api/docs and GET /api/openapi.json
}

// --- TERMINAL HANDLERS (must be registered after all routes) ---
app.use(notFoundHandler);
app.use(errorHandler);

httpServer.listen(config.port, "0.0.0.0", () => {
  console.log(`[ENTERPRISE] Business Layers Active on ${config.port}`);
  console.log(`[ENTERPRISE] LiveKit Target: ${config.livekit.url}`);
});
