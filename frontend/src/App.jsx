import React, { useState } from "react";
import axios from "axios";
import LiveList from "./components/LiveList";
import VideoRoom from "./components/VideoRoom";
import LinaRoom from "./components/LinaRoom";
import VigilRoom from "./components/VigilRoom";
import BIRoom from "./components/BIRoom";
import NovaRoom from "./components/NovaRoom";
import WeatherRoom from "./components/WeatherRoom";
import '@livekit/components-styles/index.css';
import "./index.css";

const API = import.meta.env.VITE_API_URL || "";

function App() {
  const [roomData, setRoomData] = useState(null);

  const handleJoin = (data) => {
    console.log(`[FRONTEND] Entering room: ${data.roomName} | Agent: ${data.creatorId}`);
    setRoomData(data);
  };

  const handleLeave = () => {
    console.log(`[FRONTEND] Leaving room.`);
    setRoomData(null);
  };

  const isLina = roomData?.creatorId === "LINA";
  const isVigil = roomData?.creatorId === "VIGIL";
  const isBI = roomData?.creatorId === "BI";
  const isBI2 = roomData?.creatorId === "BI2";
  const isNova = roomData?.creatorId === "NOVA";
  const isAura = roomData?.creatorId === "AURA";

  return (
    <div className="app-container">
      {roomData ? (
        isLina ? (
          <LinaRoom roomData={roomData} onLeave={handleLeave} />
        ) : isVigil ? (
          <VigilRoom roomData={roomData} onLeave={handleLeave} />
        ) : isBI ? (
          <BIRoom roomData={roomData} onLeave={handleLeave} />
        ) : isBI2 ? (
          <BIRoom roomData={roomData} onLeave={handleLeave} />
        ) : isNova ? (
          <NovaRoom roomData={roomData} onLeave={handleLeave} />
        ) : isAura ? (
          <WeatherRoom roomData={roomData} onLeave={handleLeave} />
        ) : (
          <VideoRoom roomData={roomData} onLeave={handleLeave} />
        )
      ) : (
        <LiveList onJoin={handleJoin} />
      )}
    </div>
  );
}

export default App;

