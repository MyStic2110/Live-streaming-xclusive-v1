import { tokenService } from '../services/tokenService.js';
import { presenceService } from '../services/presenceService.js';

export const goLive = async (req, res) => {
  console.log(`[HTTP_CONTROLLER] --> POST /go-live | START`);
  try {
    const { creatorId } = req.body;
    console.log(`[HTTP_CONTROLLER] PARAMS: creatorId=${creatorId}`);
    
    const roomName = `room_${creatorId.substring(0, 5)}`;
    const { token, identity } = await tokenService.generateToken(creatorId, roomName, true);
    
    console.log(`[HTTP_CONTROLLER] <-- SUCCESS: Room Created: ${roomName}`);
    res.json({ token, roomName, identity });
  } catch (err) {
    console.error("[HTTP_CONTROLLER] !!! CRITICAL ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
};

export const requestCall = async (req, res) => {
  console.log(`[HTTP_CONTROLLER] --> POST /request-call | START`);
  try {
    const { creatorId, userId } = req.body;
    console.log(`[HTTP_CONTROLLER] PARAMS: creatorId=${creatorId}, userId=${userId}`);
    
    const creatorData = presenceService.getCreator(creatorId);
    if (!creatorData) {
      console.log(`[HTTP_CONTROLLER] <-- FAIL: Creator ${creatorId} not found in presence map.`);
      return res.status(404).json({ error: "Creator Offline" });
    }

    const { token, identity } = await tokenService.generateToken(userId, creatorData.roomName, false);
    
    console.log(`[HTTP_CONTROLLER] <-- SUCCESS: Call Granted for room ${creatorData.roomName}`);
    res.json({ token, identity });
  } catch (err) {
    console.error("[HTTP_CONTROLLER] !!! CRITICAL ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
};

export const endRoom = (req, res) => {
  console.log(`[HTTP_CONTROLLER] --> POST /end-room | Handled.`);
  res.json({ success: true });
};
