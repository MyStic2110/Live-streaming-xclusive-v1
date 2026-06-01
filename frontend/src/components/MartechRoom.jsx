import React, { memo, useEffect, useRef, useState } from "react";
import CostGuardAlert from "./CostGuardAlert";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRemoteParticipants,
  useRoomContext
} from "@livekit/components-react";
import { motion, AnimatePresence } from "framer-motion";

// --- AUDIO ANALYSER HOOK (reacts to voice agent's speaking amplitude) ---
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

// --- LIGHTWEIGHT CUSTOM MARKDOWN PARSER ---
// Converts the structured markdown report into beautiful styled HTML
function parseMarkdown(mdText) {
  if (!mdText) return [];
  const lines = mdText.split("\n");
  const parsed = [];
  let inTable = false;
  let tableHeaders = [];
  let tableRows = [];
  let inList = false;
  let listItems = [];

  const flushTable = (index) => {
    if (inTable && tableHeaders.length > 0) {
      parsed.push(
        <div key={`table-${index}`} style={{ overflowX: "auto", margin: "1.5rem 0" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "500px" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid rgba(249, 115, 22, 0.4)", background: "rgba(249, 115, 22, 0.05)" }}>
                {tableHeaders.map((h, i) => (
                  <th key={i} style={{ padding: "12px", textAlign: "left", fontSize: "0.85rem", color: "#f97316", fontWeight: "800" }}>{h.trim()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, ri) => (
                <tr key={ri} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)", background: ri % 2 === 0 ? "transparent" : "rgba(255, 255, 255, 0.01)" }}>
                  {row.map((col, ci) => (
                    <td key={ci} style={{ padding: "12px", fontSize: "0.85rem", color: "#e2e8f0" }}>{col.trim()}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      inTable = false;
      tableHeaders = [];
      tableRows = [];
    }
  };

  const flushList = (index) => {
    if (inList && listItems.length > 0) {
      parsed.push(
        <ul key={`list-${index}`} style={{ margin: "1rem 0", paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
          {listItems.map((item, li) => (
            <li key={li} style={{ fontSize: "0.85rem", color: "#cbd5e1", lineHeight: "1.6" }}>{item}</li>
          ))}
        </ul>
      );
      inList = false;
      listItems = [];
    }
  };

  for (let idx = 0; idx < lines.length; idx++) {
    let line = lines[idx].trim();

    // Bold replacement helper
    const makeBold = (text) => {
      return text.replace(/\*\*(.*?)\*\*/g, (_, p1) => `<strong>${p1}</strong>`);
    };

    // Table parsing
    if (line.startsWith("|")) {
      flushList(idx);
      const cols = line.split("|").slice(1, -1);
      if (line.includes("---") || line.includes("---:")) {
        // Separator line, ignore
        continue;
      }
      if (!inTable) {
        inTable = true;
        tableHeaders = cols;
      } else {
        tableRows.push(cols);
      }
      continue;
    } else {
      flushTable(idx);
    }

    // List parsing
    if (line.startsWith("- ") || line.startsWith("* ")) {
      flushTable(idx);
      inList = true;
      listItems.push(<span dangerouslySetInnerHTML={{ __html: makeBold(line.substring(2)) }} />);
      continue;
    } else if (/^\d+\.\s/.test(line)) {
      flushTable(idx);
      inList = true;
      listItems.push(<span dangerouslySetInnerHTML={{ __html: makeBold(line.replace(/^\d+\.\s/, "")) }} />);
      continue;
    } else {
      flushList(idx);
    }

    // Headings
    if (line.startsWith("# ")) {
      parsed.push(<h1 key={idx} style={{ color: "#ffffff", fontSize: "1.6rem", fontWeight: "900", borderBottom: "1px solid rgba(249, 115, 22, 0.2)", paddingBottom: "8px", margin: "2rem 0 1rem 0", letterSpacing: "-0.5px" }}>{line.substring(2)}</h1>);
    } else if (line.startsWith("## ")) {
      parsed.push(<h2 key={idx} style={{ color: "#f97316", fontSize: "1.25rem", fontWeight: "800", margin: "1.8rem 0 1rem 0" }}>{line.substring(3)}</h2>);
    } else if (line.startsWith("### ")) {
      // Alert styles for H3 anomalies
      const isCritical = line.includes("🔴") || line.includes("CRITICAL");
      const isWarning = line.includes("🟠") || line.includes("HIGH");
      const borderCol = isCritical ? "rgba(239, 68, 68, 0.4)" : (isWarning ? "rgba(245, 158, 11, 0.4)" : "rgba(249, 115, 22, 0.4)");
      const bgCol = isCritical ? "rgba(239, 68, 68, 0.03)" : (isWarning ? "rgba(245, 158, 11, 0.03)" : "rgba(249, 115, 22, 0.03)");
      parsed.push(
        <h3 key={idx} style={{ 
          color: isCritical ? "#ef4444" : (isWarning ? "#f59e0b" : "#fb923c"), 
          fontSize: "1rem", fontWeight: "800", margin: "1.2rem 0 0.6rem 0",
          background: bgCol, borderLeft: `3px solid ${borderCol.replace('0.4', '1')}`, padding: "8px 12px", borderRadius: "0 6px 6px 0"
        }}>
          {line.replace("### ", "")}
        </h3>
      );
    } else if (line.length > 0) {
      // Standard paragraph
      parsed.push(<p key={idx} style={{ color: "#cbd5e1", fontSize: "0.9rem", lineHeight: "1.7", margin: "0.8rem 0" }} dangerouslySetInnerHTML={{ __html: makeBold(line) }} />);
    }
  }

  // End of file flushers
  flushTable(lines.length);
  flushList(lines.length);

  return parsed;
}

// --- DYNAMIC RADAR COMPONENT ---
function RadarVisualizer({ active, amplitude }) {
  const rings = [1, 2, 3];
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* Radar sweep */}
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
        style={{
          position: "absolute",
          width: "280px",
          height: "280px",
          borderRadius: "50%",
          background: "conic-gradient(from 0deg, rgba(249, 115, 22, 0.15) 0deg, transparent 90deg, transparent 360deg)",
          zIndex: 1,
          pointerEvents: "none"
        }}
      />

      {/* Grid Rings */}
      {rings.map((ring) => (
        <div key={ring} style={{
          position: "absolute",
          width: `${ring * 90}px`,
          height: `${ring * 90}px`,
          border: "1px dashed rgba(249, 115, 22, 0.12)",
          borderRadius: "50%",
          pointerEvents: "none"
        }} />
      ))}

      {/* Dynamic Voice Pulsar */}
      <motion.div
        animate={{ 
          scale: active ? 1 + amplitude * 0.4 : [1, 1.05, 1],
          opacity: active ? 0.8 + amplitude * 0.2 : 0.6
        }}
        transition={{ duration: active ? 0.1 : 3, repeat: active ? 0 : Infinity, ease: "easeInOut" }}
        style={{
          width: "120px",
          height: "120px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(249, 115, 22, 0.4) 0%, rgba(249, 115, 22, 0.05) 70%, transparent 100%)",
          boxShadow: `0 0 ${30 + amplitude * 50}px rgba(249, 115, 22, ${0.2 + amplitude * 0.4})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1px solid rgba(249, 115, 22, 0.4)",
          zIndex: 2
        }}
      >
        <span style={{ fontSize: "2rem" }}>📈</span>
      </motion.div>

      {/* Concentric Audio Pulse Waves */}
      {active && amplitude > 0.15 && (
        <motion.div
          initial={{ scale: 0.9, opacity: 1 }}
          animate={{ scale: 2.2, opacity: 0 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          style={{
            position: "absolute",
            width: "120px",
            height: "120px",
            borderRadius: "50%",
            border: "2px solid rgba(249, 115, 22, 0.5)",
            pointerEvents: "none",
            zIndex: 1
          }}
        />
      )}
    </div>
  );
}

// --- MAIN MARTECH SCENE ---
function MartechScene({ onLeave }) {
  const [activeTab, setActiveTab] = useState("telemetry");
  const [agentState, setAgentState] = useState("idle");
  const [transcription, setTranscription] = useState("");
  
  // High fidelity default fallback dataset so UI is immediately gorgeous
  const [analyticsData, setAnalyticsData] = useState({
    summary: {
      ga: {
        users: { curr: 12450, prev: 15900, change: -21.7 },
        sessions: { curr: 16800, prev: 21500, change: -21.8 },
        conversions: { curr: 480, prev: 610, change: -21.3 },
        engagement_rate: { curr: 0.624, prev: 0.682, change: -5.8 },
        avg_engagement_time: { curr: 105, prev: 130, change: -19.2 }
      },
      gsc: {
        clicks: { curr: 5400, prev: 6800, change: -20.6 },
        impressions: { curr: 125000, prev: 140000, change: -10.7 },
        ctr: { curr: 0.0432, prev: 0.0486, change: -11.1 },
        avg_position: { curr: 8.4, prev: 7.2, change: 1.2 }
      }
    },
    anomalies: [
      {
        metric: "Users (Traffic) Decline",
        change: "-21.7%",
        severity: "CRITICAL",
        probable_cause: "Google Core Algorithm Update affecting high-volume organic search rankings.",
        affected_pages: ["/blog/webrtc-guide"],
        recommended_action: "Audit core content search rankings, update outdated guides with fresher tutorials, and expand related internal linking."
      },
      {
        metric: "Signup Funnel Conversion Crash",
        change: "-21.3% Conversions Drop",
        severity: "CRITICAL",
        probable_cause: "Email form verification validation script throwing silent JS exceptions on iOS mobile clients.",
        affected_pages: ["/signup"],
        recommended_action: "Examine validation handlers on signup fields, run automated viewport tests, and deploy a validation bypass fallback."
      },
      {
        metric: "Mobile Conversion Rate Slip",
        change: "-27.5% drop on mobile devices",
        severity: "HIGH",
        probable_cause: "Styling update truncated the CTA button viewport boundaries on mobile screens, obstructing submission clicks.",
        affected_pages: ["/pricing", "/signup"],
        recommended_action: "Reconfigure viewport breakpoints and resize payment checkouts for mobile browsers."
      }
    ],
    opportunities: [
      {
        query: "custom video chat integrations",
        impressions: 6800,
        clicks: 25,
        ctr: "0.37%",
        position: 1.1,
        type: "Low CTR (Page 1 Spot)",
        recommendation: "Optimizing the title tag & descriptions using high-incentive messaging will dramatically expand search CTR."
      },
      {
        query: "how to build a video calling app",
        impressions: 14000,
        clicks: 120,
        ctr: "0.86%",
        position: 8.2,
        type: "Page 1 Margin push candidate",
        recommendation: "Build internal links from high-authority home pages, integrate illustrative diagrams, and resolve technical subtopics."
      }
    ],
    correlations: [
      {
        title: "Search Vol vs pricing conversions gap",
        finding: "Significant keyword impressions but a low 5.1% signup conversion rate.",
        analysis: "Pricing comparison grids are lacking transparency, inducing user bounce rates.",
        action: "Deploy interactive pricing calculators and risk-free trial checkouts."
      }
    ]
  });

  const [reportMarkdown, setReportMarkdown] = useState("");
  const amplitude = useAgentAudioLevel();
  const remoteParticipants = useRemoteParticipants();
  const room = useRoomContext();

  // Listen for LiveKit Room Transcriptions
  useEffect(() => {
    const handleTranscription = (segments) => {
      const text = segments.map(s => s.text).join(" ");
      setTranscription(text);
      // Clear after 4 seconds of silence
      const timer = setTimeout(() => setTranscription(""), 4000);
      return () => clearTimeout(timer);
    };

    room.on("transcriptionReceived", handleTranscription);
    return () => room.off("transcriptionReceived", handleTranscription);
  }, [room]);

  // Listen to speaking state changes
  useEffect(() => {
    if (remoteParticipants.length === 0) {
      setAgentState("idle");
      return;
    }
    const agentParticipant = remoteParticipants[0];
    const handleSpeakingChanged = () => {
      setAgentState(agentParticipant.isSpeaking ? "speaking" : "listening");
    };
    agentParticipant.on("isSpeakingChanged", handleSpeakingChanged);
    return () => agentParticipant.off("isSpeakingChanged", handleSpeakingChanged);
  }, [remoteParticipants]);

  // Listen to incoming WebRTC Data Channel packets for dynamic updates
  useEffect(() => {
    const handleDataReceived = (payload) => {
      try {
        const text = new TextDecoder().decode(payload);
        const message = JSON.parse(text);
        if (message.type === "MARTECH_ANALYTICS_DATA") {
          console.log("[MARTECH_ROOM] Received live telemetry updates:", message);
          if (message.data) setAnalyticsData(message.data);
          if (message.markdown) setReportMarkdown(message.markdown);
        }
      } catch (e) {
        console.error("[MARTECH_ROOM] Failed to parse data channel packet:", e);
      }
    };

    room.on("dataReceived", handleDataReceived);
    return () => room.off("dataReceived", handleDataReceived);
  }, [room]);

  // Render initial report markdown if empty
  useEffect(() => {
    if (!reportMarkdown && analyticsData) {
      // Mock-generate report markdown for initial load
      const ga = analyticsData.summary.ga;
      const gsc = analyticsData.summary.gsc;
      let mockMd = `# Executive Summary\n\nWebsite traffic and conversions are experiencing a minor correction over the current 30-day window. Overall GA4 Users declined **${Math.abs(ga.users.change).toFixed(1)}%** compared to the prior period, alongside a Search Console organic clicks contraction of **${Math.abs(gsc.clicks.change).toFixed(1)}%**. High-priority optimizations are recommended for signup forms and search meta headers.\n\n# Key Metrics\n\n| Metric | Current Period | Previous Period | Change | Status |\n| :--- | :---: | :---: | :---: | :---: |\n| **GA4 Users** | ${ga.users.curr.toLocaleString()} | ${ga.users.prev.toLocaleString()} | ${ga.users.change > 0 ? "+" : ""}${ga.users.change.toFixed(1)}% | 🔻 Alert |\n| **GA4 Sessions** | ${ga.sessions.curr.toLocaleString()} | ${ga.sessions.prev.toLocaleString()} | ${ga.sessions.change > 0 ? "+" : ""}${ga.sessions.change.toFixed(1)}% | 🔻 Alert |\n| **GA4 Conversions** | ${ga.conversions.curr} | ${ga.conversions.prev} | ${ga.conversions.change > 0 ? "+" : ""}${ga.conversions.change.toFixed(1)}% | 🔻 Alert |\n| **GSC Average CTR** | ${(gsc.ctr.curr * 100).toFixed(2)}% | ${(gsc.ctr.prev * 100).toFixed(2)}% | ${gsc.ctr.change > 0 ? "+" : ""}${gsc.ctr.change.toFixed(1)}% | 🔻 Slip |\n| **GSC Avg. Position** | ${gsc.avg_position.curr.toFixed(1)} | ${gsc.avg_position.prev.toFixed(1)} | ${gsc.avg_position.change > 0 ? "+" : ""}${gsc.avg_position.change.toFixed(1)} | 🔻 Drop |\n\n# Traffic Insights\n\n- Organic channels fell by over 2,000 sessions, driving the overall user acquisition dip.\n- Direct traffic remains our highest converting channel, maintaining a solid 4.76% signup rate.\n\n# SEO Insights\n\n- Organic CTR dropped due to competitors bidding heavily on our main brand and technology keywords.\n- Key positions for backend terms drifted down from page 1 top-spots.`;
      setReportMarkdown(mockMd);
    }
  }, [analyticsData, reportMarkdown]);

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "radial-gradient(circle at center, #1e1b4b 0%, #030712 100%)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'Outfit', sans-serif",
      overflow: "hidden",
      color: "#ffffff"
    }}>
      {/* Decorative Grid Mesh */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "radial-gradient(rgba(249, 115, 22, 0.06) 0.5px, transparent 0.5px)",
        backgroundSize: "30px 30px",
        opacity: 0.6,
        pointerEvents: "none",
      }} />

      {/* Header */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, height: "80px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "0 2.5rem", background: "rgba(30, 27, 75, 0.8)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(249, 115, 22, 0.25)", zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "36px", height: "36px", borderRadius: "10px",
            background: "linear-gradient(135deg, #f97316 0%, #fb923c 100%)",
            display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "900", color: "#fff", fontSize: "1.1rem"
          }}>
            M
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ color: "white", fontWeight: 900, letterSpacing: "2.5px", fontSize: "0.85rem" }}>
              MARTECH <span style={{ color: "#f97316", fontSize: "0.7rem", fontWeight: 500 }}>• GROWTH INTELLIGENCE</span>
            </span>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.6rem", letterSpacing: "1.5px" }}>GA4 + GSC OBSERVER NODES ACTIVE</span>
          </div>
        </div>

        {/* Telemetry Resource Monitor */}
        <div style={{ 
          display: "flex", gap: "1.5rem", background: "rgba(0,0,0,0.4)", 
          padding: "0.6rem 1.2rem", borderRadius: "12px", 
          border: "1px solid rgba(249, 115, 22, 0.15)" 
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.55rem", fontWeight: 900, marginBottom: "2px" }}>CORTEX SYNC</div>
            <div style={{ color: "#f97316", fontSize: "0.85rem", fontWeight: "bold", fontFamily: "monospace" }}>
              {remoteParticipants.length > 0 ? "LIVE LINK" : "STANDBY"}
            </div>
          </div>
          <div style={{ width: "1px", background: "rgba(249, 115, 22, 0.15)" }}></div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.55rem", fontWeight: 900, marginBottom: "2px" }}>SESSION COST</div>
            <div style={{ color: "#fb923c", fontSize: "0.85rem", fontWeight: "bold", fontFamily: "monospace" }}>
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
          background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.3)",
          padding: "0.5rem 1.2rem", borderRadius: "8px", fontSize: "0.75rem", fontWeight: "bold", cursor: "pointer",
          transition: "all 0.2s"
        }}
        onMouseEnter={e => e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)"}
        onMouseLeave={e => e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)"}
        >DISCONNECT</button>
      </header>

      {/* Main Split Grid Layout */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "350px 1fr",
        gap: "2rem",
        width: "95%",
        maxWidth: "1600px",
        height: "calc(100vh - 120px)",
        marginTop: "80px",
        zIndex: 2,
        position: "relative"
      }}>
        {/* Left Column: Pulse Orb Visualizer & Chat Stream */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
          height: "100%"
        }}>
          {/* Pulse Orb Glassmorphic Card */}
          <div style={{
            background: "rgba(15, 23, 42, 0.3)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(249, 115, 22, 0.15)",
            borderRadius: "20px",
            padding: "2rem",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            height: "50%",
            justifyContent: "space-between",
            boxShadow: "0 20px 40px rgba(0,0,0,0.3)"
          }}>
            <div style={{ textAlign: "center" }}>
              <span style={{ fontSize: "0.6rem", background: "rgba(249, 115, 22, 0.1)", color: "#f97316", padding: "4px 10px", borderRadius: "99px", fontWeight: "800", letterSpacing: "1px" }}>
                VOICE SYNC FEEDBACK
              </span>
              <h4 style={{ fontSize: "0.95rem", fontWeight: "800", color: "#f1f5f9", marginTop: "8px" }}>Orchestrator Radar</h4>
            </div>

            <div style={{ width: "200px", height: "200px" }}>
              <RadarVisualizer active={remoteParticipants.length > 0} amplitude={amplitude} />
            </div>

            <div style={{ textAlign: "center" }}>
              <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}>
                {remoteParticipants.length > 0 ? (agentState === "speaking" ? "Agent speaking..." : "Listening...") : "Connecting to swarm..."}
              </span>
            </div>
          </div>

          {/* Live Conversation Subtitles Box */}
          <div style={{
            background: "rgba(15, 23, 42, 0.4)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(249, 115, 22, 0.15)",
            borderRadius: "20px",
            padding: "1.5rem",
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
            position: "relative",
            overflow: "hidden"
          }}>
            <div style={{ 
              position: "absolute", top: "12px", left: "16px", 
              fontSize: "0.55rem", fontWeight: "900", color: "#f97316", letterSpacing: "1.5px" 
            }}>
              REAL-TIME TRANSCRIBER
            </div>
            
            <div style={{
              color: transcription ? "#f97316" : "rgba(255,255,255,0.25)",
              fontSize: "1.1rem",
              fontWeight: "600",
              textAlign: "center",
              lineHeight: "1.5",
              maxHeight: "180px",
              overflowY: "auto",
              padding: "0 10px",
              textShadow: transcription ? "0 0 15px rgba(249, 115, 22, 0.4)" : "none",
              transition: "all 0.3s ease"
            }}>
              {transcription || "Awaiting voice or text query..."}
            </div>
          </div>
        </div>

        {/* Right Column: Premium Metric Tab panels */}
        <div style={{
          background: "rgba(15, 23, 42, 0.25)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(249, 115, 22, 0.15)",
          borderRadius: "24px",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          boxShadow: "0 30px 60px rgba(0,0,0,0.4)",
          overflow: "hidden"
        }}>
          {/* Navigation Tabs */}
          <div style={{
            display: "flex",
            background: "rgba(15, 23, 42, 0.6)",
            borderBottom: "1px solid rgba(249, 115, 22, 0.15)",
            padding: "0.5rem 1rem",
            gap: "0.5rem"
          }}>
            {[
              { id: "telemetry", label: "📊 Funnel Telemetry" },
              { id: "seo", label: "🔍 SEO Opportunities" },
              { id: "anomalies", label: "⚠️ Anomaly Center" },
              { id: "report", label: "✍️ Executive Report" }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: activeTab === tab.id ? "rgba(249, 115, 22, 0.15)" : "transparent",
                  color: activeTab === tab.id ? "#fb923c" : "#94a3b8",
                  border: activeTab === tab.id ? "1px solid rgba(249, 115, 22, 0.3)" : "1px solid transparent",
                  padding: "0.6rem 1.2rem",
                  borderRadius: "8px",
                  fontSize: "0.85rem",
                  fontWeight: "700",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Panel Contents */}
          <div style={{ flex: 1, padding: "2rem", overflowY: "auto" }}>
            <AnimatePresence mode="wait">
              {activeTab === "telemetry" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  style={{ display: "flex", flexDirection: "column", gap: "2rem" }}
                >
                  <div>
                    <h3 style={{ fontSize: "1.2rem", fontWeight: "800", color: "#f8fafc", margin: 0 }}>Funnel Performance Matrix</h3>
                    <p style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "4px" }}>Active comparison showing Current vs. Previous 30 days website traffic channels and KPIs.</p>
                  </div>

                  {/* Visual Bar Graphs Grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" }}>
                    {[
                      { title: "GA4 Sessions", value: analyticsData.summary.ga.sessions.curr, prev: analyticsData.summary.ga.sessions.prev, change: analyticsData.summary.ga.sessions.change, unit: "", color: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)" },
                      { title: "GA4 Conversions", value: analyticsData.summary.ga.conversions.curr, prev: analyticsData.summary.ga.conversions.prev, change: analyticsData.summary.ga.conversions.change, unit: "", color: "linear-gradient(135deg, #10b981 0%, #059669 100%)" },
                      { title: "GSC Clicks", value: analyticsData.summary.gsc.clicks.curr, prev: analyticsData.summary.gsc.clicks.prev, change: analyticsData.summary.gsc.clicks.change, unit: "", color: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)" },
                      { title: "GSC Average CTR", value: analyticsData.summary.gsc.ctr.curr * 100, prev: analyticsData.summary.gsc.ctr.prev * 100, change: analyticsData.summary.gsc.ctr.change, unit: "%", color: "linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)" }
                    ].map((chart, idx) => {
                      const maxVal = Math.max(chart.value, chart.prev, 1);
                      const barCurrWidth = (chart.value / maxVal) * 100;
                      const barPrevWidth = (chart.prev / maxVal) * 100;
                      return (
                        <div key={idx} style={{
                          background: "rgba(15, 23, 42, 0.3)",
                          border: "1px solid rgba(255, 255, 255, 0.05)",
                          padding: "1.5rem",
                          borderRadius: "16px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "1rem"
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "0.85rem", fontWeight: "700", color: "#e2e8f0" }}>{chart.title}</span>
                            <span style={{ 
                              fontSize: "0.75rem", fontWeight: "800", 
                              color: chart.change < 0 ? "#ef4444" : "#10b981" 
                            }}>
                              {chart.change.toFixed(1)}%
                            </span>
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                            {/* Current Bar */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "#94a3b8" }}>
                                <span>Current</span>
                                <span style={{ fontWeight: "700" }}>{chart.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}{chart.unit}</span>
                              </div>
                              <div style={{ width: "100%", height: "8px", background: "rgba(255, 255, 255, 0.05)", borderRadius: "4px", overflow: "hidden" }}>
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${barCurrWidth}%` }}
                                  transition={{ duration: 0.8, delay: idx * 0.1 }}
                                  style={{ height: "100%", background: chart.color, borderRadius: "4px" }}
                                />
                              </div>
                            </div>
                            {/* Previous Bar */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "#64748b" }}>
                                <span>Previous</span>
                                <span>{chart.prev.toLocaleString(undefined, { maximumFractionDigits: 2 })}{chart.unit}</span>
                              </div>
                              <div style={{ width: "100%", height: "8px", background: "rgba(255, 255, 255, 0.05)", borderRadius: "4px", overflow: "hidden" }}>
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${barPrevWidth}%` }}
                                  transition={{ duration: 0.8, delay: idx * 0.1 + 0.2 }}
                                  style={{ height: "100%", background: "rgba(255, 255, 255, 0.15)", borderRadius: "4px" }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* General Overview Table */}
                  <div style={{
                    background: "rgba(15, 23, 42, 0.3)",
                    border: "1px solid rgba(255, 255, 255, 0.05)",
                    borderRadius: "16px",
                    padding: "1.5rem",
                    overflowX: "auto"
                  }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.1)", color: "#94a3b8", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px" }}>
                          <th style={{ padding: "12px" }}>Channel Group</th>
                          <th style={{ padding: "12px" }}>GA4 Current Sessions</th>
                          <th style={{ padding: "12px" }}>Current Conversions</th>
                          <th style={{ padding: "12px" }}>Conversion Rate</th>
                          <th style={{ padding: "12px" }}>Previous Sessions</th>
                        </tr>
                      </thead>
                      <tbody style={{ fontSize: "0.85rem", color: "#cbd5e1" }}>
                        {[
                          { channel: "Organic Search", sessions: 6800, convs: 150, prev: 9200 },
                          { channel: "Direct Traffic", sessions: 4200, convs: 200, prev: 5000 },
                          { channel: "Paid Search", sessions: 3100, convs: 90, prev: 4000 },
                          { channel: "Social Media", sessions: 1800, convs: 30, prev: 2100 }
                        ].map((row, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                            <td style={{ padding: "12px", fontWeight: "700" }}>{row.channel}</td>
                            <td style={{ padding: "12px" }}>{row.sessions.toLocaleString()}</td>
                            <td style={{ padding: "12px" }}>{row.convs}</td>
                            <td style={{ padding: "12px", color: "#f97316", fontWeight: "700" }}>{((row.convs / row.sessions) * 100).toFixed(2)}%</td>
                            <td style={{ padding: "12px", color: "rgba(255,255,255,0.4)" }}>{row.prev.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}

              {activeTab === "seo" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  style={{ display: "flex", flexDirection: "column", gap: "2rem" }}
                >
                  <div>
                    <h3 style={{ fontSize: "1.2rem", fontWeight: "800", color: "#f8fafc", margin: 0 }}>GSC SEO Growth Pipeline</h3>
                    <p style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "4px" }}>Surfaces search terms with strong click/impression leverage or ranking slip vulnerabilities.</p>
                  </div>

                  {/* SEO Opportunity Tables */}
                  <div style={{
                    background: "rgba(15, 23, 42, 0.3)",
                    border: "1px solid rgba(255, 255, 255, 0.05)",
                    borderRadius: "16px",
                    padding: "1.5rem",
                    overflowX: "auto"
                  }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.1)", color: "#94a3b8", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px" }}>
                          <th style={{ padding: "12px" }}>Target Query</th>
                          <th style={{ padding: "12px" }}>Impressions</th>
                          <th style={{ padding: "12px" }}>Clicks</th>
                          <th style={{ padding: "12px" }}>Organic CTR</th>
                          <th style={{ padding: "12px" }}>Average Position</th>
                          <th style={{ padding: "12px" }}>Category / Recommendation</th>
                        </tr>
                      </thead>
                      <tbody style={{ fontSize: "0.85rem", color: "#cbd5e1" }}>
                        {analyticsData.opportunities.map((opp, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                            <td style={{ padding: "12px", fontWeight: "700", color: "#fff" }}>`{opp.query}`</td>
                            <td style={{ padding: "12px" }}>{opp.impressions.toLocaleString()}</td>
                            <td style={{ padding: "12px" }}>{opp.clicks}</td>
                            <td style={{ padding: "12px", color: "#ef4444" }}>{opp.ctr}</td>
                            <td style={{ padding: "12px", fontWeight: "700", color: "#fb923c" }}>{opp.position.toFixed(1)}</td>
                            <td style={{ padding: "12px" }}>
                              <span style={{ 
                                display: "block", fontSize: "0.7rem", color: "#fb923c", 
                                background: "rgba(249, 115, 22, 0.1)", padding: "2px 8px", borderRadius: "4px",
                                width: "fit-content", fontWeight: "900", marginBottom: "4px"
                              }}>
                                {opp.type}
                              </span>
                              <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{opp.recommendation}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Correlations Card */}
                  <div style={{
                    background: "rgba(249, 115, 22, 0.03)",
                    border: "1px solid rgba(249, 115, 22, 0.2)",
                    borderRadius: "16px",
                    padding: "1.5rem"
                  }}>
                    <h4 style={{ color: "#fb923c", fontWeight: "800", fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "8px", margin: "0 0 10px 0" }}>
                      <span>🔗</span> SEO & Behavioral Correlation Audit
                    </h4>
                    {analyticsData.correlations.map((corr, ci) => (
                      <div key={ci} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <div style={{ fontWeight: "700", fontSize: "0.85rem", color: "#fff" }}>{corr.title}</div>
                        <div style={{ fontSize: "0.8rem", color: "#cbd5e1" }}><span style={{ color: "#94a3b8" }}>Finding:</span> {corr.finding}</div>
                        <div style={{ fontSize: "0.8rem", color: "#cbd5e1" }}><span style={{ color: "#94a3b8" }}>Analysis:</span> {corr.analysis}</div>
                        <div style={{ fontSize: "0.8rem", color: "#fb923c", fontWeight: "700", marginTop: "4px" }}><span style={{ color: "#94a3b8" }}>Recommended Fix:</span> {corr.action}</div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {activeTab === "anomalies" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
                >
                  <div>
                    <h3 style={{ fontSize: "1.2rem", fontWeight: "800", color: "#f8fafc", margin: 0 }}>Funnel Anomalies & Critical Triggers</h3>
                    <p style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "4px" }}>Strict threshold monitor flags deviations in traffic ({'>'}20%), bounce rates ({'>'}15%), and organic ranks.</p>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
                    {analyticsData.anomalies.map((anom, i) => {
                      const isCritical = anom.severity === "CRITICAL";
                      const borderCol = isCritical ? "rgba(239, 68, 68, 0.3)" : "rgba(245, 158, 11, 0.3)";
                      const badgeBg = isCritical ? "rgba(239, 68, 68, 0.15)" : "rgba(245, 158, 11, 0.15)";
                      const badgeText = isCritical ? "#f87171" : "#fbbf24";
                      return (
                        <div key={i} style={{
                          background: "rgba(15, 23, 42, 0.3)",
                          border: `1px solid ${borderCol}`,
                          borderRadius: "16px",
                          padding: "1.5rem",
                          position: "relative"
                        }}>
                          {/* Severity Badge */}
                          <span style={{
                            position: "absolute", top: "1.5rem", right: "1.5rem",
                            fontSize: "0.65rem", fontWeight: "900", background: badgeBg, color: badgeText,
                            padding: "4px 12px", borderRadius: "99px", letterSpacing: "0.5px"
                          }}>
                            {anom.severity}
                          </span>

                          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", maxWidth: "80%" }}>
                            <h4 style={{ color: "#fff", fontSize: "1rem", fontWeight: "800", margin: 0 }}>
                              {anom.metric} <span style={{ color: badgeText }}>{anom.change}</span>
                            </h4>
                            <p style={{ fontSize: "0.8rem", color: "#cbd5e1", margin: 0 }}>
                              <span style={{ color: "#94a3b8", fontWeight: "700" }}>Probable Cause: </span> 
                              {anom.probable_cause}
                            </p>
                            <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: 0 }}>
                              <span style={{ fontWeight: "700" }}>Affected Paths: </span> 
                              {anom.affected_pages.join(", ")}
                            </p>
                            <div style={{ 
                              marginTop: "8px", padding: "8px 12px", background: "rgba(255, 255, 255, 0.02)",
                              borderLeft: `2.5px solid ${badgeText}`, borderRadius: "0 6px 6px 0",
                              fontSize: "0.8rem", color: badgeText, fontWeight: "700"
                            }}>
                              Fix: {anom.recommended_action}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {activeTab === "report" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <h3 style={{ fontSize: "1.2rem", fontWeight: "800", color: "#f8fafc", margin: 0 }}>Strategic Marketing Report</h3>
                      <p style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "4px" }}>Structured digital marketing analysis generated by MarTech Analytics agent.</p>
                    </div>
                  </div>

                  <div style={{
                    background: "rgba(15, 23, 42, 0.4)",
                    border: "1px solid rgba(249, 115, 22, 0.15)",
                    borderRadius: "16px",
                    padding: "2.5rem",
                    boxShadow: "inset 0 0 20px rgba(0,0,0,0.5)"
                  }}>
                    {parseMarkdown(reportMarkdown)}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <RoomAudioRenderer />
    </div>
  );
}

const MartechRoom = memo(function MartechRoom({ roomData, onLeave }) {
  const serverUrl = import.meta.env.VITE_LIVEKIT_URL || "";
  return (
    <LiveKitRoom audio={true} video={false} token={roomData.token} serverUrl={serverUrl} onDisconnected={onLeave}>
      <MartechScene onLeave={onLeave} />
      <CostGuardAlert />
      </LiveKitRoom>
  );
});

export default MartechRoom;
