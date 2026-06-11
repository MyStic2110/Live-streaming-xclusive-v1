import React from "react";
import { motion, AnimatePresence } from "framer-motion";

const DOMAINS = ["Governance", "Detection", "Response", "Recovery", "Improvement"];

export default function AuditResultsModal({ isOpen, results = {}, onReset, onBook }) {
  if (!isOpen) return null;

  // --- SCORE CALCULATION ---
  const calculateMaturity = () => {
    let totalPoints = 0;
    const domainScores = {};
    DOMAINS.forEach(d => domainScores[d] = { earned: 0, total: 0 });

    // Questions mapping (Simplified logic based on the 18 questions)
    // In a real app, we'd map question_id to Domain
    Object.keys(results).forEach(id => {
      const item = results[id];
      const points = item.status === "YES" ? 10 : (item.status === "PARTIAL" ? 5 : 0);
      totalPoints += points;
      
      // Auto-assign domains based on ID ranges or known IDs
      let domain = "Governance";
      if (["SIEM", "24X7", "LOGS", "MTTD"].includes(id)) domain = "Detection";
      else if (["PROCEDURES", "ISOLATION", "ESCALATION", "MTTR"].includes(id)) domain = "Response";
      else if (["BACKUPS", "TESTING", "RTO_RPO"].includes(id)) domain = "Recovery";
      else if (["DRILLS", "LESSONS", "TRACKING"].includes(id)) domain = "Improvement";
      
      domainScores[domain].earned += points;
      domainScores[domain].total += 10;
    });

    const overall = Math.min(100, Math.round((totalPoints / 180) * 100));
    return { overall, domainScores };
  };

  const { overall, domainScores } = calculateMaturity();

  const getMaturityLabel = (score) => {
    if (score < 30) return { label: "CRITICAL", color: "#ef4444" };
    if (score < 60) return { label: "AT RISK", color: "#f59e0b" };
    if (score < 85) return { label: "DEVELOPING", color: "#3b82f6" };
    return { label: "MATURE", color: "#10b981" };
  };

  const maturity = getMaturityLabel(overall);

  return (
    <AnimatePresence>
      <div style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(255, 255, 255, 0.7)",
        backdropFilter: "blur(20px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "2rem", fontFamily: "'Inter', sans-serif"
      }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          style={{
            width: "100%", maxWidth: "600px",
            background: "#ffffff", border: "1px solid rgba(0, 0, 0, 0.06)",
            borderRadius: "16px", padding: "2.5rem",
            boxShadow: "0 20px 40px rgba(0, 0, 0, 0.06)",
            position: "relative", overflow: "hidden"
          }}
        >
          {/* Background Glow */}
          <div style={{ position: "absolute", top: "-50px", right: "-50px", width: "150px", height: "150px", background: "rgba(59, 130, 246, 0.08)", filter: "blur(60px)", borderRadius: "50%" }} />

          <header style={{ textAlign: "center", marginBottom: "2.5rem" }}>
            <h2 style={{ color: "#0f172a", fontSize: "1.5rem", fontWeight: 800, letterSpacing: "1px", marginBottom: "0.5rem" }}>
              ASSESSMENT COMPLETE
            </h2>
            <p style={{ color: "#64748b", fontSize: "0.85rem" }}>Your Incident Response Maturity Report</p>
          </header>

          {/* Main Score */}
          <div style={{ display: "flex", alignItems: "center", gap: "2rem", marginBottom: "3rem", background: "#f8fafc", border: "1px solid #e2e8f0", padding: "1.5rem", borderRadius: "12px" }}>
            <div style={{ position: "relative", width: "100px", height: "100px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }} viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="transparent" stroke="rgba(15, 23, 42, 0.05)" strokeWidth="8" />
                <motion.circle 
                  cx="50" cy="50" r="45" fill="transparent" stroke={maturity.color} strokeWidth="8" 
                  strokeDasharray="283" initial={{ strokeDashoffset: 283 }} animate={{ strokeDashoffset: 283 - (283 * overall / 100) }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                />
              </svg>
              <span style={{ fontSize: "1.5rem", fontWeight: 900, color: "#0f172a" }}>{overall}%</span>
            </div>
            <div>
              <div style={{ color: maturity.color, fontSize: "0.7rem", fontWeight: 900, letterSpacing: "2px", marginBottom: "4px" }}>STATUS: {maturity.label}</div>
              <div style={{ color: "#475569", fontSize: "0.85rem", lineHeight: "1.4" }}>
                Vigil has identified several key areas for improvement in your IR posture.
              </div>
            </div>
          </div>

          {/* Domain Breakdown */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem", marginBottom: "3rem" }}>
            {DOMAINS.map(domain => {
              const dScore = domainScores[domain];
              const pct = dScore.total === 0 ? 0 : Math.round((dScore.earned / dScore.total) * 100);
              return (
                <div key={domain}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "0.7rem", fontWeight: 700, color: "#64748b", letterSpacing: "1px" }}>
                    <span>{domain.toUpperCase()}</span>
                    <span>{pct}%</span>
                  </div>
                  <div style={{ height: "4px", background: "#e2e8f0", borderRadius: "2px", overflow: "hidden" }}>
                    <motion.div 
                      initial={{ width: 0 }} animate={{ width: `${pct}%` }} 
                      transition={{ duration: 1, delay: 0.2 }}
                      style={{ height: "100%", background: "#3b82f6" }} 
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* CTAs */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <button 
              onClick={onBook}
              style={{
                background: "#3b82f6", color: "white", border: "none",
                padding: "1rem", borderRadius: "8px", fontWeight: "bold",
                cursor: "pointer", fontSize: "0.9rem", boxShadow: "0 4px 12px rgba(59, 130, 246, 0.25)"
              }}
            >
              SCHEDULE EXPERT CONSULTATION
            </button>
            <button 
              onClick={onReset}
              style={{
                background: "#ffffff", color: "#475569", border: "1px solid #cbd5e1",
                padding: "0.8rem", borderRadius: "8px", fontWeight: "bold",
                cursor: "pointer", fontSize: "0.8rem", transition: "all 0.2s"
              }}
              onMouseEnter={e => e.currentTarget.style.background = "#f1f5f9"}
              onMouseLeave={e => e.currentTarget.style.background = "#ffffff"}
            >
              RETURN TO HUB
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
