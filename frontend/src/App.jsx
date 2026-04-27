import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import LiveList from "./components/LiveList";
import VideoRoom from "./components/VideoRoom";
import '@livekit/components-styles/index.css';
import "./index.css";

const API = "";

function App() {
  const [roomData, setRoomData] = useState(null);
  const [creators, setCreators] = useState([]);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!socketRef.current) {
      console.log("[FRONTEND_MASTER] Initializing Global Socket...");
      const s = io(API, { transports: ["websocket"] });
      socketRef.current = s;
      
      s.on("connect", () => console.log(`[FRONTEND_MASTER] Socket Connected: ${s.id}`));
      
      s.on("presence_update", (list) => {
        console.log(`[FRONTEND_MASTER] Presence Sync: ${list.length} creators now live.`);
        setCreators(list);
      });
    }
  }, []);

  const handleJoin = (data) => {
    console.log(`[FRONTEND_MASTER] ACTION: Entering Video Room: ${data.roomName}`);
    setRoomData(data);
    if (data.isCreator && socketRef.current) {
      console.log(`[FRONTEND_MASTER] SOCKET_EMIT: register_creator for ${data.creatorId}`);
      socketRef.current.emit("register_creator", {
        creatorId: data.creatorId,
        roomName: data.roomName
      });
    }
  };

  const handleLeave = () => {
    console.log(`[FRONTEND_MASTER] ACTION: Leaving Video Room.`);
    setRoomData(null);
  };

  return (
    <div className="app-container">
      {roomData ? (
        <VideoRoom 
          roomData={roomData} 
          onLeave={handleLeave} 
        />
      ) : (
        <LiveList 
          creators={creators}
          onJoin={handleJoin} 
        />
      )}
    </div>
  );
}

export default App;
