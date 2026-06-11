import React from "react";
import { motion } from "framer-motion";

export default function LegalModal({ type, onClose }) {
  const isPrivacy = type === "privacy";
  const title = isPrivacy ? "PRIVACY POLICY" : "TERMS & CONDITIONS";
  const subtitle = isPrivacy 
    ? "Last updated: May 22, 2026. Learn how we handle and protect your organizational and stream data."
    : "Last updated: May 22, 2026. Please read these terms carefully before accessing the Swarm Command platform.";

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000, // Sits above all other elements
        background: "rgba(11, 15, 25, 0.7)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        fontFamily: "'Outfit', sans-serif"
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        style={{
          width: "100%",
          maxWidth: "700px",
          maxHeight: "80vh",
          background: "#ffffff",
          border: "1px solid rgba(0, 0, 0, 0.08)",
          borderRadius: "24px",
          padding: "2.5rem",
          boxShadow: "0 30px 60px -15px rgba(0, 0, 0, 0.25)",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ marginBottom: "1.5rem", borderBottom: "1px solid #f3f4f6", paddingBottom: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ color: "#3b82f6", fontSize: "0.75rem", fontWeight: "900", letterSpacing: "3px" }}>
              LEGAL COMPLIANCE
            </span>
            <button 
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                fontSize: "1.5rem",
                fontWeight: "300",
                color: "#9ca3af",
                cursor: "pointer",
                padding: "0 0.5rem",
                transition: "color 0.2s"
              }}
              onMouseEnter={e => e.target.style.color = "#111827"}
              onMouseLeave={e => e.target.style.color = "#9ca3af"}
            >
              ✕
            </button>
          </div>
          <h2 style={{ color: "#111827", fontSize: "1.8rem", fontWeight: "900", margin: "4px 0" }}>
            {title}
          </h2>
          <p style={{ color: "#6b7280", fontSize: "0.85rem", margin: "4px 0 0 0", lineHeight: "1.4" }}>
            {subtitle}
          </p>
        </div>

        {/* Scrollable Content */}
        <div 
          style={{
            overflowY: "auto",
            flex: 1,
            paddingRight: "0.5rem",
            color: "#374151",
            fontSize: "0.95rem",
            lineHeight: "1.6",
            textAlign: "left"
          }}
        >
          {isPrivacy ? (
            <div>
              <h3 style={{ color: "#111827", fontSize: "1.1rem", fontWeight: "800", marginTop: "1rem", marginBottom: "0.5rem" }}>
                1. Information We Collect
              </h3>
              <p style={{ marginBottom: "1.2rem" }}>
                To provide our premium autonomous live-streaming and agentic operations, we collect essential metadata, including stream keys, connection durations, video configurations, and user identifiers. Under no circumstances do we inspect or store media content payloads without explicit administrative consent.
              </p>

              <h3 style={{ color: "#111827", fontSize: "1.1rem", fontWeight: "800", marginTop: "1.5rem", marginBottom: "0.5rem" }}>
                2. Use of Data
              </h3>
              <p style={{ marginBottom: "1.2rem" }}>
                Your data is solely used to establish secure WebRTC connections via LiveKit, optimize stream routing, monitor agent performances, and deliver customized AI workflows. We do not sell, rent, or distribute any operational metrics or organizational datasets to third-party advertisers.
              </p>

              <h3 style={{ color: "#111827", fontSize: "1.1rem", fontWeight: "800", marginTop: "1.5rem", marginBottom: "0.5rem" }}>
                3. Security & Processing
              </h3>
              <p style={{ marginBottom: "1.2rem" }}>
                We implement robust technical and organizational measures to safeguard stream tokens and connection credentials. All inter-agent and stream-level messaging are encrypted in transit using industry-standard TLS 1.3 and DTLS-SRTP protocols.
              </p>

              <h3 style={{ color: "#111827", fontSize: "1.1rem", fontWeight: "800", marginTop: "1.5rem", marginBottom: "0.5rem" }}>
                4. Third-Party Integrations
              </h3>
              <p style={{ marginBottom: "1.2rem" }}>
                Our platform connects directly with LiveKit Cloud and custom LLM model servers. When participating in voice rooms or interactive video sessions, select routing metrics are securely transmitted to these vetted infrastructure partners.
              </p>

              <h3 style={{ color: "#111827", fontSize: "1.1rem", fontWeight: "800", marginTop: "1.5rem", marginBottom: "0.5rem" }}>
                5. Cookies & Local Storage
              </h3>
              <p style={{ marginBottom: "1.2rem" }}>
                We utilize secure cookies and local storage tokens solely to maintain authenticated agent sessions, track room preferences, and ensure high-availability routing configurations.
              </p>

              <h3 style={{ color: "#111827", fontSize: "1.1rem", fontWeight: "800", marginTop: "1.5rem", marginBottom: "0.5rem" }}>
                6. Contact & Rights
              </h3>
              <p style={{ marginBottom: "1.2rem" }}>
                You retain the right to query, export, or request the immediate deletion of your workspace configuration and agent memory logs. For inquiries, reach out to our command operators at compliance@swarmcommand.ai.
              </p>
            </div>
          ) : (
            <div>
              <h3 style={{ color: "#111827", fontSize: "1.1rem", fontWeight: "800", marginTop: "1rem", marginBottom: "0.5rem" }}>
                1. Agreement to Terms
              </h3>
              <p style={{ marginBottom: "1.2rem" }}>
                By accessing or utilizing the Swarm Command platform, you agree to be bound by these Terms & Conditions. If you disagree with any portion of these terms, you are prohibited from deploying autonomous streaming agents or accessing our network dashboards.
              </p>

              <h3 style={{ color: "#111827", fontSize: "1.1rem", fontWeight: "800", marginTop: "1.5rem", marginBottom: "0.5rem" }}>
                2. Acceptable Use
              </h3>
              <p style={{ marginBottom: "1.2rem" }}>
                You agree to use our WebRTC and agent execution pipelines strictly for legitimate, lawful enterprise activities. Generating spam, broadcasting unauthorized copyright media, or attempting to reverse-engineer our proprietary agent or audio/video orchestration servers is strictly prohibited.
              </p>

              <h3 style={{ color: "#111827", fontSize: "1.1rem", fontWeight: "800", marginTop: "1.5rem", marginBottom: "0.5rem" }}>
                3. Service SLAs & Disclaimers
              </h3>
              <p style={{ marginBottom: "1.2rem" }}>
                Swarm Command services are provided on an "as-is" and "as-available" basis. While we strive to maintain 99.9% uptime for our voice routing infrastructure, we make no guarantees regarding connection stability, real-time speech synthesis latencies, or autonomous agent decision accuracies.
              </p>

              <h3 style={{ color: "#111827", fontSize: "1.1rem", fontWeight: "800", marginTop: "1.5rem", marginBottom: "0.5rem" }}>
                4. Intellectual Property
              </h3>
              <p style={{ marginBottom: "1.2rem" }}>
                All software components, custom room orchestration algorithms, design schemas, and branding elements remain the exclusive intellectual property of Swarm Command. You receive a limited, revocable, non-transferable license to access features for authorized operations.
              </p>

              <h3 style={{ color: "#111827", fontSize: "1.1rem", fontWeight: "800", marginTop: "1.5rem", marginBottom: "0.5rem" }}>
                5. Limitation of Liability
              </h3>
              <p style={{ marginBottom: "1.2rem" }}>
                To the maximum extent permitted by applicable law, Swarm Command shall not be liable for any indirect, incidental, or consequential damages resulting from connection dropouts, LLM response anomalies, or service interruptions.
              </p>

              <h3 style={{ color: "#111827", fontSize: "1.1rem", fontWeight: "800", marginTop: "1.5rem", marginBottom: "0.5rem" }}>
                6. Amendments & Jurisdiction
              </h3>
              <p style={{ marginBottom: "1.2rem" }}>
                We reserve the right to amend these terms at any time. Your continued use of the platform after updates constitutes acceptance of the new terms. These terms are governed by and construed in accordance with federal enterprise regulations.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{ marginTop: "1.5rem", borderTop: "1px solid #f3f4f6", paddingTop: "1.5rem", display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              background: "#3b82f6",
              color: "#ffffff",
              border: "none",
              padding: "0.75rem 2rem",
              borderRadius: "12px",
              fontWeight: "700",
              fontSize: "0.9rem",
              cursor: "pointer",
              boxShadow: "0 10px 15px -3px rgba(59, 130, 246, 0.3)",
              transition: "all 0.2s"
            }}
            onMouseEnter={e => {
              e.target.style.background = "#2563eb";
              e.target.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={e => {
              e.target.style.background = "#3b82f6";
              e.target.style.transform = "none";
            }}
          >
            ACKNOWLEDGE
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
