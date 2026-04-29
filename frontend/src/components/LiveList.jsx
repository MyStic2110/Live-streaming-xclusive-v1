import React from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "";
const generateId = (prefix) => `${prefix}_${Math.floor(Math.random() * 1000)}`;

export default function LiveList({ onJoin }) {
  const initiateAITalk = async () => {
    console.log("[LIVELIST] ACTION: User clicked 'TALK TO AI'");
    try {
      const res = await axios.post(`${API}/talk-to-ai`);
      onJoin({
        roomName: res.data.roomName,
        token: res.data.token,
        isCreator: false,
        creatorId: "Mistral_AI",
        isAI: true
      });
    } catch (err) {
      console.error("[LIVELIST] !!! FAILED TO START AI SESSION:", err.message);
      alert("AI Assistant is currently offline");
    }
  };

  return (
    <div className="app-container">
      <nav className="navbar">
        <div className="brand" style={{ letterSpacing: "1px", color: "#3b82f6" }}>
          SWARM <span className="version-badge" style={{ background: "rgba(59, 130, 246, 0.1)", color: "#3b82f6", border: "1px solid rgba(59, 130, 246, 0.3)", marginLeft: "15px", letterSpacing: "0.5px" }}>ARMY OF AGENTS • BUILDING FUTURE GEN</span>
        </div>
      </nav>

      <main className="main-wrapper" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80vh" }}>
        <div className="hero-section">
          <h1 style={{ fontSize: "3.5rem", marginBottom: "0.5rem" }}>Weather Agent for India</h1>
          <p style={{ fontSize: "1.2rem", opacity: 0.8 }}>Real-time weather insights, powered by advanced AI.</p>
        </div>

        <div className="status-banner" style={{ 
          background: "rgba(59, 130, 246, 0.1)", 
          border: "1px solid rgba(59, 130, 246, 0.3)", 
          padding: "0.5rem 1.5rem", 
          borderRadius: "20px", 
          marginBottom: "2rem",
          color: "#3b82f6",
          fontWeight: "bold",
          fontSize: "0.9rem"
        }}>
          <span className="dot" style={{ display: "inline-block", width: "8px", height: "8px", background: "#3b82f6", borderRadius: "50%", marginRight: "10px", boxShadow: "0 0 10px #3b82f6" }}></span>
          1 AGENT LIVE NOW • 50+ AGENTS COMING SOON
        </div>

        <div className="azure-card" style={{ padding: "3rem", textAlign: "center", maxWidth: "500px", width: "100%" }}>
          <div className="creator-avatar" style={{ margin: "0 auto 2rem", width: "120px", height: "120px", fontSize: "3rem", background: "linear-gradient(135deg, #007bff, #00ff88)" }}>
            WA
          </div>
          <h2 style={{ marginBottom: "1rem" }}>Premium AI Session</h2>
          <p style={{ color: "var(--text-muted)", marginBottom: "2rem" }}>
            Experience the future of real-time weather interaction. Encrypted, secure, and uniquely Indian.
          </p>
          <button onClick={initiateAITalk} className="btn-azure" style={{ width: "100%", fontSize: "1.2rem", padding: "1.2rem" }}>
            START CONVERSATION
          </button>
        </div>
      </main>
    </div>
  );
}
