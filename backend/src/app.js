import express from 'express';
import cors from 'cors';

// Route Imports
import authRoutes from './routes/authRoutes.js';
import configRoutes from './routes/configRoutes.js';
import roomRoutes from './routes/roomRoutes.js';
import telemetryRoutes from './routes/telemetryRoutes.js';
import crawlerRoutes from './routes/crawlerRoutes.js';
import githubRoutes from './routes/githubRoutes.js';
import coldEmailRoutes from './routes/coldEmailRoutes.js';

const app = express();

app.use(cors());
app.use(express.json());

// --- ROUTE MOUNTINGS ---
// Consolidated routing system. Maintains strict backward compatibility with the frontend endpoints.
app.use('/api/auth', authRoutes);
app.use('/api/crawler', crawlerRoutes);
app.use('/api/github', githubRoutes);
app.use('/api', configRoutes);
app.use('/api', telemetryRoutes); // Mounts /api/llm-trace, /api/llm-traces, /api/evaluate-hallucination, etc.
app.use('/', telemetryRoutes);   // Mounts root-level routes: /security/status, /security/scan, /security/remediate, /detokenize
app.use('/', roomRoutes);        // Mounts root-level routes: /talk-to-ai, /trigger-reels, /copilot/chat, /copilot/session/clear
app.use('/cold-email', coldEmailRoutes);
export default app;
