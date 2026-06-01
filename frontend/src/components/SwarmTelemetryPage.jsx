import React, { useState, useEffect } from "react";
import axios from "axios";
import { setupPageAEO, cleanupPageAEO } from "../utils/aeo";

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
          setAgentsData(res.data);
          
          let crits = 0;
          let warns = 0;
          Object.values(res.data).forEach(agent => {
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
        background: "#0f172a", // sleek dark mode
        backgroundImage: "radial-gradient(circle at top right, rgba(59, 130, 246, 0.1) 0%, transparent 40%), radial-gradient(circle at bottom left, rgba(16, 185, 129, 0.05) 0%, transparent 40%)",
        color: "#f8fafc",
        fontFamily: "'Outfit', sans-serif",
        padding: "2rem 4%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: "2rem"
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          paddingBottom: "1.5rem"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <img
            src="/logo.jpeg"
            alt="Swarm Logo"
            style={{ height: "48px", width: "48px", borderRadius: "10px", objectFit: "cover", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}
          />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "0.7rem", background: "rgba(59, 130, 246, 0.2)", color: "#60a5fa", padding: "2px 8px", borderRadius: "4px", fontWeight: "900", letterSpacing: "1px" }}>
                AIVYUH SEC-OPS
              </span>
              <span style={{ fontSize: "0.7rem", background: "rgba(16, 185, 129, 0.2)", color: "#34d399", padding: "2px 8px", borderRadius: "4px", fontWeight: "900" }}>
                LIVE TELEMETRY
              </span>
            </div>
            <h1 style={{ fontSize: "1.8rem", fontWeight: "800", margin: "4px 0 0 0", color: "#ffffff", letterSpacing: "-0.5px" }}>
              Swarm Fleet Posture
            </h1>
          </div>
        </div>

        <button
          onClick={onBack}
          style={{
            padding: "0.8rem 1.5rem",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "12px",
            color: "#f8fafc",
            fontWeight: "600",
            cursor: "pointer",
            fontSize: "0.9rem",
            transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.transform = "translateY(0)"; }}
        >
          ← Back to Swarm HQ
        </button>
      </header>

      {/* Global Metrics */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1.5rem" }}>
        <div style={{ background: "rgba(255,255,255,0.03)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "16px", padding: "1.5rem", display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <div style={{ background: "rgba(59, 130, 246, 0.1)", color: "#60a5fa", height: "60px", width: "60px", borderRadius: "12px", display: "flex", justifyContent: "center", alignItems: "center", fontSize: "2rem" }}>🛡️</div>
          <div>
            <div style={{ fontSize: "0.85rem", color: "#94a3b8", fontWeight: "700", letterSpacing: "1px" }}>ACTIVE AGENTS</div>
            <div style={{ fontSize: "2.5rem", fontWeight: "900", color: "#ffffff", lineHeight: "1" }}>{agentEntries.length}</div>
          </div>
        </div>

        <div style={{ background: "rgba(255,255,255,0.03)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "16px", padding: "1.5rem", display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <div style={{ background: totalCriticals > 0 ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)", color: totalCriticals > 0 ? "#f87171" : "#34d399", height: "60px", width: "60px", borderRadius: "12px", display: "flex", justifyContent: "center", alignItems: "center", fontSize: "2rem" }}>🚨</div>
          <div>
            <div style={{ fontSize: "0.85rem", color: "#94a3b8", fontWeight: "700", letterSpacing: "1px" }}>FLEET CRITICALS</div>
            <div style={{ fontSize: "2.5rem", fontWeight: "900", color: totalCriticals > 0 ? "#ef4444" : "#10b981", lineHeight: "1" }}>{totalCriticals}</div>
          </div>
        </div>

        <div style={{ background: "rgba(255,255,255,0.03)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "16px", padding: "1.5rem", display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <div style={{ background: totalWarnings > 0 ? "rgba(245, 158, 11, 0.1)" : "rgba(16, 185, 129, 0.1)", color: totalWarnings > 0 ? "#fbbf24" : "#34d399", height: "60px", width: "60px", borderRadius: "12px", display: "flex", justifyContent: "center", alignItems: "center", fontSize: "2rem" }}>⚠️</div>
          <div>
            <div style={{ fontSize: "0.85rem", color: "#94a3b8", fontWeight: "700", letterSpacing: "1px" }}>FLEET WARNINGS</div>
            <div style={{ fontSize: "2.5rem", fontWeight: "900", color: totalWarnings > 0 ? "#f59e0b" : "#10b981", lineHeight: "1" }}>{totalWarnings}</div>
          </div>
        </div>
      </section>

      {/* Grid of Agents */}
      <h2 style={{ fontSize: "1.5rem", fontWeight: "800", color: "#ffffff", marginTop: "1rem", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "1rem" }}>
        Live Agent Instances
      </h2>

      {agentEntries.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem", color: "#64748b" }}>Waiting for telemetry streams...</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.5rem" }}>
          {agentEntries.map(([agentId, data]) => {
            const hasCritical = data.critical_count > 0;
            const hasWarning = data.warning_count > 0;
            const dateStr = new Date(data.timestamp).toLocaleString();

            return (
              <div 
                key={agentId}
                style={{
                  background: "rgba(255,255,255,0.02)",
                  backdropFilter: "blur(12px)",
                  border: `1px solid ${hasCritical ? "rgba(239, 68, 68, 0.3)" : hasWarning ? "rgba(245, 158, 11, 0.3)" : "rgba(16, 185, 129, 0.2)"}`,
                  borderRadius: "20px",
                  padding: "1.5rem",
                  transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.2)"
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = "translateY(-6px)";
                  e.currentTarget.style.boxShadow = `0 15px 40px ${hasCritical ? "rgba(239, 68, 68, 0.15)" : hasWarning ? "rgba(245, 158, 11, 0.1)" : "rgba(16, 185, 129, 0.1)"}`;
                  e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 10px 30px rgba(0,0,0,0.2)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.02)";
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <h3 style={{ fontSize: "1.3rem", fontWeight: "800", color: "#ffffff", textTransform: "uppercase", letterSpacing: "1px", margin: 0 }}>
                        {agentId}
                      </h3>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(16, 185, 129, 0.1)", padding: "3px 8px", borderRadius: "12px", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
                        <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981" }} />
                        <span style={{ fontSize: "0.65rem", fontWeight: "800", color: "#34d399", letterSpacing: "0.5px" }}>ONLINE</span>
                      </div>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "4px" }}>
                      Last Audit: {dateStr}
                    </div>
                  </div>
                  <div style={{
                    background: hasCritical ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)",
                    color: hasCritical ? "#ef4444" : "#10b981",
                    padding: "6px 12px",
                    borderRadius: "20px",
                    fontSize: "0.75rem",
                    fontWeight: "800",
                    border: `1px solid ${hasCritical ? "rgba(239, 68, 68, 0.2)" : "rgba(16, 185, 129, 0.2)"}`
                  }}>
                    {hasCritical ? "VULNERABLE" : "SECURE"}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "10px", marginTop: "auto" }}>
                  <div style={{ flex: 1, background: "rgba(0,0,0,0.2)", padding: "10px", borderRadius: "10px", textAlign: "center", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: "700" }}>CRITICALS</div>
                    <div style={{ fontSize: "1.5rem", fontWeight: "900", color: hasCritical ? "#ef4444" : "#f8fafc" }}>{data.critical_count}</div>
                  </div>
                  <div style={{ flex: 1, background: "rgba(0,0,0,0.2)", padding: "10px", borderRadius: "10px", textAlign: "center", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: "700" }}>WARNINGS</div>
                    <div style={{ fontSize: "1.5rem", fontWeight: "900", color: hasWarning ? "#f59e0b" : "#f8fafc" }}>{data.warning_count}</div>
                  </div>
                </div>

                {data.report_summary && data.report_summary.length > 0 && (
                  <div style={{ 
                    background: "rgba(255,255,255,0.02)", 
                    padding: "10px", 
                    borderRadius: "8px", 
                    border: "1px solid rgba(255,255,255,0.05)",
                    maxHeight: "80px",
                    overflowY: "auto",
                    fontSize: "0.75rem",
                    color: "#cbd5e1",
                    lineHeight: "1.4"
                  }} className="terminal-scroll">
                    {data.report_summary.map((r, i) => (
                      <div key={i} style={{ marginBottom: "4px" }}>• {r}</div>
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
