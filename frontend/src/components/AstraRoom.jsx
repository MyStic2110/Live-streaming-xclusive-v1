import React, { memo, useEffect, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRemoteParticipants,
  useRoomContext
} from "@livekit/components-react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Sparkles, Activity, Shield, RefreshCw, User, Mic, MicOff } from "lucide-react";
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
  const [transcription, setTranscription] = useState(null);
  const [blogPosts, setBlogPosts] = useState([]);
  const [logs, setLogs] = useState([
    { id: 1, type: "system", msg: "Strategic data link established.", time: new Date().toLocaleTimeString() }
  ]);
  const [isLogOpen, setIsLogOpen] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const [isMicMuted, setIsMicMuted] = useState(true);
  const remoteParticipants = useRemoteParticipants();
  const room = useRoomContext();
  const logEndRef = React.useRef(null);

  const handleSendChat = async () => {
    if (!chatInput.trim()) return;
    const userText = chatInput.trim();
    setChatInput("");

    setLogs(prev => [...prev, {
      id: Date.now(),
      type: "user_message",
      msg: userText,
      time: new Date().toLocaleTimeString()
    }]);

    try {
      const payload = JSON.stringify({ type: "chat_message", text: userText });
      await room.localParticipant.publishData(
        new TextEncoder().encode(payload),
        { reliable: true, topic: "chat_message" }
      );
    } catch (err) {
      console.error("[ASTRA] Failed to send chat message:", err);
      setLogs(prev => [...prev, {
        id: Date.now(),
        type: "warning",
        msg: "Failed to deliver message to Astra.",
        time: new Date().toLocaleTimeString()
      }]);
    }
  };

  const toggleMute = async () => {
    try {
      const enabled = room.localParticipant.isMicrophoneEnabled;
      await room.localParticipant.setMicrophoneEnabled(!enabled);
      setIsMicMuted(enabled);
    } catch (err) {
      console.error("Failed to toggle microphone:", err);
    }
  };

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, transcription]);

  // Listen for transcriptions
  useEffect(() => {
    let timer;
    const handleTranscription = (segments, participant) => {
      if (!segments || segments.length === 0) return;
      const text = segments.map(s => s.text).join(" ");
      if (!text.trim()) return;

      let speaker = "user";
      if (participant) {
        const identity = participant.identity || "";
        let metaName = "";
        try {
          metaName = JSON.parse(participant.metadata || "{}").name || "";
        } catch (e) {}

        if (identity.toUpperCase().includes("ASTRA") || metaName.toUpperCase().includes("ASTRA")) {
          speaker = "astra";
        }
      }

      setTranscription({ text, speaker });

      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setTranscription(null), 3000);
    };

    room.on("transcriptionReceived", handleTranscription);
    return () => {
      room.off("transcriptionReceived", handleTranscription);
      if (timer) clearTimeout(timer);
    };
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
            if (msg.level === "astra") {
                setTranscription(null);
            }
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
      case "user_message": return <User size={14} color="#10b981" />;
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
                onClick={toggleMute}
                style={{ 
                    padding: "0.6rem 1.2rem", borderRadius: "12px", border: `1px solid ${COLORS.border}`,
                    background: isMicMuted ? "#ef444411" : "none", fontWeight: "800", cursor: "pointer", fontSize: "0.8rem",
                    color: isMicMuted ? "#ef4444" : COLORS.primary, display: "flex", alignItems: "center", gap: "8px",
                    transition: "all 0.2s"
                }}
            >
                {isMicMuted ? <MicOff size={16} /> : <Mic size={16} />}
                {isMicMuted ? "MIC OFF" : "MIC ON"}
            </button>

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

                    <div style={{ flex: 1, overflowY: "auto", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {logs.map((log, i) => {
                            if (log.type === "user_message") {
                                return (
                                    <motion.div 
                                        key={log.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        style={{ 
                                            display: "flex", 
                                            justifyContent: "flex-end", 
                                            width: "100%",
                                            marginBottom: "0.4rem"
                                        }}
                                    >
                                        <div style={{ 
                                            maxWidth: "85%",
                                            background: "linear-gradient(135deg, #10b981, #059669)",
                                            color: "white",
                                            padding: "0.7rem 0.9rem",
                                            borderRadius: "16px 16px 2px 16px",
                                            boxShadow: "0 4px 12px rgba(16,185,129,0.15)",
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: "2px"
                                        }}>
                                            <span style={{ fontSize: "0.78rem", lineHeight: "1.35", fontWeight: "500", whiteSpace: "pre-wrap" }}>
                                                {log.msg}
                                            </span>
                                            <span style={{ fontSize: "0.5rem", opacity: 0.7, textAlign: "right", fontWeight: "500" }}>
                                                {log.time}
                                            </span>
                                        </div>
                                    </motion.div>
                                );
                            } else if (log.type === "astra") {
                                return (
                                    <motion.div 
                                        key={log.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        style={{ 
                                            display: "flex", 
                                            justifyContent: "flex-start", 
                                            width: "100%",
                                            gap: "8px",
                                            marginBottom: "0.4rem"
                                        }}
                                    >
                                        <div style={{ 
                                            width: "28px", height: "28px", borderRadius: "50%", 
                                            background: `${COLORS.accent}11`, 
                                            border: `1px solid ${COLORS.accent}33`,
                                            display: "flex", alignItems: "center", justifyContent: "center", 
                                            color: COLORS.accent, flexShrink: 0, marginTop: "2px"
                                        }}>
                                            <Sparkles size={12} />
                                        </div>
                                        <div style={{ 
                                            maxWidth: "80%",
                                            background: "white",
                                            border: `1px solid ${COLORS.border}`,
                                            color: COLORS.primary,
                                            padding: "0.7rem 0.9rem",
                                            borderRadius: "16px 16px 16px 2px",
                                            boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: "2px"
                                        }}>
                                            <span style={{ fontSize: "0.78rem", lineHeight: "1.35", fontWeight: "500", whiteSpace: "pre-wrap" }}>
                                                {log.msg}
                                            </span>
                                            <span style={{ fontSize: "0.5rem", color: COLORS.textMuted, fontWeight: "500" }}>
                                                {log.time}
                                            </span>
                                        </div>
                                    </motion.div>
                                );
                            } else {
                                return (
                                    <motion.div 
                                        key={log.id}
                                        initial={{ opacity: 0, y: 5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        style={{ 
                                            display: "flex", 
                                            justifyContent: "center", 
                                            width: "100%",
                                            margin: "0.5rem 0"
                                        }}
                                    >
                                        <div style={{
                                            background: "#f3f4f6",
                                            border: "1px solid #e5e7eb",
                                            borderRadius: "16px",
                                            padding: "4px 12px",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "6px",
                                            maxWidth: "90%",
                                            boxShadow: "0 2px 4px rgba(0,0,0,0.01)"
                                        }}>
                                            {getLogIcon(log.type)}
                                            <span style={{ 
                                                fontSize: "0.65rem", 
                                                color: "#4b5563", 
                                                fontWeight: "600",
                                                letterSpacing: "0.2px",
                                                lineHeight: "1.3",
                                                whiteSpace: "pre-wrap"
                                            }}>
                                                {log.msg}
                                            </span>
                                        </div>
                                    </motion.div>
                                );
                            }
                        })}
                        {transcription && transcription.text && (
                            <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                style={{ 
                                    display: "flex", 
                                    justifyContent: transcription.speaker === "user" ? "flex-end" : "flex-start", 
                                    width: "100%",
                                    gap: "8px",
                                    marginBottom: "0.4rem"
                                }}
                            >
                                {transcription.speaker === "astra" && (
                                    <div style={{ 
                                        width: "28px", height: "28px", borderRadius: "50%", 
                                        background: `${COLORS.accent}11`, 
                                        border: `1px solid ${COLORS.accent}33`,
                                        display: "flex", alignItems: "center", justifyContent: "center", 
                                        color: COLORS.accent, flexShrink: 0, marginTop: "2px"
                                    }}>
                                        <Sparkles size={12} />
                                    </div>
                                )}
                                <div style={{ 
                                    maxWidth: transcription.speaker === "user" ? "85%" : "80%",
                                    background: transcription.speaker === "user" ? "linear-gradient(135deg, #10b981, #059669)" : "white",
                                    border: transcription.speaker === "user" ? "none" : `1px solid ${COLORS.border}`,
                                    color: transcription.speaker === "user" ? "white" : COLORS.primary,
                                    padding: "0.7rem 0.9rem",
                                    borderRadius: transcription.speaker === "user" ? "16px 16px 2px 16px" : "16px 16px 16px 2px",
                                    boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "2px",
                                    opacity: 0.8,
                                    fontStyle: "italic"
                                }}>
                                    <span style={{ fontSize: "0.78rem", lineHeight: "1.35", fontWeight: "500", whiteSpace: "pre-wrap" }}>
                                        {transcription.text}...
                                    </span>
                                </div>
                            </motion.div>
                        )}
                        <div ref={logEndRef} />
                    </div>

                    {/* Chat Input Bar */}
                    <div style={{ padding: "1rem", borderTop: `1px solid ${COLORS.border}`, background: "white", display: "flex", gap: "8px" }}>
                        <input 
                            type="text" 
                            placeholder="Type guidance for Astra..." 
                            value={chatInput} 
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                            style={{
                                flex: 1,
                                padding: "0.8rem 1rem",
                                borderRadius: "12px",
                                border: `1px solid ${COLORS.border}`,
                                fontSize: "0.85rem",
                                outline: "none",
                                background: "#f9fafb",
                                color: COLORS.primary,
                                fontWeight: "500",
                                transition: "border-color 0.2s"
                            }}
                            onFocus={(e) => e.target.style.borderColor = COLORS.accent}
                            onBlur={(e) => e.target.style.borderColor = COLORS.border}
                        />
                        <button
                            onClick={handleSendChat}
                            style={{
                                padding: "0.8rem 1.2rem",
                                borderRadius: "12px",
                                background: COLORS.accent,
                                color: "white",
                                border: "none",
                                fontWeight: "700",
                                fontSize: "0.8rem",
                                cursor: "pointer",
                                boxShadow: `0 4px 12px ${COLORS.accent}44`,
                                transition: "transform 0.2s"
                            }}
                            onMouseEnter={(e) => e.target.style.transform = "scale(1.03)"}
                            onMouseLeave={(e) => e.target.style.transform = "scale(1)"}
                        >
                            SEND
                        </button>
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
  const serverUrl = import.meta.env.VITE_LIVEKIT_URL || 'ws://localhost:7880';

  return (
    <LiveKitRoom
      audio={false}
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
