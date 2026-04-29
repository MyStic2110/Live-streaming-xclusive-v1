import { AccessToken } from 'livekit-server-sdk';
import { config } from '../config/livekit.js';

class TokenService {
  async generateToken(identity, roomName, canPublish = false) {
    console.log(`[TOKEN_SERVICE] STEP 1: Starting generation for identity: ${identity}`);

    const at = new AccessToken(config.livekit.apiKey, config.livekit.apiSecret, {
      identity: identity,
      ttl: "2h"
    });

    console.log(`[TOKEN_SERVICE] STEP 3: Grants applied for room: ${roomName}`);
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: canPublish,
      canSubscribe: true
    });

    const token = await at.toJwt();
    console.log(`[TOKEN_SERVICE] STEP 4: JWT Signing Complete. Status: SUCCESS`);
    
    return { token, identity: identity };
  }
}

export const tokenService = new TokenService();
