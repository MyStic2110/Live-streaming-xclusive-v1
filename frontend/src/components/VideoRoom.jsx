import React, { memo } from "react";
import { 
  LiveKitRoom, 
  VideoConference, 
  formatChatMessageLinks,
  RoomAudioRenderer,
  ControlBar
} from "@livekit/components-react";
import "@livekit/components-styles";

const VideoRoom = memo(function VideoRoom({ roomData, onLeave }) {
  // Use the same proxy logic to ensure we hit the Go server via Vite
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const proxiedServerUrl = `${protocol}://${window.location.host}/livekit`;

  return (
    <div style={{ height: "100dvh", width: "100vw", background: "#0f172a" }}>
      <LiveKitRoom
        video={true}
        audio={true}
        token={roomData.token}
        serverUrl={proxiedServerUrl}
        onDisconnected={onLeave}
        data-lk-theme="default"
        style={{ height: "100%" }}
      >
        <header style={{ 
          height: "60px", 
          padding: "0 2rem", 
          background: "rgba(30, 41, 59, 0.7)", 
          backdropFilter: "blur(10px)", 
          borderBottom: "1px solid rgba(255,255,255,0.1)", 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center", 
          zIndex: 10,
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          color: "white"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <span style={{ fontWeight: "800" }}>XCLUSIVE <span style={{ color: "#3b82f6" }}>PRO</span></span>
          </div>
          <button 
            onClick={onLeave} 
            style={{ 
              background: "#ef4444", 
              color: "white", 
              border: "none", 
              padding: "0.4rem 1rem", 
              borderRadius: "6px", 
              fontWeight: "bold", 
              cursor: "pointer" 
            }}
          >
            EXIT
          </button>
        </header>

        <div style={{ paddingTop: "60px", height: "calc(100% - 60px)", display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, overflow: "hidden" }}>
             <VideoConference 
               screenShare={false} 
               chat={true} 
               settingsView={false}
             />
          </div>
        </div>
        
        {/* Force-hide the screen share button via CSS if the component is still rendering it */}
        <style>{`
          button[data-lk-source="screen_share"] { display: none !important; }
          .lk-button-group:has(button[data-lk-source="screen_share"]) button[data-lk-source="screen_share"] { display: none !important; }
        `}</style>
        
        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  );
});

export default VideoRoom;

