import React, { useState, useEffect } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import LegalModal from "./LegalModal";
import SwarmReelsCarousel from "./SwarmReelsCarousel";


const API = import.meta.env.VITE_API_URL || "";

const COLORS = {
  primary: "#3b82f6",
  accent: "#16a34a",
  bgSlate: "#ffffff",
  border: "#e2e8f0",
  textMuted: "#64748b",
  success: "#16a34a"
};

// Custom Telemetry Hook to simulate real-time process stats on dashboard cards
const useLiveStats = (isActive) => {
  const [stats, setStats] = useState({
    cpu: (Math.random() * 1.5 + 0.2).toFixed(1),
    latency: Math.floor(Math.random() * 50 + 190),
    uptime: "99.98%"
  });

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setStats({
        cpu: (Math.random() * 2.0 + 0.2).toFixed(1),
        latency: Math.floor(Math.random() * 80 + 180),
        uptime: "99.98%"
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [isActive]);

  return stats;
};

const ConsoleAgentCard = ({ agent, onAction }) => {
  const [isHovered, setIsHovered] = useState(false);
  const stats = useLiveStats(true);

  return (
    <motion.div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        background: COLORS.bgSlate,
        borderRadius: "20px",
        border: `1px solid ${isHovered ? agent.color : COLORS.border}`,
        padding: "2rem",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        height: "100%",
        boxShadow: isHovered ? `0 10px 30px ${agent.color}12` : "0 4px 6px -1px rgba(0, 0, 0, 0.02)",
        position: "relative",
        overflow: "hidden"
      }}
    >
      {/* Decorative Glow */}
      <div style={{
        position: "absolute",
        top: "-10%",
        right: "-10%",
        width: "100px",
        height: "100px",
        background: `radial-gradient(circle, ${agent.color}12 0%, transparent 70%)`,
        pointerEvents: "none"
      }} />

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div style={{
            width: "48px",
            height: "48px",
            borderRadius: "12px",
            background: `${agent.color}12`,
            border: `1.5px solid ${agent.color}25`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.6rem"
          }}>
            {agent.icon}
          </div>

          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: "rgba(22, 163, 74, 0.08)",
            border: "1px solid rgba(22, 163, 74, 0.15)",
            padding: "4px 10px",
            borderRadius: "99px",
            fontSize: "0.65rem",
            fontWeight: "800",
            color: COLORS.success,
            letterSpacing: "0.5px"
          }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: COLORS.success, boxShadow: `0 0 6px ${COLORS.success}` }} />
            <span>RUNNING</span>
          </div>
        </div>

        <h3 style={{ fontSize: "1.25rem", fontWeight: "900", color: "#0f172a", marginBottom: "0.5rem" }}>
          {agent.title}
        </h3>
        <p style={{ fontSize: "0.85rem", color: COLORS.textMuted, lineHeight: "1.6", marginBottom: "1.5rem" }}>
          {agent.desc}
        </p>

        {/* Process Telemetry Panel */}
        <div style={{
          background: "#f8fafc",
          border: `1px solid #cbd5e1`,
          borderRadius: "12px",
          padding: "12px 16px",
          fontSize: "0.75rem",
          fontFamily: "monospace",
          color: COLORS.textMuted,
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "1.5rem"
        }}>
          <div>CPU: <span style={{ color: "#0f172a", fontWeight: "700" }}>{stats.cpu}%</span></div>
          <div>LATENCY: <span style={{ color: "#0f172a", fontWeight: "700" }}>{stats.latency}ms</span></div>
          <div>UPTIME: <span style={{ color: COLORS.success, fontWeight: "700" }}>{stats.uptime}</span></div>
        </div>
      </div>

      <button
        onClick={() => onAction(agent.id)}
        style={{
          width: "100%",
          padding: "10px",
          background: isHovered ? agent.color : "#ffffff",
          color: isHovered ? "#ffffff" : "#475569",
          border: `1px solid ${isHovered ? agent.color : "#cbd5e1"}`,
          borderRadius: "10px",
          fontSize: "0.85rem",
          fontWeight: "700",
          cursor: "pointer",
          transition: "all 0.2s"
        }}
      >
        {isHovered ? `INITIALIZE SESSION` : `CONNECT CLI`}
      </button>
    </motion.div>
  );
};

export default function LiveList({ onJoin, onBlogClick, onTelemetryClick, onShortsClick, onDashboardClick, onDeploymentClick, user, onLoginClick, onLogout }) {
  const [legalModalType, setLegalModalType] = useState(null);
  const [enabledAgents, setEnabledAgents] = useState([]);

  useEffect(() => {
    axios.get(`${API}/api/whitelabel/config`)
      .then(res => {
        if (res.data && res.data.enabledAgents) {
          setEnabledAgents(res.data.enabledAgents.map(a => a.toLowerCase()));
        }
      })
      .catch(err => console.warn('Could not fetch whitelabel config for agents:', err.message));
  }, []);

  const agents = [
    {
      id: "DEVOPS_GENI", title: "DevOps Geni", icon: "🛡️", color: "#f43f5e",
      desc: "Autonomous DevSecOps agent. Monitors Docker telemetry, runs SAST scans, and hunts ghost processes."
    },
    {
      id: "bi", title: "Cortex BI", icon: "📊", color: "#059669",
      desc: "Conversational MySQL analysis and realtime business insights. Perfect for data-driven operations."
    },
    {
      id: "bi2", title: "Cortex IPL", icon: "🍃", color: "#10b981",
      desc: "Live MongoDB database intelligence for IPL predictions and real-time operations dashboarding."
    },
    {
      id: "lina", title: "Lina Wellness", icon: "✨", color: "#d946ef",
      desc: "Empathetic companion and wellness support. Conversational cognitive therapy models."
    },
    {
      id: "nova", title: "Nova Copilot", icon: "🚀", color: "#8b5cf6",
      desc: "Autonomous SaaS engineering copilot. Helps users explore Nexus platform, schedules tasks, and automates UI steps."
    },
    {
      id: "aura", title: "Cortex Aura", icon: "🔮", color: "#06b6d4",
      desc: "Multi-modal cognitive voice agent. Integrates visual cues with real-time operations telemetry."
    },
    {
      id: "astra", title: "Astra Coach", icon: "🎙️", color: "#6366f1",
      desc: "Conversational public speaking coach. Analyzes vocal pacing, filler usage, and delivery."
    },
    {
      id: "rehearsal", title: "Rehearsal Coach", icon: "🎭", color: "#f43f5e",
      desc: "Real-time presentation coach. Analyzes vocal cadence, speaker pacing, and speech clarity."
    },
    {
      id: "seva", title: "Seva Support", icon: "🤝", color: "#f59e0b",
      desc: "Live customer onboarding assistant. Integrates backend APIs with context-aware logic."
    },
    {
      id: "martech", title: "Martech Dynamo", icon: "📈", color: "#ea580c",
      desc: "Autonomous marketing analytics coordinator. Tracks SEO health and customer conversion metrics."
    },
    {
      id: "octane", title: "Octane Telemetry", icon: "⚡", color: "#eab308",
      desc: "High-throughput telemetry auditor. Monitors sub-second network overhead and GPU scheduling."
    },
    {
      id: "aivyuh", title: "Aivyuh Agent", icon: "🧬", color: "#14b8a6",
      desc: "Advanced swarm logic coordinator. Dispatches complex multi-turn sub-agents to solve nested workflows."
    }
  ];



  const initiateAITalk = async (agentId) => {
    try {
      const res = await axios.post(`${API}/talk-to-ai`, { agentType: agentId });
      onJoin({ 
        roomName: res.data.roomName, 
        token: res.data.token, 
        isCreator: false, 
        creatorId: agentId.toUpperCase(), 
        isAI: true 
      });
    } catch {
      alert("AI Assistant is offline");
    }
  };



  // Render Premium Guest landing portal if not authenticated
  if (!user) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: "#f8fafc",
        backgroundImage: `radial-gradient(circle at 10% 20%, rgba(59,130,246,0.04) 0%, transparent 40%),
                          radial-gradient(circle at 90% 80%, rgba(16,185,129,0.02) 0%, transparent 40%)`,
        fontFamily: "'Outfit', sans-serif"
      }}>
        {/* Navigation */}
        <nav className="premium-navbar">
          <div className="brand-wrapper">
            <div className="brand-logo-dot">S</div>
            <div className="brand-text">
              SWARM <span>AGENTIC LAB</span>
            </div>
          </div>

          {/* Guest Public Nav Links */}
          <div className="saas-nav-links">
            <button className="saas-nav-link" onClick={onDeploymentClick}>
              Governance
            </button>
            <button className="saas-nav-link" onClick={onBlogClick}>
              Insights
            </button>
            <button className="saas-nav-link" onClick={onShortsClick}>
              Sneak-Peak
            </button>
          </div>

          <button className="nav-cta-btn" onClick={() => { console.log('Access Console clicked'); onLoginClick(); }}>
            Access Console
          </button>
        </nav>

        {/* Hero Splash Portal */}
        <header style={{ textAlign: "center", padding: "6rem 2rem 4rem", maxWidth: "900px", margin: "0 auto" }}>
          <div style={{
            display: "inline-block",
            padding: "6px 16px",
            background: "rgba(37, 99, 235, 0.08)",
            border: "1px solid rgba(37, 99, 235, 0.15)",
            color: COLORS.primary,
            borderRadius: "99px",
            fontSize: "0.75rem",
            fontWeight: "900",
            marginBottom: "2rem",
            letterSpacing: "1.5px"
          }}>
            SOVEREIGN AI CONTROL PLANE
          </div>
          
          <h1 style={{
            fontSize: "4.2rem",
            fontWeight: "900",
            color: "#0f172a",
            lineHeight: "1.1",
            letterSpacing: "-2px",
            marginBottom: "2rem"
          }}>
            Stop Renting Intelligence.<br/>Own Your <span style={{ color: COLORS.primary }}>Agent Factories.</span>
          </h1>

          <p style={{
            fontSize: "1.15rem",
            color: COLORS.textMuted,
            lineHeight: "1.6",
            marginBottom: "3.5rem",
            maxWidth: "650px",
            margin: "0 auto 3.5rem"
          }}>
            Deploy fully private, cloud-agnostic, and LLM-independent AI agent fleets directly inside your secure infrastructure. Guarantee 100% data governance.
          </p>

          <button
            onClick={onLoginClick}
            style={{
              padding: "16px 36px",
              background: `linear-gradient(135deg, ${COLORS.primary}, #4f46e5)`,
              border: "none",
              color: "#ffffff",
              borderRadius: "12px",
              fontSize: "1.05rem",
              fontWeight: "800",
              cursor: "pointer",
              boxShadow: `0 8px 30px rgba(59, 130, 246, 0.2)`
            }}
          >
            
          </button>
        </header>

        {/* Guest Footer */}
        <footer style={{
          padding: "2rem",
          borderTop: "1px solid rgba(0, 0, 0, 0.06)",
          textAlign: "center",
          fontSize: "0.8rem",
          color: COLORS.textMuted
        }}>
          &copy; {new Date().getFullYear()} Swarm Agentic Lab. Single-Tenant Cloud Edition.
        </footer>
      </div>
    );
  }

  // Render SaaS Operator Control Panel Workspace
  return (
    <div style={{ color: "#0f172a" }}>
      {/* Main Swarm Fleet Section */}
      <h2 style={{ fontSize: "1.3rem", fontWeight: "900", marginBottom: "1.5rem" }}>
        🖥️ Sovereign Agent Fleet
      </h2>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
        gap: "2rem",
        marginBottom: "4rem"
      }}>
        {agents
          .filter(agent => {
            if (enabledAgents.length > 0) {
              const checkId = agent.id.toLowerCase();
              if (checkId === "bi2") {
                return enabledAgents.includes("bi");
              }
              return enabledAgents.includes(checkId);
            }
            return true;
          })
          .filter(agent => agent.id !== "DEVOPS_GENI" || !!user)
          .map(agent => (
            <ConsoleAgentCard key={agent.id} agent={agent} onAction={initiateAITalk} />
          ))
        }
      </div>


    </div>
  );
}
