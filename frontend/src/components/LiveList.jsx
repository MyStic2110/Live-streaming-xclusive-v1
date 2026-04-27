import React, { useState } from "react";
import axios from "axios";

const API = "";
const generateId = (prefix) => `${prefix}_${Math.floor(Math.random() * 1000)}`;

export default function LiveList({ onJoin, creators }) {
  const [isGoingLive, setIsGoingLive] = useState(false);

  const goLive = async () => {
    console.log("[LIVELIST] ACTION: User clicked 'GO LIVE'");
    setIsGoingLive(true);
    
    const creatorId = generateId("creator");
    console.log(`[LIVELIST] STEP 1: Generated Creator ID: ${creatorId}`);

    try {
      console.log(`[LIVELIST] STEP 2: Requesting room from Backend...`);
      const res = await axios.post(`${API}/go-live`, { creatorId });
      
      console.log(`[LIVELIST] STEP 3: Room Received! Name: ${res.data.roomName}`);
      onJoin({
        roomName: res.data.roomName,
        token: res.data.token,
        isCreator: true,
        creatorId: creatorId
      });
    } catch (err) {
      console.error("[LIVELIST] !!! FAILED TO GO LIVE:", err.message);
      alert("Failed to go live");
      setIsGoingLive(false);
    }
  };

  const joinCall = async (creatorId) => {
    console.log(`[LIVELIST] ACTION: User clicked 'JOIN' for Creator: ${creatorId}`);
    const userId = generateId("user");
    
    try {
      console.log(`[LIVELIST] STEP 1: Requesting call token for User: ${userId}`);
      const res = await axios.post(`${API}/request-call`, { creatorId, userId });
      
      console.log(`[LIVELIST] STEP 2: Token Received! Entering session...`);
      onJoin({
        roomName: "room_unknown", 
        token: res.data.token,
        isCreator: false,
        creatorId: creatorId
      });
    } catch (err) {
      console.error("[LIVELIST] !!! FAILED TO JOIN CALL:", err.message);
      alert("Creator is offline");
    }
  }

  return (
    <div className="app-container">
      <nav className="navbar">
        <div className="brand">
          XCLUSIVE <span className="version-badge">AZURE V5.1</span>
        </div>
        <button onClick={goLive} className="btn-azure" disabled={isGoingLive}>
          {isGoingLive ? "CONNECTING..." : "GO LIVE"}
        </button>
      </nav>

      <main className="main-wrapper">
        <div className="hero-section">
          <h1>Direct Premium Access</h1>
          <p>The world's most stable 1:1 video platform.</p>
        </div>

        <div className="grid-layout">
          {creators.length === 0 ? (
            <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "6rem", color: "var(--text-muted)" }}>
              <h2>Waiting for secure lines...</h2>
              <p style={{ fontSize: "0.8rem", marginTop: "1rem" }}>Be the first to go live and start a session.</p>
            </div>
          ) : (
            creators.map((c) => (
              <div key={c.creatorId} className="azure-card streaming-card">
                 <div className="card-media">
                    <div className="live-badge">
                      <span className="pulse-dot"></span> LIVE
                    </div>
                    <div className="creator-avatar">
                      {c.creatorId.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="card-overlay">
                       <span className="viewer-count">1.2k viewing</span>
                    </div>
                 </div>
                 <div className="card-info">
                   <h3 className="creator-name">{c.creatorId}</h3>
                   <p className="room-info">Private Premium Session</p>
                   <button onClick={() => joinCall(c.creatorId)} className="btn-azure join-btn">
                     JOIN NOW
                   </button>
                 </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
