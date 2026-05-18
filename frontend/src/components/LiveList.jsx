import React, { useState, useEffect } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";

const API = import.meta.env.VITE_API_URL || "";

// --- OPERATEAI DESIGN TOKENS ---
const COLORS = {
  primary: "#111827", // Deep Navy/Black
  accent: "#3b82f6",  // Blue
  textMuted: "#6b7280",
  bgLight: "#ffffff",
  bgSoft: "#f9fafb",
  border: "#e5e7eb",
  success: "#10b981"
};

// --- COMPONENTS ---

const SectionHeader = ({ title, subtitle, alignment = "center" }) => (
  <div style={{ textAlign: alignment, marginBottom: "4rem" }}>
    <h2 style={{ fontSize: "2.5rem", fontWeight: "900", color: COLORS.primary, marginBottom: "1rem", letterSpacing: "-1px" }}>{title}</h2>
    <p style={{ fontSize: "1.1rem", color: COLORS.textMuted, maxWidth: "600px", margin: alignment === "center" ? "0 auto" : "0" }}>{subtitle}</p>
  </div>
);

const AgentCard = ({ agent, onAction }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ 
        background: "white", 
        padding: "2.5rem", 
        borderRadius: "24px", 
        border: `1px solid ${isHovered ? agent.color : COLORS.border}`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        transition: "all 0.3s ease",
        height: "100%",
        boxShadow: isHovered ? `0 20px 40px ${agent.color}15` : "none"
      }}
      className="hover-shadow"
    >
      <div>
        <div style={{ 
          width: "60px", height: "60px", borderRadius: "16px", 
          background: `${agent.color}11`, display: "flex", alignItems: "center", 
          justifyContent: "center", fontSize: "2rem", border: `1px solid ${agent.color}22`,
          marginBottom: "2rem"
        }}>
          {agent.icon}
        </div>
        <h3 style={{ fontSize: "1.5rem", fontWeight: "900", color: COLORS.primary, marginBottom: "1rem" }}>{agent.title}</h3>
        <p style={{ color: COLORS.textMuted, lineHeight: "1.6", marginBottom: "2rem", fontSize: "1rem" }}>{agent.desc}</p>
        
        <AnimatePresence>
          {isHovered && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              style={{ overflow: "hidden" }}
            >
              <div style={{ fontSize: "0.7rem", fontWeight: "900", color: agent.color, letterSpacing: "2px", marginBottom: "1rem", textTransform: "uppercase" }}>Suggested Commands</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "2rem" }}>
                {agent.prompts.map((p, i) => (
                  <div key={i} style={{ 
                    fontSize: "0.75rem", color: COLORS.primary, fontWeight: "500",
                    padding: "8px 12px", background: COLORS.bgSoft, borderRadius: "8px",
                    border: `1px solid ${COLORS.border}`
                  }}>
                    {p}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!isHovered && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "2rem" }}>
            {agent.prompts.slice(0, 3).map((p, i) => (
              <span key={i} style={{ fontSize: "0.75rem", background: COLORS.bgSoft, padding: "6px 12px", borderRadius: "99px", color: COLORS.primary, fontWeight: "600", border: `1px solid ${COLORS.border}` }}>
                {p}
              </span>
            ))}
          </div>
        )}
      </div>
      
      <button 
        onClick={() => onAction(agent.id)}
        style={{ 
          width: "100%", padding: "1.2rem", background: isHovered ? agent.color : COLORS.primary, 
          color: "white", border: "none", borderRadius: "12px", 
          fontWeight: "800", cursor: "pointer", fontSize: "0.9rem",
          letterSpacing: "1px", transition: "all 0.3s ease"
        }}
      >
        {agent.btnText.toUpperCase()}
      </button>
    </motion.div>
  );
};

const PricingCard = ({ tier, price, duration, bestFor, features, isFeatured }) => (
  <div style={{ 
    background: isFeatured ? COLORS.primary : "white", 
    padding: "3rem", 
    borderRadius: "32px", 
    border: isFeatured ? `none` : `1px solid ${COLORS.border}`,
    color: isFeatured ? "white" : COLORS.primary,
    position: "relative",
    display: "flex",
    flexDirection: "column",
    boxShadow: isFeatured ? "0 20px 50px rgba(17, 24, 39, 0.2)" : "none"
  }}>
    {isFeatured && (
      <div style={{ position: "absolute", top: "2rem", right: "2rem", background: COLORS.accent, color: "white", padding: "4px 12px", borderRadius: "99px", fontSize: "0.7rem", fontWeight: "900" }}>MOST POPULAR</div>
    )}
    <h3 style={{ fontSize: "1.2rem", fontWeight: "800", marginBottom: "0.5rem", opacity: isFeatured ? 0.9 : 1 }}>{tier}</h3>
    <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "1.5rem" }}>
      <span style={{ fontSize: "2.5rem", fontWeight: "900" }}>{price}</span>
      <span style={{ fontSize: "0.9rem", opacity: 0.6 }}>{duration}</span>
    </div>
    <p style={{ fontSize: "0.9rem", color: isFeatured ? "rgba(255,255,255,0.7)" : COLORS.textMuted, marginBottom: "2rem", lineHeight: "1.5" }}>{bestFor}</p>
    
    <div style={{ flex: 1 }}>
      {features.map((f, i) => (
        <div key={i} style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "12px", fontSize: "0.95rem" }}>
          <span style={{ color: isFeatured ? COLORS.success : COLORS.accent }}>✓</span>
          <span style={{ opacity: isFeatured ? 0.9 : 1 }}>{f}</span>
        </div>
      ))}
    </div>
    
    <button style={{ 
      marginTop: "3rem", width: "100%", padding: "1.2rem", 
      background: isFeatured ? "white" : COLORS.primary, 
      color: isFeatured ? COLORS.primary : "white", 
      border: "none", borderRadius: "12px", fontWeight: "900", cursor: "pointer"
    }}>
      GET STARTED
    </button>
  </div>
);

const PipelineCard = ({ agent, onAction }) => {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <motion.div 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ 
        background: "white", 
        padding: "2.5rem", 
        borderRadius: "24px", 
        border: `1px solid ${isHovered ? agent.color : COLORS.border}`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        transition: "all 0.3s ease",
        height: "100%",
        boxShadow: isHovered ? `0 20px 40px ${agent.color}15` : "none"
      }}
      className="hover-shadow"
    >
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem" }}>
          <div style={{ 
            width: "60px", height: "60px", borderRadius: "16px", 
            background: `${agent.color}11`, display: "flex", alignItems: "center", 
            justifyContent: "center", fontSize: "2rem", border: `1px solid ${agent.color}22`
          }}>
            {agent.icon}
          </div>
          <span style={{ 
            fontSize: "0.65rem", fontWeight: "900", color: agent.status === "READY" ? COLORS.success : COLORS.textMuted,
            background: agent.status === "READY" ? `${COLORS.success}11` : "rgba(107, 114, 128, 0.1)",
            padding: "4px 12px", borderRadius: "99px", letterSpacing: "1px",
            border: `1px solid ${agent.status === "READY" ? `${COLORS.success}22` : "rgba(107, 114, 128, 0.2)"}`
          }}>
            {agent.status}
          </span>
        </div>
        <h3 style={{ fontSize: "1.5rem", fontWeight: "900", color: COLORS.primary, marginBottom: "1rem" }}>{agent.title}</h3>
        <p style={{ color: COLORS.textMuted, lineHeight: "1.6", marginBottom: "2rem", fontSize: "1rem" }}>{agent.desc}</p>
      </div>
      
      <button 
        onClick={() => onAction(agent)}
        style={{ 
          width: "100%", padding: "1.2rem", background: isHovered ? agent.color : COLORS.primary, 
          color: "white", border: "none", borderRadius: "12px", 
          fontWeight: "800", cursor: agent.status === "READY" ? "pointer" : "not-allowed", fontSize: "0.9rem",
          letterSpacing: "1px", transition: "all 0.3s ease",
          opacity: agent.status === "READY" ? 1 : 0.5
        }}
        disabled={agent.status !== "READY"}
      >
        {agent.btnText.toUpperCase()}
      </button>
    </motion.div>
  );
};

// --- MAIN PAGE ---

export default function LiveList({ onJoin, onBlogClick }) {
  const [selectedReel, setSelectedReel] = React.useState(null);
  const [showReelsGallery, setShowReelsGallery] = React.useState(false);
  const [showShadowInput, setShowShadowInput] = React.useState(false);
  const [meetingUrl, setMeetingUrl] = React.useState("");
  const [isDeployingShadow, setIsDeployingShadow] = React.useState(false);
  const agents = [
    {
      id: "bi", title: "Cortex BI", icon: "📊", color: "#059669",
      desc: "Conversational MySQL analysis and realtime business insights. Perfect for data-driven operations.",
      btnText: "Consult Cortex",
      prompts: [
        "Which drivers had the highest cancellations?", "Compare today’s revenue with yesterday.",
        "Show peak booking hours in Chennai.", "Why did failed rides increase today?",
        "Which zones have lowest availability?", "Summarize performance for this week.",
        "Show top 5 routes by revenue.", "Are cancellations increasing after rain?",
        "Highlight operational anomalies.", "Top users by booking count."
      ]
    },
    {
      id: "bi2", title: "Cortex II", icon: "🍃", color: "#10b981",
      desc: "Live MongoDB intelligence for IPL Nexus — users, predictions, and leaderboard insights.",
      btnText: "Consult Cortex II",
      prompts: [
        "How many users are registered?", "Show the top 5 leaderboard scores.",
        "Who has the highest squad multiplier?", "How many predictions were made today?",
        "List all completed matches.", "Which users joined this week?",
        "Show session scores summary.", "Count predictions collection.",
        "Show recent match results.", "Top scoring users overall."
      ]
    },
    {
      id: "vigil", title: "Vigil Auditor", icon: "🛡️", color: "#4f46e5",
      desc: "Professional IR maturity assessment and security audit. Security governance for enterprises.",
      btnText: "Deploy Vigil",
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
      desc: "Empathetic companion and mental wellness support. Specialized in conversational therapy patterns.",
      btnText: "Connect Lina",
      prompts: [
        "I’ve had a stressful day.", "Talk to me for a while.",
        "Help me slow my thoughts.", "I’m feeling overwhelmed.",
        "Stay with me while I work.", "Tell me something calming.",
        "Can we just chat?", "I need motivation.",
        "Help me organize thoughts.", "I feel mentally exhausted."
      ]
    },
    {
      id: "aura", title: "Aura", icon: "☁️", color: "#3b82f6",
      desc: "Indian monsoon patterns and regional climate insights. Real-time weather intelligence.",
      btnText: "Deploy Aura",
      prompts: [
        "Will monsoon intensity increase?", "Rainfall predictions for Chennai.",
        "Which regions face flooding?", "How will weather affect transport?",
        "Compare patterns with last year.", "Impact on airport operations?",
        "Humidity and storm trends.", "Rainfall alerts per district.",
        "Predict weather disruptions.", "South India climate summary."
      ]
    },
    {
      id: "nova", title: "Nova Copilot", icon: "🚀", color: "#0ea5e9",
      desc: "Advanced SaaS copilot with autonomous UI navigation. Your companion in the Nexus ecosystem.",
      btnText: "Activate Nova",
      prompts: [
        "Nova, show me the live match arena.", "Nova, open my squad hub.",
        "Nova, check the points leaderboard.", "Nova, explain my squad multiplier.",
        "Nova, show my past prediction history.", "Nova, what's new in the latest version?",
        "Nova, log me out of Nexus."
      ]
    },
    {
      id: "vision", title: "V-One Vision", icon: "👁️", color: "#f59e0b",
      desc: "Biometric face verification and attendance logging. 100% local, secure identity confirmation.",
      btnText: "Start Verification",
      prompts: [
        "Capture my attendance.", "Verify my identity.", "Run biometric scan.",
        "Log shift start.", "Identity check."
      ]
    },
    {
      id: "astra", title: "Astra Architect", icon: "✍️", color: "#6366f1",
      desc: "Elite content strategist and insight generator. Transforming fleet data into high-impact narratives.",
      btnText: "Consult Astra",
      prompts: [
        "Generate a report on fleet security.", "Write a blog post about Agentic AI.",
        "Analyze the latest intelligence updates.", "Draft a newsletter for the swarm.",
        "Show me the latest insights."
      ]
    }
  ];

  const pipelineAgents = [
    {
      id: "reels", title: "Reels Agent", icon: "🎬", color: "#f43f5e", status: "READY",
      desc: "Digests blog content and compiles high-tempo, 30s vertical reels programmatically using Pillow subtitle overlays and zero-cost Speech Synthesis.",
      btnText: "Open Swarm Lab"
    },
    {
      id: "shadow", title: "Shadow Agent", icon: "👥", color: "#4f46e5", status: "READY",
      desc: "Autonomous headless background observer. Automatically schedules and joins Zoom/Meet sessions to generate full transcriptions and meeting audits.",
      btnText: "Deploy Shadow"
    }
  ];

  const galleryReels = [
    {
      title: "Autonomous Swarms",
      slug: "autonomous-multi-agent-orchestration",
      desc: "30-second vertical preview of multi-agent workflows."
    }
  ];

  const pricing = [
    {
      tier: "Audit + Roadmap",
      price: "₹15,000",
      duration: "/one-time",
      bestFor: "Owners who want to know exactly where AI fits before committing to a build.",
      features: [
        "30-min AI Opportunity Audit",
        "Deep-dive into 3 manual workflows",
        "Prioritized ROI Roadmap",
        "Tool & Budget Recommendations",
        "1 Week of Slack Support"
      ],
      isFeatured: false
    },
    {
      tier: "Build + Manage",
      price: "₹45,000",
      duration: "/setup",
      bestFor: "The most common engagement. Pick one painful process — we build and hand over.",
      features: [
        "End-to-end AI Agent Build",
        "Integration with existing stack",
        "customized agents built for your cases powered claude deepgram openai",
        "Full Documentation & Loom Video",
        "30-day Support Period"
      ],
      isFeatured: true
    },
    {
      tier: "Full Retainer",
      price: "₹25,000",
      duration: "/mo",
      bestFor: "For teams scaling fast who need ongoing AI automation and priority support.",
      features: [
        "Unlimited Workflow Tweaks",
        "Monthly AI Strategy Sessions",
        "Priority 24h Support",
        "New Feature Implementation",
        "Server & API Monitoring"
      ],
      isFeatured: false
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
    } catch (err) {
      alert("AI Assistant is offline");
    }
  };

  const handlePipelineAction = (agent) => {
    if (agent.id === "reels") {
      setShowReelsGallery(true);
    } else if (agent.id === "shadow") {
      setShowShadowInput(true);
    }
  };

  const handleDeployShadow = async () => {
    if (!meetingUrl) {
      alert("Please enter a valid Google Meet or Zoom URL.");
      return;
    }
    setIsDeployingShadow(true);
    try {
      await axios.post(`${API}/deploy-shadow`, { url: meetingUrl });
      alert("Shadow Agent Observer has been successfully deployed to the meeting in the background!");
      setShowShadowInput(false);
      setMeetingUrl("");
    } catch (err) {
      alert("Failed to deploy Shadow Agent. Please try again.");
    } finally {
      setIsDeployingShadow(false);
    }
  };

  return (
    <div style={{ background: COLORS.bgLight, fontFamily: "'Outfit', sans-serif" }}>
      {/* Navigation */}
      <nav style={{ 
        padding: "1.5rem 5%", display: "flex", justifyContent: "space-between", 
        alignItems: "center", borderBottom: `1px solid ${COLORS.border}`,
        position: "sticky", top: 0, background: "rgba(255,255,255,0.8)", 
        backdropFilter: "blur(10px)", zIndex: 100
      }}>
        <div style={{ fontSize: "1.2rem", fontWeight: "900", letterSpacing: "2px", color: COLORS.primary }}>
          SWARM <span style={{ color: COLORS.accent }}>AGENTIC</span>
        </div>
        <div style={{ display: "flex", gap: "2.5rem", fontSize: "0.9rem", fontWeight: "600", color: COLORS.textMuted }}>
          <a href="#services" style={{ textDecoration: "none", color: "inherit" }}>Services</a>
          <a href="#pricing" style={{ textDecoration: "none", color: "inherit" }}>Pricing</a>
          <div onClick={onBlogClick} style={{ cursor: "pointer", color: COLORS.accent, fontWeight: "800" }}>Insights</div>
          <a href="#about" style={{ textDecoration: "none", color: "inherit" }}>About</a>
        </div>
      </nav>

      {/* Hero Section */}
      <header style={{ padding: "8rem 5% 6rem", textAlign: "center", maxWidth: "1000px", margin: "0 auto" }}>
        <div style={{ 
          display: "inline-block", padding: "6px 16px", background: "rgba(59, 130, 246, 0.1)", 
          color: COLORS.accent, borderRadius: "99px", fontSize: "0.75rem", fontWeight: "900", 
          marginBottom: "2rem", letterSpacing: "1px" 
        }}>
          B2B AI AUTOMATION & INTELLIGENCE
        </div>
        <h1 style={{ fontSize: "4.5rem", fontWeight: "900", color: COLORS.primary, lineHeight: "1.05", letterSpacing: "-3px", marginBottom: "2rem" }}>
          Automate your operations.<br/>Connect your tools.<br/>Deploy your <span style={{ color: COLORS.accent }}>Fleet.</span>
        </h1>
        <p style={{ fontSize: "1.25rem", color: COLORS.textMuted, lineHeight: "1.6", marginBottom: "3.5rem" }}>
          We build AI systems that go live in 1–2 weeks. Not just chatbots, but autonomous agents that handle manual data, security audits, and climate intelligence.
        </p>
        <div style={{ display: "flex", gap: "1.5rem", justifyContent: "center" }}>
          <button style={{ padding: "1.2rem 2.5rem", background: "white", color: COLORS.primary, border: `1px solid ${COLORS.border}`, borderRadius: "12px", fontWeight: "800", fontSize: "1rem", cursor: "pointer" }}>
            SEE OUR WORK ↓
          </button>
        </div>
      </header>


      {/* Stats Bar */}
      <div style={{ display: "flex", justifyContent: "center", gap: "8rem", padding: "4rem 0", background: COLORS.bgSoft, borderTop: `1px solid ${COLORS.border}`, borderBottom: `1px solid ${COLORS.border}` }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "2.5rem", fontWeight: "900" }}>40+</div>
          <div style={{ fontSize: "0.8rem", fontWeight: "700", color: COLORS.textMuted }}>HRS SAVED / WEEK</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "2.5rem", fontWeight: "900" }}>96%</div>
          <div style={{ fontSize: "0.8rem", fontWeight: "700", color: COLORS.textMuted }}>ERROR REDUCTION</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "2.5rem", fontWeight: "900" }}>24/7</div>
          <div style={{ fontSize: "0.8rem", fontWeight: "700", color: COLORS.textMuted }}>AGENT UPTIME</div>
        </div>
      </div>

      {/* Process Section */}
      <section id="process" style={{ padding: "8rem 5%", background: "white" }}>
        <SectionHeader 
          title="A clear, proven process." 
          subtitle="No surprises, no delays. We move from initial audit to production-ready agent in 2 weeks."
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
          {[
            { step: "01", title: "Audit", desc: "Deep-dive into your workflows. Find bottlenecks and the highest-ROI AI opportunities." },
            { step: "02", title: "Architect", desc: "Design the agent logic. Choose tools, plan integrations, map the data flow." },
            { step: "03", title: "Build", desc: "Rapid development with weekly demos. Build → test → iterate until perfect." },
            { step: "04", title: "Deploy", desc: "Go live with monitoring. Full documentation, team training, and support." }
          ].map((item, i) => (
            <div key={i} style={{ position: "relative" }}>
              <div style={{ fontSize: "4rem", fontWeight: "900", color: "#f3f4f6", marginBottom: "-2rem", lineHeight: 1 }}>{item.step}</div>
              <h4 style={{ fontSize: "1.5rem", fontWeight: "800", color: COLORS.primary, marginBottom: "1rem", position: "relative" }}>{item.title}</h4>
              <p style={{ color: COLORS.textMuted, fontSize: "0.95rem", lineHeight: "1.6" }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Services Section */}
      <section id="services" style={{ padding: "8rem 5%", background: COLORS.bgSoft }}>
        <SectionHeader 
          title="The Swarm Fleet" 
          subtitle="Deploy specialized AI agents for analytics, governance, and real-time intelligence. Every agent is ready to scale with your team."
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: "2.5rem", maxWidth: "1400px", margin: "0 auto" }}>
          {agents.map(agent => (
            <AgentCard key={agent.id} agent={agent} onAction={initiateAITalk} />
          ))}
        </div>
      </section>

      {/* Swarm Lab Section */}
      <section id="swarm-lab" style={{ padding: "8rem 5%", background: "white", borderTop: `1px solid ${COLORS.border}`, borderBottom: `1px solid ${COLORS.border}` }}>
        <div style={{ textAlign: "center", marginBottom: "4rem" }}>
          <div style={{ display: "inline-block", padding: "6px 16px", background: "rgba(244, 63, 94, 0.1)", color: "#f43f5e", borderRadius: "99px", fontSize: "0.75rem", fontWeight: "900", marginBottom: "1rem", letterSpacing: "2px" }}>
            PIPELINE & EVENT-DRIVEN FLEET
          </div>
          <h2 style={{ fontSize: "2.5rem", fontWeight: "900", color: COLORS.primary, marginBottom: "1rem", letterSpacing: "-1px" }}>
            The Swarm Lab
          </h2>
          <p style={{ fontSize: "1.1rem", color: COLORS.textMuted, maxWidth: "600px", margin: "0 auto" }}>
            Utility agents that run autonomously in the background to handle data synthesis, document composition, and scheduled pipeline tasks.
          </p>
        </div>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: "2.5rem", maxWidth: "1400px", margin: "0 auto" }}>
          {pipelineAgents.map(agent => (
            <div key={agent.id} style={{ 
              background: "white", 
              padding: "2.5rem", 
              borderRadius: "24px", 
              border: `1px solid ${COLORS.border}`,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              height: "100%",
              boxShadow: "none"
            }}
            className="hover-shadow"
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem" }}>
                  <div style={{ 
                    width: "60px", height: "60px", borderRadius: "16px", 
                    background: `${agent.color}11`, display: "flex", alignItems: "center", 
                    justifyContent: "center", fontSize: "2rem", border: `1px solid ${agent.color}22`
                  }}>
                    {agent.icon}
                  </div>
                  <span style={{ 
                    fontSize: "0.65rem", fontWeight: "900", color: agent.status === "READY" ? COLORS.success : COLORS.textMuted,
                    background: agent.status === "READY" ? `${COLORS.success}11` : "rgba(107, 114, 128, 0.1)",
                    padding: "4px 12px", borderRadius: "99px", letterSpacing: "1px",
                    border: `1px solid ${agent.status === "READY" ? `${COLORS.success}22` : "rgba(107, 114, 128, 0.2)"}`
                  }}>
                    {agent.status}
                  </span>
                </div>
                <h3 style={{ fontSize: "1.5rem", fontWeight: "900", color: COLORS.primary, marginBottom: "1rem" }}>{agent.title}</h3>
                <p style={{ color: COLORS.textMuted, lineHeight: "1.6", marginBottom: "2rem", fontSize: "1rem" }}>{agent.desc}</p>
              </div>
              
              <button 
                onClick={() => handlePipelineAction(agent)}
                style={{ 
                  width: "100%", padding: "1.2rem", background: agent.status === "READY" ? agent.color : COLORS.bgSoft, 
                  color: agent.status === "READY" ? "white" : COLORS.textMuted, border: agent.status === "READY" ? "none" : `1px solid ${COLORS.border}`, borderRadius: "12px", 
                  fontWeight: "800", cursor: agent.status === "READY" ? "pointer" : "not-allowed", fontSize: "0.9rem",
                  letterSpacing: "1px", transition: "all 0.3s ease",
                  opacity: agent.status === "READY" ? 1 : 0.6
                }}
                disabled={agent.status !== "READY"}
              >
                {agent.btnText.toUpperCase()}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" style={{ padding: "8rem 5%", background: COLORS.bgSoft }}>
        <SectionHeader 
          title="Transparent AI Pricing" 
          subtitle="Every automation is different, but our pricing isn't. Honest brackets, transparent ROI, and fixed quotes after your free audit."
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "2.5rem", maxWidth: "1200px", margin: "0 auto" }}>
          {pricing.map((tier, idx) => (
            <PricingCard key={idx} {...tier} />
          ))}
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" style={{ padding: "8rem 5%", background: "white" }}>
        <SectionHeader 
          title="Common Questions" 
          subtitle="Everything you're probably wondering about deploying your AI fleet."
        />
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          {[
            { q: "How long does a typical build take?", a: "Most agents are live in production within 1–2 weeks, including tool integration." },
            { q: "Do you use my data for training?", a: "Never. We use enterprise-grade APIs where data is not used for model training." },
            { q: "Can the agents talk to my existing tools?", a: "Yes. We specialize in connecting to MySQL, MongoDB, Slack, and custom CRM APIs." },
            { q: "What are the running costs?", a: "Typically between ₹1,500 – ₹8,000/mo depending on the agent's message volume." }
          ].map((item, i) => (
            <div key={i} style={{ borderBottom: `1px solid ${COLORS.border}`, padding: "2rem 0" }}>
              <h4 style={{ fontSize: "1.1rem", fontWeight: "800", color: COLORS.primary, marginBottom: "0.5rem" }}>{item.q}</h4>
              <p style={{ color: COLORS.textMuted, fontSize: "1rem", lineHeight: "1.6" }}>{item.a}</p>
            </div>
          ))}
        </div>
      </section>


      {/* Footer */}
      <footer style={{ padding: "6rem 5% 3rem", borderTop: `1px solid ${COLORS.border}` }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "4rem", maxWidth: "1400px", margin: "0 auto", marginBottom: "4rem" }}>
          <div>
            <div style={{ fontSize: "1.5rem", fontWeight: "900", letterSpacing: "2px", marginBottom: "1.5rem" }}>SWARM</div>
            <p style={{ color: COLORS.textMuted, fontSize: "0.9rem", lineHeight: "1.6" }}>
              The future of work is agentic. We bridge the gap between complex AI capabilities and real-world business ROI.
            </p>
          </div>
          <div>
            <h4 style={{ fontSize: "0.9rem", fontWeight: "900", marginBottom: "1.5rem" }}>SERVICES</h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, color: COLORS.textMuted, fontSize: "0.9rem", lineHeight: "2" }}>
              <li>Cortex Analytics</li>
              <li>Security Audits</li>
              <li>Climate Intel</li>
              <li>Autonomous Copilots</li>
            </ul>
          </div>
          </div>
        <div style={{ textAlign: "center", borderTop: `1px solid ${COLORS.border}`, paddingTop: "2rem", color: COLORS.textMuted, fontSize: "0.8rem", letterSpacing: "1px" }}>
          © 2026 SWARM COMMAND · BUILT FOR INDIA AND GLOBE
        </div>
      </footer>

      {/* --- PIPELINE REELS GALLERY MODAL --- */}
      <AnimatePresence>
        {showReelsGallery && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed", inset: 0, zIndex: 1000,
              background: "rgba(11, 15, 25, 0.95)",
              backdropFilter: "blur(25px)",
              display: "flex", flexDirection: "column",
              padding: "4rem 2rem", overflowY: "auto",
              fontFamily: "'Outfit', sans-serif"
            }}
          >
            {/* Gallery Header */}
            <div style={{ maxWidth: "1200px", width: "100%", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4rem" }}>
              <div>
                <span style={{ color: "#f43f5e", fontSize: "0.75rem", fontWeight: "900", letterSpacing: "3px" }}>SWARM LAB PRODUCTION</span>
                <h2 style={{ color: "white", fontSize: "2.5rem", fontWeight: "900", margin: "8px 0 0 0" }}>Pipeline Reels Gallery</h2>
              </div>
              <button
                onClick={() => setShowReelsGallery(false)}
                style={{
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                  color: "white", width: "50px", height: "50px", borderRadius: "50%",
                  fontSize: "1.5rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.2s"
                }}
                onMouseEnter={e => e.target.style.background = "rgba(255,255,255,0.15)"}
                onMouseLeave={e => e.target.style.background = "rgba(255,255,255,0.05)"}
              >
                ×
              </button>
            </div>

            {/* Gallery Cards Grid */}
            <div style={{ maxWidth: "1200px", width: "100%", margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "2.5rem" }}>
              {galleryReels.map((reel, index) => (
                <motion.div
                  key={index}
                  whileHover={{ y: -8, borderColor: "rgba(244, 63, 94, 0.4)" }}
                  style={{
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "24px",
                    padding: "2rem",
                    display: "flex", flexDirection: "column", justifyContent: "space-between",
                    minHeight: "220px", transition: "all 0.3s ease",
                    cursor: "pointer"
                  }}
                  onClick={() => setSelectedReel(reel)}
                >
                  <div>
                    <div style={{ fontSize: "2.5rem", marginBottom: "1.5rem" }}>🎬</div>
                    <h3 style={{ color: "white", fontSize: "1.3rem", fontWeight: "800", marginBottom: "0.5rem" }}>{reel.title}</h3>
                    <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.9rem", lineHeight: "1.5", margin: 0 }}>{reel.desc}</p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2rem", color: "#f43f5e", fontWeight: "800", fontSize: "0.85rem" }}>
                    WATCH PREVIEW <span>→</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- SMARTPHONE CINEMA OVERLAY --- */}
      <AnimatePresence>
        {selectedReel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed", inset: 0, zIndex: 1100,
              background: "rgba(0,0,0,0.9)", backdropFilter: "blur(30px)",
              display: "flex", justifyContent: "center", alignItems: "center",
              flexDirection: "column"
            }}
          >
            {/* Smartphone Wrapper */}
            <div style={{
              position: "relative",
              width: "360px",
              height: "640px",
              borderRadius: "44px",
              border: "14px solid #1f2937",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5), 0 0 80px rgba(244,63,94,0.15)",
              background: "black",
              overflow: "hidden",
              display: "flex", justifyContent: "center", alignItems: "center"
            }}>
              {/* Dynamic Video */}
              <video
                src={`reels/${selectedReel.slug}_reel.mp4`}
                controls
                autoPlay
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover"
                }}
              />

            {/* Close Button on Bezel */}
            <button
              onClick={() => setSelectedReel(null)}
              style={{
                position: "absolute", top: "20px", right: "20px",
                background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.2)",
                color: "white", width: "40px", height: "40px", borderRadius: "50%",
                cursor: "pointer", fontSize: "1.2rem", fontWeight: "bold",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}
            >
              ×
            </button>
          </div>
          <div style={{ color: "rgba(255,255,255,0.5)", marginTop: "2rem", fontSize: "0.85rem", letterSpacing: "2px", fontWeight: "bold" }}>
            NOW PLAYING: {selectedReel.title.toUpperCase()}
          </div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* --- SHADOW AGENT DEPLOY MODAL --- */}
    <AnimatePresence>
      {showShadowInput && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: "fixed", inset: 0, zIndex: 1100,
            background: "rgba(11, 15, 25, 0.75)",
            backdropFilter: "blur(15px)",
            display: "flex", justifyContent: "center", alignItems: "center",
            fontFamily: "'Outfit', sans-serif"
          }}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            style={{
              background: "white",
              width: "100%",
              maxWidth: "500px",
              padding: "3rem",
              borderRadius: "32px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: `1px solid ${COLORS.border}`,
              position: "relative"
            }}
          >
            {/* Close Button */}
            <button
              onClick={() => {
                setShowShadowInput(false);
                setMeetingUrl("");
              }}
              style={{
                position: "absolute", top: "24px", right: "24px",
                background: "none", border: "none", color: COLORS.textMuted,
                fontSize: "1.5rem", cursor: "pointer"
              }}
            >
              ×
            </button>

            <div style={{ textAlign: "center", marginBottom: "2rem" }}>
              <div style={{ 
                width: "60px", height: "60px", borderRadius: "16px", 
                background: "rgba(79, 70, 229, 0.1)", display: "inline-flex", alignItems: "center", 
                justifyContent: "center", fontSize: "2rem", color: "#4f46e5", marginBottom: "1.5rem"
              }}>
                👥
              </div>
              <h3 style={{ fontSize: "1.75rem", fontWeight: "900", color: COLORS.primary, marginBottom: "0.5rem" }}>Deploy Shadow Agent</h3>
              <p style={{ color: COLORS.textMuted, fontSize: "0.95rem", lineHeight: "1.5" }}>
                Pipes a headless browser observer directly into your meeting session to construct daily structural transcription audits.
              </p>
            </div>

            <div style={{ marginBottom: "2rem" }}>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: "900", color: COLORS.primary, letterSpacing: "1px", marginBottom: "8px" }}>
                OFFICIAL MEETING LINK
              </label>
              <input
                type="text"
                placeholder="https://meet.google.com/abc-defg-hij"
                value={meetingUrl}
                onChange={e => setMeetingUrl(e.target.value)}
                style={{
                  width: "100%",
                  padding: "1rem",
                  borderRadius: "12px",
                  border: `1px solid ${COLORS.border}`,
                  fontSize: "0.95rem",
                  fontFamily: "inherit",
                  outline: "none",
                  transition: "border-color 0.2s"
                }}
                onFocus={e => e.target.style.borderColor = "#4f46e5"}
                onBlur={e => e.target.style.borderColor = COLORS.border}
              />
            </div>

            <button
              onClick={handleDeployShadow}
              disabled={isDeployingShadow}
              style={{
                width: "100%",
                padding: "1.2rem",
                background: "#4f46e5",
                color: "white",
                border: "none",
                borderRadius: "12px",
                fontWeight: "900",
                fontSize: "0.95rem",
                letterSpacing: "1px",
                cursor: isDeployingShadow ? "not-allowed" : "pointer",
                opacity: isDeployingShadow ? 0.7 : 1,
                transition: "background 0.2s"
              }}
            >
              {isDeployingShadow ? "SPAWNING VIRTUAL OBSERVER..." : "DEPLOY OBSERVER"}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

      <style dangerouslySetInnerHTML={{ __html: `
        html { scroll-behavior: smooth; }
        .hover-shadow:hover {
          box-shadow: 0 25px 60px -12px rgba(0, 0, 0, 0.08);
        }
      ` }} />
    </div>
  );
}
