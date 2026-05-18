import React, { memo, useEffect, useRef, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRemoteParticipants,
  useRoomContext
} from "@livekit/components-react";
import { motion, AnimatePresence } from "framer-motion";
import BIOrb from "./BIOrb";

// --- AUDIO ANALYSER HOOK ---
function useAgentAudioLevel() {
  const [amplitude, setAmplitude] = useState(0);
  const refs = useRef({});
  const room = useRoomContext();

  useEffect(() => {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.85;
    const data = new Uint8Array(analyser.frequencyBinCount);
    refs.current = { audioCtx, analyser, data };

    const tick = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      setAmplitude(avg / 128);
      refs.current.raf = requestAnimationFrame(tick);
    };
    refs.current.raf = requestAnimationFrame(tick);

    const attach = () => {
      if (refs.current.source) return;
      for (const p of room.remoteParticipants.values()) {
        for (const pub of p.trackPublications.values()) {
          if (pub.kind === "audio" && pub.track?.mediaStream) {
            const src = audioCtx.createMediaStreamSource(pub.track.mediaStream);
            src.connect(analyser);
            refs.current.source = src;
            return;
          }
        }
      }
    };

    attach();
    room.on("trackSubscribed", attach);
    return () => {
      room.off("trackSubscribed", attach);
      cancelAnimationFrame(refs.current.raf);
      audioCtx.close();
    };
  }, [room]);

  return amplitude;
}

// --- BI SCENE ---
function BIScene({ onLeave }) {
  const [agentState, setAgentState] = useState("idle");
  const [transcription, setTranscription] = useState("");
  const [chartData, setChartData] = useState(null);
  const [chartTitle, setChartTitle] = useState("");
  const amplitude = useAgentAudioLevel();
  const remoteParticipants = useRemoteParticipants();
  const room = useRoomContext();

  // Listen for LiveKit Room Transcriptions
  useEffect(() => {
    const handleTranscription = (segments) => {
      const text = segments.map(s => s.text).join(" ");
      setTranscription(text);
      // Clear after 3 seconds of inactivity
      const timer = setTimeout(() => setTranscription(""), 3000);
      return () => clearTimeout(timer);
    };

    room.on("transcriptionReceived", handleTranscription);
    return () => room.off("transcriptionReceived", handleTranscription);
  }, [room]);

  // Listen for speaking changes from BI Agent Cortex II
  useEffect(() => {
    if (remoteParticipants.length === 0) {
      setAgentState("idle");
      return;
    }
    const cortex = remoteParticipants[0];
    const handleSpeakingChanged = () => setAgentState(cortex.isSpeaking ? "speaking" : "listening");
    cortex.on("isSpeakingChanged", handleSpeakingChanged);
    return () => cortex.off("isSpeakingChanged", handleSpeakingChanged);
  }, [remoteParticipants]);

  // Listen to incoming WebRTC Data Channel packets for dynamic charts
  useEffect(() => {
    const handleDataReceived = (payload) => {
      try {
        const text = new TextDecoder().decode(payload);
        const message = JSON.parse(text);
        if (message.type === "BI_DYNAMIC_CHART") {
          setChartData(message.data);
          setChartTitle(message.title);
        }
      } catch (e) {
        console.error("[BI_ROOM] Failed to parse data channel packet:", e);
      }
    };

    room.on("dataReceived", handleDataReceived);
    return () => room.off("dataReceived", handleDataReceived);
  }, [room]);

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "radial-gradient(circle at center, #064e3b 0%, #000 100%)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'Inter', sans-serif",
      overflow: "hidden",
    }}>
      {/* Background Data Grid */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "radial-gradient(#10b981 0.5px, transparent 0.5px)",
        backgroundSize: "40px 40px",
        opacity: 0.1,
        pointerEvents: "none",
      }} />

      {/* Header */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, height: "80px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "0 2rem", background: "rgba(6, 78, 59, 0.8)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(16, 185, 129, 0.3)", zIndex: 10,
      }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ color: "white", fontWeight: 800, letterSpacing: "3px", fontSize: "0.9rem" }}>
            CORTEX <span style={{ color: "#10b981", fontSize: "0.7rem", fontWeight: 400 }}>• BI ANALYST v1.0</span>
          </span>
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.6rem", letterSpacing: "1px" }}>SECURE DATA PIPELINE ACTIVE</span>
        </div>

        {/* RESOURCE MONITOR */}
        <div style={{ 
          display: "flex", gap: "2rem", background: "rgba(0,0,0,0.3)", 
          padding: "0.8rem 1.5rem", borderRadius: "8px", 
          border: "1px solid rgba(16, 185, 129, 0.2)" 
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.5rem", fontWeight: 900, marginBottom: "4px" }}>TOKENS</div>
            <div style={{ color: "#10b981", fontSize: "0.9rem", fontWeight: "bold", fontFamily: "monospace" }}>
              {(() => {
                const activeAgent = remoteParticipants.find(p => {
                   try { return p.metadata && JSON.parse(p.metadata).usage; } catch(e) { return false; }
                });
                const meta = activeAgent?.metadata ? JSON.parse(activeAgent.metadata) : null;
                return meta?.usage ? (meta.usage.input_tokens + meta.usage.output_tokens).toLocaleString() : "0";
              })()}
            </div>
          </div>
          <div style={{ width: "1px", background: "rgba(16, 185, 129, 0.2)" }}></div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.5rem", fontWeight: 900, marginBottom: "4px" }}>SESSION COST (USD)</div>
            <div style={{ color: "#34d399", fontSize: "0.9rem", fontWeight: "bold", fontFamily: "monospace" }}>
              ${(() => {
                const activeAgent = remoteParticipants.find(p => {
                   try { return p.metadata && JSON.parse(p.metadata).usage; } catch(e) { return false; }
                });
                const meta = activeAgent?.metadata ? JSON.parse(activeAgent.metadata) : null;
                return meta?.usage ? meta.usage.total_cost.toFixed(4) : "0.0000";
              })()}
            </div>
          </div>
        </div>

        <button onClick={onLeave} style={{
          background: "transparent", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.2)",
          padding: "0.4rem 1.5rem", borderRadius: "4px", fontSize: "0.75rem", fontWeight: "bold", cursor: "pointer",
        }}>TERMINATE</button>
      </div>

      {/* Analytics Feed */}
      <div style={{
        position: "fixed", bottom: "40px", left: "40px",
        display: "flex", flexDirection: "column", gap: "8px",
        color: "rgba(52, 211, 153, 0.4)", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "2px",
        zIndex: 5
      }}>
        <div>[01] SCHEMA SYNCED</div>
        <div>[02] MONGODB CONNECTED</div>
        <div>[03] READ-ONLY MODE ACTIVE</div>
        <div style={{ color: "#10b981" }}>[04] LISTENING FOR QUERIES...</div>
      </div>

      {/* --- CENTRAL DYNAMIC HYBRID STAGE --- */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "4rem",
        width: "90%",
        maxWidth: "1400px",
        height: "500px",
        position: "relative",
        zIndex: 2,
        transition: "all 0.5s ease"
      }}>
        {/* LEFT PANEL: BI THREE.JS ORB */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.5s ease",
          width: chartData ? "40%" : "100%",
        }}>
          <div style={{ 
            position: "relative", 
            width: chartData ? 320 : 450, 
            height: chartData ? 320 : 450, 
            transition: "all 0.5s ease" 
          }}>
            <BIOrb amplitude={amplitude} agentState={agentState} />
          </div>
          
          <motion.div 
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{ 
              marginTop: "2rem", 
              color: "#34d399", 
              letterSpacing: "4px", 
              fontSize: "0.85rem", 
              fontWeight: 800, 
              textTransform: "uppercase" 
            }}
          >
            {remoteParticipants.length > 0 ? (agentState === "speaking" ? "Analyzing Data..." : "Awaiting Query") : "Establishing Data Link..."}
          </motion.div>
        </div>

        {/* RIGHT PANEL: GLASSMORPHIC INTERACTIVE CHART PANEL */}
        <AnimatePresence>
          {chartData && (
            <motion.div
              initial={{ opacity: 0, x: 100, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.95 }}
              transition={{ type: "spring", damping: 20, stiffness: 120 }}
              style={{
                width: "60%",
                height: "100%",
                background: "rgba(6, 40, 30, 0.4)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(16, 185, 129, 0.25)",
                borderRadius: "24px",
                padding: "2.5rem",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 40px 80px rgba(0,0,0,0.5), 0 0 50px rgba(16,185,129,0.05)",
                position: "relative"
              }}
            >
              {/* Chart Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2.5rem" }}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ color: "#34d399", fontSize: "0.6rem", fontWeight: 900, letterSpacing: "1.5px" }}>DYNAMIC VISUALIZATION</span>
                  <h3 style={{ color: "white", fontSize: "1.3rem", fontWeight: 800, margin: 0, textTransform: "uppercase", letterSpacing: "1px" }}>{chartTitle}</h3>
                </div>
                <button 
                  onClick={() => setChartData(null)}
                  style={{
                    background: "rgba(16,185,129,0.1)",
                    border: "1px solid rgba(16,185,129,0.3)",
                    borderRadius: "8px",
                    color: "#34d399",
                    padding: "6px 16px",
                    cursor: "pointer",
                    fontSize: "0.75rem",
                    fontWeight: "bold",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => e.target.style.background = "rgba(16,185,129,0.25)"}
                  onMouseLeave={(e) => e.target.style.background = "rgba(16,185,129,0.1)"}
                >
                  CLEAR ×
                </button>
              </div>

              {/* Dynamic Vector Bars */}
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-around", flex: 1, gap: "1.5rem", paddingBottom: "1.5rem" }}>
                {chartData.map((item, idx) => {
                  const maxValue = Math.max(...chartData.map(d => d.value), 1);
                  const heightPct = (item.value / maxValue) * 80;
                  return (
                    <div key={idx} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, height: "100%", justifyContent: "flex-end" }}>
                      {/* Floating Values */}
                      <div style={{ color: "#34d399", fontSize: "0.85rem", fontWeight: "bold", marginBottom: "8px", fontFamily: "monospace" }}>
                        {item.value.toLocaleString()}
                      </div>
                      {/* Animated Framer-Motion Column */}
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${heightPct}%` }}
                        transition={{ type: "spring", stiffness: 100, damping: 15, delay: idx * 0.06 }}
                        style={{
                          width: "100%",
                          maxWidth: "45px",
                          background: "linear-gradient(180deg, #34d399 0%, #10b981 100%)",
                          borderRadius: "8px 8px 0 0",
                          boxShadow: "0 0 25px rgba(16, 185, 129, 0.3)",
                          cursor: "pointer"
                        }}
                        whileHover={{ scaleY: 1.05, filter: "brightness(1.15)" }}
                      />
                      {/* Sub-label */}
                      <div style={{
                        color: "rgba(255,255,255,0.5)",
                        fontSize: "0.7rem",
                        marginTop: "12px",
                        textAlign: "center",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "1px",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        width: "100%"
                      }}>
                        {item.name}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* FIXED LIVE CONVERSATION FEED */}
      <div style={{
        position: "fixed",
        bottom: "100px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "80%",
        maxWidth: "900px",
        minHeight: "100px",
        background: "rgba(16, 185, 129, 0.05)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(16, 185, 129, 0.2)",
        borderRadius: "16px",
        padding: "1.5rem 2.5rem",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        boxShadow: "0 10px 40px rgba(0, 0, 0, 0.4)",
        zIndex: 100,
        transition: "all 0.3s ease"
      }}>
        <div style={{ 
          position: "absolute", top: "-10px", left: "30px", 
          background: "#064e3b", padding: "2px 12px", 
          borderRadius: "4px", border: "1px solid #10b981",
          fontSize: "0.6rem", fontWeight: 900, color: "#10b981", letterSpacing: "2px" 
        }}>
          LIVE CONVERSATION FEED
        </div>
        
        <div style={{
          color: transcription ? "#34d399" : "rgba(52, 211, 153, 0.2)",
          fontSize: "1.4rem",
          fontWeight: 700,
          textAlign: "center",
          lineHeight: "1.4",
          textShadow: transcription ? "0 0 10px rgba(16, 185, 129, 0.5)" : "none",
          transition: "all 0.3s ease"
        }}>
          {transcription || "Awaiting voice command..."}
        </div>
      </div>
      
      <div style={{ position: "fixed", bottom: "40px", color: "rgba(255,255,255,0.2)", fontSize: "0.7rem", letterSpacing: "2px" }}>
        MONGODB TLS ENCRYPTED • SSL-V3
      </div>

      <RoomAudioRenderer />
    </div>
  );
}

const BIRoom = memo(function BIRoom({ roomData, onLeave }) {
  const serverUrl = import.meta.env.VITE_LIVEKIT_URL || "";
  return (
    <LiveKitRoom audio={true} video={false} token={roomData.token} serverUrl={serverUrl} onDisconnected={onLeave}>
      <BIScene onLeave={onLeave} />
    </LiveKitRoom>
  );
});

export default BIRoom;
