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
import NotFoundPage from "./components/NotFoundPage";
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

  let content;
  if (showBlog) {
    content = <BlogSection onBack={() => setShowBlog(false)} />;
  } else if (showShorts || isShortsPath) {
    content = <SwarmShortsPage onBack={navigateHome} />;
  } else if (isTelemetryPath) {
    content = <SwarmTelemetryPage onBack={navigateHome} />;
  } else if (isDashboardPath) {
    content = <DashboardPage onBack={navigateHome} />;
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
      />
    );
  } else {
    content = <NotFoundPage onBack={navigateHome} />;
  }

  return (
    <div className="app-container">
      {content}

      {/* Floating Premium WhatsApp Contact Button & Popup Panel (Hidden in Active Rooms) */}
      {!roomData && (
        <>
          <DevopsOrb />
          {/* WhatsApp Popup Card */}
          <div 
            className={`wa-popup ${isWaPopupOpen ? "is-open" : ""}`} 
            role="dialog" 
            aria-label="WhatsApp message from Swarm"
          >
            <button 
              type="button" 
              className="wa-popup-close" 
              id="wa-popup-close" 
              aria-label="Close message"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsWaPopupOpen(false);
                sessionStorage.setItem("wa-popup-closed", "true");
              }}
            >
              ×
            </button>
            <div className="wa-popup-head">
              <div className="wa-popup-avatar" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.05 4.91A10.05 10.05 0 0 0 12 2C6.5 2 2.04 6.46 2.04 11.96c0 1.76.46 3.48 1.34 4.99L2 22l5.2-1.36a9.96 9.96 0 0 0 4.79 1.22h.01c5.5 0 9.96-4.46 9.96-9.96 0-2.66-1.04-5.16-2.91-7.04zM12 20.16a8.2 8.2 0 0 1-4.17-1.14l-.3-.18-3.09.81.82-3.01-.2-.31a8.18 8.18 0 0 1-1.25-4.37c0-4.52 3.68-8.2 8.2-8.2 2.19 0 4.25.85 5.8 2.4a8.15 8.15 0 0 1 2.4 5.8c0 4.52-3.68 8.2-8.2 8.2z" />
                </svg>
              </div>
              <div className="wa-popup-name">
                Swarm Agentic Lab
                <span className="wa-popup-status">Online · Replies in ~1 hr</span>
              </div>
            </div>
            <div className="wa-popup-msg">
              Hi there! Tell us what you're building — we usually reply within an hour.
            </div>
            <a 
              href="https://wa.me/919791388549?text=Hi%20swarm%20agents%2C%20I%27d%20like%20to%20discuss%20a%20project." 
              target="_blank" 
              rel="noopener noreferrer" 
              className="wa-popup-cta"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M19.05 4.91A10.05 10.05 0 0 0 12 2C6.5 2 2.04 6.46 2.04 11.96c0 1.76.46 3.48 1.34 4.99L2 22l5.2-1.36a9.96 9.96 0 0 0 4.79 1.22h.01c5.5 0 9.96-4.46 9.96-9.96 0-2.66-1.04-5.16-2.91-7.04zM12 20.16a8.2 8.2 0 0 1-4.17-1.14l-.3-.18-3.09.81.82-3.01-.2-.31a8.18 8.18 0 0 1-1.25-4.37c0-4.52 3.68-8.2 8.2-8.2 2.19 0 4.25.85 5.8 2.4a8.15 8.15 0 0 1 2.4 5.8c0 4.52-3.68 8.2-8.2 8.2z" />
              </svg>
              Start chat on WhatsApp
            </a>
          </div>

          {/* Floating Action Button */}
          <div 
            style={{
              position: "fixed",
              bottom: "2rem",
              right: "2rem",
              zIndex: 9999,
              display: "flex",
              alignItems: "center",
              gap: "12px",
              fontFamily: "'Outfit', sans-serif"
            }}
          >
            {/* Tooltip badge */}
            <div 
              style={{
                background: "rgba(255, 255, 255, 0.85)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255, 255, 255, 0.4)",
                color: "#111827",
                padding: "8px 16px",
                borderRadius: "14px",
                fontSize: "0.85rem",
                fontWeight: "700",
                boxShadow: "0 10px 30px rgba(0, 0, 0, 0.08)",
                opacity: 0,
                transform: "translateX(20px)",
                transition: "all 0.3s ease",
                pointerEvents: "none",
                whiteSpace: "nowrap"
              }}
            >
              Reach Swarm Creator 💬
            </div>

            {/* Floating Icon */}
            <div 
              onClick={() => setIsWaPopupOpen(prev => !prev)}
              style={{
                width: "56px",
                height: "56px",
                background: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)",
                borderRadius: "50%",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                boxShadow: "0 8px 30px rgba(37, 211, 102, 0.35), 0 0 0 1px rgba(37, 211, 102, 0.15)",
                cursor: "pointer",
                transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.1) translateY(-4px)";
                e.currentTarget.style.boxShadow = "0 15px 35px rgba(37, 211, 102, 0.5), 0 0 20px rgba(37, 211, 102, 0.3)";
                const tooltip = e.currentTarget.previousSibling;
                if (tooltip) {
                  tooltip.style.opacity = "1";
                  tooltip.style.transform = "translateX(0)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1) translateY(0)";
                e.currentTarget.style.boxShadow = "0 8px 30px rgba(37, 211, 102, 0.35), 0 0 0 1px rgba(37, 211, 102, 0.15)";
                const tooltip = e.currentTarget.previousSibling;
                if (tooltip) {
                  tooltip.style.opacity = "0";
                  tooltip.style.transform = "translateX(20px)";
                }
              }}
            >
              <svg 
                viewBox="0 0 24 24" 
                width="28" 
                height="28" 
                fill="#ffffff"
              >
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.501-5.733-1.455L0 24zm6.49-4.899l.374.222c1.618.96 3.738 1.467 5.926 1.468 5.482-.001 9.944-4.461 9.947-9.943.002-2.657-1.03-5.153-2.91-7.034C18.004 1.932 15.503.9 12.83.9 7.348.9 2.887 5.361 2.884 10.843c-.001 2.227.587 4.4 1.701 6.29l.262.443-1.01 3.692 3.71-.977zM17.47 14.86c-.27-.135-1.595-.788-1.842-.877-.247-.09-.427-.135-.607.135-.18.27-.697.877-.855 1.057-.157.18-.315.202-.585.067-1.157-.58-1.91-1.025-2.653-2.302-.197-.338-.197-.687-.067-.822.112-.116.247-.29.37-.435.124-.145.165-.248.248-.413.083-.165.042-.31-.02-.445-.062-.135-.607-1.462-.832-2.007-.22-.528-.44-.457-.607-.465-.157-.007-.337-.007-.517-.007-.18 0-.472.067-.719.338-.247.27-.944.922-.944 2.25s.966 2.61 1.1 2.79c.135.18 1.9 2.9 4.606 4.068.644.278 1.147.443 1.54.567.647.206 1.233.177 1.697.108.517-.077 1.595-.652 1.82-1.282.225-.63.225-1.17.157-1.282-.068-.113-.248-.18-.518-.315z"/>
              </svg>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
