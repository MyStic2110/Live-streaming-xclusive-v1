import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { setupPageAEO, cleanupPageAEO } from "../../utils/aeo";
import { ShieldCheck, AlertCircle, AlertTriangle, Cpu, Activity, ArrowLeft } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";

// Mini Cyber Radar Component
function RadarSweep() {
  return (
    <div style={{ position: "relative", width: "80px", height: "80px", border: "1px solid rgba(59, 130, 246, 0.25)", borderRadius: "50%", background: "rgba(10, 15, 30, 0.45)", overflow: "hidden" }}>
      {/* Concentric rings */}
      <div style={{ position: "absolute", inset: "12px", border: "1px dashed rgba(59, 130, 246, 0.2)", borderRadius: "50%" }}></div>
      <div style={{ position: "absolute", inset: "24px", border: "1px solid rgba(59, 130, 246, 0.12)", borderRadius: "50%" }}></div>
      <div style={{ position: "absolute", inset: "36px", border: "1px dashed rgba(59, 130, 246, 0.08)", borderRadius: "50%" }}></div>
      
      {/* Crosshairs */}
      <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: "1px", background: "rgba(59, 130, 246, 0.15)" }}></div>
      <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: "1px", background: "rgba(59, 130, 246, 0.15)" }}></div>
      
      {/* Rotating sweep sector */}
      <div className="radar-sweep-line" style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "50%",
        height: "50%",
        background: "linear-gradient(45deg, rgba(59, 130, 246, 0.3) 0%, transparent 100%)",
        transformOrigin: "bottom right",
        borderRadius: "100% 0 0 0"
      }}></div>
      
      {/* Glowing targets */}
      <div className="radar-blip blip-1" style={{ position: "absolute", top: "25%", left: "30%", width: "4px", height: "4px", borderRadius: "50%", background: "#34d399" }}></div>
      <div className="radar-blip blip-2" style={{ position: "absolute", top: "65%", left: "70%", width: "4px", height: "4px", borderRadius: "50%", background: "#f87171" }}></div>
      <div className="radar-blip blip-3" style={{ position: "absolute", top: "40%", left: "75%", width: "4px", height: "4px", borderRadius: "50%", background: "#fbbf24" }}></div>
    </div>
  );
}

// Corner HUD targeted brackets decoration
function CardHUDDecorations({ statusColor }) {
  return (
    <>
      <div className="hud-corner hud-corner-tl" style={{ borderColor: statusColor }} />
      <div className="hud-corner hud-corner-tr" style={{ borderColor: statusColor }} />
      <div className="hud-corner hud-corner-bl" style={{ borderColor: statusColor }} />
      <div className="hud-corner hud-corner-br" style={{ borderColor: statusColor }} />
    </>
  );
}

function SwarmTelemetryPage({ onBack }) {
  const [agentsData, setAgentsData] = useState({});
  const [totalCriticals, setTotalCriticals] = useState(0);
  const [totalWarnings, setTotalWarnings] = useState(0);
  const canvasRef = useRef(null);
  
  // Real-time polling
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await axios.get(`${API}/security/status`);
        if (res.data) {
          // Filter out weather agent (AURA / WEATHER_AGENT)
          const filtered = {};
          Object.entries(res.data).forEach(([agentId, data]) => {
            if (agentId.toUpperCase() !== "AURA" && agentId.toUpperCase() !== "WEATHER_AGENT") {
              filtered[agentId] = data;
            }
          });
          
          setAgentsData(filtered);
          
          let crits = 0;
          let warns = 0;
          Object.values(filtered).forEach(agent => {
            crits += (agent.critical_count || 0);
            warns += (agent.warning_count || 0);
          });
          setTotalCriticals(crits);
          setTotalWarnings(warns);
        }
      } catch (err) {
        console.error("Failed to load security status:", err);
      }
    };
    
    fetchStatus();
    const intervalId = setInterval(fetchStatus, 2000);
    return () => clearInterval(intervalId);
  }, []);

  // Interactive Particle Canvas Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animationFrameId;
    
    let particles = [];
    const maxParticles = 65;
    
    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (!container) return;
      canvas.width = container.scrollWidth || container.clientWidth || window.innerWidth;
      canvas.height = container.scrollHeight || container.clientHeight || window.innerHeight;
    };
    
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    
    // Create initial particle fleet
    for (let i = 0; i < maxParticles; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: Math.random() * 2 + 1,
        color: Math.random() > 0.6 ? "rgba(96, 165, 250, 0.25)" : "rgba(139, 92, 246, 0.18)"
      });
    }
    
    let mouse = { x: null, y: null, radius: 150 };
    
    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };
    
    const handleMouseLeave = () => {
      mouse.x = null;
      mouse.y = null;
    };
    
    const handleClick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      
      // Spawn data-burst particles
      for (let k = 0; k < 6; k++) {
        particles.push({
          x: clickX,
          y: clickY,
          vx: (Math.random() - 0.5) * 2.5,
          vy: (Math.random() - 0.5) * 2.5,
          radius: Math.random() * 1.5 + 1,
          color: "rgba(96, 165, 250, 0.65)",
          life: 90
        });
      }
      
      if (particles.length > maxParticles + 40) {
        particles.splice(maxParticles, particles.length - maxParticles);
      }
    };
    
    const container = canvas.parentElement;
    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseleave", handleMouseLeave);
    container.addEventListener("click", handleClick);
    
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      particles.forEach((p, idx) => {
        p.x += p.vx;
        p.y += p.vy;
        
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        
        if (mouse.x !== null && mouse.y !== null) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist < mouse.radius) {
            const force = (mouse.radius - dist) / mouse.radius;
            const angle = Math.atan2(dy, dx);
            p.x += Math.cos(angle) * force * 1.2;
            p.y += Math.sin(angle) * force * 1.2;
          }
        }
        
        if (p.life !== undefined) {
          p.life--;
          ctx.fillStyle = `rgba(96, 165, 250, ${p.life / 90})`;
        } else {
          ctx.fillStyle = p.color;
        }
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        
        if (p.life !== undefined && p.life <= 0) {
          particles.splice(idx, 1);
        }
      });
      
      // Lines connection
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const p1 = particles[i];
          const p2 = particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          
          if (dist < 120) {
            const alpha = (1 - dist / 120) * 0.12;
            ctx.strokeStyle = `rgba(99, 102, 241, ${alpha})`;
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }
      
      animationFrameId = requestAnimationFrame(draw);
    };
    
    draw();
    
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resizeCanvas);
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseleave", handleMouseLeave);
      container.removeEventListener("click", handleClick);
    };
  }, []);

  // Set AEO metadata
  useEffect(() => {
    setupPageAEO({
      title: "Swarm AI Telemetry | Live Agent Security",
      description: "Real-time fleet-wide security telemetry dashboard for Swarm Agentic Lab.",
      url: window.location.href,
      schemaId: "telemetry-aeo",
      schemaData: {}
    });
    return () => cleanupPageAEO("telemetry-aeo");
  }, []);

  const agentEntries = Object.entries(agentsData);

  return (
    <div className="telemetry-container">
      {/* Interactive Floating Particle Background */}
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 1
        }}
      />

      {/* CSS Injections for HUD, Scanlines, Blinking Blips */}
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;900&family=JetBrains+Mono:wght@400;700&family=Outfit:wght@300;400;600;800;900&display=swap');
        
        .telemetry-container {
          min-height: 100vh;
          background-color: #070913;
          background-image: 
            linear-gradient(rgba(7, 9, 19, 0.95), rgba(7, 9, 19, 0.95)),
            radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.12), transparent 70%),
            linear-gradient(rgba(59, 130, 246, 0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59, 130, 246, 0.02) 1px, transparent 1px);
          background-size: 100% 100%, 100% 100%, 45px 45px, 45px 45px;
          color: #f3f4f6;
          font-family: 'Outfit', sans-serif;
          padding: 2.5rem 6%;
          position: relative;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: 2.5rem;
        }

        .z-content {
          position: relative;
          z-index: 10;
        }

        @keyframes pulse-ring {
          0% { transform: scale(0.95); opacity: 0.4; }
          50% { transform: scale(1.15); opacity: 0.8; }
          100% { transform: scale(0.95); opacity: 0.4; }
        }
        .pulse-indicator {
          animation: pulse-ring 2s infinite ease-in-out;
        }

        .orbitron-title {
          font-family: 'Orbitron', sans-serif;
          letter-spacing: 1.5px;
        }
        .orbitron-stat {
          font-family: 'Orbitron', sans-serif;
        }

        /* Radar animations */
        @keyframes radar-sweep {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .radar-sweep-line {
          animation: radar-sweep 4s linear infinite;
        }
        @keyframes radar-fade {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 1; filter: drop-shadow(0 0 4px currentColor); }
        }
        .radar-blip {
          animation: radar-fade 2s infinite ease-in-out;
        }
        .blip-1 { animation-delay: 0.5s; }
        .blip-2 { animation-delay: 1.2s; }
        .blip-3 { animation-delay: 0s; }

        /* HUD targeted corners */
        .hud-corner {
          position: absolute;
          width: 8px;
          height: 8px;
          border-color: rgba(59, 130, 246, 0.4);
          border-style: solid;
          pointer-events: none;
          transition: border-color 0.4s ease;
        }
        .hud-corner-tl { top: 8px; left: 8px; border-width: 1px 0 0 1px; }
        .hud-corner-tr { top: 8px; right: 8px; border-width: 1px 1px 0 0; }
        .hud-corner-bl { bottom: 8px; left: 8px; border-width: 0 0 1px 1px; }
        .hud-corner-br { bottom: 8px; right: 8px; border-width: 0 1px 1px 0; }

        /* Premium holographic card designs */
        .premium-card {
          position: relative;
          background: rgba(10, 15, 30, 0.6);
          backdrop-filter: blur(25px) saturate(130%);
          border: 1px solid rgba(59, 130, 246, 0.15);
          border-radius: 20px;
          padding: 1.75rem;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 
            0 15px 35px rgba(0, 0, 0, 0.5), 
            inset 0 1px 0 rgba(255, 255, 255, 0.02),
            inset 0 0 15px rgba(59, 130, 246, 0.03);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          gap: 1.35rem;
        }

        .premium-card::after {
          content: '';
          position: absolute;
          top: -100%;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(96, 165, 250, 0.35), transparent);
          animation: scanline 6s linear infinite;
          pointer-events: none;
        }

        @keyframes scanline {
          0% { top: -10%; opacity: 0; }
          10% { opacity: 0.8; }
          90% { opacity: 0.8; }
          100% { top: 110%; opacity: 0; }
        }

        .premium-card:hover {
          transform: translateY(-5px);
          border-color: rgba(59, 130, 246, 0.4);
          box-shadow: 
            0 25px 45px -10px rgba(59, 130, 246, 0.22), 
            inset 0 1px 0 rgba(255, 255, 255, 0.05),
            inset 0 0 20px rgba(59, 130, 246, 0.07);
        }

        /* Vulnerable (Critical) Card State overrides */
        .premium-card.critical {
          border-color: rgba(239, 68, 68, 0.22);
          box-shadow: 
            0 15px 35px rgba(0, 0, 0, 0.5), 
            inset 0 1px 0 rgba(255, 255, 255, 0.02),
            inset 0 0 15px rgba(239, 68, 68, 0.03);
        }

        .premium-card.critical::after {
          background: linear-gradient(90deg, transparent, rgba(239, 68, 68, 0.4), transparent);
        }

        .premium-card.critical:hover {
          border-color: rgba(239, 68, 68, 0.45);
          box-shadow: 
            0 25px 45px -10px rgba(239, 68, 68, 0.22), 
            inset 0 1px 0 rgba(255, 255, 255, 0.05),
            inset 0 0 20px rgba(239, 68, 68, 0.07);
        }

        /* Warning Card State overrides */
        .premium-card.warning {
          border-color: rgba(245, 158, 11, 0.22);
          box-shadow: 
            0 15px 35px rgba(0, 0, 0, 0.5), 
            inset 0 1px 0 rgba(255, 255, 255, 0.02),
            inset 0 0 15px rgba(245, 158, 11, 0.03);
        }

        .premium-card.warning::after {
          background: linear-gradient(90deg, transparent, rgba(245, 158, 11, 0.4), transparent);
        }

        .premium-card.warning:hover {
          border-color: rgba(245, 158, 11, 0.45);
          box-shadow: 
            0 25px 45px -10px rgba(245, 158, 11, 0.22), 
            inset 0 1px 0 rgba(255, 255, 255, 0.05),
            inset 0 0 20px rgba(245, 158, 11, 0.07);
        }

        /* Global HUD stats panels */
        .stat-card {
          background: rgba(10, 15, 30, 0.55);
          backdrop-filter: blur(15px);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 16px;
          padding: 1.5rem;
          display: flex;
          align-items: center;
          gap: 1.5rem;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.01);
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }

        .stat-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 4px;
          height: 100%;
          background: rgba(59, 130, 246, 0.6);
        }

        .stat-card:hover {
          background: rgba(10, 15, 30, 0.7);
          border: 1px solid rgba(59, 130, 246, 0.2);
          box-shadow: 0 12px 40px rgba(59, 130, 246, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.03);
        }

        .stat-card.critical::before {
          background: #f87171;
        }
        .stat-card.critical:hover {
          border-color: rgba(239, 68, 68, 0.25);
          box-shadow: 0 12px 40px rgba(239, 68, 68, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.03);
        }

        .stat-card.warning::before {
          background: #fbbf24;
        }
        .stat-card.warning:hover {
          border-color: rgba(245, 158, 11, 0.25);
          box-shadow: 0 12px 40px rgba(245, 158, 11, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.03);
        }

        .metric-pill {
          flex: 1;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 12px;
          padding: 10px 14px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          transition: all 0.3s ease;
        }
        .metric-pill:hover {
          background: rgba(255, 255, 255, 0.04);
        }

        /* CLI monospaced terminal logs */
        .custom-terminal {
          background: rgba(2, 6, 23, 0.9);
          border: 1px solid rgba(59, 130, 246, 0.15);
          border-radius: 12px;
          padding: 14px 18px;
          max-height: 110px;
          overflow-y: auto;
          font-family: 'JetBrains Mono', 'Courier New', monospace;
          font-size: 0.72rem;
          color: #34d399;
          line-height: 1.6;
          box-shadow: inset 0 0 15px rgba(0, 0, 0, 0.9), 0 4px 12px rgba(0,0,0,0.5);
          position: relative;
        }

        .custom-terminal::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.2) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.03), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.03));
          background-size: 100% 3px, 3px 100%;
          pointer-events: none;
          z-index: 2;
          border-radius: 12px;
        }

        .custom-terminal::-webkit-scrollbar {
          width: 5px;
        }
        .custom-terminal::-webkit-scrollbar-thumb {
          background: rgba(59, 130, 246, 0.35);
          border-radius: 10px;
        }
        .custom-terminal::-webkit-scrollbar-thumb:hover {
          background: rgba(59, 130, 246, 0.55);
        }
        .custom-terminal::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.4);
        }

        @keyframes blink {
          0%, 100% { opacity: 0; }
          50% { opacity: 1; }
        }
        .blinking-cursor {
          animation: blink 1s infinite;
          color: #60a5fa;
          font-weight: bold;
        }

        .back-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0.75rem 1.5rem;
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 14px;
          color: #f3f4f6;
          font-weight: 600;
          cursor: pointer;
          font-size: 0.9rem;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          backdrop-filter: blur(10px);
        }
        .back-btn:hover {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(59, 130, 246, 0.4);
          box-shadow: 0 0 15px rgba(59, 130, 246, 0.15);
          transform: translateY(-2px);
        }
      `}} />

      {/* Header Panel */}
      <header
        className="z-content"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          paddingBottom: "1.75rem"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
          <img
            src="/logo.jpeg"
            alt="Swarm Logo"
            style={{
              height: "50px",
              width: "50px",
              borderRadius: "12px",
              objectFit: "cover",
              boxShadow: "0 8px 24px rgba(59, 130, 246, 0.15)",
              border: "1px solid rgba(255, 255, 255, 0.1)"
            }}
          />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "0.68rem", background: "rgba(59, 130, 246, 0.12)", color: "#60a5fa", padding: "3px 9px", borderRadius: "50px", fontWeight: "900", letterSpacing: "1px", border: "1px solid rgba(59, 130, 246, 0.2)" }}>
                <Cpu size={11} strokeWidth={2.5} />
                AIVYUH SEC-OPS
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "0.68rem", background: "rgba(16, 185, 129, 0.12)", color: "#34d399", padding: "3px 9px", borderRadius: "50px", fontWeight: "900", letterSpacing: "0.5px", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
                <Activity size={11} strokeWidth={2.5} className="pulse-indicator" />
                LIVE TELEMETRY
              </span>
            </div>
            
            <h1 className="orbitron-title" style={{ fontSize: "2rem", fontWeight: "900", margin: "6px 0 0 0", color: "#ffffff", letterSpacing: "-0.5px" }}>
              Swarm Fleet Posture
            </h1>
            
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "8px", fontSize: "0.7rem", color: "#64748b", fontFamily: "'JetBrains Mono', monospace" }}>
              <span style={{ color: "#3b82f6" }}>[SYS_LOCK: ONLINE]</span>
              <span style={{ color: "rgba(255,255,255,0.15)" }}>|</span>
              <span style={{ color: "#34d399" }}>POSTURE: AUDITING</span>
              <span style={{ color: "rgba(255,255,255,0.15)" }}>|</span>
              <span>GRID_SECTOR: SWARM-SEC-09</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <RadarSweep />
          <button onClick={onBack} className="back-btn">
            <ArrowLeft size={16} strokeWidth={2.5} /> Back to Swarm HQ
          </button>
        </div>
      </header>

      {/* Global Metrics Panels */}
      <section className="z-content" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1.5rem" }}>
        {/* Active Agents Card */}
        <div className="stat-card">
          <div style={{ background: "rgba(59, 130, 246, 0.08)", color: "#60a5fa", height: "56px", width: "56px", borderRadius: "14px", display: "flex", justifyContent: "center", alignItems: "center", border: "1px solid rgba(59, 130, 246, 0.15)" }}>
            <ShieldCheck size={28} strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: "800", letterSpacing: "1.5px" }}>ACTIVE AGENTS</div>
            <div className="orbitron-stat" style={{ fontSize: "2.25rem", fontWeight: "900", color: "#ffffff", lineHeight: "1.2", marginTop: "4px" }}>{agentEntries.length}</div>
          </div>
        </div>

        {/* Fleet Criticals Card */}
        <div className={`stat-card ${totalCriticals > 0 ? "critical" : ""}`}>
          <div style={{
            background: totalCriticals > 0 ? "rgba(239, 68, 68, 0.08)" : "rgba(16, 185, 129, 0.08)",
            color: totalCriticals > 0 ? "#f87171" : "#34d399",
            height: "56px", width: "56px", borderRadius: "14px", display: "flex", justifyContent: "center", alignItems: "center",
            border: `1px solid ${totalCriticals > 0 ? "rgba(239, 68, 68, 0.15)" : "rgba(16, 185, 129, 0.15)"}`
          }}>
            <AlertCircle size={28} strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: "800", letterSpacing: "1.5px" }}>FLEET CRITICALS</div>
            <div className="orbitron-stat" style={{ fontSize: "2.25rem", fontWeight: "900", color: totalCriticals > 0 ? "#f87171" : "#34d399", lineHeight: "1.2", marginTop: "4px" }}>{totalCriticals}</div>
          </div>
        </div>

        {/* Fleet Warnings Card */}
        <div className={`stat-card ${totalWarnings > 0 ? "warning" : ""}`}>
          <div style={{
            background: totalWarnings > 0 ? "rgba(245, 158, 11, 0.08)" : "rgba(16, 185, 129, 0.08)",
            color: totalWarnings > 0 ? "#fbbf24" : "#34d399",
            height: "56px", width: "56px", borderRadius: "14px", display: "flex", justifyContent: "center", alignItems: "center",
            border: `1px solid ${totalWarnings > 0 ? "rgba(245, 158, 11, 0.15)" : "rgba(16, 185, 129, 0.15)"}`
          }}>
            <AlertTriangle size={28} strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: "800", letterSpacing: "1.5px" }}>FLEET WARNINGS</div>
            <div className="orbitron-stat" style={{ fontSize: "2.25rem", fontWeight: "900", color: totalWarnings > 0 ? "#fbbf24" : "#34d399", lineHeight: "1.2", marginTop: "4px" }}>{totalWarnings}</div>
          </div>
        </div>
      </section>

      {/* Grid Header */}
      <h2 className="orbitron-title z-content" style={{ fontSize: "1.4rem", fontWeight: "900", color: "#ffffff", marginTop: "1rem", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: "1rem", letterSpacing: "-0.3px" }}>
        Live Agent Instances
      </h2>

      {/* Grid of Active Telemetry Cards */}
      {agentEntries.length === 0 ? (
        <div className="z-content" style={{
          textAlign: "center",
          padding: "6rem 2rem",
          background: "rgba(10, 15, 30, 0.45)",
          borderRadius: "24px",
          border: "1.5px dashed rgba(255, 255, 255, 0.08)",
          color: "#94a3b8"
        }}>
          <Activity size={32} strokeWidth={1.5} style={{ marginBottom: "1rem", opacity: 0.5 }} className="pulse-indicator" />
          <div>Waiting for live telemetry streams...</div>
        </div>
      ) : (
        <div className="z-content" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: "1.75rem" }}>
          {agentEntries.map(([agentId, data]) => {
            const hasCritical = data.critical_count > 0;
            const hasWarning = data.warning_count > 0;
            const dateStr = new Date(data.timestamp).toLocaleString();
            
            // Choose colors based on threat state
            const statusColor = hasCritical ? "#f87171" : hasWarning ? "#fbbf24" : "#34d399";
            const cardClass = hasCritical ? "critical" : hasWarning ? "warning" : "";

            return (
              <div
                key={agentId}
                className={`premium-card ${cardClass}`}
              >
                {/* HUD Corners */}
                <CardHUDDecorations statusColor={statusColor} />

                {/* Card Top Block */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h3 className="orbitron-title" style={{ fontSize: "1.3rem", fontWeight: "900", color: "#ffffff", textTransform: "uppercase", letterSpacing: "1px", margin: 0 }}>
                      {agentId}
                    </h3>
                    <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: "6px", fontFamily: "'JetBrains Mono', monospace" }}>
                      LAST AUDIT: {dateStr}
                    </div>
                  </div>
                  
                  {/* Status Badge */}
                  <div style={{
                    background: hasCritical ? "rgba(239, 68, 68, 0.08)" : hasWarning ? "rgba(245, 158, 11, 0.08)" : "rgba(16, 185, 129, 0.08)",
                    color: statusColor,
                    padding: "5px 12px",
                    borderRadius: "50px",
                    fontSize: "0.72rem",
                    fontWeight: "900",
                    letterSpacing: "0.5px",
                    border: `1px solid ${hasCritical ? "rgba(239, 68, 68, 0.15)" : hasWarning ? "rgba(245, 158, 11, 0.15)" : "rgba(16, 185, 129, 0.15)"}`
                  }}>
                    {hasCritical ? "VULNERABLE" : hasWarning ? "WARNING" : "SECURE"}
                  </div>
                </div>

                {/* Criticals & Warnings indicators */}
                <div style={{ display: "flex", gap: "10px", marginTop: "auto" }}>
                  <div className="metric-pill" style={{ border: `1px solid ${hasCritical ? "rgba(239, 68, 68, 0.12)" : "rgba(255,255,255,0.03)"}` }}>
                    <div style={{ fontSize: "0.68rem", color: "#94a3b8", fontWeight: "800", letterSpacing: "0.5px" }}>CRITICALS</div>
                    <div className="orbitron-stat" style={{ fontSize: "1.6rem", fontWeight: "900", color: hasCritical ? "#f87171" : "#ffffff", marginTop: "4px" }}>
                      {data.critical_count}
                    </div>
                  </div>
                  <div className="metric-pill" style={{ border: `1px solid ${hasWarning ? "rgba(245, 158, 11, 0.12)" : "rgba(255,255,255,0.03)"}` }}>
                    <div style={{ fontSize: "0.68rem", color: "#94a3b8", fontWeight: "800", letterSpacing: "0.5px" }}>WARNINGS</div>
                    <div className="orbitron-stat" style={{ fontSize: "1.6rem", fontWeight: "900", color: hasWarning ? "#fbbf24" : "#ffffff", marginTop: "4px" }}>
                      {data.warning_count}
                    </div>
                  </div>
                </div>

                {/* SRE Action Log Terminal Output */}
                <div className="custom-terminal">
                  {data.report_summary && data.report_summary.length > 0 ? (
                    data.report_summary.map((r, i) => (
                      <div key={i} style={{ marginBottom: "3px" }}>
                        <span style={{ color: statusColor, marginRight: "6px" }}>&gt;</span>
                        {r}
                      </div>
                    ))
                  ) : (
                    <div style={{ color: "rgba(52, 211, 153, 0.6)" }}>&gt; Audited status clear. Listening for anomalies...</div>
                  )}
                  {/* Dynamic system active pulse */}
                  <div style={{ color: "#60a5fa", display: "flex", alignItems: "center", gap: "6px", marginTop: "6px", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "4px" }}>
                    <span className="pulse-indicator" style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: "#60a5fa" }}></span>
                    <span style={{ fontSize: "0.65rem", letterSpacing: "0.5px" }}>AUDIT STATUS: STREAMING</span>
                    <span className="blinking-cursor">_</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default SwarmTelemetryPage;
