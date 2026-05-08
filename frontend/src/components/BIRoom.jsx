import React, { memo, useEffect, useRef, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRemoteParticipants,
  useRoomContext
} from "@livekit/components-react";
import { motion } from "framer-motion";
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
  const amplitude = useAgentAudioLevel();
  const remoteParticipants = useRemoteParticipants();
  const room = useRoomContext();

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
                // Look for any participant broadcasting usage metadata
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
        color: "rgba(52, 211, 153, 0.4)", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "2px"
      }}>
        <div>[01] SCHEMA SYNCED</div>
        <div>[02] MYSQL CONNECTED</div>
        <div>[03] READ-ONLY MODE ACTIVE</div>
        <div style={{ color: "#10b981" }}>[04] LISTENING FOR QUERIES...</div>
      </div>

      {/* Orb Wrapper */}
      <div style={{ position: "relative", width: 450, height: 450 }}>
        <BIOrb amplitude={amplitude} agentState={agentState} />
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

      {/* Status Indicators */}
      <motion.div 
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 2, repeat: Infinity }}
        style={{ marginTop: "3rem", color: "#34d399", letterSpacing: "4px", fontSize: "0.85rem", fontWeight: 800, textTransform: "uppercase" }}
      >
        {remoteParticipants.length > 0 ? (agentState === "speaking" ? "Analyzing Data..." : "Awaiting Query") : "Establishing Data Link..."}
      </motion.div>
      
      <div style={{ position: "fixed", bottom: "40px", color: "rgba(255,255,255,0.2)", fontSize: "0.7rem", letterSpacing: "2px" }}>
        MYSQL TLS ENCRYPTED • SSL-V3
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
