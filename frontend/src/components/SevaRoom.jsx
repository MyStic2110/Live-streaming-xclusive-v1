import React, { memo, useEffect, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRemoteParticipants,
  useRoomContext,
} from "@livekit/components-react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Colour tokens ────────────────────────────────────────────────────────────
const C = {
  bg:         "#0a0f1e",
  surface:    "#111827",
  card:       "#1a2235",
  border:     "rgba(255,255,255,0.07)",
  accent:     "#22c55e",     // service green
  accentSoft: "rgba(34,197,94,0.1)",
  accentGlow: "rgba(34,197,94,0.25)",
  gold:       "#f59e0b",
  blue:       "#3b82f6",
  text:       "#f1f5f9",
  muted:      "#64748b",
};

// ─── Service palette ──────────────────────────────────────────────────────────
const SERVICES = [
  { emoji: "🔧", label: "Plumbing",    color: "#3b82f6", desc: "Leaks, pipe repairs, installations"  },
  { emoji: "⚡", label: "Electrical",  color: "#f59e0b", desc: "Wiring, panels, lighting"            },
  { emoji: "🧹", label: "Cleaning",    color: "#22c55e", desc: "Deep clean, sanitization, maid"      },
  { emoji: "🪑", label: "Carpentry",   color: "#a855f7", desc: "Furniture, woodwork, installations"  },
  { emoji: "👕", label: "Laundry",     color: "#06b6d4", desc: "Wash, dry-clean, doorstep delivery"  },
  { emoji: "🔨", label: "Repairs",     color: "#f43f5e", desc: "Appliances, AC, general maintenance" },
];

// ─── Status pill ──────────────────────────────────────────────────────────────
const StatusPill = ({ state }) => {
  const map = {
    idle:      { label: "STANDBY",    bg: "rgba(100,116,139,0.15)", color: C.muted   },
    listening: { label: "LISTENING",  bg: C.accentSoft,              color: C.accent  },
    speaking:  { label: "SPEAKING",   bg: "rgba(59,130,246,0.15)",   color: C.blue    },
  };
  const s = map[state] || map.idle;
  return (
    <span style={{
      fontSize: "0.6rem", fontWeight: "900", letterSpacing: "1.5px",
      padding: "3px 10px", borderRadius: "99px",
      background: s.bg, color: s.color,
      display: "flex", alignItems: "center", gap: 5,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.color, display: "inline-block" }} />
      {s.label}
    </span>
  );
};

// ─── Booking card ─────────────────────────────────────────────────────────────
const BookingCard = ({ booking }) => {
  const svc = SERVICES.find(s => s.label.toLowerCase() === booking.service) || SERVICES[0];
  const statusColor = booking.status === "confirmed" ? C.accent
    : booking.status === "cancelled" ? "#f43f5e" : C.gold;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: C.card, borderRadius: 14, padding: "1rem",
        border: `1px solid ${C.border}`, marginBottom: "0.75rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <span style={{
          width: 36, height: 36, borderRadius: 10, fontSize: "1.2rem",
          background: `${svc.color}18`, display: "flex", alignItems: "center", justifyContent: "center",
          border: `1px solid ${svc.color}33`,
        }}>{svc.emoji}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "0.8rem", fontWeight: "800", color: C.text }}>
            {booking.service?.toUpperCase()} — {booking.sub_service?.replace(/_/g, " ")}
          </div>
          <div style={{ fontSize: "0.65rem", color: C.muted }}>
            {booking.date} @ {booking.time} · {booking.address}
          </div>
        </div>
        <span style={{
          fontSize: "0.6rem", fontWeight: "900", padding: "2px 8px",
          borderRadius: 99, background: `${statusColor}18`, color: statusColor,
        }}>
          {booking.status?.toUpperCase()}
        </span>
      </div>
      <div style={{ fontSize: "0.6rem", color: C.muted, fontFamily: "monospace" }}>
        ID: {booking.id}
      </div>
    </motion.div>
  );
};

// ─── Animated orb ─────────────────────────────────────────────────────────────
const SevaOrb = ({ state }) => (
  <motion.div
    animate={{
      scale:     state === "speaking"  ? [1, 1.12, 1] : state === "listening" ? [1, 1.05, 1] : 1,
      boxShadow: state === "speaking"  ? [`0 0 0px ${C.accentGlow}`, `0 0 60px ${C.accentGlow}`, `0 0 0px ${C.accentGlow}`]
               : state === "listening" ? [`0 0 0px ${C.accentGlow}`, `0 0 30px ${C.accentGlow}`, `0 0 0px ${C.accentGlow}`]
               : "0 0 0px transparent",
    }}
    transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
    style={{
      width: 180, height: 180, borderRadius: "50%",
      background: "radial-gradient(circle at 35% 35%, #1e3a2f, #0a1a12)",
      border: `2px solid ${state === "idle" ? C.border : C.accent}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: "4.5rem", position: "relative",
    }}
  >
    🏠
    {/* Ring */}
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
      style={{
        position: "absolute", inset: -10, borderRadius: "50%",
        border: `2px dashed ${C.accentGlow}`,
        pointerEvents: "none",
      }}
    />
  </motion.div>
);

// ─── Main inner component ─────────────────────────────────────────────────────
function SevaScene({ onLeave }) {
  const [agentState, setAgentState] = useState("idle");
  const [transcription, setTranscription] = useState("");
  const [bookings, setBookings]   = useState([]);
  const [logs, setLogs]           = useState([
    { id: 1, type: "system", msg: "🏠 SEVA Service OS online — awaiting service request.", time: new Date().toLocaleTimeString() },
  ]);
  const [logOpen, setLogOpen]     = useState(true);
  const logEndRef                 = React.useRef(null);
  const remoteParticipants        = useRemoteParticipants();
  const room                      = useRoomContext();

  // Auto-scroll feed
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

  // Transcription listener
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

  // SEVA speaking state
  useEffect(() => {
    const seva = remoteParticipants.find(p => {
      try { return JSON.parse(p.metadata || "{}").name === "SEVA"; } catch { return false; }
    });
    if (!seva) { setAgentState("idle"); return; }
    const handle = () => setAgentState(seva.isSpeaking ? "speaking" : "listening");
    seva.on("isSpeakingChanged", handle);
    handle();
    return () => seva.off("isSpeakingChanged", handle);
  }, [remoteParticipants]);

  // Data messages from SEVA
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
        if (msg.type === "booking_created") {
          setBookings(prev => [msg.data, ...prev]);
          setLogs(prev => [...prev, {
            id: Date.now(), type: "success",
            msg: `✅ BOOKED: ${msg.data.service?.toUpperCase()} on ${msg.data.date} @ ${msg.data.time}`,
            time: new Date().toLocaleTimeString(),
          }]);
        }
        if (msg.type === "booking_updated") {
          setBookings(prev => prev.map(b => b.id === msg.data.id ? msg.data : b));
          setLogs(prev => [...prev, {
            id: Date.now(), type: "info",
            msg: `🔄 UPDATED: ${msg.data.id} → ${msg.data.date} @ ${msg.data.time}`,
            time: new Date().toLocaleTimeString(),
          }]);
        }
        if (msg.type === "booking_cancelled") {
          setBookings(prev => prev.map(b => b.id === msg.data.id ? { ...b, status: "cancelled" } : b));
          setLogs(prev => [...prev, {
            id: Date.now(), type: "warning",
            msg: `❌ CANCELLED: ${msg.data.id}`,
            time: new Date().toLocaleTimeString(),
          }]);
        }
      } catch (e) { /* ignore malformed */ }
    };
    room.on("dataReceived", onData);
    return () => room.off("dataReceived", onData);
  }, [room]);

  const logColor = (type) =>
    type === "success" ? C.accent : type === "warning" ? "#f43f5e"
    : type === "milestone" ? C.gold : type === "system" ? C.blue : C.muted;

  return (
    <div style={{
      height: "100vh", width: "100vw", overflow: "hidden",
      display: "flex", flexDirection: "column",
      background: C.bg, fontFamily: "'Outfit', sans-serif",
    }}>
      {/* ── Header ── */}
      <header style={{
        height: 70, padding: "0 3%",
        background: C.surface,
        borderBottom: `1px solid ${C.border}`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        zIndex: 100, flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: `${C.accent}18`,
            border: `1px solid ${C.accent}44`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem",
          }}>🏠</div>
          <div>
            <div style={{ fontSize: "1rem", fontWeight: "900", color: C.text, letterSpacing: 1 }}>
              SEVA <span style={{ color: C.accent }}>SERVICE OS</span>
            </div>
            <div style={{ fontSize: "0.65rem", color: C.muted, letterSpacing: 1 }}>
              AI-Powered Home Services · English & Hindi
            </div>
          </div>
          <StatusPill state={agentState} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <AnimatePresence>
            {transcription && (
              <motion.div
                initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                style={{
                  fontSize: "0.85rem", color: C.accent,
                  fontStyle: "italic", fontWeight: 600,
                  maxWidth: 340, overflow: "hidden",
                  textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}
              >
                "{transcription}"
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={() => setLogOpen(v => !v)}
            style={{
              padding: "6px 14px", borderRadius: 20,
              border: `1px solid ${C.border}`,
              background: logOpen ? C.accent : "transparent",
              color: logOpen ? "#000" : C.muted,
              fontSize: "0.65rem", fontWeight: "800",
              cursor: "pointer", transition: "all 0.2s",
              letterSpacing: 1,
            }}
          >
            {logOpen ? "HIDE FEED" : "ACTIVITY FEED"}
          </button>

          <button
            onClick={onLeave}
            style={{
              padding: "6px 16px", borderRadius: 12,
              border: "1px solid rgba(239,68,68,0.3)",
              background: "transparent", color: "#ef4444",
              fontSize: "0.75rem", fontWeight: "800",
              cursor: "pointer",
            }}
          >
            LEAVE
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ── Centre panel ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", overflow: "auto", padding: "3rem 2rem" }}>

          {/* Orb */}
          <SevaOrb state={agentState} />

          <h2 style={{
            marginTop: "2rem", fontSize: "1.5rem", fontWeight: "900",
            color: C.text, textAlign: "center",
          }}>
            {agentState === "speaking"  ? "SEVA is speaking…"
           : agentState === "listening" ? "SEVA is listening…"
           :                              "Say what service you need"}
          </h2>
          <p style={{ color: C.muted, fontSize: "0.9rem", marginTop: "0.5rem", textAlign: "center" }}>
            Speak naturally in English or Hindi&nbsp;/&nbsp;Hinglish
          </p>

          {/* Prompt chips */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: "2rem", justifyContent: "center", maxWidth: 600 }}>
            {[
              "Book a plumber for tomorrow morning",
              "Kal deep cleaning karwani hai",
              "Schedule electrician on Saturday",
              "Cancel my last booking",
              "What are my active bookings?",
              "Book laundry pickup today evening",
            ].map((p, i) => (
              <span key={i} style={{
                padding: "6px 14px", borderRadius: 99, fontSize: "0.75rem",
                background: C.card, border: `1px solid ${C.border}`,
                color: C.muted, fontWeight: 600,
              }}>
                "{p}"
              </span>
            ))}
          </div>

          {/* Service tiles */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12, marginTop: "2.5rem", width: "100%", maxWidth: 560,
          }}>
            {SERVICES.map(svc => (
              <div key={svc.label} style={{
                background: C.card, borderRadius: 14, padding: "1rem",
                border: `1px solid ${C.border}`, textAlign: "center",
                transition: "border-color 0.2s",
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = svc.color + "66"}
                onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
              >
                <div style={{ fontSize: "1.6rem", marginBottom: 4 }}>{svc.emoji}</div>
                <div style={{ fontSize: "0.7rem", fontWeight: "900", color: svc.color, letterSpacing: 1 }}>
                  {svc.label.toUpperCase()}
                </div>
                <div style={{ fontSize: "0.6rem", color: C.muted, marginTop: 2 }}>{svc.desc}</div>
              </div>
            ))}
          </div>

          {/* Bookings list */}
          {bookings.length > 0 && (
            <div style={{ width: "100%", maxWidth: 560, marginTop: "2.5rem" }}>
              <div style={{ fontSize: "0.65rem", fontWeight: "900", color: C.accent, letterSpacing: 2, marginBottom: 12 }}>
                SESSION BOOKINGS
              </div>
              {bookings.map(b => <BookingCard key={b.id} booking={b} />)}
            </div>
          )}
        </div>

        {/* ── Activity feed ── */}
        <AnimatePresence>
          {logOpen && (
            <motion.div
              initial={{ x: 380 }} animate={{ x: 0 }} exit={{ x: 380 }}
              style={{
                width: 340, height: "100%",
                background: C.surface, borderLeft: `1px solid ${C.border}`,
                display: "flex", flexDirection: "column", flexShrink: 0,
              }}
            >
              <div style={{
                padding: "1.25rem 1.25rem 1rem",
                borderBottom: `1px solid ${C.border}`,
              }}>
                <div style={{ fontSize: "0.7rem", fontWeight: "900", color: C.text, letterSpacing: 1 }}>
                  SEVA ACTIVITY FEED
                </div>
                <div style={{ fontSize: "0.6rem", color: C.muted, marginTop: 2 }}>
                  Live booking & agent actions
                </div>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "1rem" }}>
                {logs.map(log => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    style={{
                      marginBottom: "0.75rem", padding: "0.75rem",
                      borderRadius: 10, background: C.card,
                      border: `1px solid ${C.border}`,
                    }}
                  >
                    <div style={{
                      fontSize: "0.72rem", color: C.text, fontWeight: 600,
                      lineHeight: 1.4, marginBottom: 4,
                      borderLeft: `3px solid ${logColor(log.type)}`,
                      paddingLeft: 8,
                    }}>
                      {log.msg}
                    </div>
                    <div style={{ fontSize: "0.58rem", color: C.muted }}>{log.time}</div>
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

// ─── LiveKit wrapper ──────────────────────────────────────────────────────────
const SevaRoom = memo(function SevaRoom({ roomData, onLeave }) {
  const protocol  = window.location.protocol === "https:" ? "wss" : "ws";
  const serverUrl = `${protocol}://${window.location.host}/livekit`;

  return (
    <LiveKitRoom
      audio={true}
      video={false}
      token={roomData.token}
      serverUrl={serverUrl}
      onDisconnected={onLeave}
    >
      <SevaScene onLeave={onLeave} />
    </LiveKitRoom>
  );
});

export default SevaRoom;
