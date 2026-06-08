import React, { useState } from "react";
import axios from "axios";
import LiveList from "./components/LiveList";
import VideoRoom from "./components/VideoRoom";
import LinaRoom from "./components/LinaRoom";
import BIRoom from "./components/BIRoom";
import NovaRoom from "./components/NovaRoom";
import VisionRoom from "./components/VisionRoom";
import BlogSection from "./components/BlogSection";
import AstraRoom from "./components/AstraRoom";
import RehearsalRoom from "./components/RehearsalRoom";
import SevaRoom from "./components/SevaRoom";
import SwarmTelemetryPage from "./components/SwarmTelemetryPage";
import MartechRoom from "./components/MartechRoom";
import OctaneRoom from "./components/OctaneRoom";
import DevopsGeniRoom from "./components/DevopsGeniRoom";
import AivyuhRoom from "./components/AivyuhRoom";
import DevopsOrb from "./components/DevopsOrb";
import SwarmShortsPage from "./components/SwarmShortsPage";
import DashboardPage from "./components/DashboardPage";
import GovernedDeployment from "./components/GovernedDeployment";
import NotFoundPage from "./components/NotFoundPage";
import CopilotWidget from "./components/CopilotWidget";
import '@livekit/components-styles/index.css';
import "./index.css";

const API = import.meta.env.VITE_API_URL || "";

function App() {
  const [roomData, setRoomData] = useState(null);
  const [showBlog, setShowBlog] = useState(false);
  const [showShorts, setShowShorts] = useState(false);
  const [currentPath, setCurrentPath] = useState(window.location.hash || window.location.pathname);
  const [isWaPopupOpen, setIsWaPopupOpen] = useState(false);

  React.useEffect(() => {
    // Auto-open WhatsApp popup after 5 seconds if not closed in this session
    const hasClosed = sessionStorage.getItem("wa-popup-closed");
    if (!hasClosed) {
      const timer = setTimeout(() => {
        setIsWaPopupOpen(true);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, []);

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

  const navigateToShorts = () => {
    window.history.pushState({}, "", "/learn");
    setCurrentPath("/learn");
    setShowShorts(true);
  };

  const navigateToDashboard = () => {
    window.history.pushState({}, "", "/dashboard");
    setCurrentPath("/dashboard");
    setShowShorts(false);
  };

  const navigateToDeployment = () => {
    window.history.pushState({}, "", "/governed-deployment");
    setCurrentPath("/governed-deployment");
    setShowShorts(false);
  };

  const navigateHome = () => {
    window.history.pushState({}, "", "/");
    setCurrentPath("/");
    setShowShorts(false);
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
  const isBI        = roomData?.creatorId === "BI";
  const isBI2       = roomData?.creatorId === "BI2";
  const isNova      = roomData?.creatorId === "NOVA";
  const isAura      = roomData?.creatorId === "AURA";
  const isVision    = roomData?.creatorId === "VONE";
  const isAstra     = roomData?.creatorId === "ASTRA";
  const isRehearsal = roomData?.creatorId === "REHEARSAL";
  const isSeva      = roomData?.creatorId === "SEVA";
  const isMartech   = roomData?.creatorId === "MARTECH";
  const isOctane    = roomData?.creatorId === "OCTANE";
  const isDevopsGeni = roomData?.creatorId === "DEVOPS_GENI";
  const isAivyuh    = roomData?.creatorId === "AIVYUH" || roomData?.creatorId === "aivyuh";

  const isTelemetryPath = 
    currentPath.replace(/\/$/, "") === "/agents-value-technicals-business" || 
    window.location.hash.replace(/\/$/, "") === "#/agents-value-technicals-business" ||
    window.location.hash === "#agents-value-technicals-business";

  const isShortsPath =
    currentPath.replace(/\/$/, "") === "/learn" ||
    window.location.hash === "#/learn";

  const isDashboardPath =
    currentPath.replace(/\/$/, "") === "/dashboard" ||
    window.location.hash === "#/dashboard" ||
    window.location.hash === "#dashboard";

  const isDeploymentPath =
    currentPath.replace(/\/$/, "") === "/governed-deployment" ||
    window.location.hash.replace(/\/$/, "") === "#/governed-deployment" ||
    window.location.hash === "#governed-deployment" ||
    window.location.hash === "#/governed-deployment/";

  let content;
  if (showBlog) {
    content = <BlogSection onBack={() => setShowBlog(false)} />;
  } else if (showShorts || isShortsPath) {
    content = <SwarmShortsPage onBack={navigateHome} />;
  } else if (isTelemetryPath) {
    content = <SwarmTelemetryPage onBack={navigateHome} />;
  } else if (isDashboardPath) {
    content = <DashboardPage onBack={navigateHome} />;
  } else if (isDeploymentPath) {
    content = <GovernedDeployment onBack={navigateHome} />;
  } else if (roomData) {
    content = isDevopsGeni ? (
      <DevopsGeniRoom roomData={roomData} onLeave={handleLeave} />
    ) : isLina ? (
      <LinaRoom roomData={roomData} onLeave={handleLeave} />
    ) : isBI ? (
      <BIRoom roomData={roomData} onLeave={handleLeave} />
    ) : isBI2 ? (
      <BIRoom roomData={roomData} onLeave={handleLeave} />
    ) : isNova ? (
      <NovaRoom roomData={roomData} onLeave={handleLeave} />
    ) : isAura ? (
      <VideoRoom roomData={roomData} onLeave={handleLeave} />
    ) : isAivyuh ? (
      <AivyuhRoom roomData={roomData} onLeave={handleLeave} />
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
    ) : isOctane ? (
      <OctaneRoom roomData={roomData} onLeave={handleLeave} />
    ) : (
      <VideoRoom roomData={roomData} onLeave={handleLeave} />
    );
  } else if (
    currentPath === "/" ||
    currentPath === "" ||
    currentPath.startsWith("#") ||
    currentPath === "/blog" ||
    currentPath.startsWith("/blog/")
  ) {
    content = (
      <LiveList 
        onJoin={handleJoin} 
        onBlogClick={() => setShowBlog(true)} 
        onTelemetryClick={navigateToTelemetry}
        onShortsClick={navigateToShorts}
        onDashboardClick={navigateToDashboard}
        onDeploymentClick={navigateToDeployment}
      />
    );
  } else {
    content = <NotFoundPage onBack={navigateHome} />;
  }

  return (
    <div className="app-container">
      {content}

      {/* Floating Swarm Customer Support Copilot Chat Widget */}
      {!roomData && (
        <>
          <DevopsOrb />
          <CopilotWidget />
        </>
      )}
    </div>
  );
}

export default App;
