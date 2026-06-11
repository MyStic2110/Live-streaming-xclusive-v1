import React, { useState, useEffect } from "react";
import axios from "axios";
import { setupPageAEO, cleanupPageAEO } from "../../utils/aeo";
import { ShieldCheck, AlertCircle, AlertTriangle, Cpu, Activity, ArrowLeft } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";

function SwarmTelemetryPage({ onBack }) {
  const [agentsData, setAgentsData] = useState({});
  const [totalCriticals, setTotalCriticals] = useState(0);
  const [totalWarnings, setTotalWarnings] = useState(0);
  
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
    <div
      style={{
        minHeight: "100vh",
        background: "#080c14",
        backgroundImage: `
          radial-gradient(circle at 80% 10%, rgba(59, 130, 246, 0.08) 0%, transparent 50%),
          radial-gradient(circle at 10% 90%, rgba(139, 92, 246, 0.05) 0%, transparent 50%)
        `,
        color: "#f3f4f6",
        fontFamily: "'Outfit', sans-serif",
        padding: "2rem 6%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: "2.5rem"
      }}
    >
      {/* CSS Injections for Hover Effects and Pulsing Rings */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pulse-ring {
          0% { transform: scale(0.95); opacity: 0.5; }
          50% { transform: scale(1.1); opacity: 0.8; }
          100% { transform: scale(0.95); opacity: 0.5; }
        }
        .pulse-indicator {
          animation: pulse-ring 2s infinite ease-in-out;
        }
        .premium-card {
          background: rgba(17, 24, 39, 0.5);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 24px;
          padding: 1.75rem;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.02);
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        .premium-card:hover {
          transform: translateY(-6px);
          border: 1px solid rgba(59, 130, 246, 0.25);
          box-shadow: 0 20px 40px -10px rgba(59, 130, 246, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }
        .premium-card.vulnerable:hover {
          border: 1px solid rgba(239, 68, 68, 0.25);
          box-shadow: 0 20px 40px -10px rgba(239, 68, 68, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }
        .stat-card {
          background: rgba(255, 255, 255, 0.01);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 20px;
          padding: 1.5rem;
          display: flex;
          align-items: center;
          gap: 1.5rem;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.01);
          transition: all 0.3s ease;
        }
        .stat-card:hover {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .custom-terminal {
          background: #020617;
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 14px;
          padding: 12px 16px;
          max-height: 90px;
          overflow-y: auto;
          font-family: 'JetBrains Mono', 'Courier New', monospace;
          font-size: 0.75rem;
          color: #34d399;
          line-height: 1.5;
        }
        .custom-terminal::-webkit-scrollbar {
          width: 5px;
        }
        .custom-terminal::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-terminal::-webkit-scrollbar-track {
          background: transparent;
        }
        .back-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0.75rem 1.5rem;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          color: #f3f4f6;
          fontWeight: 600;
          cursor: pointer;
          fontSize: 0.9rem;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          backdrop-filter: blur(10px);
        }
        .back-btn:hover {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(59, 130, 246, 0.3);
          transform: translateY(-2px);
        }
      `}} />

      {/* Header Panel */}
      <header
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
            <h1 style={{ fontSize: "2rem", fontWeight: "900", margin: "6px 0 0 0", color: "#ffffff", letterSpacing: "-0.5px" }}>
              Swarm Fleet Posture
            </h1>
          </div>
        </div>

        <button onClick={onBack} className="back-btn">
          <ArrowLeft size={16} strokeWidth={2.5} /> Back to Swarm HQ
        </button>
      </header>

      {/* Global Metrics Panels */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1.5rem" }}>
        {/* Active Agents Card */}
        <div className="stat-card">
          <div style={{ background: "rgba(59, 130, 246, 0.1)", color: "#60a5fa", height: "56px", width: "56px", borderRadius: "14px", display: "flex", justifyContent: "center", alignItems: "center", border: "1px solid rgba(59, 130, 246, 0.2)" }}>
            <ShieldCheck size={28} strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: "800", letterSpacing: "1.5px" }}>ACTIVE AGENTS</div>
            <div style={{ fontSize: "2.25rem", fontWeight: "900", color: "#ffffff", lineHeight: "1.2", marginTop: "4px" }}>{agentEntries.length}</div>
          </div>
        </div>

        {/* Fleet Criticals Card */}
        <div className="stat-card">
          <div style={{
            background: totalCriticals > 0 ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)",
            color: totalCriticals > 0 ? "#f87171" : "#34d399",
            height: "56px", width: "56px", borderRadius: "14px", display: "flex", justifyContent: "center", alignItems: "center",
            border: `1px solid ${totalCriticals > 0 ? "rgba(239, 68, 68, 0.2)" : "rgba(16, 185, 129, 0.2)"}`
          }}>
            <AlertCircle size={28} strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: "800", letterSpacing: "1.5px" }}>FLEET CRITICALS</div>
            <div style={{ fontSize: "2.25rem", fontWeight: "900", color: totalCriticals > 0 ? "#f87171" : "#34d399", lineHeight: "1.2", marginTop: "4px" }}>{totalCriticals}</div>
          </div>
        </div>

        {/* Fleet Warnings Card */}
        <div className="stat-card">
          <div style={{
            background: totalWarnings > 0 ? "rgba(245, 158, 11, 0.1)" : "rgba(16, 185, 129, 0.1)",
            color: totalWarnings > 0 ? "#fbbf24" : "#34d399",
            height: "56px", width: "56px", borderRadius: "14px", display: "flex", justifyContent: "center", alignItems: "center",
            border: `1px solid ${totalWarnings > 0 ? "rgba(245, 158, 11, 0.2)" : "rgba(16, 185, 129, 0.2)"}`
          }}>
            <AlertTriangle size={28} strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: "800", letterSpacing: "1.5px" }}>FLEET WARNINGS</div>
            <div style={{ fontSize: "2.25rem", fontWeight: "900", color: totalWarnings > 0 ? "#fbbf24" : "#34d399", lineHeight: "1.2", marginTop: "4px" }}>{totalWarnings}</div>
          </div>
        </div>
      </section>

      {/* Grid Header */}
      <h2 style={{ fontSize: "1.4rem", fontWeight: "900", color: "#ffffff", marginTop: "1rem", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: "1rem", letterSpacing: "-0.3px" }}>
        Live Agent Instances
      </h2>

      {/* Grid of Active Telemetry Cards */}
      {agentEntries.length === 0 ? (
        <div style={{
          textAlign: "center",
          padding: "6rem 2rem",
          background: "rgba(255,255,255,0.01)",
          borderRadius: "24px",
          border: "1.5px dashed rgba(255, 255, 255, 0.1)",
          color: "#94a3b8"
        }}>
          <Activity size={32} strokeWidth={1.5} style={{ marginBottom: "1rem", opacity: 0.5 }} className="pulse-indicator" />
          <div>Waiting for live telemetry streams...</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "1.75rem" }}>
          {agentEntries.map(([agentId, data]) => {
            const hasCritical = data.critical_count > 0;
            const hasWarning = data.warning_count > 0;
            const dateStr = new Date(data.timestamp).toLocaleString();

            return (
              <div
                key={agentId}
                className={`premium-card ${hasCritical ? "vulnerable" : ""}`}
                style={{
                  border: `1px solid ${hasCritical ? "rgba(239, 68, 68, 0.2)" : hasWarning ? "rgba(245, 158, 11, 0.2)" : "rgba(16, 185, 129, 0.15)"}`,
                }}
              >
                {/* Card Top Block */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h3 style={{ fontSize: "1.3rem", fontWeight: "900", color: "#ffffff", textTransform: "uppercase", letterSpacing: "1px", margin: 0 }}>
                      {agentId}
                    </h3>
                    <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: "6px" }}>
                      Last Audit: {dateStr}
                    </div>
                  </div>
                  
                  {/* Status Badge */}
                  <div style={{
                    background: hasCritical ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)",
                    color: hasCritical ? "#f87171" : "#34d399",
                    padding: "5px 12px",
                    borderRadius: "50px",
                    fontSize: "0.72rem",
                    fontWeight: "900",
                    letterSpacing: "0.5px",
                    border: `1px solid ${hasCritical ? "rgba(239, 68, 68, 0.15)" : "rgba(16, 185, 129, 0.15)"}`
                  }}>
                    {hasCritical ? "VULNERABLE" : "SECURE"}
                  </div>
                </div>

                {/* Criticals & Warnings indicators */}
                <div style={{ display: "flex", gap: "10px", marginTop: "auto" }}>
                  <div className="metric-pill" style={{ border: `1px solid ${hasCritical ? "rgba(239, 68, 68, 0.1)" : "rgba(255,255,255,0.03)"}` }}>
                    <div style={{ fontSize: "0.68rem", color: "#94a3b8", fontWeight: "800", letterSpacing: "0.5px" }}>CRITICALS</div>
                    <div style={{ fontSize: "1.6rem", fontWeight: "900", color: hasCritical ? "#f87171" : "#ffffff", marginTop: "4px" }}>
                      {data.critical_count}
                    </div>
                  </div>
                  <div className="metric-pill" style={{ border: `1px solid ${hasWarning ? "rgba(245, 158, 11, 0.1)" : "rgba(255,255,255,0.03)"}` }}>
                    <div style={{ fontSize: "0.68rem", color: "#94a3b8", fontWeight: "800", letterSpacing: "0.5px" }}>WARNINGS</div>
                    <div style={{ fontSize: "1.6rem", fontWeight: "900", color: hasWarning ? "#fbbf24" : "#ffffff", marginTop: "4px" }}>
                      {data.warning_count}
                    </div>
                  </div>
                </div>

                {/* SRE Action Log Terminal Output */}
                {data.report_summary && data.report_summary.length > 0 && (
                  <div className="custom-terminal">
                    {data.report_summary.map((r, i) => (
                      <div key={i} style={{ marginBottom: "3px" }}>
                        <span style={{ color: "#10b981", marginRight: "6px" }}>&gt;</span>
                        {r}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default SwarmTelemetryPage;
