import React, { memo, useEffect, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRemoteParticipants,
  useRoomContext
} from "@livekit/components-react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Sparkles, Activity, Shield, RefreshCw } from "lucide-react";
import BlogSection from "./BlogSection";

const COLORS = {
  primary: "#111827",
  accent: "#3b82f6",
  textMuted: "#6b7280",
  bgLight: "#ffffff",
  border: "#e5e7eb",
};

function AstraScene({ roomData, onLeave }) {
  const [agentState, setAgentState] = useState("idle");
  const [transcription, setTranscription] = useState("");
  const [blogPosts, setBlogPosts] = useState([]);
  const [logs, setLogs] = useState([
    { id: 1, type: "system", msg: "Strategic data link established.", time: new Date().toLocaleTimeString() }
  ]);
  const [isLogOpen, setIsLogOpen] = useState(true);
  const remoteParticipants = useRemoteParticipants();
  const room = useRoomContext();
  const logEndRef = React.useRef(null);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Listen for transcriptions
  useEffect(() => {
    const handleTranscription = (segments) => {
      const text = segments.map(s => s.text).join(" ");
      setTranscription(text);
      const timer = setTimeout(() => setTranscription(""), 3000);
      return () => clearTimeout(timer);
    };
    room.on("transcriptionReceived", handleTranscription);
    return () => room.off("transcriptionReceived", handleTranscription);
  }, [room]);

  // Listen for Astra's speaking state
  useEffect(() => {
    const astra = remoteParticipants.find(p => {
        try { return JSON.parse(p.metadata || "{}").name === "ASTRA"; } catch(e) { return false; }
    });
    if (!astra) {
        setAgentState("idle");
        return;
    }
    const handleSpeakingChanged = () => setAgentState(astra.isSpeaking ? "speaking" : "listening");
    astra.on("isSpeakingChanged", handleSpeakingChanged);
    return () => astra.off("isSpeakingChanged", handleSpeakingChanged);
  }, [remoteParticipants]);

  // Listen for data messages
  useEffect(() => {
    const onData = (payload, participant, kind, topic) => {
      if (topic === "ui_control") {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg.type === "publish_blog") {
            setBlogPosts(prev => [msg.data, ...prev]);
            setLogs(prev => [...prev, { 
                id: Date.now(), 
                type: "success", 
                msg: `DEPLOYED: "${msg.data.title}"`, 
                time: new Date().toLocaleTimeString() 
            }]);
        }
        if (msg.type === "agent_log") {
            setLogs(prev => [...prev, { 
                id: Date.now(), 
                type: msg.level || "info", 
                msg: msg.message, 
                time: new Date().toLocaleTimeString() 
            }]);
        }
      }
    };
    room.on('dataReceived', onData);
    return () => room.off('dataReceived', onData);
  }, [room]);

  const getLogIcon = (type) => {
    switch(type) {
      case "success": return <Shield size={14} color="#10b981" />;
      case "milestone": return <Sparkles size={14} color={COLORS.accent} />;
      case "warning": return <Activity size={14} color="#f59e0b" />;
      case "system": return <RefreshCw size={14} color={COLORS.accent} />;
      default: return <Sparkles size={14} color={COLORS.accent} />;
    }
  };

  return (
    <div style={{ height: "100vh", width: "100vw", overflow: "hidden", display: "flex", flexDirection: "column", background: COLORS.bgLight }}>
      {/* Astra Control Header */}
      <header style={{ 
        height: "80px", padding: "0 3%", background: "white", 
        borderBottom: `1px solid ${COLORS.border}`, display: "flex", 
        justifyContent: "space-between", alignItems: "center", zIndex: 1000,
        boxShadow: "0 4px 12px rgba(0,0,0,0.05)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "1.1rem", fontWeight: "900", letterSpacing: "2px", color: COLORS.primary }}>
              ASTRA <span style={{ color: COLORS.accent }}>ARCHITECT</span>
            </span>
            <span style={{ fontSize: "0.7rem", fontWeight: "700", color: COLORS.textMuted, letterSpacing: "1px" }}>
              {agentState === "speaking" ? "GENERATING STRATEGY..." : "MONITORING DATA..."}
            </span>
          </div>

          <button 
            onClick={() => setIsLogOpen(!isLogOpen)}
            style={{
                display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1rem",
                borderRadius: "20px", border: `1px solid ${COLORS.border}`, background: isLogOpen ? COLORS.primary : "none",
                color: isLogOpen ? "white" : COLORS.primary, fontSize: "0.7rem", fontWeight: "800", cursor: "pointer",
                transition: "all 0.3s"
            }}
          >
            <Activity size={14} /> {isLogOpen ? "CLOSE FEED" : "VIEW ACTIVITY"}
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
            <AnimatePresence>
                {transcription && (
                    <motion.div 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        style={{ fontSize: "0.9rem", color: COLORS.accent, fontStyle: "italic", fontWeight: "600" }}
                    >
                        "{transcription}"
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Visualizer Orb (Mini Version) */}
            <motion.div 
                animate={{ 
                    scale: agentState === "speaking" ? [1, 1.1, 1] : 1,
                    boxShadow: agentState === "speaking" ? `0 0 20px ${COLORS.accent}44` : "none"
                }}
                transition={{ duration: 0.5, repeat: Infinity }}
                style={{ 
                    width: "40px", height: "40px", borderRadius: "50%", 
                    background: agentState === "speaking" ? COLORS.accent : COLORS.primary,
                    display: "flex", alignItems: "center", justifyContent: "center", color: "white"
                }}
            >
                <Sparkles size={20} />
            </motion.div>

            <button 
                onClick={onLeave}
                style={{ 
                    padding: "0.6rem 1.5rem", borderRadius: "12px", border: `1px solid ${COLORS.border}`,
                    background: "none", fontWeight: "800", cursor: "pointer", fontSize: "0.8rem",
                    color: "#ef4444", transition: "all 0.2s"
                }}
                onMouseEnter={(e) => e.target.style.background = "#ef444411"}
                onMouseLeave={(e) => e.target.style.background = "none"}
            >
                LEAVE SESSION
            </button>
        </div>
      </header>

      {/* Main Layout Body */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Blog Content (Center) */}
        <div style={{ flex: 1, overflow: "auto", position: "relative" }}>
            <BlogSection onBack={onLeave} externalPosts={blogPosts} />
        </div>

        {/* Growth Activity Side Feed */}
        <AnimatePresence>
            {isLogOpen && (
                <motion.div 
                    initial={{ x: 400 }}
                    animate={{ x: 0 }}
                    exit={{ x: 400 }}
                    style={{ 
                        width: "350px", height: "100%", background: "#f9fafb",
                        borderLeft: `1px solid ${COLORS.border}`, display: "flex", flexDirection: "column",
                        boxShadow: "-4px 0 20px rgba(0,0,0,0.03)"
                    }}
                >
                    <div style={{ padding: "1.5rem", borderBottom: `1px solid ${COLORS.border}`, background: "white" }}>
                        <h3 style={{ fontSize: "0.8rem", fontWeight: "900", color: COLORS.primary, letterSpacing: "1px", margin: 0 }}>
                            GROWTH ACTIVITY FEED
                        </h3>
                        <p style={{ fontSize: "0.65rem", color: COLORS.textMuted, margin: "4px 0 0" }}>
                            Real-time autonomous decision stream
                        </p>
                    </div>

                    <div style={{ flex: 1, overflowY: "auto", padding: "1rem" }}>
                        {logs.map((log, i) => (
                            <motion.div 
                                key={log.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                style={{ 
                                    marginBottom: "1rem", display: "flex", gap: "0.8rem",
                                    padding: "0.8rem", borderRadius: "12px", 
                                    background: log.type === "milestone" ? "#eff6ff" : "white",
                                    border: log.type === "milestone" ? `1px solid ${COLORS.accent}44` : `1px solid ${COLORS.border}`, 
                                    boxShadow: log.type === "milestone" ? `0 4px 12px ${COLORS.accent}11` : "0 2px 6px rgba(0,0,0,0.02)"
                                }}
                            >
                                <div style={{ marginTop: "2px" }}>{getLogIcon(log.type)}</div>
                                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                    <span style={{ 
                                        fontSize: "0.75rem", color: COLORS.primary, lineHeight: "1.3", 
                                        fontWeight: log.type === "milestone" ? "800" : "600",
                                        letterSpacing: log.type === "milestone" ? "0.2px" : "normal"
                                    }}>
                                        {log.msg}
                                    </span>
                                    <span style={{ fontSize: "0.6rem", color: COLORS.textMuted, fontWeight: "500" }}>
                                        {log.time}
                                    </span>
                                </div>
                            </motion.div>
                        ))}
                        <div ref={logEndRef} />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
      </div>

      <RoomAudioRenderer />
    </div>
  );
}

const AstraRoom = memo(function AstraRoom({ roomData, onLeave }) {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const serverUrl = `${protocol}://${window.location.host}/livekit`;

  return (
    <LiveKitRoom
      audio={true}
      video={false}
      token={roomData.token}
      serverUrl={serverUrl}
      onDisconnected={onLeave}
    >
      <AstraScene roomData={roomData} onLeave={onLeave} />
    </LiveKitRoom>
  );
});

export default AstraRoom;
