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
        background: "#f8fafc",
        backgroundImage: "radial-gradient(circle at top right, rgba(59, 130, 246, 0.04) 0%, transparent 40%), radial-gradient(circle at bottom left, rgba(16, 185, 129, 0.02) 0%, transparent 40%)",
        color: "#0f172a",
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
          borderBottom: "1px solid rgba(0,0,0,0.06)",
          paddingBottom: "1.5rem"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <img
            src="/logo.jpeg"
            alt="Swarm Logo"
            style={{ height: "48px", width: "48px", borderRadius: "10px", objectFit: "cover", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
          />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "0.7rem", background: "rgba(59, 130, 246, 0.1)", color: "#2563eb", padding: "2px 8px", borderRadius: "4px", fontWeight: "900", letterSpacing: "1px" }}>
                AIVYUH SEC-OPS
              </span>
              <span style={{ fontSize: "0.7rem", background: "rgba(16, 185, 129, 0.1)", color: "#059669", padding: "2px 8px", borderRadius: "4px", fontWeight: "900" }}>
                LIVE TELEMETRY
              </span>
            </div>
            <h1 style={{ fontSize: "1.8rem", fontWeight: "800", margin: "4px 0 0 0", color: "#0f172a", letterSpacing: "-0.5px" }}>
              Swarm Fleet Posture
            </h1>
          </div>
        </div>

        <button
          onClick={onBack}
          style={{
            padding: "0.8rem 1.5rem",
            background: "#ffffff",
            border: "1px solid #cbd5e1",
            borderRadius: "12px",
            color: "#0f172a",
            fontWeight: "600",
            cursor: "pointer",
            fontSize: "0.9rem",
            transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
            boxShadow: "0 2px 4px rgba(0,0,0,0.02)"
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "#f1f5f9"; e.currentTarget.style.transform = "translateY(-2px)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "#ffffff"; e.currentTarget.style.transform = "translateY(0)"; }}
        >
          ← Back to Swarm HQ
        </button>
      </header>

      {/* Global Metrics */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1.5rem" }}>
        <div style={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.06)", borderRadius: "16px", padding: "1.5rem", display: "flex", alignItems: "center", gap: "1.5rem", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
          <div style={{ background: "rgba(59, 130, 246, 0.08)", color: "#2563eb", height: "60px", width: "60px", borderRadius: "12px", display: "flex", justifyContent: "center", alignItems: "center", fontSize: "2rem" }}>🛡️</div>
          <div>
            <div style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: "700", letterSpacing: "1px" }}>ACTIVE AGENTS</div>
            <div style={{ fontSize: "2.5rem", fontWeight: "900", color: "#0f172a", lineHeight: "1" }}>{agentEntries.length}</div>
          </div>
        </div>

        <div style={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.06)", borderRadius: "16px", padding: "1.5rem", display: "flex", alignItems: "center", gap: "1.5rem", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
          <div style={{ background: totalCriticals > 0 ? "rgba(239, 68, 68, 0.08)" : "rgba(16, 185, 129, 0.08)", color: totalCriticals > 0 ? "#dc2626" : "#059669", height: "60px", width: "60px", borderRadius: "12px", display: "flex", justifyContent: "center", alignItems: "center", fontSize: "2rem" }}>🚨</div>
          <div>
            <div style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: "700", letterSpacing: "1px" }}>FLEET CRITICALS</div>
            <div style={{ fontSize: "2.5rem", fontWeight: "900", color: totalCriticals > 0 ? "#ef4444" : "#10b981", lineHeight: "1" }}>{totalCriticals}</div>
          </div>
        </div>

        <div style={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.06)", borderRadius: "16px", padding: "1.5rem", display: "flex", alignItems: "center", gap: "1.5rem", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
          <div style={{ background: totalWarnings > 0 ? "rgba(245, 158, 11, 0.08)" : "rgba(16, 185, 129, 0.08)", color: totalWarnings > 0 ? "#d97706" : "#059669", height: "60px", width: "60px", borderRadius: "12px", display: "flex", justifyContent: "center", alignItems: "center", fontSize: "2rem" }}>⚠️</div>
          <div>
            <div style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: "700", letterSpacing: "1px" }}>FLEET WARNINGS</div>
            <div style={{ fontSize: "2.5rem", fontWeight: "900", color: totalWarnings > 0 ? "#f59e0b" : "#10b981", lineHeight: "1" }}>{totalWarnings}</div>
          </div>
        </div>
      </section>

      {/* Grid of Agents */}
      <h2 style={{ fontSize: "1.5rem", fontWeight: "800", color: "#0f172a", marginTop: "1rem", borderBottom: "1px solid rgba(0,0,0,0.06)", paddingBottom: "1rem" }}>
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
                  background: "#ffffff",
                  border: `1px solid ${hasCritical ? "rgba(239, 68, 68, 0.3)" : hasWarning ? "rgba(245, 158, 11, 0.3)" : "rgba(16, 185, 129, 0.2)"}`,
                  borderRadius: "20px",
                  padding: "1.5rem",
                  transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.02)"
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = "translateY(-6px)";
                  e.currentTarget.style.boxShadow = `0 15px 40px rgba(0, 0, 0, 0.05)`;
                  e.currentTarget.style.background = "#ffffff";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 10px 30px rgba(0,0,0,0.02)";
                  e.currentTarget.style.background = "#ffffff";
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <h3 style={{ fontSize: "1.3rem", fontWeight: "800", color: "#0f172a", textTransform: "uppercase", letterSpacing: "1px", margin: 0 }}>
                        {agentId}
                      </h3>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "4px" }}>
                      Last Audit: {dateStr}
                    </div>
                  </div>
                  <div style={{
                    background: hasCritical ? "rgba(239, 68, 68, 0.08)" : "rgba(16, 185, 129, 0.08)",
                    color: hasCritical ? "#dc2626" : "#059669",
                    padding: "6px 12px",
                    borderRadius: "20px",
                    fontSize: "0.75rem",
                    fontWeight: "800",
                    border: `1px solid ${hasCritical ? "rgba(239, 68, 68, 0.12)" : "rgba(16, 185, 129, 0.12)"}`
                  }}>
                    {hasCritical ? "VULNERABLE" : "SECURE"}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "10px", marginTop: "auto" }}>
                  <div style={{ flex: 1, background: "#f8fafc", padding: "10px", borderRadius: "10px", textAlign: "center", border: "1px solid rgba(0,0,0,0.05)" }}>
                    <div style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: "700" }}>CRITICALS</div>
                    <div style={{ fontSize: "1.5rem", fontWeight: "900", color: hasCritical ? "#dc2626" : "#0f172a" }}>{data.critical_count}</div>
                  </div>
                  <div style={{ flex: 1, background: "#f8fafc", padding: "10px", borderRadius: "10px", textAlign: "center", border: "1px solid rgba(0,0,0,0.05)" }}>
                    <div style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: "700" }}>WARNINGS</div>
                    <div style={{ fontSize: "1.5rem", fontWeight: "900", color: hasWarning ? "#d97706" : "#0f172a" }}>{data.warning_count}</div>
                  </div>
                </div>

                {data.report_summary && data.report_summary.length > 0 && (
                  <div style={{ 
                    background: "#f1f5f9", 
                    padding: "10px", 
                    borderRadius: "8px", 
                    border: "1px solid rgba(0,0,0,0.05)",
                    maxHeight: "80px",
                    overflowY: "auto",
                    fontSize: "0.75rem",
                    color: "#334155",
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
