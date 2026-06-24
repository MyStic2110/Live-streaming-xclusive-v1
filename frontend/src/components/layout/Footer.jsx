import React, { useState, useEffect } from "react";
import { Mail, Shield, Zap, Code, Send, Activity, Globe, Map } from "lucide-react";
import DelhiveryMapModal from "./DelhiveryMapModal";


// Inline SVG icon components matching standard Lucide outlines to bypass build-time import errors
const TwitterIcon = ({ size = 16, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
  </svg>
);

const LinkedinIcon = ({ size = 16, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

const GithubIcon = ({ size = 16, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

const COLORS = {
  bg: "#f8fafc",           // Matches the landing page background
  bgSoft: "#ffffff",
  border: "#e2e8f0",
  accent: "#3b82f6",
  accentHover: "#2563eb",
  textMuted: "#64748b",
  textLight: "#0f172a",
  green: "#16a34a"
};

const Footer = ({ onBlogClick, onShortsClick, onLegalClick, onDashboardClick, onDeploymentClick, onChangelogClick, onCareersClick, onBattleClick }) => {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [latency, setLatency] = useState(28);
  const [isMapOpen, setIsMapOpen] = useState(false);


  useEffect(() => {
    const interval = setInterval(() => {
      setLatency(prev => {
        const diff = Math.floor(Math.random() * 5) - 2; // +/- 2ms
        const next = prev + diff;
        return next >= 15 && next <= 40 ? next : 28;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setTimeout(() => {
        setEmail("");
        setSubscribed(false);
      }, 3000);
    }
  };

  return (
    <footer style={{
      background: COLORS.bg,
      color: COLORS.textLight,
      padding: "6.5rem 5% 4rem 5%",
      fontFamily: "'Outfit', sans-serif",
      position: "relative",
      overflow: "hidden"
    }}>
      <style>{`
        .footer-grid-overlay {
          position: absolute;
          inset: 0;
          background-image: linear-gradient(to right, rgba(15, 23, 42, 0.015) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(15, 23, 42, 0.015) 1px, transparent 1px);
          background-size: 32px 32px;
          pointer-events: none;
          opacity: 0.8;
          z-index: 0;
        }
        .footer-link {
          color: #64748b;
          text-decoration: none;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          display: inline-flex;
          align-items: center;
          gap: 0px;
          font-size: 0.92rem;
          cursor: pointer;
        }
        .footer-link::before {
          content: '→';
          opacity: 0;
          width: 0px;
          transition: all 0.2s ease;
          color: #3b82f6;
          font-weight: bold;
          margin-right: 0px;
        }
        .footer-link:hover {
          color: #3b82f6;
          transform: translateX(4px);
        }
        .footer-link:hover::before {
          opacity: 1;
          width: auto;
          margin-right: 6px;
        }
        .footer-link-highlight {
          color: #3b82f6 !important;
          font-weight: 700;
        }
        .footer-link-highlight:hover {
          color: #2563eb !important;
        }
        .footer-bottom-link {
          color: #64748b;
          text-decoration: none;
          transition: color 0.2s ease-in-out;
          font-weight: 500;
        }
        .footer-bottom-link:hover {
          color: #3b82f6;
          text-decoration: underline;
        }
        .social-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          color: #64748b;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          text-decoration: none;
        }
        .social-icon:hover {
          background: rgba(59, 130, 246, 0.05);
          color: #3b82f6;
          border-color: rgba(59, 130, 246, 0.3);
          transform: translateY(-3px) scale(1.05);
          box-shadow: 0 8px 16px rgba(59, 130, 246, 0.08);
        }
        .pulse-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: rgba(22, 163, 74, 0.05);
          border: 1px solid rgba(22, 163, 74, 0.15);
          color: #16a34a;
          border-radius: 99px;
          font-size: 0.8rem;
          font-weight: 700;
          letter-spacing: 0.5px;
          box-shadow: 0 2px 8px rgba(22, 163, 74, 0.03);
          backdrop-filter: blur(8px);
        }
        .pulse-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #16a34a;
          box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.7);
          animation: pulse 1.8s infinite;
        }
        @keyframes pulse {
          0% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.7);
          }
          70% {
            transform: scale(1);
            box-shadow: 0 0 0 6px rgba(22, 163, 74, 0);
          }
          100% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(22, 163, 74, 0);
          }
        }
        .newsletter-input:focus {
          border-color: #3b82f6 !important;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1), 0 4px 12px rgba(0, 0, 0, 0.04) !important;
          background: #ffffff !important;
        }
        .newsletter-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(59, 130, 246, 0.25) !important;
          background: #ffffff !important;
        }
        .newsletter-btn:active {
          transform: translateY(0);
        }
      `}</style>

      {/* Grid overlay */}
      <div className="footer-grid-overlay" />

      {/* Background Glow Accents */}
      <div style={{
        position: "absolute",
        bottom: "-150px",
        left: "5%",
        width: "350px",
        height: "350px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(59, 130, 246, 0.04) 0%, transparent 70%)",
        pointerEvents: "none",
        zIndex: 0
      }} />
      <div style={{
        position: "absolute",
        top: "-100px",
        right: "5%",
        width: "300px",
        height: "300px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(16, 185, 129, 0.03) 0%, transparent 70%)",
        pointerEvents: "none",
        zIndex: 0
      }} />

      {/* Top Gradient Divider Line */}
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: "1px",
        background: "linear-gradient(90deg, rgba(226,232,240,0) 0%, rgba(226,232,240,1) 15%, rgba(226,232,240,1) 85%, rgba(226,232,240,0) 100%)",
        zIndex: 1
      }} />

      <div style={{ maxWidth: "1200px", margin: "0 auto", position: "relative", zIndex: 1 }}>
        
        {/* ── Top Header Section: Newsletter & Status ── */}
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "2.5rem",
          paddingBottom: "4rem",
          marginBottom: "4rem",
          borderBottom: `1px solid ${COLORS.border}`
        }}>
          <div>
            <h3 style={{ fontSize: "1.75rem", fontWeight: "900", margin: "0 0 0.5rem 0", letterSpacing: "-0.5px", color: COLORS.textLight }}>
              Join the Swarm Newsletter
            </h3>
            <p style={{ color: COLORS.textMuted, margin: 0, fontSize: "0.95rem", lineHeight: "1.5" }}>
              Get weekly updates on decentralized orchestration, local LLM telemetry, and agent compliance metrics.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", flexWrap: "wrap" }}>
            <form onSubmit={handleSubscribe} style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Mail size={18} color={COLORS.textMuted} style={{ position: "absolute", left: "14px", pointerEvents: "none" }} />
                <input
                  type="email"
                  required
                  placeholder="operator@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                     padding: "12px 16px 12px 42px",
                     borderRadius: "12px",
                     border: `1.5px solid ${COLORS.border}`,
                     background: "#ffffff",
                     fontSize: "0.9rem",
                     width: "280px",
                     outline: "none",
                     transition: "all 0.25s ease",
                     boxShadow: "0 2px 4px rgba(0,0,0,0.02)"
                  }}
                  className="newsletter-input"
                />
              </div>
              <button
                type="submit"
                style={{
                  padding: "12px 24px",
                  background: `linear-gradient(135deg, ${COLORS.accent}, #4f46e5)`,
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "12px",
                  fontWeight: "800",
                  fontSize: "0.9rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  transition: "all 0.25s ease",
                  boxShadow: "0 4px 12px rgba(59, 130, 246, 0.15)"
                }}
                className="newsletter-btn"
              >
                {subscribed ? (
                  <span>SUBSCRIBED!</span>
                ) : (
                  <>
                    <span>SUBSCRIBE</span>
                    <Send size={14} />
                  </>
                )}
              </button>
            </form>

            <div className="pulse-badge">
              <span className="pulse-dot"></span>
              SWARM CORE ONLINE ({latency}ms)
            </div>
          </div>
        </div>

        {/* ── Main Footer Grid ── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "4rem",
          marginBottom: "5rem"
        }}>
          
          {/* Column 1: Brand details */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{
                width: "32px",
                height: "32px",
                borderRadius: "9px",
                background: "linear-gradient(135deg, #3b82f6, #4f46e5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                fontSize: "1.05rem",
                fontWeight: "900",
                boxShadow: "0 4px 12px rgba(59, 130, 246, 0.25)"
              }}>
                S
              </div>
              <span style={{ fontSize: "1.05rem", fontWeight: "900", letterSpacing: "2px", color: COLORS.textLight }}>
                SWARM <span style={{ color: "#3b82f6", fontWeight: "600" }}>AGENTIC LAB</span>
              </span>
            </div>
            <p style={{ color: COLORS.textMuted, fontSize: "0.95rem", lineHeight: "1.6", margin: 0 }}>
              Enterprise-grade decentralized AI Swarm and Multi-Agent Orchestration platform specializing in local inference and zero-cost AI agents.
            </p>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <a href="https://twitter.com" target="_blank" rel="noreferrer" className="social-icon" title="Twitter / X">
                <TwitterIcon size={16} />
              </a>
              <a href="https://linkedin.com" target="_blank" rel="noreferrer" className="social-icon" title="LinkedIn">
                <LinkedinIcon size={16} />
              </a>
              <a href="https://github.com/MyStic2110/Live-streaming-xclusive-v1" target="_blank" rel="noreferrer" className="social-icon" title="GitHub">
                <GithubIcon size={16} />
              </a>
              <a href="https://docs.mistral.ai" target="_blank" rel="noreferrer" className="social-icon" title="Mistral Docs">
                <Globe size={16} />
              </a>
            </div>
          </div>

          {/* Column 2: Product Capabilities */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <h4 style={{ fontSize: "0.8rem", fontWeight: "800", margin: "0 0 0.5rem 0", color: COLORS.textLight, textTransform: "uppercase", letterSpacing: "1.5px" }}>
              Capabilities
            </h4>
            <a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo(0, 0); }} className="footer-link">Agent Directory</a>
            <a href="#" onClick={(e) => { e.preventDefault(); if (onShortsClick) onShortsClick(); }} className="footer-link">Swarm Shorts</a>
            <a href="#" onClick={(e) => { e.preventDefault(); if (onDashboardClick) onDashboardClick(); }} className="footer-link">LLM Telemetry</a>
            <a href="#" onClick={(e) => { e.preventDefault(); if (onDeploymentClick) onDeploymentClick(); }} className="footer-link">Governed Deployment</a>
          </div>

          {/* Column 3: Resources & Links */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <h4 style={{ fontSize: "0.8rem", fontWeight: "800", margin: "0 0 0.5rem 0", color: COLORS.textLight, textTransform: "uppercase", letterSpacing: "1.5px" }}>
              Resources
            </h4>
            <a href="#" onClick={(e) => { e.preventDefault(); if (onBlogClick) onBlogClick(); }} className="footer-link">Insights & Blog</a>
            <a href="#" onClick={(e) => { e.preventDefault(); if (onChangelogClick) onChangelogClick(); }} className="footer-link">Changelog ✨</a>
            <a href="#" className="footer-link">SDK Documentation</a>
            <a href="#" className="footer-link">API Specification</a>
          </div>

          {/* Column 4: Laboratory details */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <h4 style={{ fontSize: "0.8rem", fontWeight: "800", margin: "0 0 0.5rem 0", color: COLORS.textLight, textTransform: "uppercase", letterSpacing: "1.5px" }}>
              Laboratory
            </h4>
            <a href="#" className="footer-link">About Swarm Lab</a>
            <a href="#" onClick={(e) => { e.preventDefault(); if (onCareersClick) onCareersClick(); }} className="footer-link footer-link-highlight">
              Careers <span style={{ fontSize: "0.75rem", padding: "2px 6px", background: "rgba(59, 130, 246, 0.1)", borderRadius: "6px", marginLeft: "4px" }}>We're Hiring</span>
            </a>
            <a href="#" onClick={(e) => { e.preventDefault(); if (onBattleClick) onBattleClick(); }} className="footer-link">
              1v1 Battle Arena <span style={{ fontSize: "0.75rem", padding: "2px 6px", background: "rgba(245, 158, 11, 0.1)", color: "#d97706", borderRadius: "6px", marginLeft: "4px" }}>Play & Win</span>
            </a>
            <a href="https://wa.me/919791388549" target="_blank" rel="noreferrer" className="footer-link">Contact Operator</a>
            <a href="#" onClick={(e) => { e.preventDefault(); setIsMapOpen(true); }} className="footer-link">
              <Map size={14} style={{ marginRight: "6px" }} /> Location Intelligence
            </a>
          </div>

        </div>

        {/* ── Footer Bottom Copyright & Disclaimers ── */}
        <div style={{
          paddingTop: "2.5rem",
          borderTop: `1px solid ${COLORS.border}`,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1.5rem",
          fontSize: "0.88rem",
          color: COLORS.textMuted
        }}>
          <div>
            © {new Date().getFullYear()} Swarm Agentic Lab. Built by operators, for operators.
          </div>
          <div style={{ display: "flex", gap: "1.5rem" }}>
            <a href="#" onClick={(e) => { e.preventDefault(); if (onLegalClick) onLegalClick("privacy"); }} className="footer-bottom-link">Privacy Policy</a>
            <a href="#" onClick={(e) => { e.preventDefault(); if (onLegalClick) onLegalClick("terms"); }} className="footer-bottom-link">Terms of Service</a>
            <a href="#" onClick={(e) => { e.preventDefault(); if (onLegalClick) onLegalClick("cookie"); }} className="footer-bottom-link">Cookie Preferences</a>
          </div>
        </div>

      </div>
      <DelhiveryMapModal isOpen={isMapOpen} onClose={() => setIsMapOpen(false)} />
    </footer>
  );
};

export default Footer;
