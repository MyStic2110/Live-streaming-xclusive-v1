import React from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "";
const generateId = (prefix) => `${prefix}_${Math.floor(Math.random() * 1000)}`;

export default function LiveList({ onJoin }) {
  const initiateAITalk = async (agentType = "weather") => {
    console.log(`[LIVELIST] ACTION: User clicked 'TALK TO ${agentType.toUpperCase()}'`);
    try {
      const res = await axios.post(`${API}/talk-to-ai`, { agentType });
      onJoin({
        roomName: res.data.roomName,
        token: res.data.token,
        isCreator: false,
        creatorId: agentType.toUpperCase(),
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

      <main className="main-wrapper">
        <div className="hero-section" style={{ textAlign: "center", marginBottom: "4rem" }}>
          <h1 style={{ fontSize: "3.5rem", fontWeight: "800", marginBottom: "0.5rem" }}>SWARM Intelligence</h1>
          <p style={{ fontSize: "1.2rem", color: "var(--text-muted)" }}>Deploy specialized agents for any task</p>
        </div>

        <div className="status-banner" style={{ 
          background: "rgba(59, 130, 246, 0.1)", 
          border: "1px solid rgba(59, 130, 246, 0.3)", 
          padding: "0.5rem 1.5rem", 
          borderRadius: "20px", 
          margin: "0 auto 4rem auto",
          width: "fit-content",
          color: "#3b82f6",
          fontWeight: "bold",
          fontSize: "0.9rem"
        }}>
          <span className="dot" style={{ display: "inline-block", width: "8px", height: "8px", background: "#3b82f6", borderRadius: "50%", marginRight: "10px", boxShadow: "0 0 10px #3b82f6" }}></span>
          3 AGENTS ACTIVE • THE SWARM IS GROWING
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
          
          {/* CARD 1: WEATHER AGENT */}
          <div className="azure-card" style={{ transition: "all 0.3s ease" }}>
            <div className="card-media" style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)", height: "160px", display: "flex", alignItems: "center", justifyContent: "center" }}>
               <div className="creator-avatar" style={{ width: "60px", height: "60px", fontSize: "1.5rem" }}>☁️</div>
            </div>
            <div style={{ padding: "1.5rem" }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: "800", marginBottom: "0.5rem" }}>Weather Agent</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "1.5rem", lineHeight: "1.5" }}>Indian monsoon patterns and regional climate insights.</p>
              <button className="btn-azure" style={{ width: "100%" }} onClick={() => initiateAITalk("weather")}>DEPLOY WEATHER</button>
            </div>
          </div>

          {/* CARD 2: LINA (PERSONAL COMPANION) */}
          <div className="azure-card" style={{ borderColor: "#a855f7", transition: "all 0.3s ease" }}>
            <div className="card-media" style={{ background: "linear-gradient(135deg, #581c87 0%, #a855f7 100%)", height: "160px", display: "flex", alignItems: "center", justifyContent: "center" }}>
               <div className="creator-avatar" style={{ width: "60px", height: "60px", fontSize: "1.5rem", background: "#a855f7" }}>✨</div>
            </div>
            <div style={{ padding: "1.5rem" }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: "800", marginBottom: "0.5rem", color: "#a855f7" }}>Lina</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "1.5rem", lineHeight: "1.5" }}>Your empathetic companion. Here to listen and support.</p>
              <button className="btn-azure" style={{ width: "100%", background: "#a855f7" }} onClick={() => initiateAITalk("lina")}>CONNECT LINA</button>
            </div>
          </div>

          {/* CARD 3: VIGIL (AUDITOR) */}
          <div className="azure-card" style={{ borderColor: "#3b82f6", transition: "all 0.3s ease" }}>
            <div className="card-media" style={{ background: "linear-gradient(135deg, #020617 0%, #1e40af 100%)", height: "160px", display: "flex", alignItems: "center", justifyContent: "center" }}>
               <div className="creator-avatar" style={{ width: "60px", height: "60px", fontSize: "1.5rem", background: "#1e40af", borderRadius: "8px" }}>🛡️</div>
            </div>
            <div style={{ padding: "1.5rem" }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: "800", marginBottom: "0.5rem", color: "#60a5fa" }}>Vigil Auditor</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "1.5rem", lineHeight: "1.5" }}>Professional IR maturity assessment and security audit.</p>
              <button className="btn-azure" style={{ width: "100%", background: "#1e40af" }} onClick={() => initiateAITalk("vigil")}>DEPLOY VIGIL</button>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
