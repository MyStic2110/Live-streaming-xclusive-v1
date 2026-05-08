import React, { useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";

const API = import.meta.env.VITE_API_URL || "";

function SwarmNode({ title, icon, color, desc, prompts, btnText, onAction, isActive, onHover }) {
  return (
    <motion.div 
      onMouseEnter={onHover}
      style={{
        position: "relative",
        padding: "2rem",
        background: isActive ? "white" : "rgba(255,255,255,0.4)",
        borderRadius: "24px",
        border: `1px solid ${isActive ? color : "rgba(0,0,0,0.05)"}`,
        cursor: "pointer",
        backdropFilter: "blur(20px)",
        boxShadow: isActive ? `0 20px 40px ${color}15` : "0 4px 6px rgba(0,0,0,0.02)",
        transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        overflow: "hidden",
        width: "100%"
      }}
      whileHover={{ y: -5, boxShadow: `0 20px 40px rgba(0,0,0,0.05)` }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
        <div style={{ 
          width: "50px", height: "50px", borderRadius: "12px", 
          background: `${color}11`, display: "flex", alignItems: "center", 
          justifyContent: "center", fontSize: "1.5rem", border: `1px solid ${color}22`
        }}>
          {icon}
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: "1.3rem", fontWeight: "900", color: isActive ? color : "#111827" }}>{title}</h3>
          <p style={{ margin: 0, fontSize: "0.95rem", color: "#4b5563", marginTop: "8px", lineHeight: "1.6" }}>{desc}</p>
        </div>
      </div>

      <AnimatePresence>
        {isActive && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ marginTop: "2.5rem" }}
          >
            <div style={{ fontSize: "0.75rem", fontWeight: "900", color: color, letterSpacing: "2px", marginBottom: "1.2rem" }}>SUGGESTED COMMANDS</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {prompts.map((p, i) => (
                <div key={i} style={{ 
                  fontSize: "0.85rem", color: "#1f2937", fontWeight: "500",
                  padding: "10px 14px", background: "#f9fafb", borderRadius: "8px",
                  border: "1px solid #e5e7eb"
                }}>
                  {p}
                </div>
              ))}
            </div>
            <button 
              onClick={onAction}
              style={{ 
                marginTop: "2rem", width: "100%", padding: "1rem", 
                background: color, color: "white", border: "none", 
                borderRadius: "12px", fontWeight: "900", cursor: "pointer",
                boxShadow: `0 10px 20px ${color}33`
              }}
            >
              {btnText}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function LiveList({ onJoin }) {
  const [activeAgent, setActiveAgent] = useState("bi");

  const agents = [
    {
      id: "bi", title: "Cortex BI", icon: "📊", color: "#059669",
      desc: "Conversational MySQL analysis and realtime business insights.",
      btnText: "CONSULT CORTEX",
      prompts: [
        "Which drivers had the highest cancellations?", "Compare today’s revenue with yesterday.",
        "Show peak booking hours in Chennai.", "Why did failed rides increase today?",
        "Which zones have lowest availability?", "Summarize performance for this week.",
        "Show top 5 routes by revenue.", "Are cancellations increasing after rain?",
        "Highlight operational anomalies.", "Top users by booking count."
      ]
    },
    {
      id: "vigil", title: "Vigil Auditor", icon: "🛡️", color: "#4f46e5",
      desc: "Professional IR maturity assessment and security audit.",
      btnText: "DEPLOY VIGIL",
      prompts: [
        "Assess IR maturity.", "Identify security gaps.",
        "Audit readiness summary.", "Review access control risks.",
        "Weak compliance areas?", "Ransomware response scenario.",
        "Analyze governance posture.", "Operational vulnerabilities.",
        "Privilege escalation exposure.", "Remediation roadmap."
      ]
    },
    {
      id: "lina", title: "Lina", icon: "✨", color: "#d946ef",
      desc: "Your empathetic companion. Here to listen and support.",
      btnText: "CONNECT LINA",
      prompts: [
        "I’ve had a stressful day.", "Talk to me for a while.",
        "Help me slow my thoughts.", "I’m feeling overwhelmed.",
        "Stay with me while I work.", "Tell me something calming.",
        "Can we just chat?", "I need motivation.",
        "Help me organize thoughts.", "I feel mentally exhausted."
      ]
    },
    {
      id: "weather", title: "Weather Agent", icon: "☁️", color: "#3b82f6",
      desc: "Indian monsoon patterns and regional climate insights.",
      btnText: "DEPLOY WEATHER",
      prompts: [
        "Will monsoon intensity increase?", "Rainfall predictions for Chennai.",
        "Which regions face flooding?", "How will weather affect transport?",
        "Compare patterns with last year.", "Impact on airport operations?",
        "Humidity and storm trends.", "Rainfall alerts per district.",
        "Predict weather disruptions.", "South India climate summary."
      ]
    }
  ];

  const initiateAITalk = async (agentType) => {
    try {
      const res = await axios.post(`${API}/talk-to-ai`, { agentType });
      onJoin({ roomName: res.data.roomName, token: res.data.token, isCreator: false, creatorId: agentType.toUpperCase(), isAI: true });
    } catch (err) {
      alert("AI Assistant is offline");
    }
  };

  return (
    <div style={{ 
      minHeight: "100vh", background: "#f9fafb", color: "#111827", 
      fontFamily: "'Outfit', sans-serif", overflowX: "hidden",
      display: "flex", flexDirection: "column"
    }}>
      {/* Dynamic Background */}
      <div style={{ 
        position: "fixed", inset: 0, zIndex: 0,
        background: `radial-gradient(circle at 80% 20%, ${agents.find(a => a.id === activeAgent).color}08 0%, transparent 40%)`,
        transition: "all 1s ease"
      }} />

      <nav style={{ padding: "2rem 4rem", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 10, background: "white", borderBottom: "1px solid #f3f4f6" }}>
        <div style={{ fontSize: "1.2rem", fontWeight: "900", letterSpacing: "4px", color: "#3b82f6" }}>SWARM <span style={{ color: "#9ca3af", fontSize: "0.7rem", fontWeight: "400" }}>| FUTURE GEN INTEL</span></div>
        <div style={{ color: "#9ca3af", fontSize: "0.7rem", letterSpacing: "2px" }}>4 AGENTS ACTIVE • SYSTEM STABLE</div>
      </nav>

      <main style={{ flex: 1, padding: "4rem", display: "flex", gap: "6rem", zIndex: 10, maxWidth: "1600px", margin: "0 auto", width: "100%" }}>
        {/* Left Side: Massive Text & Intro */}
        <div style={{ flex: 1.2, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <motion.h1 
            key={activeAgent}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            style={{ fontSize: "7rem", fontWeight: "900", lineHeight: "0.85", letterSpacing: "-5px", margin: 0, color: "#111827" }}
          >
            {agents.find(a => a.id === activeAgent).title.split(" ")[0].toUpperCase()}<br/>
            <span style={{ color: "#e5e7eb" }}>FLEET</span>
          </motion.h1>
          <p style={{ fontSize: "1.2rem", color: "#6b7280", maxWidth: "500px", marginTop: "3rem", lineHeight: "1.6" }}>
            Deploy specialized AI agents for analytics, governance, emotional support, and realtime intelligence.
          </p>
          <div style={{ display: "flex", gap: "1rem", marginTop: "4rem" }}>
             <div style={{ padding: "0.6rem 1.2rem", background: "white", border: "1px solid #f3f4f6", borderRadius: "40px", fontSize: "0.7rem", color: "#9ca3af", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>SECURE TLS</div>
             <div style={{ padding: "0.6rem 1.2rem", background: "white", border: "1px solid #f3f4f6", borderRadius: "40px", fontSize: "0.7rem", color: "#9ca3af", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>GPT-4O POWERED</div>
          </div>
        </div>

        {/* Right Side: Interactive Node Stack */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "1.5rem", justifyContent: "center" }}>
          {agents.map(agent => (
            <SwarmNode 
              key={agent.id}
              {...agent}
              isActive={activeAgent === agent.id}
              onHover={() => setActiveAgent(agent.id)}
              onAction={() => initiateAITalk(agent.id)}
            />
          ))}
        </div>
      </main>

      <footer style={{ padding: "2rem 4rem", color: "#d1d5db", fontSize: "0.7rem", letterSpacing: "2px", zIndex: 10, textAlign: "center", borderTop: "1px solid #f3f4f6", background: "white" }}>
        SWARM COMMAND INTERFACE © 2026 • CLEARALIGN DEFENSE
      </footer>
    </div>
  );
}
