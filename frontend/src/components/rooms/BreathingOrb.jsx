import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useRemoteParticipants, useRoomContext } from "@livekit/components-react";
import OrbCanvas from "./OrbCanvas";

const STATE_THEMES = {
  listening: { primary: "#a855f7", label: "Listening...",   pulseSpeed: 3.5 },
  thinking:  { primary: "#818cf8", label: "Thinking...",    pulseSpeed: 1.2 },
  speaking:  { primary: "#e879f9", label: "Speaking",       pulseSpeed: 0.8 },
  idle:      { primary: "#6366f1", label: "Connecting...",  pulseSpeed: 5.0 },
};

// ── Live audio amplitude from Lina's remote track ─────────────────────────
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

// ── Main component ─────────────────────────────────────────────────────────
export default function BreathingOrb({ agentState = "idle", onLeave }) {
  const theme = STATE_THEMES[agentState] || STATE_THEMES.idle;
  const amplitude = useAgentAudioLevel();
  const remoteParticipants = useRemoteParticipants();
  const linaConnected = remoteParticipants.length > 0;

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "radial-gradient(ellipse at center, #0f0621 0%, #080414 60%, #000 100%)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'Inter','Segoe UI',sans-serif",
      overflow: "hidden",
    }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, height: "60px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "0 2rem",
        background: "rgba(15,6,33,0.85)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(168,85,247,0.15)", zIndex: 10,
      }}>
        <span style={{ color: "white", fontWeight: 800, letterSpacing: "1px" }}>
          LINA <span style={{ color: theme.primary, fontSize: "0.75rem", fontWeight: 500 }}>
            • PERSONAL COMPANION
          </span>
        </span>
        <button onClick={onLeave} style={{
          background: "rgba(239,68,68,0.12)", color: "#f87171",
          border: "1px solid rgba(239,68,68,0.3)",
          padding: "0.4rem 1.2rem", borderRadius: "8px",
          fontWeight: "bold", cursor: "pointer", fontSize: "0.85rem",
        }}>
          LEAVE
        </button>
      </div>

      {/* ── Ambient background rings ───────────────────────────────── */}
      {[340, 480, 640].map((size, i) => (
        <motion.div key={i}
          animate={{ scale: [1, 1.03, 1], opacity: [0.03, 0.07, 0.03] }}
          transition={{ duration: theme.pulseSpeed * 1.6 + i, repeat: Infinity, ease: "easeInOut", delay: i * 0.7 }}
          style={{
            position: "absolute", width: size, height: size,
            borderRadius: "50%", border: `1px solid ${theme.primary}`,
            pointerEvents: "none",
          }}
        />
      ))}

      {/* ── Three.js Orb ───────────────────────────────────────────── */}
      <div style={{ position: "relative", width: 340, height: 340 }}>
        <OrbCanvas amplitude={amplitude} agentState={agentState} />
      </div>

      {/* ── State label ───────────────────────────────────────────── */}
      <motion.div
        key={agentState}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          marginTop: "2.5rem", color: theme.primary,
          fontSize: "0.9rem", fontWeight: 600,
          letterSpacing: "2.5px", textTransform: "uppercase",
        }}
      >
        {linaConnected ? theme.label : "Waiting for Lina..."}
      </motion.div>

      {/* ── Bottom hint ────────────────────────────────────────────── */}
      <div style={{
        position: "fixed", bottom: "2.5rem",
        color: "rgba(255,255,255,0.25)", fontSize: "0.78rem",
        letterSpacing: "1.5px", textAlign: "center",
      }}>
        SPEAK TO LINA
      </div>
    </div>
  );
}
