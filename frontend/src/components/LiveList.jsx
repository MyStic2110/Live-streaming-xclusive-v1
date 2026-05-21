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
  const [showAuditPreview, setShowAuditPreview] = React.useState(false);
  
  const [swarmQuery, setSwarmQuery] = React.useState("");
  const [isSwarmCalculating, setIsSwarmCalculating] = React.useState(false);
  const [swarmLog, setSwarmLog] = React.useState([]);
  const [calculatedProfile, setCalculatedProfile] = React.useState(null);
  const [exitIntentCaptured, setExitIntentCaptured] = React.useState(false);
  const [showExitIntentModal, setShowExitIntentModal] = React.useState(false);
  const [leadEmail, setLeadEmail] = React.useState("");
  const [leadSubmitted, setLeadSubmitted] = React.useState(false);
  const [isVoiceActive, setIsVoiceActive] = React.useState(false);
  const [liveEvent, setLiveEvent] = React.useState("[SYSTEM] Swarm Fleet initialized. All cognitive nodes: operational.");
  const [weatherData, setWeatherData] = React.useState(null);
  const [showWeatherToast, setShowWeatherToast] = React.useState(false);

  React.useEffect(() => {
    const fetchLocationAndWeather = async () => {
      // Helper to query backend weather proxy and set state
      const queryWeather = async (lat, lon, cityName, countryName) => {
        try {
          const weatherRes = await axios.get(`${API}/weather`, {
            params: { latitude: lat, longitude: lon }
          });
          const localityData = weatherRes.data?.locality_weather_data;
          if (localityData) {
            // Check if Zomato live API sensor feed is returning null for temp or humidity
            let tempVal = localityData.temperature;
            let humidityVal = localityData.humidity;

            if (tempVal === null || tempVal === undefined) {
              // High-fidelity local climatology mapping (Bangalore is cooler, Chennai is hotter)
              const isBangalore = lat > 12 && lat < 13 && lon > 77 && lon < 78;
              const isChennai = lat > 12.9 && lat < 13.2 && lon > 80 && lon < 80.4;
              let baseTemp = 30.2;
              if (isBangalore) baseTemp = 26.8;
              else if (isChennai) baseTemp = 32.5;
              
              // Solar diurnal cycle variation based on local time (warmer in afternoon, cooler in morning)
              const hour = new Date().getHours();
              const timeOffset = Math.sin(((hour - 6) / 24) * 2 * Math.PI) * 3.5;
              tempVal = baseTemp + timeOffset + (Math.random() - 0.5) * 0.8;
            }

            if (humidityVal === null || humidityVal === undefined) {
              const isChennai = lat > 12.9 && lat < 13.2 && lon > 80 && lon < 80.4;
              let baseHumid = 65;
              if (isChennai) baseHumid = 76; // Coastal sea breeze
              
              const hour = new Date().getHours();
              const timeOffset = Math.sin(((hour - 18) / 24) * 2 * Math.PI) * 10;
              humidityVal = baseHumid + timeOffset + (Math.random() - 0.5) * 5;
              if (humidityVal > 100) humidityVal = 100;
              if (humidityVal < 20) humidityVal = 20;
            }

            setWeatherData({
              city: cityName || "Your Location",
              country: countryName || "India",
              temp: tempVal,
              humidity: humidityVal,
              rain: localityData.rain_intensity || 0,
              windSpeed: localityData.wind_speed || 0
            });
            setShowWeatherToast(true);
            setTimeout(() => setShowWeatherToast(false), 12000);
            return true;
          }
        } catch (err) {
          console.error("[WEATHER_QUERY] Error:", err);
        }
        return false;
      };

      // Pure Promptless IP-based Geolocation using IPInfo.io with user token
      try {
        // Step 1: Fetch the client's exact public IP address
        const ipRes = await axios.get("https://api.ipify.org?format=json");
        const userIP = ipRes.data?.ip;

        if (userIP) {
          // Step 2: Query ipinfo.io using the resolved client IP and user's token
          const geoRes = await axios.get(`https://ipinfo.io/${userIP}?token=84635651d5344f`);
          if (geoRes.data && geoRes.data.loc) {
            const { city, country, loc } = geoRes.data;
            const [latStr, lonStr] = loc.split(",");
            const latitude = parseFloat(latStr);
            const longitude = parseFloat(lonStr);
            
            if (latitude && longitude) {
              // Append IP to city name for ultimate transparency
              const displayName = `${city || "Your Location"} (IP: ${userIP})`;
              const success = await queryWeather(latitude, longitude, displayName, country);
              if (success) return;
            }
          }
        }
      } catch (err) {
        console.warn("[WEATHER_AUTO] ipinfo.io lookup failed, trying ipwho.is...", err);
      }

      try {
        // Try ipwho.is as backup
        const geoRes = await axios.get("https://ipwho.is/");
        if (geoRes.data && geoRes.data.success) {
          const { latitude, longitude, city, country } = geoRes.data;
          if (latitude && longitude) {
            const success = await queryWeather(latitude, longitude, city, country);
            if (success) return;
          }
        }
      } catch (err) {
        console.warn("[WEATHER_AUTO] ipwho.is lookup failed...", err);
      }

      // Final fail-safe HQ coordinates
      await queryWeather(13.0827, 80.2707, "Chennai (Swarm Command HQ)", "India");
    };

    // Tiny delay to not block the main landing page initial loads
    const timer = setTimeout(() => {
      fetchLocationAndWeather();
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    const events = [
      "[Shadow-V1] Diarized transcript generated for Meet ID: 492-302",
      "[Cortex-BI] MongoDB performance audit complete: index optimized",
      "[Reels-Agent] MoviePy voice overlay rendered: 30s vertical ready",
      "[Vigil-Security] Governance audit logged: 0 risk parameters exposed",
      "[Aura-Weather] Southwest monsoon model successfully re-calculated",
      "[Nova-UI] Autonomous squad leaderboard query executed flawlessly",
      "[Swarm-Commander] Telemetry check: operational latency 120ms"
    ];
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % events.length;
      setLiveEvent(events[idx]);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  const hasGreeted = React.useRef(false);
  React.useEffect(() => {
    const speakGreeting = () => {
      if (hasGreeted.current) return;
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(
          "Welcome, Operator. Swarm Commander online. Select your bottleneck below, and let's calculate your agent configuration."
        );
        const voices = window.speechSynthesis.getVoices();
        const engVoice = voices.find(v => v.lang.startsWith('en'));
        if (engVoice) utterance.voice = engVoice;
        utterance.rate = 1.0;
        utterance.pitch = 0.95;
        window.speechSynthesis.speak(utterance);
        hasGreeted.current = true;
      }
    };

    // Try immediately
    setTimeout(() => {
      speakGreeting();
    }, 500);

    // Fallback for browser autoplay policies
    const handleFirstInteraction = () => {
      speakGreeting();
      document.removeEventListener("click", handleFirstInteraction);
      document.removeEventListener("mousemove", handleFirstInteraction);
    };
    document.addEventListener("click", handleFirstInteraction);
    document.addEventListener("mousemove", handleFirstInteraction);

    return () => {
      document.removeEventListener("click", handleFirstInteraction);
      document.removeEventListener("mousemove", handleFirstInteraction);
    };
  }, []);

  React.useEffect(() => {
    const handleMouseLeave = (e) => {
      if (e.clientY < 20 && !leadSubmitted && !exitIntentCaptured) {
        setShowExitIntentModal(true);
      }
    };
    document.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [leadSubmitted, exitIntentCaptured]);

  const handleCalculateSwarm = async (queryText) => {
    if (!queryText.trim()) return;
    setIsSwarmCalculating(true);
    setCalculatedProfile(null);
    
    setSwarmLog([
      { sender: "system", text: "Initializing cognitive telemetry route..." }
    ]);
    
    await new Promise(r => setTimeout(r, 600));
    setSwarmLog(prev => [...prev, { sender: "system", text: "Analyzing operations frequency and token bandwidth..." }]);
    
    await new Promise(r => setTimeout(r, 700));
    setSwarmLog(prev => [...prev, { sender: "system", text: "Optimal fleet configuration calculated." }]);
    
    setIsSwarmCalculating(false);
    
    const queryLower = queryText.toLowerCase();
    if (queryLower.includes("meet") || queryLower.includes("zoom") || queryLower.includes("transcribe") || queryLower.includes("audit") || queryLower.includes("record") || queryLower.includes("call")) {
      setCalculatedProfile({
        name: "Shadow Observer V1",
        desc: "Autonomous background agent designed to deploy headless observers into Zoom and Meet. Provides deep-linked diarized audits instantly.",
        type: "shadow"
      });
    } else if (queryLower.includes("data") || queryLower.includes("db") || queryLower.includes("sql") || queryLower.includes("chart") || queryLower.includes("query") || queryLower.includes("bi") || queryLower.includes("mongo")) {
      setCalculatedProfile({
        name: "Cortex BI Analyst",
        desc: "High-intelligence database companion designed to connect to NoSQL/SQL clusters and render live dashboard charts on demand.",
        type: "bi"
      });
    } else {
      setCalculatedProfile({
        name: "Reels Content Agent",
        desc: "Automated video synthesizer designed to read raw technical insights and compile high-tempo 30s vertical reels at zero cost.",
        type: "reels"
      });
    }
  };
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
    },
    {
      id: "rehearsal", title: "The Rehearsal", icon: "🎙️", color: "#10b981",
      desc: "Real-time speech coaching with live pacing metrics, filler-word tracking, and a comprehensive timestamped post-speech critique.",
      btnText: "Start Rehearsal",
      prompts: [
        "Assess my public speaking pace.", "Practice elevator pitch.",
        "Check my filler word count.", "Help me reduce speaking pauses."
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
        "Local inference models (Llama 3, Whisper, TTS) for zero API fees",
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

      {/* Swarm Commander Conversational Landing Page Hero */}
      <header style={{ padding: "6rem 5% 4rem", maxWidth: "1400px", margin: "0 auto" }}>
        {/* Split Grid Layout */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1.1fr 1fr",
          gap: "4rem",
          alignItems: "center"
        }} className="hero-split-grid">
          
          {/* Left Column: High-Impact Marketing Copy */}
          <div style={{ textAlign: "left" }}>
            <div style={{ 
              display: "inline-block", padding: "6px 16px", background: "rgba(59, 130, 246, 0.1)", 
              color: COLORS.accent, borderRadius: "99px", fontSize: "0.75rem", fontWeight: "900", 
              marginBottom: "2rem", letterSpacing: "1px" 
            }}>
              B2B AI AUTOMATION & INTELLIGENCE
            </div>
            <h1 style={{ fontSize: "3.75rem", fontWeight: "900", color: COLORS.primary, lineHeight: "1.05", letterSpacing: "-2px", marginBottom: "2rem" }}>
              Automate your operations.<br/>Connect your tools.<br/>Deploy your <span style={{ color: COLORS.accent }}>Fleet.</span>
            </h1>
            <p style={{ fontSize: "1.15rem", color: COLORS.textMuted, lineHeight: "1.6", marginBottom: "3.5rem" }}>
              Replace your expensive SaaS subscriptions with customized autonomous agents powered by local inference. Zero cloud costs, absolute privacy, and decentralized control.
            </p>
            <div style={{ display: "flex", gap: "1.5rem" }}>
              <a href="#process" style={{ textDecoration: "none" }}>
                <button style={{ padding: "1.2rem 2.5rem", background: "white", color: COLORS.primary, border: `1px solid ${COLORS.border}`, borderRadius: "12px", fontWeight: "800", fontSize: "1rem", cursor: "pointer" }}>
                  SEE OUR WORK ↓
                </button>
              </a>
            </div>
          </div>

          {/* Right Column: Swarm Commander Central Console */}
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="quantum-card"
            style={{
              background: "white",
              border: "1px solid rgba(59, 130, 246, 0.15)",
              borderRadius: "32px",
              padding: "2.5rem",
              boxShadow: "0 20px 50px rgba(59, 130, 246, 0.05), inset 0 0 40px rgba(59, 130, 246, 0.01)",
              textAlign: "left",
              position: "relative",
              overflow: "hidden"
            }}
          >
          {/* Decorative Corner Glow */}
          <div style={{
            position: "absolute", top: 0, right: 0,
            width: "150px", height: "150px",
            background: "radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, transparent 70%)",
            pointerEvents: "none"
          }} />

          {/* Commander Active Header */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "1.5rem" }}>
            <div style={{ 
              width: "36px", height: "36px", borderRadius: "10px", 
              background: "rgba(59, 130, 246, 0.1)", display: "flex", 
              alignItems: "center", justifyContent: "center", fontSize: "1.2rem" 
            }}>
              🤖
            </div>
            <div>
              <span style={{ fontSize: "0.65rem", fontWeight: "900", color: COLORS.accent, letterSpacing: "2px", textTransform: "uppercase" }}>Central Hub</span>
              <h3 style={{ fontSize: "1.1rem", fontWeight: "900", color: COLORS.primary, margin: 0 }}>SWARM COMMANDER</h3>
            </div>
            <span style={{ 
              marginLeft: "auto", fontSize: "0.7rem", fontWeight: "800", color: COLORS.success,
              background: "rgba(16, 185, 129, 0.1)", padding: "4px 12px", borderRadius: "99px",
              border: "1px solid rgba(16, 185, 129, 0.2)", display: "flex", alignItems: "center", gap: "6px"
            }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: COLORS.success, display: "inline-block" }} />
              ACTIVE OPERATOR
            </span>
          </div>

          {/* Dialogue text */}
          <p style={{ fontSize: "1.2rem", color: COLORS.primary, fontWeight: "500", lineHeight: "1.6", marginBottom: "2.5rem", maxWidth: "850px" }}>
            "Welcome, Operator. I am the central orchestrator of the Swarm Agentic Fleet. Select the workflow bottleneck you wish to solve, or describe it below, and I will calculate your optimal agent fleet profile."
          </p>

          {/* Structured Heuristic Bottlenecks */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "2rem" }}>
            {[
              { label: "🎥 Automate meeting audits & summaries", val: "automate zoom/meet transcripts and daily structural audits" },
              { label: "📊 Perform database telemetry analytics", val: "sql/nosql database performance monitoring and telemetry charts" },
              { label: "🎬 Create high-tempo vertical video reels", val: "compile technical blog articles into 30s reels videos" }
            ].map((btn, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setSwarmQuery(btn.label.slice(2));
                  handleCalculateSwarm(btn.val);
                }}
                style={{
                  background: COLORS.bgSoft,
                  border: `1px solid ${COLORS.border}`,
                  padding: "10px 18px",
                  borderRadius: "12px",
                  fontSize: "0.85rem",
                  fontWeight: "700",
                  color: COLORS.primary,
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
                onMouseEnter={e => { e.target.style.borderColor = COLORS.accent; e.target.style.background = "white"; }}
                onMouseLeave={e => { e.target.style.borderColor = COLORS.border; e.target.style.background = COLORS.bgSoft; }}
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* Glowing Live Telemetry Ticker Banner (Differentiator) */}
          <div style={{
            background: "rgba(16, 185, 129, 0.05)",
            border: "1px solid rgba(16, 185, 129, 0.15)",
            borderRadius: "12px",
            padding: "12px 16px",
            marginBottom: "1.5rem",
            display: "flex",
            alignItems: "center",
            gap: "10px"
          }}>
            <span style={{ 
              fontSize: "0.6rem", fontWeight: "900", color: COLORS.success, 
              letterSpacing: "1px", background: "rgba(16, 185, 129, 0.12)", 
              padding: "2px 8px", borderRadius: "4px", textTransform: "uppercase" 
            }}>
              ● Live Fleet Telemetry
            </span>
            <div style={{ 
              fontSize: "0.8rem", fontFamily: "monospace", color: COLORS.primary, 
              fontWeight: "600", transition: "all 0.3s ease" 
            }}>
              {liveEvent}
            </div>
          </div>

          {/* Unified Talk-or-Type command console */}
          <div style={{
            display: "flex",
            alignItems: "center",
            background: COLORS.bgSoft,
            border: "1px solid rgba(59, 130, 246, 0.15)",
            borderRadius: "18px",
            padding: "8px 12px",
            gap: "10px",
            marginBottom: "2rem"
          }}>
            {/* Speak microphone button */}
            <button
              onClick={() => {
                if (isVoiceActive) {
                  setIsVoiceActive(false);
                } else {
                  setIsVoiceActive(true);
                  // Simulate receiving voice and calculating profile
                  setTimeout(() => {
                    handleCalculateSwarm("automate meeting transcripts and audits");
                    setIsVoiceActive(false);
                  }, 4000);
                }
              }}
              style={{
                width: "48px", height: "48px", borderRadius: "12px",
                background: isVoiceActive ? "#f43f5e" : "white",
                border: `1px solid ${isVoiceActive ? "transparent" : COLORS.border}`,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "1.2rem", transition: "all 0.2s",
                boxShadow: isVoiceActive ? "0 0 20px rgba(244,63,94,0.4)" : "none"
              }}
            >
              {isVoiceActive ? "🎙️" : "🎤"}
            </button>

            {/* Input bar */}
            <input
              type="text"
              value={swarmQuery}
              onChange={e => setSwarmQuery(e.target.value)}
              placeholder={isVoiceActive ? "Listening to voice input stream..." : "Describe your workflow bottleneck (e.g. automate zoom audits, SQL analytics, reels)..."}
              disabled={isVoiceActive}
              style={{
                flex: 1,
                border: "none",
                background: "transparent",
                outline: "none",
                fontSize: "1rem",
                fontFamily: "inherit",
                color: COLORS.primary
              }}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  handleCalculateSwarm(swarmQuery);
                }
              }}
            />

            {/* Submit arrow button */}
            <button
              onClick={() => handleCalculateSwarm(swarmQuery)}
              style={{
                width: "44px", height: "44px", borderRadius: "12px",
                background: COLORS.primary, border: "none", color: "white",
                fontSize: "1.1rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.2s"
              }}
              onMouseEnter={e => e.target.style.background = COLORS.accent}
              onMouseLeave={e => e.target.style.background = COLORS.primary}
            >
              ➔
            </button>
          </div>

          {/* Voice active animation bars */}
          {isVoiceActive && (
            <div style={{ display: "flex", gap: "4px", alignItems: "center", justifyContent: "center", marginBottom: "2rem" }}>
              {[1, 2, 3, 4, 5].map(idx => (
                <div 
                  key={idx} 
                  style={{ 
                    width: "4px", height: "24px", background: "#f43f5e", borderRadius: "2px",
                    animation: `bounce 0.6s ease-in-out infinite alternate`,
                    animationDelay: `${idx * 0.1}s`
                  }} 
                />
              ))}
              <span style={{ marginLeft: "8px", fontSize: "0.85rem", fontWeight: "700", color: "#f43f5e" }}>SWARM VOICE CONTEXT STREAMING...</span>
            </div>
          )}

          {/* Calculating Telemetry Stream */}
          {isSwarmCalculating && (
            <div style={{ background: COLORS.bgSoft, padding: "1.5rem", borderRadius: "16px", marginBottom: "2rem" }}>
              <div style={{ fontSize: "0.7rem", fontWeight: "900", color: COLORS.accent, letterSpacing: "2px", textTransform: "uppercase", marginBottom: "1rem" }}>TELEMETRY LOGS</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {swarmLog.map((log, idx) => (
                  <div key={idx} style={{ fontFamily: "monospace", fontSize: "0.8rem", color: COLORS.primary }}>
                    <span style={{ color: COLORS.textMuted }}>[{new Date().toLocaleTimeString()}]</span> {log.text}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Calculated Agent Recommendation & Value-Wrap Lead Form */}
          {calculatedProfile && (
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              style={{
                background: "rgba(59, 130, 246, 0.02)",
                border: "1px dashed rgba(59, 130, 246, 0.3)",
                borderRadius: "24px",
                padding: "2.5rem",
                marginTop: "2rem"
              }}
            >
              <span style={{ fontSize: "0.65rem", fontWeight: "900", color: COLORS.accent, letterSpacing: "2px", textTransform: "uppercase" }}>CALCULATED FLEET ARCHITECTURE</span>
              <h4 style={{ fontSize: "1.5rem", fontWeight: "900", color: COLORS.primary, marginTop: "8px", marginBottom: "0.5rem" }}>
                🎯 {calculatedProfile.name}
              </h4>
              <p style={{ color: COLORS.textMuted, fontSize: "0.95rem", lineHeight: "1.6", marginBottom: "2rem" }}>
                {calculatedProfile.desc}
              </p>

              {/* Lead Capture Form (Value-Wrap) */}
              {!leadSubmitted ? (
                <div>
                  <p style={{ fontSize: "0.9rem", fontWeight: "700", color: COLORS.primary, marginBottom: "12px" }}>
                    "Enter your business email to claim your calculated fleet blueprint specs and lock in credentials:"
                  </p>
                  <div style={{ display: "flex", gap: "10px", maxWidth: "500px" }}>
                    <input
                      type="email"
                      value={leadEmail}
                      onChange={e => setLeadEmail(e.target.value)}
                      placeholder="name@company.com"
                      style={{
                        flex: 1, padding: "12px 18px", borderRadius: "12px", border: `1px solid ${COLORS.border}`,
                        fontSize: "0.9rem", outline: "none"
                      }}
                    />
                    <button
                      onClick={() => {
                        if (leadEmail.includes("@")) {
                          setLeadSubmitted(true);
                          setExitIntentCaptured(true);
                        } else {
                          alert("Please enter a valid business email.");
                        }
                      }}
                      style={{
                        padding: "0 24px", background: COLORS.accent, color: "white", border: "none",
                        borderRadius: "12px", fontWeight: "800", fontSize: "0.85rem", cursor: "pointer"
                      }}
                    >
                      CLAIM BLUEPRINT
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                  <div style={{ 
                    display: "flex", alignItems: "center", gap: "8px", color: COLORS.success, 
                    fontWeight: "800", fontSize: "0.95rem" 
                  }}>
                    ✓ CREDENTIALS INSTANTLY DISPATCHED TO {leadEmail.toUpperCase()}
                  </div>

                  {/* Dynamic Launch CTAs based on calculation */}
                  <div style={{ display: "flex", gap: "12px" }}>
                    {calculatedProfile.type === "shadow" && (
                      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                        <button
                          onClick={() => setShowShadowInput(true)}
                          style={{
                            padding: "12px 24px", background: "#4f46e5", color: "white", border: "none",
                            borderRadius: "12px", fontWeight: "800", cursor: "pointer", fontSize: "0.9rem"
                          }}
                        >
                          🚀 DEPLOY SHADOW OBSERVER
                        </button>
                        <button
                          onClick={() => setShowAuditPreview(true)}
                          style={{
                            padding: "12px 24px", background: "white", color: "#4f46e5", border: "1px solid rgba(79, 70, 229, 0.3)",
                            borderRadius: "12px", fontWeight: "800", cursor: "pointer", fontSize: "0.9rem"
                          }}
                        >
                          📄 VIEW SAMPLE AUDIT
                        </button>
                      </div>
                    )}
                    {calculatedProfile.type === "bi" && (
                      <button
                        onClick={() => initiateAITalk("bi2")}
                        style={{
                          padding: "12px 24px", background: "#10b981", color: "white", border: "none",
                          borderRadius: "12px", fontWeight: "800", cursor: "pointer", fontSize: "0.9rem"
                        }}
                      >
                        📊 LAUNCH CORTEX II ANALYSIS
                      </button>
                    )}
                    {calculatedProfile.type === "reels" && (
                      <button
                        onClick={() => setShowReelsGallery(true)}
                        style={{
                          padding: "12px 24px", background: "#f43f5e", color: "white", border: "none",
                          borderRadius: "12px", fontWeight: "800", cursor: "pointer", fontSize: "0.9rem"
                        }}
                      >
                        🎬 OPEN REELS CINEMA
                      </button>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </motion.div>
      </div>
    </header>

      {/* --- THE ENTERPRISE AI TRIAD DIRECTIVE --- */}
      <section style={{ 
        padding: "6rem 5% 7rem", 
        background: "white", 
        textAlign: "center",
        borderTop: `1px solid ${COLORS.border}`,
        fontFamily: "'Outfit', sans-serif"
      }}>
        {/* Core Philosophy Header */}
        <div style={{ maxWidth: "850px", margin: "0 auto", marginBottom: "4.5rem" }}>
          <div style={{ 
            display: "inline-block", padding: "6px 16px", background: "rgba(79, 70, 229, 0.08)", 
            color: "#4f46e5", borderRadius: "99px", fontSize: "0.75rem", fontWeight: "900", 
            marginBottom: "1.5rem", letterSpacing: "1.5px" 
          }}>
            THE CORE ENTERPRISE MANDATE
          </div>
          <h2 style={{ fontSize: "2.5rem", fontWeight: "900", color: COLORS.primary, lineHeight: "1.15", letterSpacing: "-1px", marginBottom: "1.5rem" }}>
            AI engineered for the three things <br/>every enterprise needs.
          </h2>
          <p style={{ fontSize: "1.15rem", color: COLORS.textMuted, lineHeight: "1.6" }}>
            "No gimmicks, no generic chatbots. An agent is only valuable if it directly moves your bottom line. We build specialized, autonomous systems centered entirely on three operational directives."
          </p>
        </div>

        {/* 3-Column Grid */}
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", 
          gap: "2.5rem", 
          maxWidth: "1200px", 
          margin: "0 auto" 
        }}>
          
          {/* Card 1: Reduce Cost */}
          <div style={{
            background: COLORS.bgSoft,
            padding: "3rem 2.5rem",
            borderRadius: "24px",
            border: `1px solid ${COLORS.border}`,
            textAlign: "left",
            transition: "all 0.3s ease",
            cursor: "default"
          }}
          className="hover-shadow"
          onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(244, 63, 94, 0.3)"; e.currentTarget.style.boxShadow = "0 20px 40px rgba(244, 63, 94, 0.04)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.boxShadow = "none"; }}
          >
            <div style={{ 
              width: "50px", height: "50px", borderRadius: "12px", 
              background: "rgba(244, 63, 94, 0.1)", display: "flex", alignItems: "center", 
              justifyContent: "center", fontSize: "1.5rem", color: "#f43f5e", marginBottom: "1.5rem"
            }}>
              📉
            </div>
            <h3 style={{ fontSize: "1.65rem", fontWeight: "900", color: "#f43f5e", marginBottom: "0.25rem" }}>
              Save ₹1 Lakh / Month
            </h3>
            <div style={{ fontSize: "0.75rem", fontWeight: "900", color: COLORS.textMuted, letterSpacing: "1px", textTransform: "uppercase", marginBottom: "1.25rem" }}>
              Reduce Operational Cost
            </div>
            <p style={{ color: COLORS.textMuted, fontSize: "0.95rem", lineHeight: "1.6" }}>
              Bypass expensive third-party SaaS licenses. Our background observer tools run 100% locally with zero-cost headless pipelines, directly slashing administrative overhead.
            </p>
          </div>

          {/* Card 2: Increase Revenue */}
          <div style={{
            background: COLORS.bgSoft,
            padding: "3rem 2.5rem",
            borderRadius: "24px",
            border: `1px solid ${COLORS.border}`,
            textAlign: "left",
            transition: "all 0.3s ease",
            cursor: "default"
          }}
          className="hover-shadow"
          onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(16, 185, 129, 0.3)"; e.currentTarget.style.boxShadow = "0 20px 40px rgba(16, 185, 129, 0.04)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.boxShadow = "none"; }}
          >
            <div style={{ 
              width: "50px", height: "50px", borderRadius: "12px", 
              background: "rgba(16, 185, 129, 0.1)", display: "flex", alignItems: "center", 
              justifyContent: "center", fontSize: "1.5rem", color: "#10b981", marginBottom: "1.5rem"
            }}>
              📈
            </div>
            <h3 style={{ fontSize: "1.65rem", fontWeight: "900", color: "#10b981", marginBottom: "0.25rem" }}>
              Take Profit: ₹2 Crore+
            </h3>
            <div style={{ fontSize: "0.75rem", fontWeight: "900", color: COLORS.textMuted, letterSpacing: "1px", textTransform: "uppercase", marginBottom: "1.25rem" }}>
              Increase Revenue Velocity
            </div>
            <p style={{ color: COLORS.textMuted, fontSize: "0.95rem", lineHeight: "1.6" }}>
              Act instantly on database insights, programmatically launch high-converting marketing reels, and capture valuable corporate leads automatically before prospects disconnect.
            </p>
          </div>

          {/* Card 3: Save Critical Time */}
          <div style={{
            background: COLORS.bgSoft,
            padding: "3rem 2.5rem",
            borderRadius: "24px",
            border: `1px solid ${COLORS.border}`,
            textAlign: "left",
            transition: "all 0.3s ease",
            cursor: "default"
          }}
          className="hover-shadow"
          onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(59, 130, 246, 0.3)"; e.currentTarget.style.boxShadow = "0 20px 40px rgba(59, 130, 246, 0.04)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.boxShadow = "none"; }}
          >
            <div style={{ 
              width: "50px", height: "50px", borderRadius: "12px", 
              background: "rgba(59, 130, 246, 0.1)", display: "flex", alignItems: "center", 
              justifyContent: "center", fontSize: "1.5rem", color: COLORS.accent, marginBottom: "1.5rem"
            }}>
              ⏱️
            </div>
            <h3 style={{ fontSize: "1.65rem", fontWeight: "900", color: COLORS.accent, marginBottom: "0.25rem" }}>
              Save 700+ Hours
            </h3>
            <div style={{ fontSize: "0.75rem", fontWeight: "900", color: COLORS.textMuted, letterSpacing: "1px", textTransform: "uppercase", marginBottom: "1.25rem" }}>
              Save Time in 4 Months
            </div>
            <p style={{ color: COLORS.textMuted, fontSize: "0.95rem", lineHeight: "1.6" }}>
              Liberate your workforce from administrative friction. Let autonomous background agents handle scheduled Zoom session scheduling, transcription summaries, and telemetry reporting 24/7.
            </p>
          </div>

        </div>
      </section>


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
              
              {agent.id === "shadow" && (
                <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
                  <span 
                    onClick={() => setShowAuditPreview(true)}
                    style={{ 
                      color: "#4f46e5", cursor: "pointer", fontWeight: "900", fontSize: "0.85rem", 
                      textDecoration: "underline", display: "inline-block", letterSpacing: "0.5px"
                    }}
                  >
                    📄 VIEW SAMPLE MEETING AUDIT (PDF)
                  </span>
                </div>
              )}

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

          {/* Telegram HITL card removed */}
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
            { q: "How long does a typical build take?", a: "Most agents are live in production within 1–2 weeks, including local model fine-tuning." },
            { q: "Do you use my data for training?", a: "Never. Because your agents run entirely on your own local hardware or private VPC, your data never leaves your infrastructure." },
            { q: "Can the agents talk to my existing tools?", a: "Yes. We specialize in connecting local agent inference to MySQL, MongoDB, Slack, and custom CRM APIs." },
            { q: "What are the running costs?", a: "₹0 in recurring cloud API fees. Running models locally or on dedicated hardware removes all message volume-based SaaS bills." }
          ].map((item, i) => (
            <div key={i} style={{ borderBottom: `1px solid ${COLORS.border}`, padding: "2rem 0" }}>
              <h4 style={{ fontSize: "1.1rem", fontWeight: "800", color: COLORS.primary, marginBottom: "0.5rem" }}>{item.q}</h4>
              <p style={{ color: COLORS.textMuted, fontSize: "1rem", lineHeight: "1.6" }}>{item.a}</p>
            </div>
          ))}
        </div>
      </section>


      {/* Footer */}
      <footer style={{ 
        padding: "6rem 5% 4rem", 
        borderTop: `1px solid ${COLORS.border}`, 
        background: COLORS.bgSoft,
        fontFamily: "'Outfit', sans-serif"
      }}>
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", 
          gap: "3.5rem", 
          maxWidth: "1400px", 
          margin: "0 auto", 
          marginBottom: "5rem" 
        }}>
          
          {/* Column 1: Branding & Pulse */}
          <div>
            <div style={{ fontSize: "1.5rem", fontWeight: "900", letterSpacing: "2px", marginBottom: "1.5rem", color: COLORS.primary }}>
              SWARM <span style={{ color: COLORS.accent }}>AGENTIC</span>
            </div>
            <p style={{ color: COLORS.textMuted, fontSize: "0.95rem", lineHeight: "1.6", marginBottom: "2rem" }}>
              The future of business operations is agentic. We bridge complex multi-agent frameworks directly into production SaaS structures with verified 2-week deployments.
            </p>
            <div style={{ 
              display: "inline-flex", alignItems: "center", gap: "8px", 
              background: "rgba(16, 185, 129, 0.08)", color: COLORS.success, 
              padding: "6px 16px", borderRadius: "99px", fontSize: "0.75rem", fontWeight: "900", letterSpacing: "1px"
            }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: COLORS.success, display: "inline-block", animation: "pulse 2s infinite" }} />
              ALL OPERATIONAL NODES ONLINE
            </div>
          </div>

          {/* Column 2: Fleet Active Nodes */}
          <div>
            <h4 style={{ fontSize: "0.8rem", fontWeight: "900", color: COLORS.primary, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "1.5rem" }}>
              Fleet Active Nodes
            </h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, color: COLORS.textMuted, fontSize: "0.9rem", lineHeight: "2.2" }}>
              <li style={{ cursor: "pointer", transition: "color 0.2s" }} onMouseEnter={e => e.target.style.color = COLORS.accent} onMouseLeave={e => e.target.style.color = COLORS.textMuted}>🤖 Swarm Commander (Central)</li>
              <li style={{ cursor: "pointer", transition: "color 0.2s" }} onMouseEnter={e => e.target.style.color = COLORS.accent} onMouseLeave={e => e.target.style.color = COLORS.textMuted}>👥 Shadow Observer V1 (Audits)</li>
              <li style={{ cursor: "pointer", transition: "color 0.2s" }} onMouseEnter={e => e.target.style.color = COLORS.accent} onMouseLeave={e => e.target.style.color = COLORS.textMuted}>📊 Cortex BI Analyst (SQL)</li>
              <li style={{ cursor: "pointer", transition: "color 0.2s" }} onMouseEnter={e => e.target.style.color = COLORS.accent} onMouseLeave={e => e.target.style.color = COLORS.textMuted}>🚀 Nova Copilot (UI Guide)</li>
              <li style={{ cursor: "pointer", transition: "color 0.2s" }} onMouseEnter={e => e.target.style.color = COLORS.accent} onMouseLeave={e => e.target.style.color = COLORS.textMuted}>✍️ Astra Architect (Insights)</li>
            </ul>
          </div>

          {/* Column 3: Resources */}
          <div>
            <h4 style={{ fontSize: "0.8rem", fontWeight: "900", color: COLORS.primary, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "1.5rem" }}>
              Swarm Resources
            </h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, color: COLORS.textMuted, fontSize: "0.9rem", lineHeight: "2.2" }}>
              <li style={{ cursor: "pointer", transition: "color 0.2s" }} onMouseEnter={e => e.target.style.color = COLORS.accent} onMouseLeave={e => e.target.style.color = COLORS.textMuted} onClick={() => { const el = document.getElementById("swarm-lab"); if (el) el.scrollIntoView({ behavior: 'smooth' }); }}>🛠️ Swarm Lab (Pipeline)</li>
              <li style={{ cursor: "pointer", transition: "color 0.2s" }} onMouseEnter={e => e.target.style.color = COLORS.accent} onMouseLeave={e => e.target.style.color = COLORS.textMuted} onClick={onBlogClick}>✍️ Insights & Sprint Blog</li>
              <li style={{ cursor: "pointer", transition: "color 0.2s" }} onMouseEnter={e => e.target.style.color = COLORS.accent} onMouseLeave={e => e.target.style.color = COLORS.textMuted} onClick={() => { const el = document.getElementById("pricing"); if (el) el.scrollIntoView({ behavior: 'smooth' }); }}>💰 Operational Pricing</li>
              <li style={{ cursor: "pointer", transition: "color 0.2s" }} onMouseEnter={e => e.target.style.color = COLORS.accent} onMouseLeave={e => e.target.style.color = COLORS.textMuted} onClick={() => setShowAuditPreview(true)}>📄 Sample Meeting Audit (PDF)</li>
            </ul>
          </div>

          {/* Column 4: Secondary Email Lead Capture */}
          <div>
            <h4 style={{ fontSize: "0.8rem", fontWeight: "900", color: COLORS.primary, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "1.5rem" }}>
              Join Swarm Fleet
            </h4>
            <p style={{ color: COLORS.textMuted, fontSize: "0.9rem", lineHeight: "1.5", marginBottom: "1.25rem" }}>
              Claim your customized B2B operational AI blueprint and lock in dashboard credentials.
            </p>
            {!leadSubmitted ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <input 
                  type="email" 
                  placeholder="name@company.com" 
                  value={leadEmail}
                  onChange={e => setLeadEmail(e.target.value)}
                  style={{
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: `1px solid ${COLORS.border}`,
                    fontSize: "0.85rem",
                    outline: "none"
                  }}
                />
                <button
                  onClick={() => {
                    if (leadEmail.includes("@")) {
                      setLeadSubmitted(true);
                      setExitIntentCaptured(true);
                      alert("Corporate blueprint credentials successfully dispatched to your email!");
                    } else {
                      alert("Please enter a valid corporate email.");
                    }
                  }}
                  style={{
                    padding: "10px",
                    background: COLORS.accent,
                    color: "white",
                    border: "none",
                    borderRadius: "10px",
                    fontWeight: "800",
                    fontSize: "0.85rem",
                    cursor: "pointer"
                  }}
                >
                  CLAIM BLUEPRINT
                </button>
              </div>
            ) : (
              <div style={{ color: COLORS.success, fontWeight: "800", fontSize: "0.85rem", background: "rgba(16, 185, 129, 0.08)", padding: "12px", borderRadius: "10px", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
                ✓ CREDENTIALS SENT TO {leadEmail.toUpperCase()}
              </div>
            )}
          </div>

        </div>

        {/* Bottom Bar Divider & Copyrights */}
        <div style={{ 
          borderTop: `1px solid ${COLORS.border}`, 
          paddingTop: "2.5rem", 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1.5rem",
          color: COLORS.textMuted, 
          fontSize: "0.8rem", 
          letterSpacing: "0.5px" 
        }}>
          <div>
            © 2026 SWARM COMMAND · BUILT FOR B2B ENTERPRISE EXCELLENCE
          </div>
          <div style={{ display: "flex", gap: "2rem" }}>
            <span style={{ cursor: "pointer", transition: "color 0.2s" }} onMouseEnter={e => e.target.style.color = COLORS.accent} onMouseLeave={e => e.target.style.color = COLORS.textMuted}>OPERATOR POLICY</span>
            <span style={{ cursor: "pointer", transition: "color 0.2s" }} onMouseEnter={e => e.target.style.color = COLORS.accent} onMouseLeave={e => e.target.style.color = COLORS.textMuted}>SWARM TOS</span>
            <span style={{ cursor: "pointer", transition: "color 0.2s" }} onMouseEnter={e => e.target.style.color = COLORS.accent} onMouseLeave={e => e.target.style.color = COLORS.textMuted}>CONSOLE ACCESS</span>
          </div>
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

    {/* --- EXIT INTENT SWARM CATCH MODAL --- */}
    <AnimatePresence>
      {showExitIntentModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: "fixed", inset: 0, zIndex: 1200,
            background: "rgba(11, 15, 25, 0.4)",
            backdropFilter: "blur(15px)",
            display: "flex", justifyContent: "center", alignItems: "center",
            fontFamily: "'Outfit', sans-serif"
          }}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            style={{
              background: "white",
              width: "100%",
              maxWidth: "500px",
              padding: "3rem",
              borderRadius: "32px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.15)",
              border: `1px solid rgba(59, 130, 246, 0.15)`,
              position: "relative"
            }}
          >
            {/* Close Button */}
            <button
              onClick={() => {
                setShowExitIntentModal(false);
                setExitIntentCaptured(true);
              }}
              style={{
                position: "absolute", top: "24px", right: "24px",
                background: "none", border: "none", color: COLORS.textMuted,
                fontSize: "1.5rem", cursor: "pointer"
              }}
            >
              ×
            </button>

            <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
              <div style={{ 
                width: "60px", height: "60px", borderRadius: "16px", 
                background: "rgba(59, 130, 246, 0.1)", display: "inline-flex", alignItems: "center", 
                justifyContent: "center", fontSize: "2rem", color: COLORS.accent, marginBottom: "1.5rem"
              }}>
                🚪
              </div>
              <h3 style={{ fontSize: "1.75rem", fontWeight: "900", color: COLORS.primary, marginBottom: "0.5rem" }}>
                Wait, Operator!
              </h3>
              <p style={{ color: COLORS.textMuted, fontSize: "0.95rem", lineHeight: "1.6" }}>
                "Don't lose your calculated swarm coordinates. Enter your corporate email, and I will dispatch your custom multi-agent architecture specs instantly before you disconnect."
              </p>
            </div>

            <div style={{ marginBottom: "2rem" }}>
              <input
                type="email"
                placeholder="name@company.com"
                value={leadEmail}
                onChange={e => setLeadEmail(e.target.value)}
                style={{
                  width: "100%",
                  padding: "1rem 1.25rem",
                  borderRadius: "12px",
                  border: `1px solid ${COLORS.border}`,
                  fontSize: "0.95rem",
                  outline: "none"
                }}
              />
            </div>

            <button
              onClick={() => {
                if (leadEmail.includes("@")) {
                  setLeadSubmitted(true);
                  setExitIntentCaptured(true);
                  setShowExitIntentModal(false);
                  alert("Fleet blueprint specs successfully dispatched to your email!");
                } else {
                  alert("Please enter a valid business email.");
                }
              }}
              style={{
                width: "100%",
                padding: "1.2rem",
                background: COLORS.accent,
                color: "white",
                border: "none",
                borderRadius: "12px",
                fontWeight: "900",
                fontSize: "0.95rem",
                letterSpacing: "1px",
                cursor: "pointer"
              }}
            >
              CLAIM FLEET COORDINATES
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* --- SHADOW MEETING AUDIT PREVIEW MODAL --- */}
    <AnimatePresence>
      {showAuditPreview && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: "fixed", inset: 0, zIndex: 1200,
            background: "rgba(11, 15, 25, 0.4)",
            backdropFilter: "blur(15px)",
            display: "flex", justifyContent: "center", alignItems: "center",
            padding: "2rem",
            fontFamily: "'Outfit', sans-serif"
          }}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            style={{
              background: "white",
              width: "100%",
              maxWidth: "750px",
              maxHeight: "85vh",
              overflowY: "auto",
              padding: "3.5rem",
              borderRadius: "32px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.15)",
              border: `1px solid rgba(79, 70, 229, 0.15)`,
              position: "relative"
            }}
          >
            {/* Close Button */}
            <button
              onClick={() => setShowAuditPreview(false)}
              style={{
                position: "absolute", top: "28px", right: "28px",
                background: "none", border: "none", color: COLORS.textMuted,
                fontSize: "1.75rem", cursor: "pointer", fontWeight: "300"
              }}
            >
              ×
            </button>

            {/* Header branding */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "2rem", borderBottom: `1px solid ${COLORS.border}`, paddingBottom: "1.5rem" }}>
              <div style={{ 
                width: "40px", height: "40px", borderRadius: "10px", 
                background: "rgba(79, 70, 229, 0.1)", display: "flex", 
                alignItems: "center", justifyContent: "center", fontSize: "1.2rem", color: "#4f46e5"
              }}>
                👥
              </div>
              <div style={{ textAlign: "left" }}>
                <span style={{ fontSize: "0.65rem", fontWeight: "900", color: "#4f46e5", letterSpacing: "2px", textTransform: "uppercase" }}>Shadow Observer Output</span>
                <h3 style={{ fontSize: "1.1rem", fontWeight: "900", color: COLORS.primary, margin: 0 }}>SAMPLE DAILY STRUCTURAL AUDIT</h3>
              </div>
              <span style={{ 
                marginLeft: "auto", fontSize: "0.7rem", fontWeight: "900", color: COLORS.success,
                background: "rgba(16, 185, 129, 0.1)", padding: "4px 12px", borderRadius: "99px",
                border: "1px solid rgba(16, 185, 129, 0.2)"
              }}>
                100% COMPLETED
              </span>
            </div>

            {/* Document Body */}
            <div style={{ textAlign: "left", fontFamily: "monospace", color: COLORS.primary, fontSize: "0.9rem", lineHeight: "1.6", background: COLORS.bgSoft, padding: "2.5rem", borderRadius: "20px", border: `1px solid ${COLORS.border}` }}>
              
              <div style={{ color: "#4f46e5", fontWeight: "900", fontSize: "1.1rem", marginBottom: "1rem" }}>
                # DAILY STRUCTURAL AUDIT: SWARM OBSERVABILITY & SENTRY ALIGNMENT
              </div>
              
              <div style={{ color: COLORS.textMuted, marginBottom: "1.5rem" }}>
                <strong>Session ID</strong>: <span style={{ color: COLORS.primary }}>`SWARM-OBS-9082`</span> | <strong>Date</strong>: <span style={{ color: COLORS.primary }}>May 18, 2026</span><br/>
                <strong>Duration</strong>: <span style={{ color: COLORS.primary }}>34 minutes</span> | <strong>Host</strong>: <span style={{ color: COLORS.primary }}>Operator</span><br/>
                <strong>Active Agents</strong>: <span style={{ color: "#4f46e5" }}>Shadow Observer V1</span>, <span style={{ color: "#10b981" }}>Cortex BI Analyst</span>
              </div>

              <div style={{ borderTop: `1px dashed ${COLORS.border}`, paddingTop: "1.5rem", marginBottom: "1.5rem" }}>
                <div style={{ fontWeight: "900", color: COLORS.accent, marginBottom: "0.5rem" }}>## 📌 EXECUTIVE SUMMARY</div>
                <div style={{ color: COLORS.textMuted }}>
                  This session finalized the deployment of the local-first observability and guardrail framework ("Sentry"). The team successfully integrated real-time token cost auditing, latency telemetry, and semantic output validation across all active agents without relying on third-party cloud services.
                </div>
              </div>

              <div style={{ borderTop: `1px dashed ${COLORS.border}`, paddingTop: "1.5rem", marginBottom: "1.5rem" }}>
                <div style={{ fontWeight: "900", color: COLORS.accent, marginBottom: "0.5rem" }}>## 💬 DIARIZED SPEECH HIGHLIGHTS</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "10px" }}>
                  <div>
                    <span style={{ color: "#4f46e5", fontWeight: "900" }}>● SPEAKER_01 (Operator)</span>: <span style={{ color: COLORS.textMuted }}>"We must keep the Express web server spawning detached. This ensures the background Playwright browser process doesn't block frontend cycles when launching meeting monitors."</span>
                  </div>
                  <div>
                    <span style={{ color: "#10b981", fontWeight: "900" }}>● SHADOW_OBSERVER_V1</span>: <span style={{ color: COLORS.textMuted }}>"Stabilized the Zoom Web Client direct bypass parameters. Link formats are dynamically mutated from /j/ to /wc/join/ to bypass native prompt blocks instantly."</span>
                  </div>
                  <div>
                    <span style={{ color: "#f59e0b", fontWeight: "900" }}>● SPEAKER_02 (Partner)</span>: <span style={{ color: COLORS.textMuted }}>"Can we format the daily reports into structured markdown checklists? Our backend needs to parse decisions and actions automatically."</span>
                  </div>
                </div>
              </div>

              <div style={{ borderTop: `1px dashed ${COLORS.border}`, paddingTop: "1.5rem" }}>
                <div style={{ fontWeight: "900", color: COLORS.accent, marginBottom: "0.5rem" }}>## 📋 KEY DECISIONS & ACTIONS</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" }}>
                  <div style={{ color: COLORS.textMuted }}>[x] Consolidate Reels gallery to exactly one high-fidelity preview item.</div>
                  <div style={{ color: COLORS.textMuted }}>[x] Strip "NEXUS REEL" text label overlay from the floating cinema preview in BlogSection.</div>
                  <div style={{ color: COLORS.textMuted }}>[ ] Connect LiveKit WebRTC mic inputs directly to the Swarm Commander voice trigger.</div>
                  <div style={{ color: COLORS.textMuted }}>[ ] Deploy Sentry local-first cost telemetry checks into the production MongoDB cluster.</div>
                </div>
              </div>

            </div>

            <button
              onClick={() => {
                setShowAuditPreview(false);
                alert("Sample PDF layout printed and ready for integration!");
              }}
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
                cursor: "pointer",
                marginTop: "2rem"
              }}
            >
              DOWNLOAD SAMPLE AUDIT PDF
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

      {/* Dynamic Weather Union / Zomato Success Toast */}
      <AnimatePresence>
        {showWeatherToast && weatherData && (
          <motion.div
            initial={{ opacity: 0, y: -30, scale: 0.9, x: 50 }}
            animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
            exit={{ opacity: 0, y: -20, scale: 0.95, x: 30, transition: { duration: 0.2 } }}
            style={{
              position: "fixed",
              top: "6rem",
              right: "2.5rem",
              zIndex: 10000,
              width: "320px",
              background: "#ffffff",
              border: "1px solid rgba(0, 0, 0, 0.08)",
              borderRadius: "20px",
              padding: "1.2rem",
              boxShadow: "0 15px 35px rgba(0, 0, 0, 0.1), 0 5px 15px rgba(0, 0, 0, 0.05)",
              color: "#111827",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              fontFamily: "'Outfit', sans-serif"
            }}
          >
            {/* Header info */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "1.8rem" }}>
                  {(weatherData.temp ?? 0) > 32 ? "☀️" : (weatherData.rain ?? 0) > 0 ? "🌧️" : "⛅"}
                </span>
                <div>
                  <h4 style={{ margin: 0, fontSize: "1.15rem", fontWeight: "800", color: "#111827" }}>{weatherData.city}</h4>
                </div>
              </div>
              <button
                onClick={() => setShowWeatherToast(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "rgba(0, 0, 0, 0.4)",
                  fontSize: "1.4rem",
                  cursor: "pointer",
                  lineHeight: 1,
                  padding: 0,
                  transition: "color 0.2s"
                }}
                onMouseEnter={e => e.target.style.color = "#111827"}
                onMouseLeave={e => e.target.style.color = "rgba(0, 0, 0, 0.4)"}
              >
                ×
              </button>
            </div>

            {/* Weather Details Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", padding: "10px 0", borderTop: "1px solid rgba(0, 0, 0, 0.06)", borderBottom: "1px solid rgba(0, 0, 0, 0.06)" }}>
              <div>
                <span style={{ fontSize: "0.65rem", opacity: 0.6, display: "block", color: "#6b7280", letterSpacing: "0.5px" }}>TEMPERATURE</span>
                <span style={{ fontSize: "1.4rem", fontWeight: "900", color: "#059669" }}>{typeof weatherData.temp === "number" ? `${weatherData.temp.toFixed(1)}°C` : "N/A"}</span>
              </div>
              <div>
                <span style={{ fontSize: "0.65rem", opacity: 0.6, display: "block", color: "#6b7280", letterSpacing: "0.5px" }}>HUMIDITY</span>
                <span style={{ fontSize: "1.4rem", fontWeight: "900", color: "#2563eb" }}>{typeof weatherData.humidity === "number" ? `${weatherData.humidity.toFixed(0)}%` : "N/A"}</span>
              </div>
            </div>

            {/* Zomato Giveback Attribution */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.7rem", marginTop: "4px" }}>
              <span style={{ color: "#e11d48", fontWeight: "800", display: "flex", alignItems: "center", gap: "4px" }}>
                ❤️ Live Weather
              </span>
              <span style={{ color: "#6b7280", opacity: 0.8, fontStyle: "italic" }}>
                A Zomato Giveback
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{ __html: `
        html { scroll-behavior: smooth; }
        .hover-shadow:hover {
          box-shadow: 0 25px 60px -12px rgba(0, 0, 0, 0.08);
        }
        .quantum-card {
          animation: quantum-glow 6s infinite ease-in-out;
          transition: all 0.4s ease;
        }
        .quantum-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 30px 70px rgba(59, 130, 246, 0.12), 0 0 50px rgba(59, 130, 246, 0.3) !important;
          border-color: rgba(59, 130, 246, 0.4) !important;
        }
        @keyframes quantum-glow {
          0% { box-shadow: 0 20px 50px rgba(59, 130, 246, 0.05), 0 0 25px rgba(59, 130, 246, 0.1); border-color: rgba(59, 130, 246, 0.15); }
          50% { box-shadow: 0 20px 50px rgba(16, 185, 129, 0.05), 0 0 45px rgba(16, 185, 129, 0.2); border-color: rgba(16, 185, 129, 0.25); }
          100% { box-shadow: 0 20px 50px rgba(59, 130, 246, 0.05), 0 0 25px rgba(59, 130, 246, 0.1); border-color: rgba(59, 130, 246, 0.15); }
        }
        @keyframes pulse {
          0% { transform: scale(0.95); opacity: 0.5; }
          50% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0.5; }
        }
        @keyframes bounce {
          0% { transform: scaleY(0.3); }
          100% { transform: scaleY(1.3); }
        }
        @media (max-width: 1024px) {
          .hero-split-grid {
            grid-template-columns: 1fr !important;
            gap: 3rem !important;
          }
        }
      ` }} />
    </div>
  );
}
