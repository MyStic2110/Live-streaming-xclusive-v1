import { tokenService } from '../services/tokenService.js';
import { AgentDispatchClient } from 'livekit-server-sdk';
import { config } from '../config/livekit.js';

const ROOM_NAME  = "ai_room_MURALI";
const AGENT_NAME = "WEATHER AGENT FOR INDIA";
const USER_ID    = "MURALI";

export const talkToAI = async (req, res) => {
  const { agentType } = req.body; // 'weather' or 'lina'
  
  let roomName = "ai_room_MURALI";
  let agentName = "WEATHER AGENT FOR INDIA";

  if (agentType === "lina") {
    roomName = "personal_companion";
    agentName = "LINA";
  }

  console.log(`[HTTP_CONTROLLER] --> POST /talk-to-ai | AGENT: ${agentName} | ROOM: ${roomName}`);
  
  try {
    // 1. Generate token
    const { token } = await tokenService.generateToken(USER_ID, roomName, true);
    console.log(`[HTTP_CONTROLLER] Token generated for ${USER_ID}`);

    // 2. Prepare HTTP URL for Dispatch
    const apiUrl = config.livekit.url.replace("ws://", "http://").replace("wss://", "https://");
    
    const dispatchClient = new AgentDispatchClient(
      apiUrl,
      config.livekit.apiKey,
      config.livekit.apiSecret
    );

    // 3. Create Dispatch for the SPECIFIC agent
    const dispatch = await dispatchClient.createDispatch(roomName, agentName);
    console.log(`[HTTP_CONTROLLER] ✅ ${agentName} dispatched successfully!`);

    res.json({ token, roomName: roomName, identity: USER_ID, isAI: true });
  } catch (err) {
    console.error("[HTTP_CONTROLLER] ❌ CRITICAL AI DISPATCH ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
};
