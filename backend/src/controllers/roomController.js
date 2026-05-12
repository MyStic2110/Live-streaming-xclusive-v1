import { tokenService } from '../services/tokenService.js';
import { AgentDispatchClient } from 'livekit-server-sdk';
import { config } from '../config/livekit.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOM_NAME  = "ai_room_MURALI";
const AGENT_NAME = "AURA";
const USER_ID    = "MURALI";

export const talkToAI = async (req, res) => {
  const { agentType, userName } = req.body; 
  
  // Dynamic Identity: Use provided name or generate a Guest ID
  const userId = userName || `Guest_${Math.floor(Math.random() * 9000) + 1000}`;
  
  let roomName = "ai_room_MURALI";
  let agentName = "AURA";

  if (agentType === "lina") {
    roomName = `lina_session_${userId}`;
    agentName = "LINA";
  } else if (agentType === "vigil") {
    roomName = `audit_session_${userId}`;
    agentName = "VIGIL";
  } else if (agentType === "bi") {
    roomName = `bi_session_${userId}`;
    agentName = "BI";
  } else if (agentType === "bi2") {
    roomName = `bi2_session_${userId}`;
    agentName = "CORTEX2";
  } else if (agentType === "nova") {
    roomName = `nova_session_${userId}`;
    agentName = "NOVA";
  } else if (agentType === "vision") {
    roomName = `vision_session_${userId}`;
    agentName = "VONE";
  } else if (agentType === "aura") {
    roomName = `aura_session_${userId}`;
    agentName = "AURA";
  } else if (agentType === "astra") {
    roomName = `growth_session_${userId}`;
    agentName = "ASTRA";
  }

  console.log(`[HTTP_CONTROLLER] --> POST /talk-to-ai | AGENT: ${agentName} | ROOM: ${roomName}`);
  
  try {
    // 1. Generate token
    const { token } = await tokenService.generateToken(userId, roomName, true);
    console.log(`[HTTP_CONTROLLER] Token generated for ${userId}`);

    // 2. Prepare HTTP URL for Dispatch
    const apiUrl = config.livekit.url.replace("ws://", "http://").replace("wss://", "https://");
    
    const dispatchClient = new AgentDispatchClient(
      apiUrl,
      config.livekit.apiKey,
      config.livekit.apiSecret
    );

    // 3. Create Dispatch for the SPECIFIC agent
    // Adding a tiny delay to ensure the server is ready for the dispatch
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const dispatch = await dispatchClient.createDispatch(roomName, agentName);
    console.log(`[HTTP_CONTROLLER] ✅ ${agentName} dispatched successfully!`);

    res.json({ token, roomName: roomName, identity: userId, isAI: true });
  } catch (err) {
    console.error("[HTTP_CONTROLLER] ❌ CRITICAL AI DISPATCH ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
};

export const getAstraInsights = async (req, res) => {
  try {
    const blogsDir = path.join(__dirname, "../../../python-agent/agents/astra/blogs");
    
    if (!fs.existsSync(blogsDir)) {
      return res.json([]);
    }

    const files = fs.readdirSync(blogsDir);
    const insights = files
      .filter(f => f.endsWith(".json"))
      .map(f => {
        const content = fs.readFileSync(path.join(blogsDir, f), "utf-8");
        return JSON.parse(content);
      });

    // Sort by date (newest first)
    insights.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json(insights);
  } catch (err) {
    console.error("[HTTP_CONTROLLER] ❌ Error fetching insights:", err.message);
    res.status(500).json({ error: err.message });
  }
};
