import React, { memo, useEffect, useState, useRef, useCallback } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRemoteParticipants,
  useRoomContext
} from "@livekit/components-react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, 
  Terminal, 
  Search, 
  Trash2, 
  Play, 
  Square, 
  Server, 
  Database,
  Cpu,
  Activity,
  Volume2
} from "lucide-react";

const COLORS = {
  bgDark: "#050914",
  panelDark: "#0c1328",
  borderCyan: "rgba(6, 182, 212, 0.2)",
  cyanGlow: "#06b6d4",
  warnYellow: "#f59e0b",
  errRed: "#ef4444",
  textGreen: "#10b981",
  textMuted: "#64748b",
  textLight: "#f8fafc"
};

// Log Parser helper for color coding
function parseLogLevel(line) {
  const upperLine = line.toUpperCase();
  if (upperLine.includes("ERROR") || upperLine.includes("ERR") || upperLine.includes("FATAL") || upperLine.includes("FAIL")) {
    return COLORS.errRed;
  }
  if (upperLine.includes("WARN") || upperLine.includes("WARNING")) {
    return COLORS.warnYellow;
  }
  if (upperLine.includes("INFO") || upperLine.includes("SUCCESS") || upperLine.includes("OK")) {
    return COLORS.textGreen;
  }
  return COLORS.textLight;
}

function OctaneScene({ roomData, onLeave }) {
  const room = useRoomContext();
  const remoteParticipants = useRemoteParticipants();

  const [agentState, setAgentState] = useState("idle");
  const [transcription, setTranscription] = useState("");
  const [activeContainer, setActiveContainer] = useState("livekit-video-app-livekit-1");
  const [logs, setLogs] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("ALL"); // ALL | ERROR | WARN | INFO
  const [isTailing, setIsTailing] = useState(true);

  const logsEndRef = useRef(null);

  // Monitor logs tailing auto-scroll
  useEffect(() => {
    if (isTailing && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, isTailing]);

  // Monitor Agent state (Octane's voice activities)
  useEffect(() => {
    const octane = remoteParticipants.find(p => {
      try {
        return JSON.parse(p.metadata || "{}").name === "OCTANE";
      } catch (e) {
        return false;
      }
    });

    if (!octane) {
      setAgentState("idle");
      return;
    }

    const handleSpeakingChanged = () => {
      setAgentState(octane.isSpeaking ? "speaking" : "listening");
    };

    octane.on("isSpeakingChanged", handleSpeakingChanged);
    return () => octane.off("isSpeakingChanged", handleSpeakingChanged);
  }, [remoteParticipants]);

  // Monitor user transcriptions (Live speech bubbles)
  useEffect(() => {
    const handleTranscription = (segments) => {
      const text = segments.map(s => s.text).join(" ");
      setTranscription(text);
      const timer = setTimeout(() => setTranscription(""), 3500);
      return () => clearTimeout(timer);
    };

    room.on("transcriptionReceived", handleTranscription);
    return () => room.off("transcriptionReceived", handleTranscription);
  }, [room]);

  // Listen to the data packets (live docker log stream)
  useEffect(() => {
    const onData = (payload, participant, kind, topic) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (topic === "log_stream" && msg.type === "log_line") {
          setLogs(prev => {
            // Cap at 400 lines in React memory to prevent DOM sluggishness
            const newLogs = [...prev, msg];
            if (newLogs.length > 400) {
              return newLogs.slice(newLogs.length - 400);
            }
            return newLogs;
          });
        }
      } catch (e) {
        console.error("[OCTANE] Failed to parse log stream packet:", e);
      }
    };

    room.on("dataReceived", onData);
    return () => room.off("dataReceived", onData);
  }, [room]);

  // Command Helper: Switch target container
  const selectContainer = useCallback((containerName) => {
    setActiveContainer(containerName);
    setLogs([]); // Reset log console on switch
    setIsTailing(true);

    if (room) {
      const payload = new TextEncoder().encode(JSON.stringify({
        type: "select_container",
        container: containerName
      }));
      room.localParticipant.publishData(payload, { topic: "ui_control", reliable: true });
    }
  }, [room]);

  // Auto-connect to livekit logs upon startup
  useEffect(() => {
    const timer = setTimeout(() => {
      selectContainer("livekit-video-app-livekit-1");
    }, 1200);
    return () => clearTimeout(timer);
  }, [selectContainer]);

  // Command Helper: Toggle stream active/paused
  const toggleTailing = () => {
    if (isTailing) {
      setIsTailing(false);
      // Let agent know we stopped listening
      if (room) {
        const payload = new TextEncoder().encode(JSON.stringify({ type: "stop_stream" }));
        room.localParticipant.publishData(payload, { topic: "ui_control", reliable: true });
      }
    } else {
      setIsTailing(true);
      // Resume streaming for current container
      selectContainer(activeContainer);
    }
  };

  // Filter logs locally based on search query, severity, and active container
  const filteredLogs = logs.filter(log => {
    if (log.container !== activeContainer) return false;
    const matchesSearch = log.line.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (severityFilter === "ALL") return matchesSearch;
    const upperLine = log.line.toUpperCase();
    if (severityFilter === "ERROR") {
      return matchesSearch && (upperLine.includes("ERROR") || upperLine.includes("ERR") || upperLine.includes("FATAL") || upperLine.includes("FAIL"));
    }
    if (severityFilter === "WARN") {
      return matchesSearch && (upperLine.includes("WARN") || upperLine.includes("WARNING"));
    }
    if (severityFilter === "INFO") {
      return matchesSearch && (upperLine.includes("INFO") || upperLine.includes("SUCCESS") || upperLine.includes("OK"));
    }
    return matchesSearch;
  });

  return (
    <div style={{
      height: "100vh",
      width: "100vw",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      background: COLORS.bgDark,
      color: COLORS.textLight,
      fontFamily: "'Outfit', monospace"
    }}>
      
      {/* 🚀 Quantum Telemetry Top bar Header */}
      <header style={{
        height: "75px",
        padding: "0 3%",
        background: COLORS.panelDark,
        borderBottom: `1px solid ${COLORS.borderCyan}`,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        zIndex: 100
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button 
            onClick={onLeave}
            style={{
              background: "none",
              border: "none",
              color: COLORS.cyanGlow,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "8px",
              borderRadius: "50%",
              transition: "background 0.2s"
            }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(6, 182, 212, 0.1)"}
            onMouseLeave={e => e.currentTarget.style.background = "none"}
          >
            <ArrowLeft size={20} />
          </button>
          
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "0.6rem", background: "rgba(6, 182, 212, 0.15)", color: COLORS.cyanGlow, padding: "2px 8px", borderRadius: "4px", fontWeight: "900", letterSpacing: "1px" }}>
                SWARM TELEMETRY MONITOR
              </span>
              <span style={{ fontSize: "0.6rem", background: isTailing ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)", color: isTailing ? COLORS.textGreen : COLORS.errRed, padding: "2px 8px", borderRadius: "4px", fontWeight: "900" }}>
                {isTailing ? "LIVE STREAMING" : "STREAM PAUSED"}
              </span>
            </div>
            <h1 style={{ fontSize: "1.2rem", fontWeight: "900", margin: "2px 0 0 0", letterSpacing: "-0.5px" }}>
              Agent Octane Telemetry Room
            </h1>
          </div>
        </div>

        {/* Real-time transcription speech bubble */}
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <AnimatePresence>
            {transcription && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                style={{ 
                  fontSize: "0.85rem", 
                  color: COLORS.cyanGlow, 
                  background: "rgba(6, 182, 212, 0.05)",
                  border: `1px solid ${COLORS.borderCyan}`,
                  padding: "6px 14px",
                  borderRadius: "12px",
                  maxWidth: "350px",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis"
                }}
              >
                🎙️ "{transcription}"
              </motion.div>
            )}
          </AnimatePresence>

          {/* Voice Orb Visualizer widget */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "0.7rem", fontWeight: "700", color: COLORS.textMuted }}>
              OCTANE: {agentState.toUpperCase()}
            </span>
            
            <motion.div 
              animate={{ 
                scale: agentState === "speaking" ? [1, 1.2, 1.1, 1.25, 1] : 1,
                borderColor: agentState === "speaking" ? COLORS.cyanGlow : "rgba(255,255,255,0.15)",
                boxShadow: agentState === "speaking" ? `0 0 15px ${COLORS.cyanGlow}` : "none"
              }}
              transition={{ duration: 0.5, repeat: Infinity, repeatType: "mirror" }}
              style={{ 
                width: "36px", 
                height: "36px", 
                borderRadius: "50%", 
                background: agentState === "speaking" ? "radial-gradient(circle, #0e7490 0%, #0891b2 100%)" : "rgba(255,255,255,0.05)",
                border: "2px solid rgba(255,255,255,0.15)",
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center"
              }}
            >
              <Volume2 size={16} color={agentState === "speaking" ? "white" : COLORS.textMuted} />
            </motion.div>
          </div>
        </div>
      </header>

      {/* 💻 Main Workspace Console layout */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "250px 1fr", overflow: "hidden" }}>
        
        {/* Left Side Control Dashboard */}
        <aside style={{
          background: COLORS.panelDark,
          borderRight: `1px solid ${COLORS.borderCyan}`,
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "24px"
        }}>
          {/* Target Infrastructure */}
          <div>
            <h3 style={{ fontSize: "0.75rem", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "12px", fontWeight: "700" }}>
              Docker Containers
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[
                { name: "livekit-video-app-livekit-1", label: "Livekit SFU", icon: <Server size={14} /> },
                { name: "livekit-video-app-redis-1", label: "Redis DB", icon: <Database size={14} /> },
                { name: "octane-agent", label: "Octane Agent", icon: <Cpu size={14} /> }
              ].map(cont => (
                <button
                  key={cont.name}
                  onClick={() => selectContainer(cont.name)}
                  style={{
                    padding: "10px 12px",
                    background: activeContainer === cont.name ? "rgba(6, 182, 212, 0.12)" : "rgba(255, 255, 255, 0.02)",
                    border: `1px solid ${activeContainer === cont.name ? COLORS.cyanGlow : "rgba(255, 255, 255, 0.08)"}`,
                    borderRadius: "8px",
                    color: activeContainer === cont.name ? COLORS.cyanGlow : COLORS.textLight,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    fontWeight: "600",
                    fontSize: "0.8rem",
                    transition: "all 0.25s"
                  }}
                  onMouseEnter={e => {
                    if (activeContainer !== cont.name) e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                  }}
                  onMouseLeave={e => {
                    if (activeContainer !== cont.name) e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)";
                  }}
                >
                  {cont.icon}
                  <span style={{ textAlign: "left" }}>{cont.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Severity filter panels */}
          <div>
            <h3 style={{ fontSize: "0.75rem", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "12px", fontWeight: "700" }}>
              Logs Severity Filter
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {[
                { type: "ALL", label: "Show All", color: COLORS.textLight },
                { type: "ERROR", label: "Errors Only", color: COLORS.errRed },
                { type: "WARN", label: "Warnings", color: COLORS.warnYellow },
                { type: "INFO", label: "Infos", color: COLORS.textGreen }
              ].map(f => (
                <button
                  key={f.type}
                  onClick={() => setSeverityFilter(f.type)}
                  style={{
                    padding: "8px",
                    background: severityFilter === f.type ? "rgba(255,255,255,0.08)" : "transparent",
                    border: `1px solid ${severityFilter === f.type ? "rgba(255,255,255,0.2)" : "rgba(255, 255, 255, 0.08)"}`,
                    borderRadius: "6px",
                    color: f.color,
                    cursor: "pointer",
                    fontSize: "0.7rem",
                    fontWeight: "700",
                    transition: "all 0.2s"
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quick operations */}
          <div>
            <h3 style={{ fontSize: "0.75rem", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "12px", fontWeight: "700" }}>
              Control Console
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <button
                onClick={toggleTailing}
                style={{
                  padding: "10px",
                  background: isTailing ? "rgba(239, 68, 68, 0.08)" : "rgba(16, 185, 129, 0.08)",
                  border: `1px solid ${isTailing ? "rgba(239, 68, 68, 0.2)" : "rgba(16, 185, 129, 0.2)"}`,
                  color: isTailing ? COLORS.errRed : COLORS.textGreen,
                  borderRadius: "8px",
                  fontWeight: "700",
                  cursor: "pointer",
                  fontSize: "0.75rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  transition: "all 0.2s"
                }}
              >
                {isTailing ? <Square size={12} /> : <Play size={12} />}
                {isTailing ? "Pause Stream" : "Resume Stream"}
              </button>

              <button
                onClick={() => setLogs([])}
                style={{
                  padding: "10px",
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: COLORS.textLight,
                  borderRadius: "8px",
                  fontWeight: "700",
                  cursor: "pointer",
                  fontSize: "0.75rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  transition: "all 0.2s"
                }}
              >
                <Trash2 size={12} />
                Clear View
              </button>
            </div>
          </div>

          {/* Speech Suggestions Desk */}
          <div style={{ marginTop: "auto", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: COLORS.cyanGlow, marginBottom: "8px" }}>
              <Cpu size={12} />
              <span style={{ fontSize: "0.65rem", fontWeight: "900", letterSpacing: "1px" }}>OCTANE PROMPTS</span>
            </div>
            <p style={{ fontSize: "0.68rem", color: COLORS.textMuted, margin: "0 0 10px 0", lineHeight: "1.4" }}>
              Ask Octane using your voice:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {[
                "Summarize these logs",
                "Check for warnings",
                "Are there any errors?"
              ].map((p, i) => (
                <div 
                  key={i} 
                  style={{ 
                    padding: "6px 8px", 
                    background: "rgba(255,255,255,0.02)", 
                    border: "1px solid rgba(255,255,255,0.04)", 
                    borderRadius: "6px", 
                    fontSize: "0.65rem", 
                    color: "rgba(255,255,255,0.5)",
                    fontStyle: "italic"
                  }}
                >
                  "{p}"
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Right Side Logs scrolling monitor terminal pane */}
        <main style={{
          display: "flex",
          flexDirection: "column",
          background: "#03060f",
          overflow: "hidden"
        }}>
          {/* Console Header search bar controls */}
          <div style={{
            height: "55px",
            background: "rgba(10,18,35,0.3)",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            padding: "0 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Terminal size={14} color={COLORS.cyanGlow} />
              <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", fontWeight: "600", fontFamily: "monospace" }}>
                bash - octane_observer@{activeContainer}:~
              </span>
            </div>

            {/* Keyword filter input */}
            <div style={{
              display: "flex",
              alignItems: "center",
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "6px",
              padding: "4px 10px",
              width: "280px",
              gap: "8px"
            }}>
              <Search size={12} color={COLORS.textMuted} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search logs (grep)..."
                style={{
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: COLORS.textLight,
                  fontSize: "0.75rem",
                  flex: 1,
                  fontFamily: "monospace"
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  style={{
                    background: "none",
                    border: "none",
                    color: COLORS.textMuted,
                    cursor: "pointer",
                    fontSize: "0.7rem"
                  }}
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Terminal Console Output Display */}
          <div style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px",
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: "0.8rem",
            lineHeight: "1.5",
            color: "rgba(255,255,255,0.85)"
          }}>
            <div style={{ color: COLORS.textMuted, marginBottom: "12px", fontSize: "0.75rem" }}>
              [SYSTEM] Telemetry pipeline established. Output terminal ready.
            </div>

            {filteredLogs.length === 0 ? (
              <div style={{ color: "rgba(255,255,255,0.25)", fontStyle: "italic", textAlign: "center", marginTop: "40px" }}>
                {logs.length === 0 ? "Waiting for container log lines..." : "No logs match the current search filters."}
              </div>
            ) : (
              filteredLogs.map((log, idx) => {
                const logColor = parseLogLevel(log.line);
                return (
                  <div 
                    key={idx} 
                    style={{ 
                      whiteSpace: "pre-wrap", 
                      wordBreak: "break-all",
                      marginBottom: "4px",
                      display: "grid",
                      gridTemplateColumns: "135px 1fr",
                      gap: "10px"
                    }}
                  >
                    {/* Timestamp column */}
                    <span style={{ color: COLORS.textMuted, fontSize: "0.7rem", userSelect: "none" }}>
                      [{new Date(log.timestamp).toLocaleTimeString()}]
                    </span>
                    {/* Log line column */}
                    <span style={{ color: logColor }}>
                      {log.line}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={logsEndRef} />
          </div>

          {/* Terminal Console footer status bar */}
          <div style={{
            height: "30px",
            background: "rgba(10,18,35,0.5)",
            borderTop: "1px solid rgba(255,255,255,0.05)",
            padding: "0 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "0.68rem",
            color: COLORS.textMuted
          }}>
            <div style={{ display: "flex", gap: "16px" }}>
              <span>BUFFER: {filteredLogs.length}/{logs.length} lines</span>
              <span>FILTER: {severityFilter}</span>
            </div>
            <div>
              <span>TAILING: {isTailing ? "YES" : "NO"}</span>
            </div>
          </div>
        </main>
      </div>

      <RoomAudioRenderer />
    </div>
  );
}

const OctaneRoom = memo(function OctaneRoom({ roomData, onLeave }) {
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
      <OctaneScene roomData={roomData} onLeave={onLeave} />
    </LiveKitRoom>
  );
});

export default OctaneRoom;
