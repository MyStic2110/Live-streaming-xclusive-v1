import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { setupPageAEO, cleanupPageAEO } from "../utils/aeo";
import Footer from "./Footer";

// ─── Design Tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:       "#07090f",
  bgCard:   "#0d1117",
  bgPanel:  "#111827",
  border:   "rgba(255,255,255,0.06)",
  borderHi: "rgba(99,102,241,0.45)",
  accent:   "#6366f1",
  accentB:  "#4f46e5",
  green:    "#22c55e",
  rose:     "#f43f5e",
  amber:    "#f59e0b",
  sky:      "#0ea5e9",
  text:     "#f1f5f9",
  muted:    "#64748b",
  muted2:   "#94a3b8",
};

// ─── Video Data ─────────────────────────────────────────────────────────────────
const SHORTS = [
  {
    id: 1,
    title: "Launch AI Teams in Minutes",
    desc: "See how Swarm Agentic Lab deploys a full multi-agent team — memory, tools, voice and orchestration — in minutes, not months.",
    tag: "FUNDAMENTALS",
    color: C.amber,
    borderColor: "rgba(245,158,11,0.55)",
    videoSrc: "/shorts/Launch_AI_teams_in_minutes_202605291710.mp4",
    thumbnail: null,
    duration: "10s",
  },
  {
    id: 4,
    title: "Swarm Agentic Lab — Full Promo",
    desc: "The complete Swarm Agentic Lab story: what we build, who we build it for, and why decentralized AI fleets are the future of enterprise automation.",
    tag: "PROMO",
    color: "#a855f7",
    borderColor: "rgba(168,85,247,0.55)",
    videoSrc: "/shorts/Swarm_Agentic_Lab_promotion_202605291713.mp4",
    thumbnail: null,
    duration: "10s",
  },
  {
    id: 5,
    title: "SaaS Learns to Talk",
    desc: "Adding voice AI capabilities to traditional SaaS.",
    tag: "VOICE AI",
    color: C.sky,
    borderColor: "rgba(14,165,233,0.55)",
    videoSrc: "/shorts/SaaS_learns_to_talk_202605300025.mp4",
    thumbnail: null,
    duration: "10s",
  },
  {
    id: 6,
    title: "Building Agent Swarms",
    desc: "A deep dive into how Swarm Agentic Lab architects and orchestrates massive agent swarms for complex automation.",
    tag: "ARCHITECTURE",
    color: "#ec4899",
    borderColor: "rgba(236,72,153,0.55)",
    videoSrc: "/shorts/Agentic_Lab_building_agent_swarms_202605301700.mp4",
    thumbnail: null,
    duration: "10s",
  },
  {
    id: 7,
    title: "Instant AI Answers",
    desc: "Watch as AI agents process natural language queries and provide instant, accurate answers using real-time data.",
    tag: "DEMO",
    color: "#22c55e",
    borderColor: "rgba(34,197,94,0.55)",
    videoSrc: "/shorts/AI_agents_answer_questions_instantly.mp4",
    thumbnail: null,
    duration: "10s",
  },
  {
    id: 8,
    title: "Autonomous Content Creation",
    desc: "See how specialized AI agents autonomously research, draft, and publish high-converting blog posts.",
    tag: "CONTENT",
    color: "#eab308",
    borderColor: "rgba(234,179,8,0.55)",
    videoSrc: "/shorts/AI_agents_create_blog_and_202605301719.mp4",
    thumbnail: null,
    duration: "10s",
  },
  {
    id: 9,
    title: "Lina AI: Contextual Voice",
    desc: "Meet Lina AI, a voice companion that remembers past conversations and builds persistent context across sessions.",
    tag: "VOICE AI",
    color: "#3b82f6",
    borderColor: "rgba(59,130,246,0.55)",
    videoSrc: "/shorts/Lina_AI_voice_companion_remembers_202605301720.mp4",
    thumbnail: null,
    duration: "10s",
  },
  {
    id: 10,
    title: "Agents Research, Investor Decides",
    desc: "A powerful workflow where autonomous agents execute extensive market research while the human simply makes the final decision.",
    tag: "FINANCE",
    color: "#8b5cf6",
    borderColor: "rgba(139,92,246,0.55)",
    videoSrc: "/shorts/Agents_research,_investor_decides_202605301747.mp4",
    thumbnail: null,
    duration: "10s",
  },
  {
    id: 11,
    title: "Autonomous End-to-End Publishing",
    desc: "Watch a fully autonomous pipeline where AI agents write, edit, format, and seamlessly publish articles without human intervention.",
    tag: "MEDIA",
    color: "#f97316",
    borderColor: "rgba(249,115,22,0.55)",
    videoSrc: "/shorts/Autonomous_agents_create_and_publish.mp4",
    thumbnail: null,
    duration: "10s",
  }
];

// ─── Sub-components ─────────────────────────────────────────────────────────────

function DurationPill({ dur, color }) {
  return (
    <span style={{
      background: `${color}22`,
      border: `1px solid ${color}44`,
      color,
      padding: "3px 10px",
      borderRadius: "99px",
      fontSize: "0.7rem",
      fontWeight: "900",
      letterSpacing: "0.5px",
    }}>
      ▶ {dur}
    </span>
  );
}

function TagPill({ tag, color }) {
  return (
    <span style={{
      fontSize: "0.58rem",
      fontWeight: "900",
      color,
      letterSpacing: "1.5px",
      background: `${color}14`,
      border: `1px solid ${color}25`,
      padding: "3px 10px",
      borderRadius: "4px",
    }}>
      {tag}
    </span>
  );
}

function VideoCard({ short, index, onPlay }) {
  const [hovered, setHovered] = useState(false);
  const videoRef = useRef(null);
  const hasThumbnail = !!short.thumbnail;

  useEffect(() => {
    if (!videoRef.current) return;
    if (hovered) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [hovered]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.5, ease: "easeOut" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onPlay(short)}
      style={{
        width: "clamp(320px, 42vw, 540px)",
        borderRadius: "20px",
        border: `2px solid ${hovered ? short.borderColor : "rgba(255,255,255,0.06)"}`,
        boxShadow: hovered
          ? `0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px ${short.borderColor}`
          : "0 6px 30px rgba(0,0,0,0.6)",
        cursor: "pointer",
        overflow: "hidden",
        transition: "all 0.4s cubic-bezier(0.23,1,0.32,1)",
        transform: hovered ? "translateY(-10px) scale(1.025)" : "translateY(0) scale(1)",
        background: "#000",
        flexShrink: 0,
      }}
    >
      {/* 16:9 Video container */}
      <div style={{ position: "relative", paddingTop: "56.25%" }}>

        {/* Video preview */}
        <video
          ref={videoRef}
          src={short.videoSrc}
          muted
          loop
          playsInline
          preload="metadata"
          poster={short.thumbnail || undefined}
          style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%",
            objectFit: "cover",
            opacity: hovered ? 1 : 0.85,
            transition: "opacity 0.5s",
          }}
        />

        {/* Gradient overlay */}
        <div style={{
          position: "absolute", inset: 0,
          background: hovered
            ? "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)"
            : "linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 70%)",
          transition: "background 0.4s",
        }} />

        {/* Coloured accent line at bottom of video */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          height: "3px",
          background: `linear-gradient(90deg, ${short.color}, transparent)`,
          opacity: hovered ? 1 : 0.4,
          transition: "opacity 0.4s",
        }} />

        {/* Centre play button — only on hover */}
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.18 }}
              style={{
                position: "absolute",
                top: "50%", left: "50%",
                transform: "translate(-50%, -50%)",
                width: "64px", height: "64px",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.95)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "1.5rem", color: "#111", fontWeight: "900",
                boxShadow: `0 0 0 12px ${short.color}22, 0 12px 40px rgba(0,0,0,0.5)`,
              }}
            >
              ▶
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top-left: tag label */}
        <div style={{
          position: "absolute", top: "0.75rem", left: "0.75rem",
        }}>
          <TagPill tag={short.tag} color={short.color} />
        </div>

        {/* Top-right: 10s badge */}
        <div style={{
          position: "absolute", top: "0.75rem", right: "0.75rem",
          background: "rgba(0,0,0,0.65)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.12)",
          color: "rgba(255,255,255,0.85)",
          fontSize: "0.65rem", fontWeight: "800",
          padding: "3px 9px", borderRadius: "99px",
          letterSpacing: "0.5px",
        }}>
          ▶ {short.duration || "10s"}
        </div>
      </div>

      {/* Caption bar — since videos have no subtitles */}
      <div style={{
        padding: "1rem 1.25rem 1.1rem",
        background: "#0d1117",
        borderTop: `1px solid rgba(255,255,255,0.05)`,
        transform: hovered ? "translateY(0)" : "translateY(2px)",
        transition: "transform 0.3s",
      }}>
        <h3 style={{
          color: "#fff",
          fontSize: "0.98rem",
          fontWeight: "800",
          lineHeight: "1.3",
          marginBottom: "0.35rem",
          letterSpacing: "-0.1px",
        }}>
          {short.title}
        </h3>
        <p style={{
          color: "#64748b",
          fontSize: "0.78rem",
          lineHeight: "1.5",
          margin: 0,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>
          {short.desc}
        </p>
        <div style={{
          marginTop: "0.65rem",
          display: "flex", alignItems: "center", gap: "8px",
        }}>
          <span style={{
            fontSize: "0.62rem", fontWeight: "700",
            color: "#f59e0b", letterSpacing: "1px",
            background: "rgba(245,158,11,0.1)",
            border: "1px solid rgba(245,158,11,0.2)",
            padding: "2px 8px", borderRadius: "4px",
          }}>
            🔇 SOUND OFF FRIENDLY
          </span>
          <span style={{
            fontSize: "0.62rem", color: "#475569", fontWeight: "600",
          }}>
            Click to watch with audio
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────────
export default function SwarmShortsPage({ onBack }) {
  const [activeVideo, setActiveVideo] = useState(null);
  const [legalModalType, setLegalModalType] = useState(null);

  useEffect(() => {
    // Generate VideoObject schemas for all shorts
    const videoSchemas = SHORTS.map(short => ({
      "@context": "https://schema.org",
      "@type": "VideoObject",
      "name": short.title,
      "description": short.desc,
      "uploadDate": "2026-05-29T17:00:00Z", // Replace with real date if available
      "contentUrl": `https://yourdomain.com${short.videoSrc}`,
      "thumbnailUrl": short.thumbnail ? `https://yourdomain.com${short.thumbnail}` : "https://yourdomain.com/logo.jpeg"
    }));

    setupPageAEO({
      title: "Swarm AI Shorts | Learn Agentic Lab in 60s",
      description: "Watch bite-sized 60-second video shorts on how to deploy Swarm Agentic Lab for enterprise automation.",
      keywords: ["Swarm AI Shorts", "AI Agent Videos", "Swarm Agentic Lab Tutorials", "decentralized AI demos"],
      url: "https://yourdomain.com/learn",
      schemaId: "shorts-aeo",
      schemaData: videoSchemas
    });

    return () => cleanupPageAEO("shorts-aeo");
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      background: C.bg,
      fontFamily: "'Outfit', sans-serif",
      color: C.text,
    }}>
      {/* ── Sticky Nav ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 200,
        padding: "1.1rem 5%",
        display: "flex", alignItems: "center", gap: "1.5rem",
        background: "rgba(7,9,15,0.85)",
        backdropFilter: "blur(18px)",
        borderBottom: `1px solid ${C.border}`,
      }}>
        <button
          onClick={onBack}
          style={{
            display: "flex", alignItems: "center", gap: "8px",
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${C.border}`,
            color: C.muted2, padding: "8px 18px", borderRadius: "10px",
            cursor: "pointer", fontSize: "0.85rem", fontWeight: "700",
            transition: "all 0.2s",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = C.accentB; e.currentTarget.style.color = C.text; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border;  e.currentTarget.style.color = C.muted2; }}
        >
          ← Back to Swarm
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <img src="/logo.jpeg" alt="Swarm" style={{ height: "30px", width: "30px", borderRadius: "7px", objectFit: "cover" }} />
          <span style={{ fontSize: "1rem", fontWeight: "900", letterSpacing: "2px" }}>
            SWARM <span style={{ color: C.accent }}>AGENTIC LAB</span>
          </span>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{
            width: "8px", height: "8px", borderRadius: "50%",
            background: C.green, display: "inline-block",
            boxShadow: `0 0 8px ${C.green}`,
          }} />
          <span style={{ fontSize: "0.75rem", fontWeight: "700", color: C.green, letterSpacing: "1px" }}>
            LIVE · {SHORTS.length} SHORTS
          </span>
        </div>
      </nav>

      {/* ── Hero Header ── */}
      <div style={{ padding: "5rem 5% 3.5rem", maxWidth: "1400px", margin: "0 auto" }}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
        >
          {/* Eyebrow */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            padding: "6px 18px",
            background: "rgba(99,102,241,0.1)",
            border: "1px solid rgba(99,102,241,0.25)",
            borderRadius: "99px",
            fontSize: "0.7rem", fontWeight: "900", color: C.accent,
            letterSpacing: "2px", marginBottom: "1.75rem",
          }}>
            🚀 LEARN SWARM AI IN 60 SECONDS
          </div>

          <h1 style={{
            fontSize: "clamp(2.4rem, 5vw, 4rem)",
            fontWeight: "900", lineHeight: "1.08",
            letterSpacing: "-2px", marginBottom: "1.5rem",
            background: "linear-gradient(135deg, #f1f5f9 0%, #94a3b8 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>
            Watch Swarm AI<br />in 60 Seconds
          </h1>

          <p style={{
            fontSize: "1.15rem", color: C.muted2,
            lineHeight: "1.7", maxWidth: "620px", marginBottom: "3rem",
          }}>
            Bite-sized explainers, architecture breakdowns, and real-world agent demos
            from our AI experts — each under a minute.
          </p>

          {/* Cards */}
          <div style={{
            display: "flex",
            gap: "2rem",
            justifyContent: "center",
            flexWrap: "wrap",
            paddingBottom: "2rem",
          }}>
            {SHORTS.map((short, i) => (
              <VideoCard key={short.id} short={short} index={i} onPlay={setActiveVideo} />
            ))}
          </div>
        </motion.div>
      </div>

      {/* ── Conversion CTA Strip ── */}
      <section style={{
        padding: "5rem 5%",
        background: "linear-gradient(135deg, #0d1117 0%, #0e0f1a 100%)",
        borderTop: `1px solid ${C.border}`,
        borderBottom: `1px solid ${C.border}`,
        textAlign: "center",
        margin: "2rem 0",
      }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div style={{
            display: "inline-block", padding: "6px 18px",
            background: "rgba(34,197,94,0.1)",
            border: "1px solid rgba(34,197,94,0.25)",
            borderRadius: "99px",
            fontSize: "0.7rem", fontWeight: "900", color: C.green,
            letterSpacing: "2px", marginBottom: "1.75rem",
          }}>
            ⚡ READY TO DEPLOY YOUR SWARM?
          </div>
          <h2 style={{
            fontSize: "clamp(1.8rem, 4vw, 3rem)",
            fontWeight: "900", letterSpacing: "-1.5px",
            lineHeight: "1.1", marginBottom: "1.25rem",
          }}>
            Ready to build your own swarm?
          </h2>
          <p style={{
            fontSize: "1.1rem", color: C.muted2,
            lineHeight: "1.65", maxWidth: "560px",
            margin: "0 auto 2.5rem",
          }}>
            Deploy AI agents with memory, tools, voice, observability and orchestration.
            Zero cloud API fees. Absolute privacy.
          </p>

          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={onBack}
              style={{
                padding: "1rem 2.5rem",
                background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                color: "white", border: "none", borderRadius: "14px",
                fontWeight: "900", fontSize: "1rem", cursor: "pointer",
                boxShadow: "0 8px 30px rgba(99,102,241,0.35)",
                transition: "all 0.25s",
                letterSpacing: "0.5px",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 14px 40px rgba(99,102,241,0.5)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)";    e.currentTarget.style.boxShadow = "0 8px 30px rgba(99,102,241,0.35)"; }}
            >
              Start Building →
            </button>
            <a
              href="https://wa.me/919791388549?text=Hi%20swarm%20agents%2C%20I%27d%20like%20to%20discuss%20a%20project."
              target="_blank" rel="noopener noreferrer"
              style={{
                padding: "1rem 2.5rem",
                background: "rgba(255,255,255,0.05)",
                color: C.text, border: `1px solid ${C.border}`,
                borderRadius: "14px", fontWeight: "800",
                fontSize: "1rem", cursor: "pointer",
                textDecoration: "none",
                transition: "all 0.25s",
                display: "inline-block",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.background = "rgba(99,102,241,0.08)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border;  e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
            >
              💬 Chat with an Expert
            </a>
          </div>
        </motion.div>
      </section>



      {/* ── Footer ── */}
      <Footer onShortsClick={() => {}} onLegalClick={setLegalModalType} />

      {/* ── Video Lightbox Modal ── */}
      <AnimatePresence>
        {activeVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActiveVideo(null)}
            style={{
              position: "fixed", inset: 0, zIndex: 999,
              background: "rgba(0,0,0,0.92)",
              backdropFilter: "blur(24px)",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "1.5rem",
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 30 }}
              transition={{ type: "spring", damping: 24, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              style={{
                width: "100%",
                maxWidth: activeVideo.videoSrc ? "780px" : "500px",
                background: activeVideo.gradient,
                border: `1px solid ${activeVideo.borderColor}`,
                borderRadius: "28px",
                overflow: "hidden",
                position: "relative",
                boxShadow: `0 40px 120px ${activeVideo.color}30`,
              }}
            >
              {/* Close button */}
              <button
                onClick={() => setActiveVideo(null)}
                style={{
                  position: "absolute", top: "1rem", right: "1rem", zIndex: 10,
                  width: "36px", height: "36px", borderRadius: "50%",
                  background: "rgba(0,0,0,0.55)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "white", fontSize: "1.1rem",
                  cursor: "pointer", display: "flex",
                  alignItems: "center", justifyContent: "center",
                  transition: "all 0.2s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.8)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(0,0,0,0.55)"}
              >
                ×
              </button>

              {/* ── REAL VIDEO PLAYER ── */}
              {activeVideo.videoSrc ? (
                <>
                  <video
                    src={activeVideo.videoSrc}
                    controls
                    autoPlay
                    style={{
                      width: "100%",
                      maxHeight: "70vh",
                      display: "block",
                      background: "#000",
                      borderRadius: "0",
                    }}
                  />
                  <div style={{ padding: "1.5rem" }}>
                    <div style={{ display: "flex", gap: "8px", marginBottom: "0.75rem" }}>
                      <TagPill tag={activeVideo.tag} color={activeVideo.color} />
                      <DurationPill dur={activeVideo.duration} color={activeVideo.color} />
                    </div>
                    <h2 style={{
                      color: C.text, fontSize: "1.2rem", fontWeight: "900",
                      lineHeight: "1.3", marginBottom: "0.5rem",
                    }}>
                      {activeVideo.title}
                    </h2>
                    <p style={{ color: C.muted2, fontSize: "0.85rem", lineHeight: "1.6", margin: 0 }}>
                      {activeVideo.desc}
                    </p>
                  </div>
                </>
              ) : (
                /* ── COMING SOON / NOTIFY ME ── */
                <div style={{ padding: "2.5rem" }}>
                  <div style={{ display: "flex", gap: "8px", marginBottom: "1.5rem" }}>
                    <TagPill tag={activeVideo.tag} color={activeVideo.color} />
                    <DurationPill dur={activeVideo.duration} color={activeVideo.color} />
                  </div>

                  <div style={{
                    width: "72px", height: "72px", borderRadius: "18px",
                    background: `${activeVideo.color}18`,
                    border: `1px solid ${activeVideo.borderColor}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "2.2rem", marginBottom: "1.25rem",
                  }}>
                    {activeVideo.emoji}
                  </div>

                  <h2 style={{
                    color: C.text, fontSize: "1.35rem", fontWeight: "900",
                    lineHeight: "1.3", marginBottom: "0.75rem",
                  }}>
                    {activeVideo.title}
                  </h2>
                  <p style={{ color: C.muted2, fontSize: "0.88rem", lineHeight: "1.65", marginBottom: "1.75rem" }}>
                    {activeVideo.desc}
                  </p>

                  <div style={{
                    padding: "1.25rem",
                    background: "rgba(255,255,255,0.04)",
                    border: `1px dashed ${activeVideo.borderColor}`,
                    borderRadius: "14px",
                    textAlign: "center", marginBottom: "1.25rem",
                  }}>
                    <div style={{ fontSize: "1.4rem", marginBottom: "0.4rem" }}>🎬</div>
                    <div style={{ fontWeight: "800", color: C.text, marginBottom: "0.2rem", fontSize: "0.9rem" }}>
                      Video Coming Soon
                    </div>
                    <div style={{ color: C.muted, fontSize: "0.75rem" }}>
                      Get notified the moment this short goes live.
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      id={`notify-email-${activeVideo.id}`}
                      type="email"
                      placeholder="your@email.com"
                      style={{
                        flex: 1, padding: "11px 14px", borderRadius: "10px",
                        border: `1px solid ${C.border}`,
                        background: "rgba(0,0,0,0.4)",
                        color: C.text, outline: "none",
                        fontSize: "0.85rem", fontFamily: "inherit",
                      }}
                    />
                    <button
                      onClick={() => {
                        const val = document.getElementById(`notify-email-${activeVideo.id}`)?.value;
                        if (val?.includes("@")) {
                          alert(`✅ Noted! We'll ping ${val} when "${activeVideo.title}" drops.`);
                          setActiveVideo(null);
                        } else {
                          alert("Please enter a valid email.");
                        }
                      }}
                      style={{
                        padding: "0 18px",
                        background: `linear-gradient(135deg, ${activeVideo.color}, ${activeVideo.color}bb)`,
                        color: "white", border: "none", borderRadius: "10px",
                        fontWeight: "900", fontSize: "0.82rem", cursor: "pointer",
                        whiteSpace: "nowrap", transition: "all 0.2s",
                      }}
                      onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
                      onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                    >
                      Notify Me
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- LEGAL MODAL --- */}
      <AnimatePresence>
        {legalModalType && (
          <LegalModal 
            type={legalModalType} 
            onClose={() => setLegalModalType(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
