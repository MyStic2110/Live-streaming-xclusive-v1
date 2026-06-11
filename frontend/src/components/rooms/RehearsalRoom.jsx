import React, { useState, useEffect, useRef, useCallback } from "react";
import CostGuardAlert from "./CostGuardAlert";
import { LiveKitRoom, RoomAudioRenderer, useRoomContext } from "@livekit/components-react";

const FILLER_RE = /\b(um|uh|like|you know|so|basically|literally|right|okay)\b/gi;

function getWpmColor(wpm) {
  if (wpm === 0) return "#6b7280";
  if (wpm >= 130 && wpm <= 150) return "#10b981";
  if (wpm < 100 || wpm > 190) return "#ef4444";
  return "#f59e0b";
}
function getFillerColor(r) { return r < 3 ? "#10b981" : r < 8 ? "#f59e0b" : "#ef4444"; }
function getPauseColor(p)  { return p < 1.5 ? "#10b981" : p < 3 ? "#f59e0b" : "#ef4444"; }
function getWobbleColor(w) { return (w === "stable" || w === "calibrating") ? "#10b981" : w === "moderate" ? "#f59e0b" : "#ef4444"; }

function highlightFillers(text) {
  const parts = [];
  let last = 0;
  const re = new RegExp(FILLER_RE.source, "gi");
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), filler: false });
    parts.push({ text: m[0], filler: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), filler: false });
  return parts;
}

function MetricBox({ label, value, unit, color, sub }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: `1px solid ${color}33`,
      borderRadius: 16,
      padding: "1.1rem 1.3rem",
      display: "flex", flexDirection: "column", gap: 4
    }}>
      <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.6rem", fontWeight: 900, letterSpacing: "1.5px", textTransform: "uppercase" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{ color, fontSize: "1.9rem", fontWeight: 900, fontFamily: "monospace", lineHeight: 1 }}>{value}</span>
        {unit && <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.7rem", fontWeight: 700 }}>{unit}</span>}
      </div>
      {sub && <span style={{ color: "rgba(255,255,255,0.28)", fontSize: "0.68rem" }}>{sub}</span>}
    </div>
  );
}

function ScoreRing({ score }) {
  const r = 52, circ = 2 * Math.PI * r;
  const progress = (score / 100) * circ;
  const color = score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ position: "relative", width: 130, height: 130, flexShrink: 0 }}>
      <svg width={130} height={130} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={65} cy={65} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={10} />
        <circle cx={65} cy={65} r={r} fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={`${progress} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1.4s cubic-bezier(.4,0,.2,1)" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color, fontSize: "2.1rem", fontWeight: 900, lineHeight: 1 }}>{score}</span>
        <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.6rem", fontWeight: 800, letterSpacing: "1px" }}>/ 100</span>
      </div>
    </div>
  );
}

function CritiqueModal({ critique, onClose, onLeave }) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => { const t = setTimeout(() => setRevealed(true), 400); return () => clearTimeout(t); }, []);

  if (critique.error) return (
    <div style={OVERLAY}>
      <div style={MODAL}>
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>⚠️</div>
          <p style={{ color: "rgba(255,255,255,0.7)", marginBottom: "1.5rem" }}>Critique failed: {critique.error}</p>
          <button onClick={onClose} style={BTN_SEC}>Close</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={OVERLAY}>
      <div style={MODAL}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem" }}>
          <div>
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.65rem", fontWeight: 900, letterSpacing: "2.5px", marginBottom: 6 }}>SESSION COMPLETE</div>
            <h2 style={{ color: "white", fontSize: "1.8rem", fontWeight: 900, margin: 0, letterSpacing: "-0.5px" }}>Your Critique</h2>
          </div>
          {revealed && <ScoreRing score={critique.score || 0} />}
        </div>

        {/* Summary */}
        <div style={{ background: "rgba(99,102,241,0.08)", borderLeft: "3px solid rgba(99,102,241,0.5)", borderRadius: "0 12px 12px 0", padding: "1rem 1.2rem", marginBottom: "1.8rem" }}>
          <p style={{ color: "rgba(255,255,255,0.85)", margin: 0, lineHeight: 1.65, fontSize: "0.95rem" }}>{critique.summary}</p>
        </div>

        {/* Top 3 Fixes */}
        <div style={{ marginBottom: "1.8rem" }}>
          <h3 style={{ color: "#f59e0b", fontSize: "0.68rem", fontWeight: 900, letterSpacing: "2px", marginBottom: "0.9rem", textTransform: "uppercase" }}>🔧 Top 3 Fixes</h3>
          {(critique.top_3_fixes || []).map((fix, i) => (
            <div key={i} style={{ display: "flex", gap: 14, marginBottom: 12 }}>
              <span style={{ color: "#f59e0b", fontWeight: 900, fontSize: "1.1rem", lineHeight: "1.3", flexShrink: 0, width: 20 }}>{i + 1}.</span>
              <p style={{ color: "rgba(255,255,255,0.8)", margin: 0, lineHeight: 1.55, fontSize: "0.9rem" }}>{fix}</p>
            </div>
          ))}
        </div>

        {/* Landed / Didn't Land */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.2rem", marginBottom: "2rem" }}>
          <div>
            <h3 style={{ color: "#10b981", fontSize: "0.65rem", fontWeight: 900, letterSpacing: "2px", marginBottom: "0.8rem", textTransform: "uppercase" }}>✅ What Landed</h3>
            {(critique.landed || []).length === 0
              ? <p style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.8rem", fontStyle: "italic" }}>Nothing flagged</p>
              : (critique.landed || []).map((item, i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <span style={{ color: "#10b981", fontFamily: "monospace", fontSize: "0.73rem", fontWeight: 700 }}>{item.timestamp}</span>
                  <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.8rem", margin: "3px 0 0" }}>{item.note}</p>
                </div>
              ))}
          </div>
          <div>
            <h3 style={{ color: "#ef4444", fontSize: "0.65rem", fontWeight: 900, letterSpacing: "2px", marginBottom: "0.8rem", textTransform: "uppercase" }}>❌ What Didn't</h3>
            {(critique.didnt_land || []).length === 0
              ? <p style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.8rem", fontStyle: "italic" }}>Nothing flagged</p>
              : (critique.didnt_land || []).map((item, i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <span style={{ color: "#ef4444", fontFamily: "monospace", fontSize: "0.73rem", fontWeight: 700 }}>{item.timestamp}</span>
                  <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.8rem", margin: "3px 0 0" }}>{item.note}</p>
                </div>
              ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={onClose} style={BTN_SEC}>Practice Again</button>
          <button onClick={onLeave} style={BTN_DANGER}>End Session</button>
        </div>
      </div>
    </div>
  );
}

const OVERLAY = {
  position: "fixed", inset: 0,
  background: "rgba(0,0,0,0.88)", backdropFilter: "blur(16px)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 1000, padding: "1.5rem"
};
const MODAL = {
  background: "#0d1526",
  border: "1px solid rgba(99,102,241,0.25)",
  borderRadius: 24, padding: "2.5rem",
  width: "100%", maxWidth: 640,
  maxHeight: "92vh", overflowY: "auto"
};
const BTN_SEC = {
  flex: 1, padding: "0.9rem",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12, color: "white",
  fontWeight: 800, cursor: "pointer", fontSize: "0.9rem",
  transition: "background 0.2s"
};
const BTN_DANGER = {
  flex: 1, padding: "0.9rem",
  background: "rgba(239,68,68,0.12)",
  border: "1px solid rgba(239,68,68,0.3)",
  borderRadius: 12, color: "#ef4444",
  fontWeight: 800, cursor: "pointer", fontSize: "0.9rem"
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Content Component
// ─────────────────────────────────────────────────────────────────────────────
function RehearsalContent({ onLeave }) {
  const room = useRoomContext();
  const [captions, setCaptions] = useState([]);
  const [interimText, setInterimText] = useState("");
  const [metrics, setMetrics] = useState(null);
  const [critique, setCritique] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const captionRef = useRef(null);
  const sessionStart = useRef(Date.now());

  // Session timer
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - sessionStart.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // LiveKit data channel — HOP-4: Agent publishes data, browser receives it here
  useEffect(() => {
    if (!room) {
      console.warn("[HOP-4][REHEARSAL] room is null — data listener not attached yet.");
      return;
    }
    console.log("[HOP-4][REHEARSAL] Attaching dataReceived listener to LiveKit room.", room.name);

    const onData = (payload, _p, _k, topic) => {
      try {
        const data = JSON.parse(new TextDecoder().decode(payload));
        console.log(`[HOP-4][REHEARSAL] dataReceived | topic='${topic}' | data=`, data);

        if (topic === "caption") {
          if (!data.is_final) {
            console.log(`[HOP-4→UI][REHEARSAL] INTERIM caption: '${data.text}'`);
            setInterimText(data.text);
          } else {
            console.log(`[HOP-4→UI][REHEARSAL] FINAL caption committed: '${data.text}'`);
            setInterimText("");
            if (data.text) setCaptions(prev => [...prev.slice(-10), { text: data.text, id: Date.now() }]);
          }
        } else if (topic === "rehearsal_metrics") {
          console.log("[HOP-4→UI][REHEARSAL] Metrics update received:", data);
          setMetrics(data);
        } else if (topic === "rehearsal_critique") {
          if (data.type === "critique_status") {
            console.log("[HOP-4][REHEARSAL] critique_status signal received (generating...). Waiting for full critique.");
            return;
          }
          console.log("[HOP-4→UI][REHEARSAL] 🎉 Full critique received! Score:", data.score);
          setCritique(data);
          setReviewing(false);
        } else {
          console.warn(`[HOP-4][REHEARSAL] Unknown topic: '${topic}'`, data);
        }
      } catch (e) {
        console.error("[HOP-4][REHEARSAL] Failed to parse data packet:", e, payload);
      }
    };
    room.on("dataReceived", onData);
    return () => {
      console.log("[HOP-4][REHEARSAL] Removing dataReceived listener.");
      room.off("dataReceived", onData);
    };
  }, [room]);

  // Auto-scroll captions
  useEffect(() => {
    if (captionRef.current) captionRef.current.scrollTop = captionRef.current.scrollHeight;
  }, [captions, interimText]);

  const handleStopReview = useCallback(() => {
    if (!room || reviewing) {
      console.warn("[HOP-5][REHEARSAL] Stop & Review blocked — room:", !!room, "reviewing:", reviewing);
      return;
    }
    console.log("[HOP-5][REHEARSAL] Stop & Review clicked. Publishing stop_review to agent.");
    setReviewing(true);
    const payload = new TextEncoder().encode(JSON.stringify({ key: "stop_review" }));
    room.localParticipant.publishData(payload, { reliable: true });
    console.log("[HOP-5][REHEARSAL] stop_review published ✅. Waiting for critique response on topic='rehearsal_critique'.");
  }, [room, reviewing]);

  const handleLeave = useCallback(async () => {
    console.log("[REHEARSAL] handleLeave called. Sending end_session to agent.");
    if (room) {
      try {
        await room.localParticipant.publishData(
          new TextEncoder().encode(JSON.stringify({ key: "end_session" })),
          { reliable: true }
        );
        console.log("[REHEARSAL] end_session published ✅.");
      } catch (e) {
        console.error("[REHEARSAL] Failed to publish end_session:", e);
      }
    }
    onLeave();
  }, [room, onLeave]);

  const handlePracticeAgain = () => {
    setCritique(null);
    setCaptions([]);
    setInterimText("");
    setMetrics(null);
    setElapsed(0);
    sessionStart.current = Date.now();
  };

  const wpm = metrics?.wpm ?? 0;
  const fillerRatio = metrics?.filler_ratio ?? 0;
  const longestPause = metrics?.longest_pause ?? 0;
  const wobble = metrics?.pace_wobble ?? "calibrating";
  const totalWords = metrics?.total_words ?? 0;
  const isSpeaking = !!interimText;

  return (
    <div style={{
      height: "100dvh", width: "100vw",
      background: "#060b14",
      display: "flex", flexDirection: "column",
      overflow: "hidden",
      fontFamily: "'Inter', system-ui, sans-serif"
    }}>

      {/* ── Top Bar ── */}
      <div style={{
        height: 58,
        background: "rgba(10,18,35,0.97)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(99,102,241,0.18)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 28px", flexShrink: 0
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 10, height: 10, borderRadius: "50%",
            background: reviewing ? "#f59e0b" : isSpeaking ? "#6366f1" : "#10b981",
            boxShadow: reviewing ? "0 0 14px #f59e0b" : isSpeaking ? "0 0 14px #6366f1" : "0 0 14px #10b981",
            transition: "all 0.4s"
          }} />
          <div>
            <div style={{ color: "white", fontWeight: 900, fontSize: "0.88rem", letterSpacing: "2.5px" }}>THE REHEARSAL</div>
            <div style={{ color: "rgba(99,102,241,0.65)", fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.5px" }}>REAL-TIME SPEECH COACH</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 28, alignItems: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.58rem", fontWeight: 900, letterSpacing: "1.5px" }}>SESSION</div>
            <div style={{ color: "white", fontFamily: "monospace", fontSize: "1rem", fontWeight: 900 }}>{fmt(elapsed)}</div>
          </div>
          <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.07)" }} />
          <button onClick={handleLeave} style={{
            padding: "5px 14px",
            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.28)",
            borderRadius: 8, color: "#ef4444", fontWeight: 700, cursor: "pointer", fontSize: "0.73rem"
          }}>EXIT</button>
        </div>
      </div>

      {/* ── Main Grid ── */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 290px", overflow: "hidden" }}>

        {/* Left: Stage + Captions + Button */}
        <div style={{ display: "flex", flexDirection: "column", padding: "2rem", gap: "1.4rem", overflow: "hidden" }}>

          {/* Speaking Stage */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1.8rem" }}>

            {/* Animated orb */}
            <div style={{
              position: "relative",
              width: 140, height: 140,
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              {isSpeaking && (
                <div style={{
                  position: "absolute", inset: -16,
                  borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)",
                  animation: "pulse 1.4s ease-in-out infinite"
                }} />
              )}
              <div style={{
                width: 120, height: 120, borderRadius: "50%",
                background: isSpeaking
                  ? "radial-gradient(circle, rgba(99,102,241,0.25) 0%, rgba(99,102,241,0.04) 70%)"
                  : "radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%)",
                border: isSpeaking ? "2px solid rgba(99,102,241,0.55)" : "2px solid rgba(255,255,255,0.06)",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.35s ease",
                boxShadow: isSpeaking ? "0 0 48px rgba(99,102,241,0.2)" : "none"
              }}>
                <span style={{ fontSize: "3rem" }}>{reviewing ? "⏳" : isSpeaking ? "🎙️" : "🤫"}</span>
              </div>
            </div>

            <p style={{
              color: "rgba(255,255,255,0.22)",
              fontSize: "0.85rem", fontWeight: 500,
              textAlign: "center", maxWidth: 320, lineHeight: 1.5
            }}>
              {totalWords === 0
                ? "Start speaking — live captions and metrics will appear in real time."
                : reviewing
                ? "Analysing your session..."
                : isSpeaking
                ? "Listening..."
                : `${totalWords} words so far`}
            </p>
          </div>

          {/* Live Caption Strip */}
          <div style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.055)",
            borderRadius: 16, padding: "1.1rem 1.4rem",
            maxHeight: 190, overflowY: "auto", flexShrink: 0
          }} ref={captionRef}>
            <div style={{ color: "rgba(255,255,255,0.22)", fontSize: "0.58rem", fontWeight: 900, letterSpacing: "1.5px", marginBottom: 10 }}>LIVE TRANSCRIPT</div>
            {captions.map(c => (
              <div key={c.id} style={{ marginBottom: 6, lineHeight: 1.6, fontSize: "0.88rem" }}>
                {highlightFillers(c.text).map((part, i) => (
                  <span key={i} style={{
                    color: part.filler ? "#f59e0b" : "rgba(255,255,255,0.72)",
                    fontWeight: part.filler ? 800 : 400,
                    background: part.filler ? "rgba(245,158,11,0.1)" : "transparent",
                    borderRadius: part.filler ? 4 : 0,
                    padding: part.filler ? "0 3px" : 0
                  }}>{part.text}</span>
                ))}
              </div>
            ))}
            {interimText && (
              <div style={{ color: "rgba(99,102,241,0.75)", fontSize: "0.88rem", fontStyle: "italic" }}>
                {interimText}
                <span style={{ animation: "blink 1s step-end infinite" }}>▋</span>
              </div>
            )}
            {captions.length === 0 && !interimText && (
              <div style={{ color: "rgba(255,255,255,0.13)", fontSize: "0.85rem", fontStyle: "italic" }}>Your words will appear here in real time...</div>
            )}
          </div>

          {/* Stop & Review Button */}
          <button
            id="stop-review-btn"
            onClick={handleStopReview}
            disabled={reviewing || totalWords < 5}
            style={{
              padding: "1.1rem 2rem", borderRadius: 14,
              fontWeight: 900, fontSize: "1rem", letterSpacing: "0.5px",
              cursor: reviewing || totalWords < 5 ? "not-allowed" : "pointer",
              border: reviewing ? "1px solid rgba(245,158,11,0.4)" : totalWords < 5 ? "1px solid rgba(255,255,255,0.07)" : "none",
              background: reviewing
                ? "rgba(245,158,11,0.12)"
                : totalWords < 5
                ? "rgba(255,255,255,0.04)"
                : "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
              color: reviewing ? "#f59e0b" : totalWords < 5 ? "rgba(255,255,255,0.2)" : "white",
              boxShadow: !reviewing && totalWords >= 5 ? "0 8px 36px rgba(99,102,241,0.32)" : "none",
              transition: "all 0.3s ease", flexShrink: 0
            }}
          >
            {reviewing ? "⏳ Analysing your speech..." : totalWords < 5 ? "Speak first to enable review..." : "⏹ Stop & Review"}
          </button>
        </div>

        {/* Right: Metrics HUD */}
        <div style={{
          borderLeft: "1px solid rgba(255,255,255,0.045)",
          padding: "2rem 1.4rem",
          display: "flex", flexDirection: "column", gap: "0.9rem",
          overflowY: "auto"
        }}>
          <div style={{ color: "rgba(255,255,255,0.28)", fontSize: "0.58rem", fontWeight: 900, letterSpacing: "2px", marginBottom: 4 }}>LIVE METRICS</div>

          <MetricBox label="Words / Min" value={wpm} unit="wpm" color={getWpmColor(wpm)}
            sub={wpm === 0 ? "Waiting..." : wpm < 130 ? "Too slow" : wpm > 150 ? "Too fast" : "✓ On target"} />
          <MetricBox label="Filler Ratio" value={`${fillerRatio}%`} color={getFillerColor(fillerRatio)}
            sub={fillerRatio < 3 ? "✓ Clean" : fillerRatio < 8 ? "Watch it" : "Too many fillers"} />
          <MetricBox label="Longest Pause" value={`${longestPause}s`} color={getPauseColor(longestPause)}
            sub={longestPause < 1.5 ? "✓ Natural" : longestPause < 3 ? "Getting long" : "Dead air"} />
          <MetricBox label="Pace" color={getWobbleColor(wobble)}
            value={wobble === "calibrating" ? "—" : wobble.charAt(0).toUpperCase() + wobble.slice(1)}
            sub={wobble === "calibrating" ? "Keep talking..." : wobble === "stable" ? "✓ Consistent" : wobble === "moderate" ? "Some wobble" : "Erratic pace"} />
          <MetricBox label="Total Words" value={totalWords} color="#6366f1" />

          {/* WPM Reference Guide */}
          <div style={{
            marginTop: 4,
            background: "rgba(99,102,241,0.05)",
            border: "1px solid rgba(99,102,241,0.13)",
            borderRadius: 12, padding: "0.9rem 1rem"
          }}>
            <div style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.58rem", fontWeight: 900, letterSpacing: "1.5px", marginBottom: 8 }}>WPM GUIDE</div>
            {[
              { range: "< 110", label: "Too slow", color: "#ef4444" },
              { range: "110–130", label: "Thoughtful", color: "#f59e0b" },
              { range: "130–150", label: "✓ Ideal", color: "#10b981" },
              { range: "150–180", label: "Fast", color: "#f59e0b" },
              { range: "> 180", label: "Too fast", color: "#ef4444" },
            ].map((g, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.68rem", fontFamily: "monospace" }}>{g.range}</span>
                <span style={{ color: g.color, fontSize: "0.68rem", fontWeight: 700 }}>{g.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes pulse { 0%,100% { transform: scale(1); opacity: 0.7; } 50% { transform: scale(1.12); opacity: 0.3; } }
      `}</style>

      {/* Critique Modal */}
      {critique && (
        <CritiqueModal critique={critique} onClose={handlePracticeAgain} onLeave={handleLeave} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root Export
// ─────────────────────────────────────────────────────────────────────────────
export default function RehearsalRoom({ roomData, onLeave }) {
  const serverUrl = import.meta.env.VITE_LIVEKIT_URL || 'ws://localhost:7880';

  console.log("[HOP-1][REHEARSAL] RehearsalRoom mounting.", {
    room: roomData.roomName,
    serverUrl,
    token: roomData.token ? `${roomData.token.slice(0, 20)}...` : "MISSING",
  });

  return (
    <LiveKitRoom
      audio={true}
      video={false}
      token={roomData.token}
      serverUrl={serverUrl}
      onDisconnected={onLeave}
      onConnected={() => console.log("[HOP-1][REHEARSAL] ✅ LiveKit room connected.")}
      onError={(err) => console.error("[HOP-1][REHEARSAL] ❌ LiveKit connection error:", err)}
    >
      <RoomAudioRenderer />
      <RehearsalContent onLeave={onLeave} />
      <CostGuardAlert />
      </LiveKitRoom>
  );
}
