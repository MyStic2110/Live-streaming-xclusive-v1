class PresenceService {
  constructor() {
    this.liveCreators = new Map();
    this.socketToCreator = new Map();
    console.log(`[PRESENCE_SERVICE] Core Engine Initialized.`);
  }

  registerCreator(creatorId, roomName, socketId) {
    console.log(`[PRESENCE_SERVICE] REGISTER: Creator[${creatorId}] on Socket[${socketId}]`);
    this.liveCreators.set(creatorId, { roomName, socketId });
    this.socketToCreator.set(socketId, creatorId);
    console.log(`[PRESENCE_SERVICE] CURRENT_TOTAL_LIVE: ${this.liveCreators.size}`);
  }

  removeCreatorBySocket(socketId) {
    const creatorId = this.socketToCreator.get(socketId);
    if (creatorId) {
      console.log(`[PRESENCE_SERVICE] REMOVE: Creator[${creatorId}] disconnecting.`);
      this.liveCreators.delete(creatorId);
      this.socketToCreator.delete(socketId);
      console.log(`[PRESENCE_SERVICE] REMOVE_COMPLETE. Remaining: ${this.liveCreators.size}`);
      return true;
    }
    console.log(`[PRESENCE_SERVICE] DISCONNECT: Socket[${socketId}] was not a registered creator.`);
    return false;
  }

  getLiveCreators() {
    const creators = Array.from(this.liveCreators.entries()).map(([cid, data]) => ({
      creatorId: cid,
      roomName: data.roomName
    }));
    console.log(`[PRESENCE_SERVICE] BROADCAST_PREP: Returning ${creators.length} creators.`);
    return creators;
  }

  getCreator(creatorId) {
    const found = this.liveCreators.get(creatorId);
    console.log(`[PRESENCE_SERVICE] QUERY: Search for ${creatorId} | Found: ${!!found}`);
    return found;
  }
}

export const presenceService = new PresenceService();
