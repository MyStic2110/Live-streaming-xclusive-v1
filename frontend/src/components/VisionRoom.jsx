import React, { memo } from "react";
import CostGuardAlert from "./CostGuardAlert";
import { 
  LiveKitRoom, 
  VideoConference, 
  RoomAudioRenderer
} from "@livekit/components-react";
import "@livekit/components-styles/index.css";

const VisionRoom = memo(function VisionRoom({ roomData, onLeave }) {
  const serverUrl = import.meta.env.VITE_LIVEKIT_URL || 'ws://localhost:7880';

  return (
    <div style={{ height: "100dvh", width: "100vw", background: "#f8fafc", fontFamily: "'Outfit', sans-serif" }}>
      <LiveKitRoom
        video={true}
        audio={true}
        token={roomData.token}
        serverUrl={serverUrl}
        onDisconnected={onLeave}
        data-lk-theme="default"
        style={{ height: "100%" }}
      >
        <header style={{ 
          height: "80px", 
          padding: "0 4rem", 
          background: "rgba(255, 255, 255, 0.8)", 
          backdropFilter: "blur(20px)", 
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
              <div style={{ width: "12px", height: "12px", background: "#f59e0b", borderRadius: "50%", boxShadow: "0 0 15px #f59e0b" }}></div>
              <span style={{ fontWeight: "900", letterSpacing: "2px", fontSize: "1.2rem" }}>V-ONE <span style={{ color: "#64748b", fontSize: "0.8rem", fontWeight: "400" }}>| BIOMETRIC GATEKEEPER</span></span>
          </div>
          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <span style={{ fontSize: "0.7rem", color: "#64748b", letterSpacing: "1px" }}>ENCRYPTED END-TO-END</span>
            <button onClick={onLeave} style={{ background: "transparent", color: "#ef4444", border: "1px solid #ef4444", padding: "0.5rem 1.5rem", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", fontSize: "0.8rem", transition: "all 0.2s" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(239, 68, 68, 0.05)" }} onMouseLeave={e => { e.currentTarget.style.background = "transparent" }}>ABORT SESSION</button>
          </div>
        </header>

        <main style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: "100px 4rem 4rem" }}>
          <div style={{ width: "100%", maxWidth: "1200px", height: "100%", position: "relative", borderRadius: "32px", overflow: "hidden", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 20px 40px rgba(0,0,0,0.03)" }}>
            <VideoConference 
                screenShare={false} 
                chat={false} 
                settingsView={false} 
                style={{ height: "100%" }}
            />
            
            {/* Overlay Instructions */}
            <div style={{ position: "absolute", bottom: "4rem", left: "50%", transform: "translateX(-50%)", textAlign: "center", zIndex: 100, pointerEvents: "none" }}>
                <div style={{ background: "rgba(255, 255, 255, 0.9)", backdropFilter: "blur(20px)", padding: "1.5rem 3rem", borderRadius: "20px", border: "1px solid rgba(245, 158, 11, 0.4)", boxShadow: "0 10px 25px rgba(0,0,0,0.05)" }}>
                    <p style={{ color: "#0f172a", fontSize: "1.2rem", fontWeight: "700", margin: 0, letterSpacing: "0.5px" }}>LOOK DIRECTLY AT THE CAMERA</p>
                    <p style={{ color: "#d97706", fontSize: "0.8rem", fontWeight: "600", marginTop: "4px", textTransform: "uppercase", letterSpacing: "2px" }}>Analyzing Biometric Profile...</p>
                </div>
            </div>

            {/* Scan Lines Animation */}
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 5 }}>
                <div style={{ width: "100%", height: "2px", background: "linear-gradient(to right, transparent, #f59e0b, transparent)", position: "absolute", top: "0%", animation: "scan 4s linear infinite", opacity: 0.3 }}></div>
            </div>
          </div>
        </main>
        
        <style>{`
          @keyframes scan {
            0% { top: 0%; }
            100% { top: 100%; }
          }
          .lk-video-conference-inner { background: #f8fafc !important; }
          .lk-participant-tile { border-radius: 24px !important; overflow: hidden !important; border: 1px solid rgba(0,0,0,0.05) !important; background: #ffffff !important; }
          .lk-control-bar { background: rgba(255, 255, 255, 0.85) !important; backdrop-filter: blur(20px) !important; border: 1px solid rgba(0,0,0,0.06) !important; bottom: 2rem !important; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
          .lk-button { color: #0f172a !important; background: #f1f5f9 !important; border: 1px solid #e2e8f0 !important; }
          .lk-button:hover { background: #e2e8f0 !important; }
          .lk-disconnect-button { background: #ef4444 !important; color: white !important; }
          .lk-disconnect-button:hover { background: #dc2626 !important; }
          .lk-participant-metadata { color: #0f172a !important; }
        `}</style>
        
        <RoomAudioRenderer />
        <CostGuardAlert />
      </LiveKitRoom>
    </div>
  );
});

export default VisionRoom;
