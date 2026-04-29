import { tokenService } from '../services/tokenService.js';
import { AgentDispatchClient } from 'livekit-server-sdk';
import { config } from '../config/livekit.js';

const ROOM_NAME  = "ai_room_MURALI";
const AGENT_NAME = "WEATHER AGENT FOR INDIA";
const USER_ID    = "MURALI";

export const talkToAI = async (req, res) => {
  console.log(`[HTTP_CONTROLLER] --> POST /talk-to-ai | START`);
  try {
    // 1. Generate token
    const { token } = await tokenService.generateToken(USER_ID, ROOM_NAME, true);
    console.log(`[HTTP_CONTROLLER] Token generated for ${USER_ID}`);

    // 2. Prepare HTTP URL for Dispatch (LiveKit API uses HTTP/HTTPS)
    const apiUrl = config.livekit.url.replace("ws://", "http://").replace("wss://", "https://");
    
    console.log(`[HTTP_CONTROLLER] Dispatching agent ${AGENT_NAME} to room ${ROOM_NAME}...`);
    console.log(`[HTTP_CONTROLLER] Using API Target: ${apiUrl}`);

    const dispatchClient = new AgentDispatchClient(
      apiUrl,
      config.livekit.apiKey,
      config.livekit.apiSecret
    );

    // 3. Create Dispatch
    const dispatch = await dispatchClient.createDispatch(ROOM_NAME, AGENT_NAME);
    console.log(`[HTTP_CONTROLLER] ✅ Agent dispatched successfully! Dispatch ID: ${dispatch.id}`);

    res.json({ token, roomName: ROOM_NAME, identity: USER_ID, isAI: true });
  } catch (err) {
    console.error("[HTTP_CONTROLLER] ❌ CRITICAL AI DISPATCH ERROR:", err.message);
    if (err.response) {
       console.error("[HTTP_CONTROLLER] Response data:", err.response.data);
    }
    res.status(500).json({ error: err.message });
  }
};
