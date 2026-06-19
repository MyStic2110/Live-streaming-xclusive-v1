import React, { memo, useEffect, useState, useRef } from "react";
import CostGuardAlert from "./CostGuardAlert";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRemoteParticipants,
  useRoomContext,
  useTracks,
  VideoTrack,
} from "@livekit/components-react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ShoppingBag, ShieldAlert, Cpu, Laptop, CheckCircle, HelpCircle, 
  ArrowLeft, RefreshCw, Send, Loader2
} from "lucide-react";

const C = {
  bg:         "#030712",
  surface:    "#0f172a",
  card:       "#1e293b",
  border:     "rgba(255, 255, 255, 0.08)",
  accent:     "#10b981",     // Mint green for Shoppe
  accentSoft: "rgba(16, 185, 129, 0.1)",
  blue:       "#3b82f6",
  gold:       "#f59e0b",
  text:       "#f8fafc",
  muted:      "#94a3b8",
};

const StatusPill = ({ state }) => {
  const map = {
    idle:      { label: "STANDBY",    bg: "rgba(148, 163, 184, 0.15)", color: C.muted   },
    listening: { label: "LISTENING",  bg: C.accentSoft,              color: C.accent  },
    speaking:  { label: "SPEAKING",   bg: "rgba(59, 130, 246, 0.15)",   color: C.blue    },
    browsing:  { label: "BROWSING",   bg: "rgba(245, 158, 11, 0.15)",   color: C.gold    },
  };
  const s = map[state] || map.idle;
  return (
    <span style={{
      fontSize: "0.65rem", fontWeight: "900", letterSpacing: "1.5px",
      padding: "4px 12px", borderRadius: "99px",
      background: s.bg, color: s.color,
      display: "flex", alignItems: "center", gap: 6,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.color, display: "inline-block" }} />
      {s.label}
    </span>
  );
};

function ShoppeScene({ onLeave }) {
  const [agentState, setAgentState] = useState("idle");
  const [transcription, setTranscription] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [logs, setLogs] = useState([
    { id: 1, type: "system", msg: "🛒 SHOPPE OS Online — Awaiting product query.", time: new Date().toLocaleTimeString() }
  ]);
  const [currentQuery, setCurrentQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  const renderLogMessage = (msg) => {
    if (typeof msg !== "string") return msg;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = msg.split(urlRegex);
    if (parts.length === 1) return msg;

    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={index}
            href="#"
            onClick={(e) => {
              e.preventDefault();
              sendAction("navigate_to_url", { url: part });
            }}
            style={{
              color: C.accent,
              textDecoration: "underline",
              fontWeight: "bold",
              wordBreak: "break-all"
            }}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };
  
  const logEndRef = useRef(null);
  const remoteParticipants = useRemoteParticipants();
  const room = useRoomContext();

  const tracks = useTracks([{ source: "screen_share", withPlaceholder: false }]);
  const shoppeScreenTrack = tracks.find(t => {
    try {
      const metadata = JSON.parse(t.participant.metadata || "{}");
      return metadata.name === "SHOPPE";
    } catch {
      return false;
    }
  });

  const sendAction = async (key, data = {}) => {
    try {
      const payload = JSON.stringify({ key, ...data });
      await room.localParticipant.publishData(
        new TextEncoder().encode(payload),
        { reliable: true }
      );
      setLogs(prev => [...prev, {
        id: Date.now(), type: "system",
        msg: `📤 Action Dispatched: ${key.toUpperCase()}`,
        time: new Date().toLocaleTimeString()
      }]);
    } catch (e) {
      console.error("Failed to send action:", e);
    }
  };

  const handleTextSearch = (e) => {
    e.preventDefault();
    if (!currentQuery.trim()) return;
    sendAction("chat_message", { text: currentQuery });
    setLogs(prev => [...prev, {
      id: Date.now(), type: "info",
      msg: `💬 Sent query: "${currentQuery}"`,
      time: new Date().toLocaleTimeString()
    }]);
    setCurrentQuery("");
  };



  // Scroll logs to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Transcriptions
  useEffect(() => {
    const onTx = (segments) => {
      const text = segments.map(s => s.text).join(" ");
      setTranscription(text);
      const t = setTimeout(() => setTranscription(""), 4000);
      return () => clearTimeout(t);
    };
    room.on("transcriptionReceived", onTx);
    return () => room.off("transcriptionReceived", onTx);
  }, [room]);

  // Track Agent states
  useEffect(() => {
    const shoppeAgent = remoteParticipants.find(p => {
      try { return JSON.parse(p.metadata || "{}").name === "SHOPPE"; } catch { return false; }
    });
    if (!shoppeAgent) { setAgentState("idle"); return; }
    const handle = () => {
      if (shoppeAgent.isSpeaking) {
        setAgentState("speaking");
      } else {
        setAgentState(isSearching ? "browsing" : "listening");
      }
    };
    shoppeAgent.on("isSpeakingChanged", handle);
    handle();
    return () => shoppeAgent.off("isSpeakingChanged", handle);
  }, [remoteParticipants, isSearching]);

  // Live data channel listener
  useEffect(() => {
    const onData = (payload, _participant, _kind, topic) => {
      if (topic !== "ui_control") return;
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        
        if (msg.type === "agent_log") {
          setLogs(prev => [...prev, {
            id: Date.now(), type: msg.level || "info",
            msg: msg.message, time: new Date().toLocaleTimeString(),
          }]);
        }
        if (msg.type === "search_started") {
          setIsSearching(true);
          setSearchResults([]); // clear previous results on new search
          setLogs(prev => [...prev, {
            id: Date.now(), type: "info",
            msg: `🔍 Initiating SearXNG shopping index lookup...`,
            time: new Date().toLocaleTimeString(),
          }]);
        }
        if (msg.type === "search_complete") {
          setIsSearching(false);
        }
        if (msg.type === "search_results") {
          setSearchResults(msg.listings || []);
        }
      } catch (e) {}
    };
    room.on("dataReceived", onData);
    return () => room.off("dataReceived", onData);
  }, [room]);

  const logColor = (type) => {
    switch (type) {
      case "success": return C.accent;
      case "warning": return C.gold;
      case "error": return "#ef4444";
      case "milestone": return "#3b82f6";
      default: return C.muted;
    }
  };

  return (
    <div style={{
      height: "100vh", width: "100vw", overflow: "hidden",
      display: "flex", flexDirection: "column",
      background: C.bg, fontFamily: "'Outfit', sans-serif",
    }}>
      {/* SaaS Navigation */}
      <header style={{
        height: 70, padding: "0 3%",
        background: C.surface,
        borderBottom: `1px solid ${C.border}`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        zIndex: 100, flexShrink: 0
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button 
            onClick={onLeave}
            style={{
              background: "none", border: "none", color: C.muted,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
              fontSize: "0.85rem", fontWeight: "700"
            }}
          >
            <ArrowLeft size={16}/> BACK
          </button>
          <div style={{ width: 1, height: 20, backgroundColor: C.border }}></div>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: `${C.accent}15`,
            border: `1px solid ${C.accent}35`,
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <ShoppingBag size={20} color={C.accent} />
          </div>
          <div>
            <div style={{ fontSize: "1rem", fontWeight: "900", color: C.text, letterSpacing: 0.5 }}>
              SHOPPE <span style={{ color: C.accent }}>CONVERSATIONAL AGENT</span>
            </div>
            <div style={{ fontSize: "0.65rem", color: C.muted, letterSpacing: 0.5 }}>
              Price Comparison & Live Site Navigation via Playwright Live-Stream
            </div>
          </div>
          <StatusPill state={agentState} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            onClick={onLeave}
            style={{
              padding: "6px 16px", borderRadius: 8,
              border: "1px solid rgba(239, 68, 68, 0.3)",
              background: "transparent", color: "#ef4444",
              fontSize: "0.75rem", fontWeight: "800", cursor: "pointer"
            }}
          >
            LEAVE ROOM
          </button>
        </div>
      </header>

      {/* Main Content Workspace */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        
        {/* Left Control and Chat Board */}
        <div style={{
          width: 380, display: "flex", flexDirection: "column",
          borderRight: `1px solid ${C.border}`, background: C.surface, flexShrink: 0
        }}>
          {/* Audio Visualizer Orb simulation */}
          <div style={{
            padding: "2rem", display: "flex", flexDirection: "column",
            alignItems: "center", borderBottom: `1px solid ${C.border}`
          }}>
            <motion.div
              animate={{
                scale: agentState === "speaking" ? [1, 1.08, 1] : 1,
                boxShadow: agentState === "speaking" ? `0 0 40px ${C.accent}25` : "none"
              }}
              transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
              style={{
                width: 100, height: 100, borderRadius: "50%",
                background: "radial-gradient(circle at 35% 35%, #059669, #064e3b)",
                display: "flex", alignItems: "center", justifyContent: "center",
                border: `2px solid ${agentState === "idle" ? C.border : C.accent}`,
                fontSize: "2.2rem"
              }}
            >
              🛍️
            </motion.div>
            <h3 style={{ fontSize: "1rem", color: C.text, fontWeight: "900", marginTop: "1rem" }}>
              {agentState === "speaking" ? "Shoppe is speaking..." : "Awaiting search query..."}
            </h3>
            <p style={{ fontSize: "0.75rem", color: C.muted, marginTop: 4 }}>
              Say or type what product you are looking for.
            </p>
          </div>

          {/* Interactive Search Results Card Panel */}
          {searchResults.length > 0 && (
            <div style={{
              maxHeight: 250, overflowY: "auto", padding: "1.5rem 1.5rem 0.5rem 1.5rem",
              borderBottom: `1px solid ${C.border}`, flexShrink: 0
            }}>
              <div style={{ fontSize: "0.7rem", fontWeight: "900", color: C.accent, letterSpacing: 1.5, marginBottom: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>🎯 INTERACTIVE SEARCH LISTINGS</span>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {searchResults.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => sendAction("navigate_to_url", { url: item.url })}
                    style={{
                      display: "flex", flexDirection: "column", gap: 4,
                      padding: 10, borderRadius: 8, background: "#1e293b",
                      border: `1px solid ${C.border}`, textAlign: "left", cursor: "pointer",
                      width: "100%", outline: "none", transition: "border-color 0.2s"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = C.accent}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = C.border}
                  >
                    <div style={{ fontSize: "0.75rem", fontWeight: "bold", color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.merchant} - {item.normalized_title}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", width: "100%", fontSize: "0.65rem", color: C.muted }}>
                      <span style={{ color: C.accent, fontWeight: "bold" }}>
                        ₹{item.price > 0 ? item.price.toLocaleString("en-IN") : "View Price"}
                      </span>
                      <span>⭐ {item.rating} ({item.reviews_count})</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Activity Logs */}
          <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem" }}>
            <div style={{ fontSize: "0.7rem", fontWeight: "900", color: C.accent, letterSpacing: 1.5, marginBottom: "1rem" }}>
              AGENT EXECUTION MODULES
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {logs.map(log => (
                <div key={log.id} style={{
                  padding: "10px", borderRadius: 10, background: "#1e293b",
                  borderLeft: `3.5px solid ${logColor(log.type)}`
                }}>
                  <div style={{ fontSize: "0.75rem", color: C.text, lineHeight: 1.4 }}>{renderLogMessage(log.msg)}</div>
                  <div style={{ fontSize: "0.55rem", color: C.muted, marginTop: 4, fontFamily: "monospace" }}>{log.time}</div>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>

          {/* Prompt/Text Input Bar */}
          <form onSubmit={handleTextSearch} style={{
            padding: "1rem", borderTop: `1px solid ${C.border}`,
            display: "flex", gap: 8
          }}>
            <input
              type="text"
              placeholder="Type product search (e.g. Dyson V15)..."
              value={currentQuery}
              onChange={e => setCurrentQuery(e.target.value)}
              style={{
                flex: 1, padding: "10px 14px", borderRadius: 10,
                background: C.bg, border: `1px solid ${C.border}`,
                color: C.text, fontSize: "0.85rem", outline: "none"
              }}
            />
            <button
              type="submit"
              style={{
                width: 40, height: 40, borderRadius: 10, background: C.accent,
                border: "none", color: "#000", display: "flex",
                alignItems: "center", justifyContent: "center", cursor: "pointer"
              }}
            >
              <Send size={16} />
            </button>
          </form>
        </div>

        {/* Right Browser Viewport */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "2rem", overflow: "hidden" }}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexShrink: 0
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Laptop size={18} color={C.accent} />
              <span style={{ fontSize: "0.85rem", fontWeight: "900", color: C.text, letterSpacing: 0.5 }}>
                PLAYWRIGHT CO-PILOT STREAM
              </span>
            </div>
            {isSearching && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.75rem", color: C.gold, fontWeight: "700" }}>
                <Loader2 size={14} className="animate-spin" />
                <span>Playwright is automating browser...</span>
              </div>
            )}
          </div>

          {/* Side-by-side workspace: Browser frame on left (or full width), forms on right */}
          <div style={{ flex: 1, display: "flex", gap: "1.5rem", overflow: "hidden", minHeight: 0 }}>
            
            {/* Left Column: Browser viewport on top, permanent subtitles on bottom */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1.5rem", overflow: "hidden" }}>
              
              {/* Browser Frame */}
              <div style={{
                flex: 1, background: "#090d16", borderRadius: 20,
                border: `1.5px solid ${C.border}`, display: "flex", alignItems: "center",
                justifyContent: "center", overflow: "hidden", position: "relative",
                boxShadow: "0 20px 50px rgba(0,0,0,0.5)"
              }}>
                {shoppeScreenTrack ? (
                  <VideoTrack 
                    trackRef={shoppeScreenTrack} 
                    style={{ width: "100%", height: "100%", objectFit: "contain" }}
                  />
                ) : (
                  <div style={{ textAlign: "center", color: C.muted, padding: "3rem" }}>
                    <Cpu size={48} color={C.muted} style={{ marginBottom: "1rem", opacity: 0.3 }} />
                    <div style={{ fontSize: "1.1rem", fontWeight: "800", color: C.text, marginBottom: 8 }}>
                      No Active Session
                    </div>
                    <p style={{ fontSize: "0.85rem", maxWidth: 360, margin: "0 auto", lineHeight: 1.5 }}>
                      The live headful browser stream will load here once the agent begins searching e-commerce platforms.
                    </p>
                  </div>
                )}
              </div>

              {/* Permanent Subtitles Panel */}
              <div style={{
                height: 100, background: C.surface, borderRadius: 16,
                border: `1.5px solid ${C.border}`, padding: "14px 20px",
                display: "flex", flexDirection: "column", justifyContent: "center",
                boxShadow: "0 10px 25px rgba(0,0,0,0.35)", flexShrink: 0
              }}>
                <div style={{
                  fontSize: "0.6rem",
                  fontWeight: "900",
                  color: C.accent,
                  textTransform: "uppercase",
                  letterSpacing: "1.5px",
                  marginBottom: "6px",
                  display: "flex",
                  alignItems: "center",
                  gap: 6
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.accent, display: "inline-block" }} />
                  COPILOT SUBTITLES
                </div>
                <p style={{
                  margin: 0,
                  fontSize: "0.9rem",
                  lineHeight: "1.4",
                  color: transcription ? C.text : C.muted,
                  fontWeight: "500",
                  fontStyle: transcription ? "normal" : "italic"
                }}>
                  {transcription || "Listening for co-pilot voice output..."}
                </p>
              </div>

            </div>


          </div>
        </div>
      </div>

      <RoomAudioRenderer />
    </div>
  );
}

const ShoppeRoom = memo(function ShoppeRoom({ roomData, onLeave }) {
  const serverUrl = import.meta.env.VITE_LIVEKIT_URL || 'ws://localhost:7880';

  return (
    <LiveKitRoom
      audio={true}
      video={false}
      token={roomData.token}
      serverUrl={serverUrl}
      onDisconnected={onLeave}
    >
      <ShoppeScene onLeave={onLeave} />
      <CostGuardAlert />
    </LiveKitRoom>
  );
});

export default ShoppeRoom;
