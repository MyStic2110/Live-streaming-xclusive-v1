import React, { useState } from "react";
import axios from "axios";
import LiveList from "./components/LiveList";
import VideoRoom from "./components/VideoRoom";
import '@livekit/components-styles/index.css';
import "./index.css";

const API = import.meta.env.VITE_API_URL || "";
function App() {
  const [roomData, setRoomData] = useState(null);

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
          onJoin={handleJoin} 
        />
      )}
    </div>
  );
}

export default App;
