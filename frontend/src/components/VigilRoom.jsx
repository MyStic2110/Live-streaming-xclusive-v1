import React, { memo, useEffect, useRef, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRemoteParticipants,
  useRoomContext
} from "@livekit/components-react";
import { motion } from "framer-motion";
import VigilOrb from "./VigilOrb";
import AuditResultsModal from "./AuditResultsModal";

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

// --- VIGIL SCENE ---
function VigilScene({ onLeave }) {
  const [agentState, setAgentState] = useState("idle");
  const amplitude = useAgentAudioLevel();
  const remoteParticipants = useRemoteParticipants();

  useEffect(() => {
    if (remoteParticipants.length === 0) {
      setAgentState("idle");
      return;
    }
    const vigil = remoteParticipants[0];
    const handleSpeakingChanged = () => setAgentState(vigil.isSpeaking ? "speaking" : "listening");
    vigil.on("isSpeakingChanged", handleSpeakingChanged);
    return () => vigil.off("isSpeakingChanged", handleSpeakingChanged);
  }, [remoteParticipants]);

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "radial-gradient(circle at center, #020617 0%, #000 100%)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'Inter', sans-serif",
      overflow: "hidden",
    }}>
      {/* Background Data Grid */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "radial-gradient(#1e3a8a 0.5px, transparent 0.5px)",
        backgroundSize: "30px 30px",
        opacity: 0.15,
        pointerEvents: "none",
      }} />

      {/* Header */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, height: "60px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "0 2rem", background: "rgba(2, 6, 23, 0.8)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(59, 130, 246, 0.3)", zIndex: 10,
      }}>
        <span style={{ color: "white", fontWeight: 800, letterSpacing: "3px", fontSize: "0.9rem" }}>
          VIGIL <span style={{ color: "#3b82f6", fontSize: "0.7rem", fontWeight: 400 }}>• SYSTEM AUDITOR v3.1</span>
        </span>
        <button onClick={onLeave} style={{
          background: "transparent", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.2)",
          padding: "0.4rem 1.5rem", borderRadius: "4px", fontSize: "0.75rem", fontWeight: "bold", cursor: "pointer",
        }}>DISCONNECT</button>
      </div>

      {/* Domain Tracker */}
      <div style={{
        position: "fixed", bottom: "40px", left: "40px",
        display: "flex", flexDirection: "column", gap: "8px",
        color: "rgba(96, 165, 250, 0.4)", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "2px"
      }}>
        <div>○ GOVERNANCE</div>
        <div>○ DETECTION</div>
        <div>○ RESPONSE</div>
        <div>○ RECOVERY</div>
        <div>○ IMPROVEMENT</div>
      </div>

      {/* Orb Wrapper */}
      <div style={{ position: "relative", width: 450, height: 450 }}>
        <VigilOrb amplitude={amplitude} agentState={agentState} />
      </div>

      {/* Status Indicators */}
      <motion.div 
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 2, repeat: Infinity }}
        style={{ marginTop: "3rem", color: "#60a5fa", letterSpacing: "4px", fontSize: "0.85rem", fontWeight: 800, textTransform: "uppercase" }}
      >
        {remoteParticipants.length > 0 ? (agentState === "speaking" ? "Analyzing Compliance..." : "Awaiting Response") : "Establishing Uplink..."}
      </motion.div>
      
      <div style={{ position: "fixed", bottom: "40px", color: "rgba(255,255,255,0.2)", fontSize: "0.7rem", letterSpacing: "2px" }}>
        SECURE CHANNEL ENCRYPTED • AES-256
      </div>

      <RoomAudioRenderer />
    </div>
  );
}

const VigilRoom = memo(function VigilRoom({ roomData, onLeave }) {
  const serverUrl = import.meta.env.VITE_LIVEKIT_URL || "";
  return (
    <LiveKitRoom audio={true} video={false} token={roomData.token} serverUrl={serverUrl} onDisconnected={onLeave}>
      <VigilScene onLeave={onLeave} />
    </LiveKitRoom>
  );
});

export default VigilRoom;
