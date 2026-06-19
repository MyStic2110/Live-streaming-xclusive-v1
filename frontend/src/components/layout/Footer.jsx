import React from "react";
import { Mail, Shield, Zap, Code } from "lucide-react";

const COLORS = {
  bg: "#07090f",
  primary: "#111827",
  accent: "#3b82f6",
  accentHover: "#2563eb",
  textMuted: "#6b7280",
  textMutedHover: "#9ca3af",
  border: "rgba(255, 255, 255, 0.08)"
};

const Footer = ({ onBlogClick, onShortsClick, onLegalClick, onDashboardClick, onDeploymentClick, onChangelogClick }) => {
  return (
    <footer style={{
      background: COLORS.bg,
      color: "#f1f5f9",
      padding: "5rem 5% 2rem",
      fontFamily: "'Outfit', sans-serif",
      borderTop: `1px solid ${COLORS.border}`
    }}>
      <div style={{
        maxWidth: "1200px",
        margin: "0 auto",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "4rem",
        marginBottom: "4rem"
      }}>
        
        {/* Column 1: Brand */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <img src="/logo.jpeg" alt="Swarm Agentic Lab" style={{ width: "40px", height: "40px", borderRadius: "10px", objectFit: "cover" }} />
            <span style={{ fontSize: "1.2rem", fontWeight: "900", letterSpacing: "1px" }}>
              SWARM <span style={{ color: COLORS.accent }}>LAB</span>
            </span>
          </div>
          <p style={{ color: COLORS.textMuted, fontSize: "0.95rem", lineHeight: "1.6", margin: 0 }}>
            Enterprise-grade decentralized AI Swarm and Multi-Agent Orchestration platform specializing in local inference and zero-cost AI agents.
          </p>
          <div style={{ display: "flex", gap: "1rem" }}>
            <a href="https://twitter.com" target="_blank" rel="noreferrer" style={{ color: COLORS.textMuted, transition: "color 0.2s", textDecoration: "none" }} onMouseEnter={(e) => e.target.style.color = COLORS.accent} onMouseLeave={(e) => e.target.style.color = COLORS.textMuted}>🐦 X</a>
            <a href="https://linkedin.com" target="_blank" rel="noreferrer" style={{ color: COLORS.textMuted, transition: "color 0.2s", textDecoration: "none" }} onMouseEnter={(e) => e.target.style.color = COLORS.accent} onMouseLeave={(e) => e.target.style.color = COLORS.textMuted}>💼 LinkedIn</a>
            <a href="https://github.com/MyStic2110/Live-streaming-xclusive-v1" target="_blank" rel="noreferrer" style={{ color: COLORS.textMuted, transition: "color 0.2s", textDecoration: "none" }} onMouseEnter={(e) => e.target.style.color = COLORS.accent} onMouseLeave={(e) => e.target.style.color = COLORS.textMuted}>🐙 GitHub</a>
          </div>
        </div>

        {/* Column 2: Product */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <h4 style={{ fontSize: "1.05rem", fontWeight: "800", margin: "0 0 0.5rem 0", color: "#fff" }}>Product</h4>
          <a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo(0, 0); }} style={linkStyle}>Agent Directory</a>
          <a href="#" onClick={(e) => { e.preventDefault(); if (onShortsClick) onShortsClick(); }} style={linkStyle}>Swarm Shorts</a>
          <a href="#" onClick={(e) => { e.preventDefault(); if (onDashboardClick) onDashboardClick(); }} style={linkStyle}>LLM Telemetry Dashboard</a>
          <a href="#" onClick={(e) => { e.preventDefault(); if (onDeploymentClick) onDeploymentClick(); }} style={linkStyle}>Governed Deployment</a>
          <a href="https://wa.me/919791388549" target="_blank" rel="noreferrer" style={linkStyle}>Enterprise Sales</a>
        </div>

        {/* Column 3: Resources */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <h4 style={{ fontSize: "1.05rem", fontWeight: "800", margin: "0 0 0.5rem 0", color: "#fff" }}>Resources</h4>
          <a href="#" onClick={(e) => { e.preventDefault(); if (onBlogClick) onBlogClick(); }} style={linkStyle}>Insights & Blog</a>
          <a href="#" onClick={(e) => { e.preventDefault(); if (onChangelogClick) onChangelogClick(); }} style={linkStyle}>Changelog ✨</a>
          <a href="#" style={linkStyle}>Documentation</a>
          <a href="#" style={linkStyle}>API Reference</a>
          <a href="#" style={linkStyle}>Case Studies</a>
        </div>

        {/* Column 4: Company */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <h4 style={{ fontSize: "1.05rem", fontWeight: "800", margin: "0 0 0.5rem 0", color: "#fff" }}>Company</h4>
          <a href="#" style={linkStyle}>About Us</a>
          <a href="#" style={linkStyle}>Careers</a>
          <a href="#" style={linkStyle}>Contact</a>
          <a href="#" style={linkStyle}>Partners</a>
        </div>
      </div>

      <div style={{
        maxWidth: "1200px",
        margin: "0 auto",
        paddingTop: "2rem",
        borderTop: `1px solid ${COLORS.border}`,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "1rem",
        fontSize: "0.85rem",
        color: COLORS.textMuted
      }}>
        <div>
          © {new Date().getFullYear()} Swarm Agentic Lab. All rights reserved.
        </div>
        <div style={{ display: "flex", gap: "1.5rem" }}>
          <a href="#" onClick={(e) => { e.preventDefault(); if (onLegalClick) onLegalClick("privacy"); }} style={bottomLinkStyle}>Privacy Policy</a>
          <a href="#" onClick={(e) => { e.preventDefault(); if (onLegalClick) onLegalClick("terms"); }} style={bottomLinkStyle}>Terms of Service</a>
          <a href="#" onClick={(e) => { e.preventDefault(); if (onLegalClick) onLegalClick("cookie"); }} style={bottomLinkStyle}>Cookie Policy</a>
        </div>
      </div>
    </footer>
  );
};

const linkStyle = {
  color: "#9ca3af",
  textDecoration: "none",
  transition: "color 0.2s, transform 0.2s",
  display: "inline-block",
  fontSize: "0.95rem"
};

const bottomLinkStyle = {
  color: "#6b7280",
  textDecoration: "none",
  transition: "color 0.2s"
};

export default Footer;
