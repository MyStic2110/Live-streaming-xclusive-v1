import { presenceService } from '../services/presenceService.js';

export const setupPresenceSocket = (io) => {
  io.on("connection", (socket) => {
    console.log(`[SOCKET] Handshake: ${socket.id}`);

    socket.on("register_creator", (data) => {
      presenceService.registerCreator(data.creatorId, data.roomName, socket.id);
      broadcast(io);
    });

    socket.on("remove_creator", () => {
      if (presenceService.removeCreatorBySocket(socket.id)) {
        broadcast(io);
      }
    });

    socket.on("disconnect", (reason) => {
      console.log(`[SOCKET] Disconnected: ${socket.id} | Reason: ${reason}`);
      if (presenceService.removeCreatorBySocket(socket.id)) {
        broadcast(io);
      }
    });
  });
};

function broadcast(io) {
  const list = presenceService.getLiveCreators();
  io.emit("presence_update", list);
}
