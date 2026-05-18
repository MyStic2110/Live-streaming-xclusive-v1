import express from 'express';
import cors from 'cors';
import { config } from './src/config/livekit.js';
import * as roomController from './src/controllers/roomController.js';

const app = express();
app.use(cors());
app.use(express.json());

// --- HTTP Business Routes ---
app.post("/talk-to-ai", roomController.talkToAI);
app.post("/deploy-shadow", roomController.deployShadow);
app.get("/insights", roomController.getAstraInsights);

app.listen(config.port, "0.0.0.0", () => {
  console.log(`[ENTERPRISE] Business Layers Active on ${config.port}`);
  console.log(`[ENTERPRISE] LiveKit Target: ${config.livekit.url}`);
});
