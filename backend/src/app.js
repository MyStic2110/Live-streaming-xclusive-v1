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
import changelogRoutes from './routes/changelogRoutes.js';
import careersRoutes from './routes/careersRoutes.js';
import battleRoutes from './routes/battleRoutes.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// --- ROUTE MOUNTINGS ---
// Consolidated routing system. Maintains strict backward compatibility with the frontend endpoints.
app.use('/api/auth', authRoutes);
app.use('/api/crawler', crawlerRoutes);
app.use('/api/github', githubRoutes);
app.use('/api/battle', battleRoutes);
app.use('/api', configRoutes);
app.use('/api', telemetryRoutes); // Mounts /api/llm-trace, /api/llm-traces, /api/evaluate-hallucination, etc.
app.use('/', telemetryRoutes);   // Mounts root-level routes: /security/status, /security/scan, /security/remediate, /detokenize
app.use('/', roomRoutes);        // Mounts root-level routes: /talk-to-ai, /trigger-reels, /copilot/chat, /copilot/session/clear
app.use('/cold-email', coldEmailRoutes);
app.use('/api/changelog', changelogRoutes);
app.use('/api/careers', careersRoutes);
export default app;
