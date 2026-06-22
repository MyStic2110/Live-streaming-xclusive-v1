import React, { useState, useEffect, useRef } from "react";
import { 
  ArrowLeft, BrainCircuit, ShieldCheck, Trophy, Briefcase, Award, 
  Send, RefreshCw, Code, Timer, ShieldAlert, CheckCircle, Zap, Target, Star, Copy 
} from "lucide-react";
import axios from "axios";
import io from "socket.io-client";

const API = import.meta.env.VITE_API_URL || "";

const COLORS = {
  bg: "#f8fafc",
  bgCard: "#ffffff",
  border: "#e2e8f0",
  accentBlue: "#3b82f6",
  accentCyan: "#0284c7",
  accentGreen: "#16a34a",
  accentOrange: "#ea580c",
  accentRed: "#dc2626",
  textLight: "#0f172a",
  textMuted: "#64748b"
};

export default function InterviewPortalPage({ onBack }) {
  // Navigation states: 'verify' | 'matchmaking' | 'countdown' | 'arena' | 'evaluating' | 'results'
  const [phase, setPhase] = useState("verify");
  
  // Game data
  const [token, setToken] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  // Participant info
  const [selfInfo, setSelfInfo] = useState(null);
  const [opponentInfo, setOpponentInfo] = useState(null);
  
  // Match state
  const [roomId, setRoomId] = useState("");
  const [countdown, setCountdown] = useState(5);
  const [question, setQuestion] = useState(null);
  const [timeLeft, setTimeLeft] = useState(60);
  const [answer, setAnswer] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [opponentTyping, setOpponentTyping] = useState(false);
  
  // Results
  const [results, setResults] = useState(null);

  // Reconnection and disconnect statuses
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [opponentDisconnectTimeLeft, setOpponentDisconnectTimeLeft] = useState(30);
  const [selfDisconnected, setSelfDisconnected] = useState(false);

  // Modern lobby & stats states
  const [onlineStats, setOnlineStats] = useState({ totalConnected: 0, inQueue: 0, inMatches: 0 });
  const [leaderboardFilter, setLeaderboardFilter] = useState("global");
  const [lobbyFeed, setLobbyFeed] = useState([
    { id: 1, type: "info", text: "Systems online. Encrypted tunnel connections verified.", time: "Live" }
  ]);
  
  // Socket reference
  const socketRef = useRef(null);
  
  // Matchmaking text cycle
  const [lobbyText, setLobbyText] = useState("Securing tunnel...");
  
  // ponytail: extract token directly from window search params to avoid routing boilerplates
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");
    if (urlToken) {
      setToken(urlToken);
      handleVerify(urlToken);
    }
  }, []);

  // Matchmaking text cycler
  useEffect(() => {
    if (phase !== "matchmaking") return;
    const texts = [
      "Securing encrypted tunnel...",
      "Analyzing active lobby candidates...",
      "Matching with a qualified opponent...",
      "Synchronizing AI Agent Host evaluations...",
      "Lobby queueing in FIFO stack..."
    ];
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % texts.length;
      setLobbyText(texts[idx]);
    }, 3000);
    return () => clearInterval(interval);
  }, [phase]);

  // Simulated lobby activity feed ticker during matchmaking phase
  useEffect(() => {
    if (phase !== "matchmaking") return;
    
    const feedTemplates = [
      { type: "info", text: "Matched pairing engine pinged: 24ms latency." },
      { type: "match", text: "New battle match secured in room_battle_84fb." },
      { type: "results", text: "Candidate in room_battle_91a0 scored 88 pts." },
      { type: "info", text: "Candidate BATTLE-9X12 entered matchmaking queue." },
      { type: "results", text: "Malaika AI Bot completed grading in room_battle_20d2." },
      { type: "info", text: "Redis zset leaderboard rankings recalculated." }
    ];

    const interval = setInterval(() => {
      const template = feedTemplates[Math.floor(Math.random() * feedTemplates.length)];
      setLobbyFeed((prev) => [
        {
          id: Date.now(),
          type: template.type,
          text: template.text,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        },
        ...prev.slice(0, 15)
      ]);
    }, 4000);

    return () => clearInterval(interval);
  }, [phase]);

  // Opponent disconnect countdown ticking down locally
  useEffect(() => {
    if (!opponentDisconnected) return;
    const interval = setInterval(() => {
      setOpponentDisconnectTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [opponentDisconnected]);

  // Clean up socket on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Token Verification
  const handleVerify = async (tokenToCheck) => {
    const activeToken = tokenToCheck || token;
    if (!activeToken) {
      setErrorMsg("Please enter a valid Battle Token.");
      return;
    }

    setIsVerifying(true);
    setErrorMsg("");

    try {
      const response = await axios.post(`${API}/api/battle/verify-token`, { token: activeToken });
      if (response.data?.success) {
        setSelfInfo({
          name: response.data.name,
          maskedEmail: response.data.maskedEmail,
          role: response.data.role
        });
        // Transition to matchmaking
        setPhase("matchmaking");
        connectWebSocket(activeToken);
      } else {
        setErrorMsg("Failed to verify token.");
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || "Token is invalid, expired, or already used.");
    } finally {
      setIsVerifying(false);
    }
  };

  // WebSocket Connection & Game Event Registration
  const connectWebSocket = (battleToken) => {
    if (socketRef.current) socketRef.current.disconnect();

    // Connect socket
    const socket = io(API || window.location.origin);
    socketRef.current = socket;
    window.socket = socket; // For debugging and verification

    socket.on("connect", () => {
      console.log("[SOCKET] Connected to Battle Engine.");
      setSelfDisconnected(false);
      socket.emit("join_lobby", { token: battleToken });
    });

    socket.on("waiting_for_opponent", () => {
      setPhase("matchmaking");
    });

    socket.on("lobby_error", (data) => {
      setErrorMsg(data.message);
      setPhase("verify");
      socket.disconnect();
    });

    socket.on("match_found", (data) => {
      setRoomId(data.roomId);
      setOpponentInfo(data.opponent);
      setSelfInfo(data.self);
      setPhase("countdown");
      setCountdown(5);
    });

    socket.on("game_countdown", (data) => {
      setCountdown(data.seconds);
    });

    socket.on("game_state_change", (data) => {
      if (data.state === "fetching_question") {
        setPhase("countdown"); // show loading state or wait
      } else if (data.state === "evaluating") {
        setPhase("evaluating");
      }
    });

    socket.on("game_question", (data) => {
      setQuestion(data);
      setTimeLeft(data.timeLimit || 60);
      setPhase("arena");
      setAnswer("");
      setIsSubmitted(false);
      setOpponentTyping(false);
    });

    socket.on("timer_tick", (data) => {
      setTimeLeft(data.secondsLeft);
    });

    socket.on("opponent_typing", (data) => {
      setOpponentTyping(data.typing);
      // Reset typing indicator after 2s if no other update
      setTimeout(() => setOpponentTyping(false), 2000);
    });

    socket.on("answer_received", () => {
      setIsSubmitted(true);
    });

    socket.on("online_stats", (data) => {
      console.log("[SOCKET] Stats received:", data);
      setOnlineStats(data);
      
      setLobbyFeed((prev) => [
        {
          id: Date.now() + 1,
          type: "info",
          text: `Matchmaking server metrics updated: ${data.totalConnected} players online.`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        },
        ...prev.slice(0, 15)
      ]);
    });

    socket.on("opponent_disconnected", (data) => {
      setOpponentDisconnected(true);
      setOpponentDisconnectTimeLeft(data.secondsLeft || 30);
    });

    socket.on("opponent_reconnected", () => {
      setOpponentDisconnected(false);
    });

    socket.on("game_reconnected", (data) => {
      console.log("[SOCKET] Reconnected to active game session.", data);
      setRoomId(data.roomId);
      setOpponentInfo(data.opponent);
      setSelfInfo(data.self);
      setQuestion(data.question);
      setTimeLeft(data.secondsLeft);
      setIsSubmitted(data.isSubmitted);
      if (data.isSubmitted) {
        setAnswer(data.submittedAnswer);
      }
      setPhase("arena");
      setOpponentDisconnected(false);
    });

    socket.on("opponent_forfeit", (data) => {
      alert(data.message);
      // Instantly request results / reload
      socket.disconnect();
      setPhase("verify");
    });

    socket.on("battle_results", (data) => {
      setResults(data);
      setPhase("results");
      socket.disconnect();
    });

    socket.on("battle_error", (data) => {
      alert(data.message);
      setPhase("verify");
      socket.disconnect();
    });

    socket.on("disconnect", () => {
      console.log("[SOCKET] Disconnected.");
      setSelfDisconnected(true);
    });
  };

  const handleAnswerSubmit = () => {
    if (!socketRef.current || isSubmitted) return;
    socketRef.current.emit("submit_answer", { answer });
  };

  // Keyboard typing trigger
  const handleTextareaChange = (e) => {
    setAnswer(e.target.value);
    if (socketRef.current) {
      socketRef.current.emit("opponent_typing", { typing: true });
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: COLORS.bg,
      color: COLORS.textLight,
      fontFamily: "'Outfit', sans-serif",
      backgroundImage: `radial-gradient(circle at 10% 20%, rgba(59, 130, 246, 0.03) 0%, transparent 40%),
                        radial-gradient(circle at 90% 80%, rgba(16, 185, 129, 0.02) 0%, transparent 40%)`,
      paddingBottom: "4rem"
    }}>
      <style>{`
        .battle-card {
          background: ${COLORS.bgCard};
          border: 1px solid ${COLORS.border};
          backdrop-filter: blur(20px);
          border-radius: 24px;
          padding: 2.5rem;
          box-shadow: 0 10px 30px rgba(0,0,0,0.03);
          width: 100%;
          max-width: 520px;
          box-sizing: border-box;
          transition: all 0.3s;
        }
        .battle-input {
          background: rgba(15, 23, 42, 0.03);
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 12px;
          padding: 14px;
          color: #0f172a;
          font-family: monospace;
          font-size: 1.1rem;
          outline: none;
          text-align: center;
          letter-spacing: 2px;
          transition: all 0.2s;
        }
        .battle-input:focus {
          border-color: ${COLORS.accentBlue};
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
        }
        .pulse-loader {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          border: 3px solid transparent;
          border-top-color: ${COLORS.accentCyan};
          border-bottom-color: ${COLORS.accentBlue};
          animation: spin 1.5s linear infinite;
          margin: 0 auto 2rem auto;
          position: relative;
        }
        .pulse-loader::after {
          content: '';
          position: absolute;
          inset: 8px;
          border-radius: 50%;
          border: 3px solid transparent;
          border-left-color: ${COLORS.accentGreen};
          border-right-color: ${COLORS.accentOrange};
          animation: spin-reverse 1.2s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes spin-reverse {
          0% { transform: rotate(360deg); }
          100% { transform: rotate(0deg); }
        }
        .giant-num {
          font-size: 8rem;
          font-weight: 900;
          background: linear-gradient(135deg, ${COLORS.accentCyan}, ${COLORS.accentBlue});
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: zoom-pop 1s ease-in-out infinite;
        }
        @keyframes zoom-pop {
          0% { transform: scale(0.6); opacity: 0; }
          50% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 0; }
        }
        @keyframes pulse-warning {
          0% { opacity: 0.6; }
          100% { opacity: 1; }
        }
        .code-editor {
          background: #0f131a;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 1rem;
          font-family: 'Courier New', Courier, monospace;
          color: #38bdf8;
          font-size: 0.95rem;
          resize: none;
          min-height: 280px;
          line-height: 1.5;
          width: 100%;
          box-sizing: border-box;
          outline: none;
        }
        .code-editor::placeholder {
          color: rgba(255, 255, 255, 0.2);
        }
        .leaderboard-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 16px;
          background: rgba(0, 0, 0, 0.02);
          border-radius: 8px;
          border-left: 3.5px solid transparent;
          margin-bottom: 6px;
          font-size: 0.9rem;
        }
      `}</style>

      {/* ── Top Header ── */}
      <header style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: "rgba(255, 255, 255, 0.85)",
        backdropFilter: "blur(20px)",
        borderBottom: `1px solid ${COLORS.border}`
      }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "1.25rem 2rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button 
            onClick={onBack}
            style={{
              background: "rgba(0, 0, 0, 0.03)",
              border: `1px solid ${COLORS.border}`,
              color: COLORS.textMuted,
              cursor: "pointer",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              fontSize: "0.85rem",
              fontWeight: "700",
              transition: "all 0.2s"
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,0.06)"; e.currentTarget.style.color = COLORS.textLight; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.03)"; e.currentTarget.style.color = COLORS.textMuted; }}
          >
            <ArrowLeft size={16} /> LEAVE
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #06b6d4, #3b82f6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <BrainCircuit size={18} color="#fff" />
            </div>
            <span style={{ fontSize: "1.25rem", fontWeight: "900", letterSpacing: "1px", color: COLORS.textLight }}>
              BATTLE <span style={{ color: COLORS.accentCyan }}>ARENA</span>
            </span>
          </div>

          <div style={{ width: "80px" }}></div>
        </div>
      </header>

      {/* ── Main Container ── */}
      <main style={{ maxWidth: "1100px", margin: "0 auto", padding: "3rem 1.5rem 0", display: "flex", justifyContent: "center" }}>
        
        {/* ── STEP 1: Verify Token ── */}
        {phase === "verify" && (
          <div className="battle-card">
            <div style={{ textAlign: "center", marginBottom: "2rem" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(16, 185, 129, 0.08)", border: `1px solid rgba(16, 185, 129, 0.2)`, borderRadius: "99px", padding: "4px 12px", marginBottom: "1rem" }}>
                <span className="live-dot" style={{ width: "6px", height: "6px", borderRadius: "50%", background: COLORS.accentGreen, display: "inline-block", animation: "pulse-warning 1s infinite alternate" }}></span>
                <span style={{ fontSize: "0.75rem", color: COLORS.accentGreen, fontWeight: "900" }}>{onlineStats.totalConnected || 0} ACTIVE PLAYERS</span>
              </div>
              <div style={{
                width: "56px",
                height: "56px",
                borderRadius: "14px",
                background: "rgba(59, 130, 246, 0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1rem auto"
              }}>
                <Code size={24} color={COLORS.accentBlue} />
              </div>
              <h2 style={{ fontSize: "1.75rem", fontWeight: "900", margin: "0 0 6px 0", color: COLORS.textLight }}>Enter Battle Ticket</h2>
              <p style={{ margin: 0, color: COLORS.textMuted, fontSize: "0.95rem" }}>
                Provide the battle token received during your resume submission to connect.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <input
                type="text"
                value={token}
                onChange={e => setToken(e.target.value.toUpperCase())}
                placeholder="BATTLE-XXXX"
                className="battle-input"
                maxLength={20}
              />

              {errorMsg && (
                <div style={{
                  background: "rgba(239, 68, 68, 0.05)",
                  border: `1px solid ${COLORS.accentRed}`,
                  borderRadius: "12px",
                  padding: "10px 14px",
                  color: "#b91c1c",
                  fontSize: "0.85rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}>
                  <ShieldAlert size={16} style={{ flexShrink: 0 }} />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                onClick={() => handleVerify()}
                disabled={isVerifying || !token}
                style={{
                  padding: "14px",
                  background: `linear-gradient(135deg, ${COLORS.accentBlue}, ${COLORS.accentCyan})`,
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "12px",
                  fontWeight: "800",
                  fontSize: "1rem",
                  cursor: isVerifying || !token ? "default" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  opacity: isVerifying || !token ? 0.7 : 1,
                  transition: "all 0.2s"
                }}
              >
                {isVerifying ? (
                  <>
                    <RefreshCw size={18} className="spin" style={{ animation: "spin 1.5s linear infinite" }} />
                    <span>VERIFYING CODE...</span>
                  </>
                ) : (
                  <>
                    <span>ENTER lobby</span>
                    <Zap size={16} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Matchmaking Lobby ── */}
        {phase === "matchmaking" && (
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "2rem", width: "100%", maxWidth: "900px" }}>
            
            {/* Left Box: Loading status */}
            <div className="battle-card" style={{ textAlign: "center", padding: "3rem", width: "100%", maxWidth: "none" }}>
              <div className="pulse-loader"></div>
              
              <h2 style={{ fontSize: "1.8rem", fontWeight: "900", marginBottom: "0.5rem", color: COLORS.textLight }}>
                Lobby Matchmaking
              </h2>
              <p style={{ color: COLORS.accentCyan, fontSize: "1rem", fontWeight: "700", letterSpacing: "1px", minHeight: "24px" }}>
                {lobbyText}
              </p>
              
              {/* Online Stats Widget */}
              <div style={{
                background: "rgba(0,0,0,0.02)",
                border: `1px solid ${COLORS.border}`,
                borderRadius: "16px",
                padding: "1rem",
                marginTop: "2rem",
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: "10px"
              }}>
                <div>
                  <span style={{ display: "block", fontSize: "0.75rem", color: COLORS.textMuted, textTransform: "uppercase", fontWeight: "800" }}>Connected</span>
                  <span style={{ fontSize: "1.4rem", fontWeight: "900", color: COLORS.accentBlue }}>{onlineStats.totalConnected}</span>
                </div>
                <div>
                  <span style={{ display: "block", fontSize: "0.75rem", color: COLORS.textMuted, textTransform: "uppercase", fontWeight: "800" }}>In Queue</span>
                  <span style={{ fontSize: "1.4rem", fontWeight: "900", color: COLORS.accentOrange }}>{onlineStats.inQueue}</span>
                </div>
                <div>
                  <span style={{ display: "block", fontSize: "0.75rem", color: COLORS.textMuted, textTransform: "uppercase", fontWeight: "800" }}>In Matches</span>
                  <span style={{ fontSize: "1.4rem", fontWeight: "900", color: COLORS.accentGreen }}>{onlineStats.inMatches}</span>
                </div>
              </div>

              <p style={{ color: COLORS.textMuted, fontSize: "0.85rem", marginTop: "2rem", lineHeight: "1.6" }}>
                Waiting in FIFO queue... If no human candidate connects within 15 seconds, you will pair up with our AI engineering bot "Malaika".
              </p>
            </div>

            {/* Right Box: Live Activity Ticker Feed */}
            <div className="battle-card" style={{ width: "100%", maxWidth: "none", display: "flex", flexDirection: "column", padding: "2rem" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: "900", display: "flex", alignItems: "center", gap: "8px", margin: "0 0 1rem 0", color: COLORS.textLight }}>
                <span className="live-dot" style={{ width: "8px", height: "8px", borderRadius: "50%", background: COLORS.accentRed, display: "inline-block", animation: "pulse-warning 1s infinite alternate" }}></span>
                LIVE ARENA ACTIVITY
              </h3>
              
              <div style={{
                flexGrow: 1,
                overflowY: "auto",
                maxHeight: "300px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                paddingRight: "8px",
                fontFamily: "monospace",
                fontSize: "0.8rem",
                textAlign: "left"
              }}>
                {lobbyFeed.map((feed) => {
                  let badgeColor = COLORS.accentBlue;
                  if (feed.type === "match") badgeColor = COLORS.accentOrange;
                  if (feed.type === "results") badgeColor = COLORS.accentGreen;
                  return (
                    <div key={feed.id} style={{
                      padding: "8px 12px",
                      background: "rgba(0,0,0,0.02)",
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: "8px",
                      lineHeight: "1.4"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "0.7rem", color: COLORS.textMuted }}>
                        <span style={{ color: badgeColor, fontWeight: "900", textTransform: "uppercase" }}>[{feed.type}]</span>
                        <span>{feed.time}</span>
                      </div>
                      <span style={{ color: COLORS.textLight }}>{feed.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

        {/* ── STEP 3: Countdown ── */}
        {phase === "countdown" && (
          <div className="battle-card" style={{ textAlign: "center", padding: "4rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: "900", color: COLORS.textMuted, letterSpacing: "2px", textTransform: "uppercase" }}>
              OPPONENT ACQUIRED
            </span>
            <h2 style={{ fontSize: "1.5rem", fontWeight: "900", margin: "8px 0 2rem 0", color: COLORS.accentGreen }}>
              Match Secured!
            </h2>
            
            <div className="giant-num">
              {countdown}
            </div>

            <p style={{ color: COLORS.textMuted, fontSize: "0.9rem", marginTop: "2rem" }}>
              Initializing sandboxed battle environments. Get ready to write your solution.
            </p>
          </div>
        )}

        {/* ── STEP 4: Battle Arena ── */}
        {phase === "arena" && (
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* Connection alerts */}
            {selfDisconnected && (
              <div style={{
                background: "rgba(239, 68, 68, 0.08)",
                border: `1.5px dashed ${COLORS.accentRed}`,
                borderRadius: "16px",
                padding: "1rem 1.5rem",
                color: COLORS.accentRed,
                display: "flex",
                alignItems: "center",
                gap: "12px",
                fontWeight: "700",
                fontSize: "0.95rem",
                animation: "pulse-warning 1.5s infinite alternate"
              }}>
                <RefreshCw size={18} className="spin" style={{ animation: "spin 1.5s linear infinite" }} />
                <span>Connection lost. Reconnecting to arena...</span>
              </div>
            )}

            {!selfDisconnected && opponentDisconnected && (
              <div style={{
                background: "rgba(234, 88, 12, 0.08)",
                border: `1.5px dashed ${COLORS.accentOrange}`,
                borderRadius: "16px",
                padding: "1rem 1.5rem",
                color: COLORS.accentOrange,
                display: "flex",
                alignItems: "center",
                gap: "12px",
                fontWeight: "700",
                fontSize: "0.95rem"
              }}>
                <ShieldAlert size={18} style={{ animation: "pulse-warning 1s infinite alternate" }} />
                <span>Opponent disconnected. Waiting {opponentDisconnectTimeLeft}s for them to reconnect...</span>
              </div>
            )}
            {/* Header: User vs Opponent Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "1.5rem", alignItems: "center" }}>
              
              {/* Candidate Self Card */}
              <div style={{
                background: COLORS.bgCard,
                border: `1px solid ${COLORS.border}`,
                borderRadius: "16px",
                padding: "1rem 1.25rem",
                display: "flex",
                alignItems: "center",
                gap: "12px"
              }}>
                <div style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: `linear-gradient(135deg, ${COLORS.accentBlue}, ${COLORS.accentCyan})`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "900",
                  fontSize: "1.1rem"
                }}>
                  {selfInfo?.name?.substring(0, 1)}
                </div>
                <div>
                  <h4 style={{ margin: 0, fontWeight: "900", fontSize: "1rem" }}>{selfInfo?.name} (You)</h4>
                  <span style={{ fontSize: "0.75rem", color: COLORS.textMuted }}>{selfInfo?.maskedEmail}</span>
                </div>
              </div>

              {/* Central Clock */}
              <div style={{
                background: "rgba(239, 68, 68, 0.1)",
                border: `1px solid rgba(239, 68, 68, 0.3)`,
                color: COLORS.accentRed,
                padding: "8px 16px",
                borderRadius: "20px",
                fontWeight: "900",
                fontSize: "1.25rem",
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}>
                <Timer size={18} />
                <span>{timeLeft}s</span>
              </div>

              {/* Candidate Opponent Card */}
              <div style={{
                background: COLORS.bgCard,
                border: opponentInfo?.isBot ? `1px solid rgba(16, 185, 129, 0.2)` : `1px solid ${COLORS.border}`,
                borderRadius: "16px",
                padding: "1rem 1.25rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "between",
                gap: "12px",
                position: "relative"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    background: opponentInfo?.isBot 
                      ? `linear-gradient(135deg, ${COLORS.accentGreen}, #34d399)`
                      : `linear-gradient(135deg, #a855f7, #ec4899)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: "900",
                    fontSize: "1.1rem"
                  }}>
                    {opponentInfo?.name?.substring(0, 1)}
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <h4 style={{ margin: 0, fontWeight: "900", fontSize: "1rem" }}>{opponentInfo?.name}</h4>
                      {opponentInfo?.isBot && (
                        <span style={{ background: "rgba(16, 185, 129, 0.2)", color: COLORS.accentGreen, fontSize: "0.65rem", padding: "2px 6px", borderRadius: "99px", fontWeight: "900" }}>AI BOT</span>
                      )}
                    </div>
                    <span style={{ fontSize: "0.75rem", color: COLORS.textMuted }}>{opponentInfo?.email}</span>
                  </div>
                </div>
                
                {opponentTyping && (
                  <div style={{
                    position: "absolute",
                    bottom: "-20px",
                    right: "10px",
                    fontSize: "0.7rem",
                    color: COLORS.accentGreen,
                    fontWeight: "800",
                    animation: "pulse 1s infinite alternate"
                  }}>
                    Drafting answer...
                  </div>
                )}
              </div>

            </div>

            {/* Battle Layout Panels */}
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.8fr", gap: "1.5rem" }}>
              
              {/* Question description */}
              <div style={{
                background: COLORS.bgCard,
                border: `1px solid ${COLORS.border}`,
                borderRadius: "20px",
                padding: "2rem",
                display: "flex",
                flexDirection: "column"
              }}>
                <span style={{ fontSize: "0.75rem", fontWeight: "900", color: COLORS.accentCyan, letterSpacing: "1px", textTransform: "uppercase" }}>
                  TECHNICAL CHALLENGE
                </span>
                <h3 style={{ fontSize: "1.4rem", fontWeight: "900", margin: "6px 0 1rem 0" }}>{question?.title}</h3>
                
                <div style={{ 
                  color: COLORS.textLight, 
                  fontSize: "0.95rem", 
                  lineHeight: "1.6", 
                  overflowY: "auto", 
                  maxHeight: "350px", 
                  paddingRight: "10px",
                  whiteSpace: "pre-line"
                }}>
                  {question?.description}
                </div>
              </div>

              {/* Code submission box */}
              <div style={{
                background: COLORS.bgCard,
                border: `1px solid ${COLORS.border}`,
                borderRadius: "20px",
                padding: "2rem",
                display: "flex",
                flexDirection: "column",
                gap: "1.25rem"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: "900", color: COLORS.textMuted, letterSpacing: "1px" }}>
                    SANDBOX SOLUTION CONSOLE
                  </span>
                  {isSubmitted && (
                    <span style={{ color: COLORS.accentGreen, fontSize: "0.8rem", fontWeight: "900", display: "flex", alignItems: "center", gap: "4px" }}>
                      <CheckCircle size={14} /> SOLUTION LOCKED
                    </span>
                  )}
                </div>

                <textarea
                  value={answer}
                  onChange={handleTextareaChange}
                  disabled={isSubmitted || timeLeft <= 0}
                  className="code-editor"
                  placeholder={`// Provide your architectural details or code logic here...\n// Be concise but technically complete.`}
                />

                {/* Character limit neon progress bar */}
                <div style={{ width: "100%", background: "rgba(0,0,0,0.05)", height: "4px", borderRadius: "2px", overflow: "hidden" }}>
                  <div style={{
                    width: `${Math.min((answer.length / 2000) * 100, 100)}%`,
                    height: "100%",
                    background: answer.length > 1700 
                      ? COLORS.accentRed 
                      : answer.length > 1000 
                        ? COLORS.accentOrange 
                        : COLORS.accentCyan,
                    boxShadow: `0 0 8px ${answer.length > 1700 
                      ? COLORS.accentRed 
                      : answer.length > 1000 
                        ? COLORS.accentOrange 
                        : COLORS.accentCyan}`,
                    transition: "width 0.2s, background-color 0.2s"
                  }}></div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.75rem", color: COLORS.textMuted }}>
                    {answer.length} / 2000 characters written
                  </span>
                  
                  <button
                    onClick={handleAnswerSubmit}
                    disabled={isSubmitted || !answer.trim()}
                    style={{
                      padding: "12px 24px",
                      background: isSubmitted ? "rgba(255,255,255,0.05)" : `linear-gradient(135deg, ${COLORS.accentBlue}, ${COLORS.accentCyan})`,
                      color: isSubmitted ? COLORS.textMuted : "#fff",
                      border: isSubmitted ? `1px solid ${COLORS.border}` : "none",
                      borderRadius: "12px",
                      fontWeight: "800",
                      fontSize: "0.9rem",
                      cursor: isSubmitted || !answer.trim() ? "default" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      transition: "all 0.2s"
                    }}
                  >
                    <span>{isSubmitted ? "LOCKING..." : "LOCK SOLUTION"}</span>
                    <Send size={14} />
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ── STEP 5: AI Evaluating ── */}
        {phase === "evaluating" && (
          <div className="battle-card" style={{ textAlign: "center", padding: "3rem" }}>
            <div style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              background: "rgba(6, 182, 212, 0.05)",
              border: `2px dashed ${COLORS.accentCyan}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 2rem auto",
              animation: "spin 10s linear infinite"
            }}>
              <BrainCircuit size={36} color={COLORS.accentCyan} />
            </div>
            
            <h2 style={{ fontSize: "1.6rem", fontWeight: "900", marginBottom: "0.5rem" }}>Evaluating Submissions</h2>
            <p style={{ color: COLORS.accentCyan, fontSize: "0.95rem", fontWeight: "700" }}>
              AI Coach is scoring responses...
            </p>
            <p style={{ color: COLORS.textMuted, fontSize: "0.85rem", marginTop: "1rem", lineHeight: "1.5" }}>
              Comparing solution architectures, completeness, syntax efficacy, and performance constraints. This takes about 5 seconds.
            </p>
          </div>
        )}

        {/* ── STEP 6: Results & Leaderboard ── */}
        {phase === "results" && (
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "2rem" }}>
            
            {/* Victory / Defeat Header */}
            {(() => {
              const myScore = results?.playerA?.score || 0;
              const opScore = results?.playerB?.score || 0;
              const isWin = myScore > opScore;
              const isTie = myScore === opScore;
              
              let title = "BATTLE COMPLETED";
              let color = COLORS.accentBlue;
              let subtitle = "Both solutions evaluated and ranked.";

              if (isWin) {
                title = "VICTORY";
                color = COLORS.accentGreen;
                subtitle = "Your technical score outperformed your opponent!";
              } else if (isTie) {
                title = "DRAW";
                color = COLORS.accentOrange;
                subtitle = "Outstanding engineering from both candidates.";
              } else {
                title = "DEFEAT";
                color = COLORS.accentRed;
                subtitle = "Your opponent secured a higher score. Keep polishing!";
              }

              return (
                <div style={{
                  background: COLORS.bgCard,
                  border: `1.5px solid ${color}40`,
                  borderRadius: "20px",
                  padding: "2rem",
                  textAlign: "center",
                  boxShadow: `0 10px 30px ${color}10`
                }}>
                  <h1 style={{ fontSize: "3.5rem", fontWeight: "950", color, margin: 0, letterSpacing: "3px" }}>
                    {title}
                  </h1>
                  <p style={{ color: COLORS.textLight, fontSize: "1.1rem", margin: "6px 0 0 0" }}>
                    {subtitle}
                  </p>
                </div>
              );
            })()}

            {/* Score Breakdown Panels */}
            <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1.2fr", gap: "2rem" }}>
              
              {/* Solution Feedbacks */}
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                
                {/* Player Self Feedback */}
                <div style={{
                  background: COLORS.bgCard,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: "20px",
                  padding: "2rem"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                    <div>
                      <span style={{ fontSize: "0.75rem", fontWeight: "900", color: COLORS.textMuted, letterSpacing: "1px" }}>YOUR EVALUATION</span>
                      <h3 style={{ fontSize: "1.3rem", fontWeight: "900", margin: "2px 0 0 0" }}>{results?.playerA?.name}</h3>
                    </div>
                    <div style={{
                      fontSize: "2rem",
                      fontWeight: "950",
                      color: COLORS.accentCyan,
                      background: "rgba(6, 182, 212, 0.08)",
                      padding: "4px 16px",
                      borderRadius: "12px",
                      border: `1.5px solid rgba(6, 182, 212, 0.2)`
                    }}>
                      {results?.playerA?.score}
                    </div>
                  </div>
                  <h5 style={{ margin: "0 0 4px 0", color: COLORS.accentCyan, fontSize: "0.85rem", fontWeight: "800" }}>AI EVALUATION FEEDBACK:</h5>
                  <p style={{ color: COLORS.textMuted, fontSize: "0.95rem", lineHeight: "1.6", margin: 0, whiteSpace: "pre-wrap" }}>
                    {results?.playerA?.reasoning}
                  </p>
                </div>

                {/* Opponent Feedback */}
                <div style={{
                  background: COLORS.bgCard,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: "20px",
                  padding: "2rem"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                    <div>
                      <span style={{ fontSize: "0.75rem", fontWeight: "900", color: COLORS.textMuted, letterSpacing: "1px" }}>OPPONENT EVALUATION</span>
                      <h3 style={{ fontSize: "1.3rem", fontWeight: "900", margin: "2px 0 0 0" }}>{results?.playerB?.name}</h3>
                    </div>
                    <div style={{
                      fontSize: "2rem",
                      fontWeight: "950",
                      color: COLORS.textMuted,
                      background: "rgba(255, 255, 255, 0.03)",
                      padding: "4px 16px",
                      borderRadius: "12px",
                      border: `1.5px solid ${COLORS.border}`
                    }}>
                      {results?.playerB?.score}
                    </div>
                  </div>
                  <h5 style={{ margin: "0 0 4px 0", color: COLORS.textMuted, fontSize: "0.85rem", fontWeight: "800" }}>AI EVALUATION FEEDBACK:</h5>
                  <p style={{ color: COLORS.textMuted, fontSize: "0.95rem", lineHeight: "1.6", margin: 0, whiteSpace: "pre-wrap" }}>
                    {results?.playerB?.reasoning}
                  </p>
                </div>

              </div>

              {/* Leaderboard Panel */}
              <div style={{
                background: COLORS.bgCard,
                border: `1px solid ${COLORS.border}`,
                borderRadius: "20px",
                padding: "2rem",
                display: "flex",
                flexDirection: "column"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "1.25rem" }}>
                  <Trophy size={20} color={COLORS.accentOrange} />
                  <h3 style={{ fontSize: "1.2rem", fontWeight: "900", margin: 0, color: COLORS.textLight }}>Rankings</h3>
                </div>

                {/* Filter Tabs */}
                <div style={{
                  display: "flex",
                  background: "rgba(0, 0, 0, 0.02)",
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: "10px",
                  padding: "4px",
                  marginBottom: "1.5rem"
                }}>
                  <button
                    onClick={() => setLeaderboardFilter("global")}
                    style={{
                      flexGrow: 1,
                      padding: "8px",
                      background: leaderboardFilter === "global" ? "rgba(0,0,0,0.04)" : "transparent",
                      border: "none",
                      color: leaderboardFilter === "global" ? COLORS.accentCyan : COLORS.textMuted,
                      borderRadius: "8px",
                      fontWeight: "800",
                      fontSize: "0.8rem",
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                  >
                    GLOBAL
                  </button>
                  <button
                    onClick={() => setLeaderboardFilter("role")}
                    style={{
                      flexGrow: 1,
                      padding: "8px",
                      background: leaderboardFilter === "role" ? "rgba(0,0,0,0.04)" : "transparent",
                      border: "none",
                      color: leaderboardFilter === "role" ? COLORS.accentCyan : COLORS.textMuted,
                      borderRadius: "8px",
                      fontWeight: "800",
                      fontSize: "0.8rem",
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                  >
                    ROLE PEERS
                  </button>
                </div>

                <div style={{ flexGrow: 1, overflowY: "auto", maxHeight: "350px" }}>
                  {(() => {
                    const originalList = results?.leaderboard || [];
                    const filteredList = leaderboardFilter === "role" && selfInfo?.role
                      ? originalList.filter(item => item.role === selfInfo.role)
                      : originalList;

                    if (filteredList.length > 0) {
                      return filteredList.map((item, idx) => {
                        const isTop3 = idx < 3;
                        const colors = [COLORS.accentOrange, "#9ca3af", "#b45309"];
                        const borderLeftColor = isTop3 ? colors[idx] : "transparent";

                        return (
                          <div 
                            key={idx} 
                            className="leaderboard-row"
                            style={{ borderLeftColor, background: "rgba(0,0,0,0.01)", border: `1px solid ${COLORS.border}`, borderRadius: "10px", padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <span style={{ 
                                fontWeight: "950", 
                                color: isTop3 ? colors[idx] : COLORS.textMuted,
                                width: "20px"
                              }}>
                                #{idx + 1}
                              </span>
                              <div style={{ textAlign: "left" }}>
                                <span style={{ fontWeight: "800", color: COLORS.textLight, display: "block" }}>
                                  {item.name}
                                </span>
                                <span style={{ fontSize: "0.7rem", color: COLORS.textMuted }}>
                                  {item.role}
                                </span>
                              </div>
                            </div>
                            
                            <div style={{ fontWeight: "900", color: COLORS.accentCyan }}>
                              {item.score} pts
                            </div>
                          </div>
                        );
                      });
                    } else {
                      return (
                        <div style={{ textAlign: "center", color: COLORS.textMuted, padding: "2rem 0" }}>
                          No ranked peers for this role.
                        </div>
                      );
                    }
                  })()}
                </div>

                <button
                  onClick={() => {
                    setPhase("verify");
                    setResults(null);
                    setSelfInfo(null);
                    setOpponentInfo(null);
                    setQuestion(null);
                  }}
                  style={{
                    width: "100%",
                    padding: "12px",
                    background: "rgba(255,255,255,0.03)",
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: "12px",
                    color: COLORS.textLight,
                    fontWeight: "800",
                    cursor: "pointer",
                    marginTop: "1.5rem",
                    fontSize: "0.85rem"
                  }}
                >
                  PLAY AGAIN
                </button>
              </div>

            </div>

          </div>
        )}

      </main>
    </div>
  );
}
