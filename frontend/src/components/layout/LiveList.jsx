/* eslint-disable react-hooks/purity */
import React, { useState, useEffect } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import LegalModal from "./LegalModal";
import SwarmReelsCarousel from "./SwarmReelsCarousel";
import Footer from "./Footer";
import SwarmCopilotPanel from "./SwarmCopilotPanel";
import {
  ShieldCheck, BarChart2, Leaf, Sparkles, Rocket, Aperture,
  Mic2, Theater, Handshake, TrendingUp, Zap, Dna, Monitor,
  Bot
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";

const COLORS = {
  primary: "#3b82f6",
  accent: "#16a34a",
  bgSlate: "#ffffff",
  bgSoft: "#f8fafc",
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
  const AgentIcon = agent.IconComponent;
  const [isHovered, setIsHovered] = useState(false);
  const stats = useLiveStats(true);
  const MotionDiv = motion.div;

  return (
    <MotionDiv
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
            background: `${agent.color}18`,
            border: `1.5px solid ${agent.color}35`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <AgentIcon size={22} color={agent.color} strokeWidth={1.75} />
          </div>

          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: agent.id === "swarm-copilot" ? "rgba(139, 92, 246, 0.08)" : "rgba(22, 163, 74, 0.08)",
            border: agent.id === "swarm-copilot" ? "1px solid rgba(139, 92, 246, 0.15)" : "1px solid rgba(22, 163, 74, 0.15)",
            padding: "4px 10px",
            borderRadius: "99px",
            fontSize: "0.65rem",
            fontWeight: "800",
            color: agent.id === "swarm-copilot" ? "#8b5cf6" : COLORS.success,
            letterSpacing: "0.5px"
          }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: agent.id === "swarm-copilot" ? "#8b5cf6" : COLORS.success, boxShadow: `0 0 6px ${agent.id === "swarm-copilot" ? "#8b5cf6" : COLORS.success}` }} />
            <span>{agent.id === "swarm-copilot" ? "KNOWLEDGE OPS" : "RUNNING"}</span>
          </div>
        </div>

        <h3 style={{ fontSize: "1.25rem", fontWeight: "900", color: "#0f172a", marginBottom: "0.5rem" }}>
          {agent.title}
        </h3>
        <p style={{ fontSize: "0.85rem", color: COLORS.textMuted, lineHeight: "1.6", marginBottom: "1.5rem" }}>
          {agent.desc}
        </p>

        {/* Process Telemetry Panel */}
        {agent.id === "swarm-copilot" ? (
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
            <div>SOURCES: <span style={{ color: "#0f172a", fontWeight: "700" }}>22</span></div>
            <div>SYNC: <span style={{ color: "#0f172a", fontWeight: "700" }}>DAILY</span></div>
            <div>STATUS: <span style={{ color: "#8b5cf6", fontWeight: "700" }}>READY</span></div>
          </div>
        ) : (
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
        )}
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
        {agent.id === "swarm-copilot"
          ? (isHovered ? "OPEN SETUP WIZARD" : "CONFIGURE SETUP")
          : (isHovered ? "INITIALIZE SESSION" : "CONNECT CLI")}
      </button>
    </MotionDiv>
  );
};

export default function LiveList({ onJoin, onBlogClick, onShortsClick, onDashboardClick, onDeploymentClick, onChangelogClick, onCareersClick, onBattleClick, user, onLoginClick, onLogout: _onLogout }) {
  const [legalModalType, setLegalModalType] = useState(null);
  const [enabledAgents, setEnabledAgents] = useState([]);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [heroWord, setHeroWord] = useState("Factories");

  useEffect(() => {
    if (user) return;
    const words = ["Factories", "Marketplaces", "Farms"];
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % words.length;
      setHeroWord(words[idx]);
    }, 2000);
    return () => clearInterval(interval);
  }, [user]);

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
      id: "swarm-copilot", title: "Swarm Copilot", IconComponent: Bot, color: "#8b5cf6",
      desc: "Web Crawling Configuration Expert. Ingest public websites, documentation, and blogs dynamically into your organizational knowledge base."
    },
    {
      id: "DEVOPS_GENI", title: "DevOps Geni", IconComponent: ShieldCheck, color: "#f43f5e",
      desc: "Autonomous DevSecOps agent. Monitors Docker telemetry, runs SAST scans, and hunts ghost processes."
    },
    {
      id: "bi", title: "Cortex BI", IconComponent: BarChart2, color: "#059669",
      desc: "Conversational MySQL analysis and realtime business insights. Perfect for data-driven operations."
    },
    {
      id: "bi2", title: "Cortex IPL", IconComponent: Leaf, color: "#10b981",
      desc: "Live MongoDB database intelligence for IPL predictions and real-time operations dashboarding."
    },
    {
      id: "lina", title: "Lina Wellness", IconComponent: Sparkles, color: "#d946ef",
      desc: "Empathetic companion and wellness support. Conversational cognitive therapy models."
    },
    {
      id: "nova", title: "Nova Copilot", IconComponent: Rocket, color: "#8b5cf6",
      desc: "Autonomous SaaS engineering copilot. Helps users explore Nexus platform, schedules tasks, and automates UI steps."
    },

    {
      id: "astra", title: "Astra Coach", IconComponent: Mic2, color: "#6366f1",
      desc: "Conversational public speaking coach. Analyzes vocal pacing, filler usage, and delivery."
    },
    {
      id: "rehearsal", title: "Rehearsal Coach", IconComponent: Theater, color: "#f43f5e",
      desc: "Real-time presentation coach. Analyzes vocal cadence, speaker pacing, and speech clarity."
    },
    {
      id: "seva", title: "Seva Support", IconComponent: Handshake, color: "#f59e0b",
      desc: "Live customer onboarding assistant. Integrates backend APIs with context-aware logic."
    },
    {
      id: "martech", title: "Martech Dynamo", IconComponent: TrendingUp, color: "#ea580c",
      desc: "Autonomous marketing analytics coordinator. Tracks SEO health and customer conversion metrics."
    },
    {
      id: "octane", title: "Octane Telemetry", IconComponent: Zap, color: "#eab308",
      desc: "High-throughput telemetry auditor. Monitors sub-second network overhead and GPU scheduling."
    },
    {
      id: "aivyuh", title: "Aivyuh Agent", IconComponent: Dna, color: "#14b8a6",
      desc: "Advanced swarm logic coordinator. Dispatches complex multi-turn sub-agents to solve nested workflows."
    },
    {
      id: "shoppe", title: "Shoppe Agent", IconComponent: Bot, color: "#10b981",
      desc: "Conversational shopping assistant for Indian consumers. Searches lowest prices, streams checkout browser, and generates instant UPI payments."
    }
  ];



  const initiateAITalk = async (agentId) => {
    if (agentId === "swarm-copilot") {
      setCopilotOpen(true);
      return;
    }
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
            Stop Renting Intelligence.<br/>Own Your <span style={{ color: COLORS.primary }}>Agent <span style={{ display: "inline-block", minWidth: "12ch", textAlign: "center" }}>{heroWord}</span>.</span>
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
            ACCESS OPERATOR CONSOLE →
          </button>
        </header>

        {/* About Section (Bento Box) */}
        <section id="about" style={{ padding: "8rem 5%", background: COLORS.bgSoft, borderTop: `1px solid ${COLORS.border}`, borderBottom: `1px solid ${COLORS.border}`, position: "relative" }}>
          <style dangerouslySetInnerHTML={{ __html: `
            .bento-grid {
              display: grid;
              grid-template-columns: repeat(12, 1fr);
              gap: 1.5rem;
              max-width: 1200px;
              margin: 0 auto;
            }
            .bento-card {
              background: rgba(255, 255, 255, 0.8);
              backdrop-filter: blur(10px);
              border: 1px solid rgba(0, 0, 0, 0.05);
              border-radius: 24px;
              padding: 2.5rem;
              display: flex;
              flex-direction: column;
              gap: 1.25rem;
              transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
              box-shadow: 0 10px 30px rgba(0,0,0,0.02);
            }
            .bento-card:hover {
              transform: translateY(-8px);
              box-shadow: 0 20px 40px rgba(0,0,0,0.08);
              border: 1px solid rgba(0, 0, 0, 0.1);
            }
            .card-1 { grid-column: span 7; }
            .card-2 { grid-column: span 5; background: ${COLORS.primary}; color: white; }
            .card-3 { grid-column: span 5; }
            .card-4 { grid-column: span 7; }
            .card-5 { grid-column: span 12; text-align: center; background: linear-gradient(135deg, ${COLORS.primary}, ${COLORS.accent}); color: white; border: none; }
            
            @media (max-width: 900px) {
              .card-1, .card-2, .card-3, .card-4, .card-5 { grid-column: span 12; }
            }
          ` }} />
          
          <div style={{ textAlign: "center", marginBottom: "4rem" }}>
            <h2 style={{ fontSize: "3rem", fontWeight: "900", color: COLORS.primary }}>
              The Founder's Story
            </h2>
          </div>

          <div className="bento-grid">
            {/* Box 1: The Origin */}
            <div className="bento-card card-1">
              <div style={{ fontSize: "0.85rem", fontWeight: "900", color: COLORS.accent, textTransform: "uppercase", letterSpacing: "2px" }}>The Origin</div>
              <p style={{ fontSize: "1.2rem", lineHeight: "1.7", color: COLORS.textMuted, margin: 0 }}>
                Like most builders in the AI era, I started with what everyone else was doing—small side projects, late-night experiments, and endless hours of vibe coding.
              </p>
              <p style={{ fontSize: "1.2rem", lineHeight: "1.7", color: COLORS.textMuted, margin: 0 }}>
                At first, I wasn't trying to build a company. I was simply trying to solve my own problems. Every day, I found myself repeating the same workflows: researching, planning, writing content, managing projects, tracking leads, documenting processes, onboarding people, and making decisions.
              </p>
            </div>

            {/* Box 2: The Catalyst */}
            <div className="bento-card card-2" style={{ justifyContent: "center" }}>
              <div style={{ fontSize: "0.85rem", fontWeight: "900", color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "2px" }}>The Epiphany</div>
              <div style={{ fontSize: "1.7rem", fontWeight: "900", lineHeight: "1.4", margin: "1rem 0" }}>
                "Why am I doing this manually when AI agents can do it for me?"
              </div>
              <p style={{ fontSize: "1.1rem", color: "rgba(255,255,255,0.9)", margin: 0, lineHeight: "1.6" }}>
                That question changed everything. Instead of building another AI tool, I started building AI agents that could replicate how I work. What began as a personal productivity experiment evolved into something much bigger: <strong>A startup designed to run itself.</strong>
              </p>
            </div>

            {/* Box 3: The Problem */}
            <div className="bento-card card-3">
              <div style={{ fontSize: "0.85rem", fontWeight: "900", color: COLORS.accent, textTransform: "uppercase", letterSpacing: "2px" }}>The Broken Reality</div>
              <p style={{ fontSize: "1.2rem", lineHeight: "1.7", color: COLORS.textMuted, margin: 0 }}>
                Not because humans aren't important. But because founders shouldn't spend their time buried under repetitive operational work.
              </p>
              <p style={{ fontSize: "1.2rem", lineHeight: "1.7", color: COLORS.textMuted, margin: 0 }}>
                Today's founders are expected to be marketers, salespeople, recruiters, operators, product managers, content creators, customer success teams, and executives—all at the same time.
              </p>
              <div style={{ fontSize: "1.5rem", fontWeight: "900", color: COLORS.primary, marginTop: "0.5rem" }}>
                That's broken.
              </div>
            </div>

            {/* Box 4: The Solution */}
            <div className="bento-card card-4">
              <div style={{ fontSize: "0.85rem", fontWeight: "900", color: COLORS.accent, textTransform: "uppercase", letterSpacing: "2px" }}>The Operating System</div>
              <h3 style={{ fontSize: "2rem", fontWeight: "900", color: COLORS.primary, margin: "0.5rem 0", lineHeight: "1.2" }}>
                Every founder deserves a digital workforce.
              </h3>
              <p style={{ fontSize: "1.15rem", lineHeight: "1.7", color: COLORS.textMuted, margin: 0 }}>
                A team of specialized AI agents that understand your business, execute proven playbooks, and help you move faster without hiring an army of people. From hiring your first employee to acquiring your first customer. From content creation to sales outreach.
              </p>
              <div style={{ display: "flex", gap: "10px", marginTop: "1rem", flexWrap: "wrap" }}>
                {["No complicated setups", "No enterprise consulting", "No months of implementation"].map(tag => (
                  <span key={tag} style={{ background: "rgba(59, 130, 246, 0.1)", color: COLORS.accent, padding: "8px 16px", borderRadius: "99px", fontSize: "0.9rem", fontWeight: "800" }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Box 5: The Vision */}
            <div className="bento-card card-5" style={{ alignItems: "center", padding: "5rem 2rem" }}>
              <div style={{ fontSize: "clamp(2.5rem, 5vw, 4rem)", fontWeight: "900", marginBottom: "2rem", textShadow: "0 4px 20px rgba(0,0,0,0.2)", lineHeight: "1.1" }}>
                One founder.<br/>Unlimited execution.
              </div>
              <p style={{ fontSize: "1.25rem", lineHeight: "1.7", maxWidth: "800px", margin: "0 auto", color: "rgba(255,255,255,0.9)" }}>
                We're building a future where entrepreneurs spend less time managing tasks and more time building products, serving customers, and creating impact. Because the next generation of startups won't scale by hiring faster. <strong>They'll scale by deploying smarter agents.</strong>
              </p>
              <div style={{ marginTop: "3.5rem", fontSize: "1.1rem", fontWeight: "900", letterSpacing: "3px", textTransform: "uppercase", padding: "16px 40px", border: "2px solid rgba(255,255,255,0.4)", borderRadius: "99px", background: "rgba(0,0,0,0.1)" }}>
                Welcome to the future of company building
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" style={{ padding: "8rem 5%", background: "white" }}>
          <div style={{ textAlign: "center", marginBottom: "4rem" }}>
            <h2 style={{ fontSize: "2.5rem", fontWeight: "900", color: COLORS.primary, marginBottom: "1rem", letterSpacing: "-1px" }}>
              Common Questions
            </h2>
            <p style={{ fontSize: "1.1rem", color: COLORS.textMuted, maxWidth: "600px", margin: "0 auto" }}>
              Everything you're probably wondering about deploying your AI fleet.
            </p>
          </div>
          <div itemScope itemType="https://schema.org/FAQPage" style={{ maxWidth: "800px", margin: "0 auto" }}>
            {[
              { q: "How long does a typical build take?", a: "Most agents are live in production within 1–2 weeks, including local model fine-tuning." },
              { q: "Do you use my data for training?", a: "Never. Because your agents run entirely on your own local hardware or private VPC, your data never leaves your infrastructure." },
              { q: "Can the agents talk to my existing tools?", a: "Yes. We specialize in connecting local agent inference to MySQL, MongoDB, Slack, and custom CRM APIs." },
              { q: "What are the running costs?", a: "₹0 in recurring cloud API fees. Running models locally or on dedicated hardware removes all message volume-based SaaS bills." },
              { q: "How does the platform handle high-throughput log volumes and disk safety?", a: "All systems (agents, backend, and Docker services) utilize structured JSON logging with strict size-capped auto-rotation and automated scheduled time-based purges. Logs are processed asynchronously via non-blocking queues, ensuring zero latency spikes for up to 50,000+ concurrent users." },
              { q: "Can the platform self-diagnose system health and hardware issues?", a: "Yes. Our DevOps Geni agent is equipped with native system diagnostic tools that can monitor hardware stats, detect NVIDIA GPU availability, scan active listening ports for EADDRINUSE conflicts, and track Docker container health in real-time." }
            ].map((item, i) => (
              <div 
                key={i} 
                itemScope 
                itemProp="mainEntity" 
                itemType="https://schema.org/Question" 
                style={{ borderBottom: `1px solid ${COLORS.border}`, padding: "2rem 0" }}
              >
                <h4 
                  itemProp="name" 
                  style={{ fontSize: "1.1rem", fontWeight: "800", color: COLORS.primary, marginBottom: "0.5rem" }}
                >
                  {item.q}
                </h4>
                <div 
                  itemScope 
                  itemProp="acceptedAnswer" 
                  itemType="https://schema.org/Answer"
                >
                  <p 
                    itemProp="text" 
                    style={{ color: COLORS.textMuted, fontSize: "1rem", lineHeight: "1.6", margin: 0 }}
                  >
                    {item.a}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <Footer 
          onBlogClick={onBlogClick} 
          onShortsClick={onShortsClick} 
          onLegalClick={setLegalModalType} 
          onDashboardClick={onDashboardClick} 
          onDeploymentClick={onDeploymentClick}
          onChangelogClick={onChangelogClick}
          onCareersClick={onCareersClick}
          onBattleClick={onBattleClick}
        />

        {legalModalType && (
          <LegalModal 
            type={legalModalType} 
            onClose={() => setLegalModalType(null)} 
          />
        )}
      </div>
    );
  }

  // Render SaaS Operator Control Panel Workspace
  return (
    <div style={{ color: "#0f172a" }}>
      {/* Main Swarm Fleet Section */}
      <h2 style={{ fontSize: "1.3rem", fontWeight: "900", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "10px" }}>
        <Monitor size={22} color="#3b82f6" strokeWidth={2} />
        Sovereign Agent Fleet
      </h2>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
        gap: "2rem",
        marginBottom: "4rem"
      }}>
        {agents
          .filter(agent => {
            if (agent.id === "swarm-copilot") return true;
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

      {/* Swarm Copilot Setup Drawer */}
      <SwarmCopilotPanel isOpen={copilotOpen} onClose={() => setCopilotOpen(false)} />

    </div>
  );
}
