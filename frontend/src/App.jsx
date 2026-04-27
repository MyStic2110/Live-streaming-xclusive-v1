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
      
      s.on("disconnect", (reason) => {
        console.warn(`[FRONTEND_MASTER] !!! SOCKET DISCONNECTED: ${reason}`);
      });
      
      s.on("presence_update", (list) => {
        console.log(`[FRONTEND_MASTER] Presence Sync: ${list.length} creators now live.`);
        setCreators(list);
      });
    }
  }, []);

  // AUTO-RECOVERY: If socket reconnects while we are a creator, re-register immediately
  useEffect(() => {
    if (roomData?.isCreator && socketRef.current) {
      const socket = socketRef.current;
      const reRegister = () => {
        console.log(`[FRONTEND_MASTER] AUTO-RECOVER: Re-registering ${roomData.creatorId}`);
        socket.emit("register_creator", {
          creatorId: roomData.creatorId,
          roomName: roomData.roomName
        });
      };

      socket.on("connect", reRegister);
      // Initial registration if just joined
      reRegister();

      return () => {
        socket.off("connect", reRegister);
      };
    }
  }, [roomData, socketRef.current]);

  const handleJoin = (data) => {
    console.log(`[FRONTEND_MASTER] ACTION: Entering Video Room: ${data.roomName}`);
    setRoomData(data);
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
