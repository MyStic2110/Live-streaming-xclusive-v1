import React, { useState } from "react";
import axios from "axios";
import LiveList from "./components/LiveList";
import VideoRoom from "./components/VideoRoom";
import LinaRoom from "./components/LinaRoom";
import VigilRoom from "./components/VigilRoom";
import BIRoom from "./components/BIRoom";
import NovaRoom from "./components/NovaRoom";
import VisionRoom from "./components/VisionRoom";
import BlogSection from "./components/BlogSection";
import AstraRoom from "./components/AstraRoom";
import RehearsalRoom from "./components/RehearsalRoom";
import SevaRoom from "./components/SevaRoom";
import SwarmTelemetryPage from "./components/SwarmTelemetryPage";
import MartechRoom from "./components/MartechRoom";
import '@livekit/components-styles/index.css';
import "./index.css";

const API = import.meta.env.VITE_API_URL || "";

function App() {
  const [roomData, setRoomData] = useState(null);
  const [showBlog, setShowBlog] = useState(false);
  const [currentPath, setCurrentPath] = useState(window.location.hash || window.location.pathname);

  React.useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.hash || window.location.pathname);
    };
    window.addEventListener("popstate", handleLocationChange);
    window.addEventListener("hashchange", handleLocationChange);
    return () => {
      window.removeEventListener("popstate", handleLocationChange);
      window.removeEventListener("hashchange", handleLocationChange);
    };
  }, []);

  const navigateToTelemetry = () => {
    window.history.pushState({}, "", "/agents-value-technicals-business");
    setCurrentPath("/agents-value-technicals-business");
  };

  const navigateHome = () => {
    window.history.pushState({}, "", "/");
    setCurrentPath("/");
  };

  const handleJoin = (data) => {
    console.log(`[FRONTEND] Entering room: ${data.roomName} | Agent: ${data.creatorId}`);
    setRoomData(data);
  };

  const handleLeave = () => {
    console.log(`[FRONTEND] Leaving room.`);
    setRoomData(null);
  };

  const toggleBlog = () => {
    setShowBlog(!showBlog);
  };

  const isLina      = roomData?.creatorId === "LINA";
  const isVigil     = roomData?.creatorId === "VIGIL";
  const isBI        = roomData?.creatorId === "BI";
  const isBI2       = roomData?.creatorId === "BI2";
  const isNova      = roomData?.creatorId === "NOVA";
  const isAura      = roomData?.creatorId === "AURA";
  const isVision    = roomData?.creatorId === "VONE";
  const isAstra     = roomData?.creatorId === "ASTRA";
  const isRehearsal = roomData?.creatorId === "REHEARSAL";
  const isSeva      = roomData?.creatorId === "SEVA";
  const isMartech   = roomData?.creatorId === "MARTECH";

  if (showBlog) {
    return <BlogSection onBack={() => setShowBlog(false)} />;
  }

  const isTelemetryPath = 
    currentPath.replace(/\/$/, "") === "/agents-value-technicals-business" || 
    window.location.hash.replace(/\/$/, "") === "#/agents-value-technicals-business" ||
    window.location.hash === "#agents-value-technicals-business";

  if (isTelemetryPath) {
    return <SwarmTelemetryPage onBack={navigateHome} />;
  }

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
          <VideoRoom roomData={roomData} onLeave={handleLeave} />
        ) : isVision ? (
          <VisionRoom roomData={roomData} onLeave={handleLeave} />
        ) : isAstra ? (
          <AstraRoom roomData={roomData} onLeave={handleLeave} />
        ) : isRehearsal ? (
          <RehearsalRoom roomData={roomData} onLeave={handleLeave} />
        ) : isSeva ? (
          <SevaRoom roomData={roomData} onLeave={handleLeave} />
        ) : isMartech ? (
          <MartechRoom roomData={roomData} onLeave={handleLeave} />
        ) : (
          <VideoRoom roomData={roomData} onLeave={handleLeave} />
        )
      ) : (
        <LiveList 
          onJoin={handleJoin} 
          onBlogClick={() => setShowBlog(true)} 
          onTelemetryClick={navigateToTelemetry}
        />
      )}
    </div>
  );
}

export default App;
