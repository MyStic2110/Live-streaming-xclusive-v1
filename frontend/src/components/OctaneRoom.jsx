import React, { memo, useEffect, useState, useRef, useCallback } from "react";
import CostGuardAlert from "./CostGuardAlert";
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
  bgDark: "#ffffff",
  panelDark: "#f8fafc",
  borderCyan: "#cbd5e1",
  cyanGlow: "#0284c7",
  warnYellow: "#d97706",
  errRed: "#dc2626",
  textGreen: "#16a34a",
  textMuted: "#64748b",
  textLight: "#0f172a"
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
      background: "#f0f9ff",
      backgroundImage: "radial-gradient(circle at 100% 0%, #dbeafe 0%, transparent 45%), radial-gradient(circle at 0% 100%, #eff6ff 0%, transparent 45%)",
      color: "#0f172a",
      fontFamily: "'Outfit', monospace",
      padding: "1.5rem 3%",
      boxSizing: "border-box",
      gap: "1.5rem"
    }}>
      
      {/* 🚀 Quantum Telemetry Top bar Header */}
      <header style={{
        flexShrink: 0,
        display: "flex",
        flexWrap: "wrap",
        gap: "1rem",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottom: "1px solid #cbd5e1",
        paddingBottom: "1rem",
        zIndex: 100
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button 
            onClick={onLeave}
            style={{
              padding: "8px 16px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              color: "#ef4444",
              fontWeight: "900",
              cursor: "pointer",
              fontSize: "0.9rem",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.2s"
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "#fee2e2";
              e.currentTarget.style.borderColor = "#fca5a5";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "#ffffff";
              e.currentTarget.style.borderColor = "#cbd5e1";
            }}
          >
            <Trash2 size={16} /> Terminate
          </button>
          
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "0.6rem", background: "rgba(15, 23, 42, 0.1)", color: "#0f172a", padding: "2px 8px", borderRadius: "4px", fontWeight: "900", letterSpacing: "1px" }}>
                SWARM TELEMETRY MONITOR
              </span>
              <span style={{ fontSize: "0.6rem", background: isTailing ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)", color: isTailing ? COLORS.textGreen : COLORS.errRed, padding: "2px 8px", borderRadius: "4px", fontWeight: "900" }}>
                {isTailing ? "LIVE STREAMING" : "STREAM PAUSED"}
              </span>
            </div>
            <h1 style={{ fontSize: "1.2rem", fontWeight: "900", margin: "2px 0 0 0", letterSpacing: "-0.5px", color: "#0f172a" }}>
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
                  color: "#0f172a", 
                  background: "#ffffff",
                  border: `1px solid #cbd5e1`,
                  padding: "6px 14px",
                  borderRadius: "12px",
                  maxWidth: "350px",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
                }}
              >
                🎙️ "{transcription}"
              </motion.div>
            )}
          </AnimatePresence>

          {/* Voice Orb Visualizer widget */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "0.7rem", fontWeight: "700", color: "#64748b" }}>
              OCTANE: {agentState.toUpperCase()}
            </span>
            
            <motion.div 
              animate={{ 
                scale: agentState === "speaking" ? [1, 1.2, 1.1, 1.25, 1] : 1,
                borderColor: agentState === "speaking" ? COLORS.cyanGlow : "#cbd5e1",
                boxShadow: agentState === "speaking" ? `0 0 15px rgba(6, 182, 212, 0.4)` : "none"
              }}
              transition={{ duration: 0.5, repeat: Infinity, repeatType: "mirror" }}
              style={{ 
                width: "36px", 
                height: "36px", 
                borderRadius: "50%", 
                background: agentState === "speaking" ? "radial-gradient(circle, #0ea5e9 0%, #0284c7 100%)" : "#e2e8f0",
                border: "2px solid #cbd5e1",
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center"
              }}
            >
              <Volume2 size={16} color={agentState === "speaking" ? "white" : "#64748b"} />
            </motion.div>
          </div>
        </div>
      </header>

      {/* 💻 Main Workspace Console layout */}
      <div style={{ 
        flex: 1, 
        minHeight: 0,
        display: "grid", 
        gridTemplateColumns: "250px 1fr", 
        gridTemplateRows: "minmax(0, 1fr)",
        overflow: "hidden",
        borderRadius: "12px",
        border: "1px solid #cbd5e1",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)",
        background: COLORS.bgDark 
      }}>
        
        {/* Left Side Control Dashboard */}
        <aside style={{
          background: COLORS.panelDark,
          borderRight: `1px solid ${COLORS.borderCyan}`,
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
          overflowY: "auto"
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
                { name: "livekit-video-app-securelytix-sdk-1", label: "Securelytix SDK", icon: <Activity size={14} /> },
                { name: "livekit-video-app-securelytix-postgres-1", label: "Securelytix DB", icon: <Database size={14} /> },
                { name: "livekit-video-app-swarm-postgres-1", label: "Swarm DB", icon: <Database size={14} /> },
                { name: "livekit-video-app-searxng-1", label: "SearXNG Engine", icon: <Search size={14} /> },
                { name: "octane-agent", label: "Octane Agent", icon: <Cpu size={14} /> }
              ].map(cont => (
                <button
                  key={cont.name}
                  onClick={() => selectContainer(cont.name)}
                  style={{
                    padding: "10px 12px",
                    background: activeContainer === cont.name ? "rgba(2, 132, 199, 0.08)" : "#ffffff",
                    border: `1px solid ${activeContainer === cont.name ? COLORS.cyanGlow : "#cbd5e1"}`,
                    borderRadius: "8px",
                    color: activeContainer === cont.name ? COLORS.cyanGlow : "#334155",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    fontWeight: "600",
                    fontSize: "0.8rem",
                    transition: "all 0.25s"
                  }}
                  onMouseEnter={e => {
                    if (activeContainer !== cont.name) e.currentTarget.style.background = "#f1f5f9";
                  }}
                  onMouseLeave={e => {
                    if (activeContainer !== cont.name) e.currentTarget.style.background = "#ffffff";
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
                    background: severityFilter === f.type ? "rgba(15, 23, 42, 0.05)" : "transparent",
                    border: `1px solid ${severityFilter === f.type ? "rgba(15, 23, 42, 0.15)" : "rgba(15, 23, 42, 0.05)"}`,
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
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
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
                onMouseEnter={e => e.currentTarget.style.background = "#f1f5f9"}
                onMouseLeave={e => e.currentTarget.style.background = "#ffffff"}
              >
                <Trash2 size={12} />
                Clear View
              </button>
            </div>
          </div>

          {/* Speech Suggestions Desk */}
          <div style={{ marginTop: "auto", borderTop: "1px solid #cbd5e1", paddingTop: "16px" }}>
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
                    background: "#ffffff", 
                    border: "1px solid #e2e8f0", 
                    borderRadius: "6px", 
                    fontSize: "0.65rem", 
                    color: "#64748b",
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
          background: "#f8fafc",
          overflow: "hidden"
        }}>
          {/* Console Header search bar controls */}
          <div style={{
            flexShrink: 0,
            height: "55px",
            background: "#f1f5f9",
            borderBottom: "1px solid #cbd5e1",
            padding: "0 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Terminal size={14} color={COLORS.cyanGlow} />
              <span style={{ fontSize: "0.75rem", color: "#475569", fontWeight: "600", fontFamily: "monospace" }}>
                bash - octane_observer@{activeContainer}:~
              </span>
            </div>

            {/* Keyword filter input */}
            <div style={{
              display: "flex",
              alignItems: "center",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
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
            fontFamily: "'JetBrains Mono', 'Courier New', Courier, monospace",
            fontSize: "0.8rem",
            lineHeight: "1.5",
            color: "#334155"
          }}>
            <div style={{ color: COLORS.textMuted, marginBottom: "12px", fontSize: "0.75rem" }}>
              [SYSTEM] Telemetry pipeline established. Output terminal ready.
            </div>

            {filteredLogs.length === 0 ? (
              <div style={{ color: "#94a3b8", fontStyle: "italic", textAlign: "center", marginTop: "40px" }}>
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
            flexShrink: 0,
            height: "30px",
            background: "#f1f5f9",
            borderTop: "1px solid #cbd5e1",
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
  const serverUrl = import.meta.env.VITE_LIVEKIT_URL || 'ws://localhost:7880';

  return (
    <LiveKitRoom
      audio={true}
      video={false}
      token={roomData.token}
      serverUrl={serverUrl}
      onDisconnected={onLeave}
    >
      <OctaneScene roomData={roomData} onLeave={onLeave} />
      <CostGuardAlert />
      </LiveKitRoom>
  );
});

export default OctaneRoom;
