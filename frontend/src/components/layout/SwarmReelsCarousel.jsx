import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { setupPageAEO, cleanupPageAEO } from "../../utils/aeo";
import { Heart, MessageCircle, Share2, Volume2, VolumeX, ArrowLeft } from "lucide-react";

// ─── Design Tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:       "#000000",
  accent:   "#6366f1",
  green:    "#22c55e",
  amber:    "#f59e0b",
  sky:      "#0ea5e9",
  indigo:   "#4f46e5",
  text:     "#ffffff",
  muted:    "rgba(255,255,255,0.7)",
};

// ─── Video Data ─────────────────────────────────────────────────────────────────
const SHORTS = [
  {
    id: 14,
    title: "AI Spending Trends",
    desc: "A female presenter breaks down the latest trends and shifts in global AI spending and infrastructure.",
    tag: "FINANCE",
    color: C.indigo,
    videoSrc: "/shorts/Female_presenter_AI_spending_202606022248.mp4",
  },
  {
    id: 1,
    title: "Launch AI Teams in Minutes",
    desc: "See how Swarm Agentic Lab deploys a full multi-agent team — memory, tools, voice and orchestration — in minutes, not months.",
    tag: "FUNDAMENTALS",
    color: C.amber,
    videoSrc: "/shorts/Launch_AI_teams_in_minutes_202605291710.mp4",
  },
  {
    id: 4,
    title: "Swarm Agentic Lab — Full Promo",
    desc: "The complete Swarm Agentic Lab story: what we build, who we build it for, and why decentralized AI fleets are the future of enterprise automation.",
    tag: "PROMO",
    color: "#a855f7",
    videoSrc: "/shorts/Swarm_Agentic_Lab_promotion_202605291713.mp4",
  },
  {
    id: 5,
    title: "SaaS Learns to Talk",
    desc: "Adding voice AI capabilities to traditional SaaS.",
    tag: "VOICE AI",
    color: C.sky,
    videoSrc: "/shorts/SaaS_learns_to_talk_202605300025.mp4",
  },
  {
    id: 6,
    title: "Building Agent Swarms",
    desc: "A deep dive into how Swarm Agentic Lab architects and orchestrates massive agent swarms for complex automation.",
    tag: "ARCHITECTURE",
    color: "#ec4899",
    videoSrc: "/shorts/Agentic_Lab_building_agent_swarms_202605301700.mp4",
  },
  {
    id: 7,
    title: "Instant AI Answers",
    desc: "Watch as AI agents process natural language queries and provide instant, accurate answers using real-time data.",
    tag: "DEMO",
    color: "#22c55e",
    videoSrc: "/shorts/AI_agents_answer_questions_instantly.mp4",
  },
  {
    id: 8,
    title: "Autonomous Content Creation",
    desc: "See how specialized AI agents autonomously research, draft, and publish high-converting blog posts.",
    tag: "CONTENT",
    color: "#eab308",
    videoSrc: "/shorts/AI_agents_create_blog_and_202605301719.mp4",
  },
  {
    id: 9,
    title: "Lina AI: Contextual Voice",
    desc: "Meet Lina AI, a voice companion that remembers past conversations and builds persistent context across sessions.",
    tag: "VOICE AI",
    color: "#3b82f6",
    videoSrc: "/shorts/Lina_AI_voice_companion_remembers_202605301720.mp4",
  },
  {
    id: 10,
    title: "Agents Research, Investor Decides",
    desc: "A powerful workflow where autonomous agents execute extensive market research while the human simply makes the final decision.",
    tag: "FINANCE",
    color: "#8b5cf6",
    videoSrc: "/shorts/Agents_research,_investor_decides_202605301747.mp4",
  },
  {
    id: 11,
    title: "Autonomous End-to-End Publishing",
    desc: "Watch a fully autonomous pipeline where AI agents write, edit, format, and seamlessly publish articles without human intervention.",
    tag: "MEDIA",
    color: "#f97316",
    videoSrc: "/shorts/Autonomous_agents_create_and_publish.mp4",
  },
  {
    id: 13,
    title: "Robotic Hand Precision",
    desc: "A robotic hand picking up a microchip with extreme precision, showcasing the future of automated hardware manufacturing.",
    tag: "HARDWARE",
    color: "#3b82f6",
    videoSrc: "/shorts/Robotic_hand_picking_microchip_202606011943.mp4",
  }
];

// ─── Shorts Player Component ──────────────────────────────────────────────────
function ShortsPlayer({ short, isActive, isMuted, toggleMute }) {
  const videoRef = useRef(null);
  const blurRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    if (!videoRef.current || !blurRef.current) return;
    
    if (isActive) {
      videoRef.current.currentTime = 0;
      blurRef.current.currentTime = 0;
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      blurRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
      blurRef.current.pause();
      setIsPlaying(false);
    }
  }, [isActive]);

  const handleVideoClick = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      blurRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      blurRef.current.play();
      setIsPlaying(true);
    }
  };

  return (
    <div style={{
      position: "relative",
      width: "100%",
      height: "100%",
      backgroundColor: "#000",
      overflow: "hidden",
      display: "flex",
      justifyContent: "center",
      alignItems: "center"
    }}>
      {/* Cinematic Blur Background */}
      <video
        ref={blurRef}
        src={short.videoSrc}
        muted
        loop
        playsInline
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: "blur(40px) brightness(0.6)",
          transform: "scale(1.1)",
          zIndex: 1
        }}
      />

      {/* Foreground Video */}
      <video
        ref={videoRef}
        src={short.videoSrc}
        muted={isMuted}
        loop
        playsInline
        onClick={handleVideoClick}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          objectFit: "contain",
          zIndex: 2,
          cursor: "pointer"
        }}
      />

      {/* Center Play/Pause indicator overlay */}
      <AnimatePresence>
        {!isPlaying && isActive && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.5 }}
            transition={{ duration: 0.2 }}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 10,
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backdropFilter: "blur(10px)",
              pointerEvents: "none"
            }}
          >
            <div style={{
              width: 0,
              height: 0,
              borderTop: "15px solid transparent",
              borderBottom: "15px solid transparent",
              borderLeft: "25px solid white",
              marginLeft: "10px"
            }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlay: Bottom Info Panel */}
      <div style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: "60px", // leave space for right actions
        padding: "2rem 1.5rem",
        background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)",
        zIndex: 5,
        display: "flex",
        flexDirection: "column",
        gap: "10px"
      }}>

        <h3 style={{ fontSize: "1.1rem", fontWeight: "700", margin: "10px 0 0 0", textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>{short.title}</h3>
        <p style={{ fontSize: "0.95rem", color: "rgba(255,255,255,0.85)", margin: 0, lineHeight: 1.4, textShadow: "0 2px 10px rgba(0,0,0,0.5)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {short.desc}
        </p>
        <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: "700", color: short.color, textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>#{short.tag.toLowerCase()}</span>
          <span style={{ fontSize: "0.85rem", fontWeight: "700", color: C.text, textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>#ai #agentic</span>
        </div>
      </div>

      {/* Overlay: Right Action Bar */}
      <div style={{
        position: "absolute",
        bottom: "2rem",
        right: "1rem",
        zIndex: 10,
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
        alignItems: "center"
      }}>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
          <button style={{ background: "rgba(0,0,0,0.5)", border: "none", color: "white", width: "48px", height: "48px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", backdropFilter: "blur(10px)", transition: "transform 0.2s" }} onMouseEnter={e => e.currentTarget.style.transform = "scale(1.1)"} onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
            <Share2 size={24} />
          </button>
          <span style={{ fontSize: "0.75rem", fontWeight: "700", textShadow: "0 2px 5px rgba(0,0,0,0.5)" }}>Share</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", marginTop: "10px" }}>
          <button onClick={toggleMute} style={{ background: "rgba(0,0,0,0.5)", border: "none", color: "white", width: "48px", height: "48px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", backdropFilter: "blur(10px)", transition: "transform 0.2s" }} onMouseEnter={e => e.currentTarget.style.transform = "scale(1.1)"} onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
            {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
          </button>
        </div>
        
        <img src="/logo.jpeg" alt="Audio" style={{ width: "40px", height: "40px", borderRadius: "8px", border: "2px solid white", marginTop: "10px", animation: isPlaying ? "spin 4s linear infinite" : "none" }} />
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────────
export default function SwarmReelsCarousel({ onBack, customData, customHeader, customTitle }) {
  const containerRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);

  const shortsList = customData || SHORTS;
  const headerTitle = customHeader || "SWARM AGENTIC LAB · AI-GENERATED";
  const subTitle = customTitle || "Reels Gallery";

  useEffect(() => {
    // Generate VideoObject schemas for all shorts
    const videoSchemas = shortsList.map(short => ({
      "@context": "https://schema.org",
      "@type": "VideoObject",
      "name": short.title,
      "description": short.desc || short.title,
      "uploadDate": "2026-05-29T17:00:00Z",
      "contentUrl": `https://yourdomain.com${short.videoSrc}`
    }));

    setupPageAEO({
      title: "Swarm AI Shorts | Reels Gallery",
      description: "Watch bite-sized video shorts on how to deploy Swarm Agentic Lab.",
      keywords: ["Swarm AI Shorts", "AI Agent Videos", "Reels Gallery"],
      url: "https://yourdomain.com/shorts",
      schemaId: "shorts-aeo",
      schemaData: videoSchemas
    });

    return () => cleanupPageAEO("shorts-aeo");
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const index = Number(entry.target.getAttribute('data-index'));
          setActiveIndex(index);
        }
      });
    }, {
      root: containerRef.current,
      rootMargin: "0px -40% 0px -40%", // Triggers only when the video hits the center 20% of the screen
      threshold: 0 
    });

    const elements = document.querySelectorAll('.shorts-item');
    elements.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  const toggleMute = () => setIsMuted(prev => !prev);

  return (
    <div style={{
      width: "100%",
      height: "100vh",
      background: C.bg,
      fontFamily: "'Outfit', sans-serif",
      color: C.text,
      position: "relative"
    }}>
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          /* Hide scrollbar for immersive feel */
          .shorts-container::-webkit-scrollbar {
            display: none;
          }
          .shorts-container {
            -ms-overflow-style: none;  /* IE and Edge */
            scrollbar-width: none;  /* Firefox */
          }
        `}
      </style>

      {/* ── Top Fixed Navigation ── */}
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        padding: "1.5rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 100%)",
        pointerEvents: "none" // Let clicks pass through except on buttons
      }}>
        <button
          onClick={onBack}
          style={{
            pointerEvents: "auto",
            display: "flex", alignItems: "center", gap: "8px",
            background: "rgba(0,0,0,0.4)",
            border: `1px solid rgba(255,255,255,0.2)`,
            backdropFilter: "blur(10px)",
            color: "white", padding: "10px", borderRadius: "50%",
            cursor: "pointer", transition: "all 0.2s"
          }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.6)"}
          onMouseLeave={e => e.currentTarget.style.background = "rgba(0,0,0,0.4)"}
        >
          <ArrowLeft size={24} />
        </button>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: "900", letterSpacing: "2px", color: C.text, textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>
            {headerTitle}
          </span>
          <span style={{ fontSize: "0.9rem", fontWeight: "700", color: C.muted, textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>
            {subTitle} · {shortsList.length} videos
          </span>
        </div>
      </div>

      {/* ── Snapping Scroll Container ── */}
      <div 
        ref={containerRef}
        className="shorts-container"
        style={{
          height: "100vh",
          width: "100vw",
          display: "flex",
          overflowX: "scroll",
          overflowY: "hidden",
          scrollSnapType: "x mandatory",
          scrollBehavior: "smooth",
          padding: "0 calc(50vw - clamp(140px, 37.5vw, 210px) - 10px)", // Perfectly centers the first and last item
          alignItems: "center"
        }}
      >
        {shortsList.map((short, i) => (
          <div 
            key={short.id} 
            className="shorts-item" 
            data-index={i}
            style={{ 
              width: "clamp(280px, 75vw, 420px)", // Tight width so next/prev are visible on desktop
              flexShrink: 0,
              margin: "0 10px", // Slight gap between videos
              height: activeIndex === i ? "90vh" : "70vh", 
              scrollSnapAlign: "center",
              position: "relative",
              transition: "all 0.5s cubic-bezier(0.25, 0.8, 0.25, 1)",
              transform: activeIndex === i ? "scale(1)" : "scale(0.9)",
              filter: activeIndex === i ? "none" : "blur(3px)", // light blur that won't crash GPU
              opacity: activeIndex === i ? 1 : 0.6,
              borderRadius: "24px",
              overflow: "hidden",
              boxShadow: activeIndex === i ? "none" : "0 20px 50px rgba(0,0,0,0.8)",
              cursor: activeIndex === i ? "default" : "pointer"
            }}
            onClick={(e) => {
              if (activeIndex !== i) {
                e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center' });
              }
            }}
          >
            {activeIndex !== i && (
              <div 
                style={{ 
                  position: "absolute", inset: 0, zIndex: 100, 
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(0,0,0,0.3)" // Dimmer instead of heavy blur
                }}
              >
                <div style={{ width: "80px", height: "80px", background: "rgba(0,0,0,0.6)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "1.5rem", border: "2px solid rgba(255,255,255,0.3)", backdropFilter: "blur(10px)", paddingLeft: "5px" }}>▶</div>
              </div>
            )}
            
            {/* PERFORMANCE OPTIMIZATION: Only render video tags if within 2 items of active index */}
            {Math.abs(activeIndex - i) <= 2 ? (
              <ShortsPlayer 
                short={short} 
                isActive={activeIndex === i} 
                isMuted={isMuted}
                toggleMute={toggleMute}
              />
            ) : (
              <div style={{ width: "100%", height: "100%", background: "#111" }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
