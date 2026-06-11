import React, { memo, useEffect } from "react";
import CostGuardAlert from "./CostGuardAlert";
import { 
  LiveKitRoom, 
  VideoConference, 
  RoomAudioRenderer
} from "@livekit/components-react";
import "@livekit/components-styles";

console.log("[VITE] VideoRoom Loaded v2.0");

const VideoRoom = memo(function VideoRoom({ roomData, onLeave }) {
  // Use direct LiveKit URL — Vite proxy is not reliable for full RTC signaling
  const livekitUrl = import.meta.env.VITE_LIVEKIT_URL || 'ws://localhost:7880';

  return (
    <div style={{ height: "100dvh", width: "100vw", background: "#f8fafc" }}>
      <LiveKitRoom
        video={true}
        audio={true}
        token={roomData.token}
        serverUrl={livekitUrl}
        onDisconnected={onLeave}
        data-lk-theme="default"
        style={{ height: "100%" }}
      >
        <header style={{ 
          height: "60px", 
          padding: "0 2rem", 
          background: "rgba(255, 255, 255, 0.8)", 
          backdropFilter: "blur(10px)", 
          borderBottom: "1px solid rgba(0, 0, 0, 0.06)", 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center", 
          zIndex: 10,
          position: "fixed",
          top: 0, left: 0, right: 0,
          color: "#0f172a"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <span style={{ fontWeight: "800", letterSpacing: "1px" }}>SWARM <span style={{ color: "#2563eb" }}>• ARMY OF AGENTS</span></span>
          </div>
          <button onClick={onLeave} style={{ background: "#ef4444", color: "white", border: "none", padding: "0.4rem 1rem", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "#dc2626"} onMouseLeave={e => e.currentTarget.style.background = "#ef4444"}>EXIT</button>
        </header>

        <div style={{ paddingTop: "60px", height: "calc(100% - 60px)", display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, overflow: "hidden" }}>
             <VideoConference screenShare={false} chat={true} settingsView={false} />
          </div>
        </div>
        
        <style>{`
          button[data-lk-source="screen_share"] { display: none !important; }
          .lk-video-conference-inner { background: #f8fafc !important; }
          .lk-participant-tile { border-radius: 12px !important; overflow: hidden !important; border: 1px solid rgba(0,0,0,0.05) !important; background: #ffffff !important; }
          .lk-control-bar { background: rgba(255, 255, 255, 0.85) !important; backdrop-filter: blur(20px) !important; border: 1px solid rgba(0,0,0,0.06) !important; bottom: 2rem !important; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
          .lk-button { color: #0f172a !important; background: #f1f5f9 !important; border: 1px solid #e2e8f0 !important; }
          .lk-button:hover { background: #e2e8f0 !important; }
          .lk-disconnect-button { background: #ef4444 !important; color: white !important; }
          .lk-disconnect-button:hover { background: #dc2626 !important; }
          .lk-participant-metadata { color: #0f172a !important; }
          .lk-chat { background: #ffffff !important; border-left: 1px solid rgba(0, 0, 0, 0.06) !important; }
          .lk-chat-header { border-bottom: 1px solid rgba(0, 0, 0, 0.06) !important; color: #0f172a !important; }
          .lk-chat-entry { color: #0f172a !important; }
          .lk-chat-message { background: #f1f5f9 !important; color: #0f172a !important; }
          .lk-chat-text-input { background: #f8fafc !important; border: 1px solid #cbd5e1 !important; color: #0f172a !important; }
        `}</style>
        
        <RoomAudioRenderer />
        <CostGuardAlert />
      </LiveKitRoom>
    </div>
  );
});

export default VideoRoom;

