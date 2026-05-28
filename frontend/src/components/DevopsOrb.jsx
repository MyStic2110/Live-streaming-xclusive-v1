import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { LiveKitRoom, useRoomContext, useLocalParticipant, useRemoteParticipants } from "@livekit/components-react";
import { Send, AlertTriangle, X, Server, User, Activity } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const API = import.meta.env.VITE_API_URL || "";

// The Chat Logic inside the Slide-out Panel
function DevopsGeniPanelChat({ initialError }) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const [messages, setMessages] = useState([
    {
      id: "init",
      sender: "DEVOPS_GENI",
      text: "DevOpsGeni SRE Monitor active. I am watching for anomalies.",
      timestamp: new Date().toISOString()
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  
  const remoteParticipants = useRemoteParticipants();
  const isAgentPresent = remoteParticipants.length > 0;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Inject the caught error automatically when connected
  useEffect(() => {
    if (initialError && room && localParticipant) {
      const errorMsg = `[SYSTEM ERROR INTERCEPTED] ${initialError}\n\nGeni, please analyze this error and tell me how to fix it.`;
      
      const payload = {
        type: "chat_message",
        sender: "USER",
        message: errorMsg,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => {
        // Prevent duplicate initial error injections
        if (prev.some(m => m.text === errorMsg)) return prev;
        return [...prev, {
          id: Math.random().toString(36).substring(7),
          sender: "SYSTEM",
          text: errorMsg,
          timestamp: payload.timestamp
        }];
      });

      const data = new TextEncoder().encode(JSON.stringify(payload));
      localParticipant.publishData(data, { topic: "chat_message", reliable: true });
    }
  }, [initialError, room, localParticipant]);

  // Listen for incoming messages
  useEffect(() => {
    if (!room) return;

    const onData = (payload, participant, kind, topic) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (topic === "chat_message") {
          setMessages(prev => [...prev, {
            id: Math.random().toString(36).substring(7),
            sender: msg.sender || "UNKNOWN",
            text: msg.message,
            timestamp: msg.timestamp || new Date().toISOString()
          }]);
          if (msg.sender !== "USER") {
            setIsTyping(false);
          }
        }
      } catch (e) {
        console.error("Failed to parse data packet:", e);
      }
    };

    room.on("dataReceived", onData);
    return () => room.off("dataReceived", onData);
  }, [room]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputValue.trim() || !room || !localParticipant) return;

    const payload = {
      type: "chat_message",
      sender: "USER",
      message: inputValue.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, {
      id: Math.random().toString(36).substring(7),
      sender: "USER",
      text: inputValue.trim(),
      timestamp: payload.timestamp
    }]);

    const data = new TextEncoder().encode(JSON.stringify(payload));
    localParticipant.publishData(data, { topic: "chat_message", reliable: true });

    setInputValue("");
    setIsTyping(true);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontFamily: "'Inter', sans-serif" }}>
      {/* Live Connection Status */}
      <div style={{ padding: "8px 16px", backgroundColor: "#f8fafc", borderBottom: "1px solid #e5e7eb", fontSize: "0.75rem", color: "#64748b", display: "flex", alignItems: "center", gap: "6px" }}>
        <span style={{ 
          width: "8px", height: "8px", borderRadius: "50%", 
          backgroundColor: isAgentPresent ? "#10b981" : "#f59e0b",
          animation: !isAgentPresent ? "pulse-presence 1.5s infinite" : "none" 
        }}></span>
        {isAgentPresent ? "Agent Online" : "Waiting for Geni..."}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isUser = msg.sender === "USER";
            const isSystem = msg.sender === "SYSTEM";
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  display: "flex",
                  gap: "12px",
                  flexDirection: isSystem ? "column" : (isUser ? "row-reverse" : "row"),
                  alignItems: isSystem ? "center" : "flex-start",
                  width: "100%"
                }}
              >
                {!isSystem && (
                  <div style={{
                    width: "28px", height: "28px", borderRadius: "6px",
                    backgroundColor: isUser ? "#3b82f6" : "#10b981",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "white", flexShrink: 0
                  }}>
                    {isUser ? <User size={16} /> : <Server size={16} />}
                  </div>
                )}

                <div style={{ maxWidth: isSystem ? "100%" : "85%", display: "flex", flexDirection: "column", alignItems: isSystem ? "center" : (isUser ? "flex-end" : "flex-start"), width: isSystem ? "100%" : "auto" }}>
                  <div style={{
                    backgroundColor: isSystem ? "#fee2e2" : (isUser ? "#3b82f6" : "#f3f4f6"),
                    color: isSystem ? "#991b1b" : (isUser ? "#ffffff" : "#1f2937"),
                    padding: "10px 14px",
                    borderRadius: "12px",
                    borderTopRightRadius: isSystem ? "12px" : (isUser ? "4px" : "12px"),
                    borderTopLeftRadius: isSystem ? "12px" : (!isUser ? "4px" : "12px"),
                    fontSize: "0.85rem",
                    lineHeight: "1.5",
                    border: isSystem ? "1px solid #fca5a5" : "none",
                    textAlign: isSystem ? "center" : "left",
                    fontWeight: isSystem ? "500" : "normal"
                  }} className="markdown-body">
                    {isUser ? (
                      msg.text || msg.message || ""
                    ) : (
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                          h1: ({node, ...props}) => <h1 style={{fontSize: "1.1rem", margin: "8px 0 4px", fontWeight: "600"}} {...props} />,
                          h2: ({node, ...props}) => <h2 style={{fontSize: "1.0rem", margin: "8px 0 4px", fontWeight: "600"}} {...props} />,
                          h3: ({node, ...props}) => <h3 style={{fontSize: "0.95rem", margin: "8px 0 4px", fontWeight: "600"}} {...props} />,
                          p: ({node, ...props}) => <p style={{margin: "4px 0", wordBreak: "break-word"}} {...props} />,
                          ul: ({node, ...props}) => <ul style={{margin: "4px 0", paddingLeft: "20px"}} {...props} />,
                          ol: ({node, ...props}) => <ol style={{margin: "4px 0", paddingLeft: "20px"}} {...props} />,
                          li: ({node, ...props}) => <li style={{marginBottom: "2px"}} {...props} />,
                          code: ({node, inline, ...props}) => 
                            inline 
                              ? <code style={{background: "rgba(0,0,0,0.08)", padding: "2px 4px", borderRadius: "4px", fontFamily: "'Courier New', Courier, monospace", fontSize: "0.8rem"}} {...props} />
                              : <pre style={{background: "#1f2937", color: "#f8fafc", padding: "10px", borderRadius: "8px", overflowX: "auto", margin: "8px 0", fontFamily: "'Courier New', Courier, monospace", fontSize: "0.8rem"}}><code {...props} /></pre>,
                          table: ({node, ...props}) => <div style={{overflowX: "auto"}}><table style={{width: "100%", borderCollapse: "collapse", margin: "8px 0"}} {...props} /></div>,
                          th: ({node, ...props}) => <th style={{border: "1px solid #d1d5db", padding: "6px", backgroundColor: "#e5e7eb", textAlign: "left"}} {...props} />,
                          td: ({node, ...props}) => <td style={{border: "1px solid #d1d5db", padding: "6px"}} {...props} />,
                        }}
                      >
                        {msg.text || msg.message || ""}
                      </ReactMarkdown>
                    )}
                    {/* Default Prompts below the Welcome Message */}
                    {msg.id === "init" && messages.length <= 1 && !initialError && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "16px" }}>
                        <button 
                          onClick={() => setInputValue("Check for ghost Python processes")}
                          style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #d1d5db", background: "#ffffff", fontSize: "0.8rem", color: "#374151", cursor: "pointer", textAlign: "left", transition: "all 0.2s" }}
                          onMouseOver={(e) => { e.currentTarget.style.background = "#f3f4f6"; e.currentTarget.style.borderColor = "#9ca3af"; }}
                          onMouseOut={(e) => { e.currentTarget.style.background = "#ffffff"; e.currentTarget.style.borderColor = "#d1d5db"; }}
                        >
                          👻 Find Ghost Processes
                        </button>
                        <button 
                          onClick={() => setInputValue("Analyze Node.js backend crash logs")}
                          style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #d1d5db", background: "#ffffff", fontSize: "0.8rem", color: "#374151", cursor: "pointer", textAlign: "left", transition: "all 0.2s" }}
                          onMouseOver={(e) => { e.currentTarget.style.background = "#f3f4f6"; e.currentTarget.style.borderColor = "#9ca3af"; }}
                          onMouseOut={(e) => { e.currentTarget.style.background = "#ffffff"; e.currentTarget.style.borderColor = "#d1d5db"; }}
                        >
                          🖥️ Analyze Backend Logs
                        </button>
                        <button 
                          onClick={() => setInputValue("What is the current Swarm memory usage?")}
                          style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #d1d5db", background: "#ffffff", fontSize: "0.8rem", color: "#374151", cursor: "pointer", textAlign: "left", transition: "all 0.2s" }}
                          onMouseOver={(e) => { e.currentTarget.style.background = "#f3f4f6"; e.currentTarget.style.borderColor = "#9ca3af"; }}
                          onMouseOut={(e) => { e.currentTarget.style.background = "#ffffff"; e.currentTarget.style.borderColor = "#d1d5db"; }}
                        >
                          📊 Swarm Memory Usage
                        </button>
                      </div>
                    )}
                    {isSystem && (
                      <div style={{ display: "flex", gap: "10px", marginTop: "12px", justifyContent: "center" }}>
                        <button 
                          onClick={() => {
                            const errText = (msg.text || "").replace("Geni, please analyze this error and tell me how to fix it.", "").trim();
                            navigator.clipboard.writeText(`Hey Antigravity, please fix this crash:\n\n${errText}`);
                            alert("Copied to clipboard! Paste it into your Antigravity chat window to automatically summon the assistant.");
                          }}
                          style={{
                            background: "#dc2626", color: "white", border: "none", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "0.75rem", fontWeight: "bold", transition: "background 0.2s"
                          }}
                          onMouseOver={(e) => e.currentTarget.style.background = "#b91c1c"}
                          onMouseOut={(e) => e.currentTarget.style.background = "#dc2626"}
                        >
                          Summon Antigravity
                        </button>
                        <button 
                          onClick={(e) => {
                            e.currentTarget.parentElement.style.display = 'none';
                          }}
                          style={{
                            background: "transparent", color: "#991b1b", border: "1px solid #fca5a5", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "0.75rem"
                          }}
                          onMouseOver={(e) => e.currentTarget.style.background = "rgba(254, 226, 226, 0.5)"}
                          onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
                        >
                          Ignore
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {isTyping && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              display: "flex", gap: "12px", flexDirection: "row"
            }}
          >
            <div style={{
              width: "28px", height: "28px", borderRadius: "6px", backgroundColor: "#10b981",
              display: "flex", alignItems: "center", justifyContent: "center", color: "white", flexShrink: 0
            }}>
              <Server size={16} />
            </div>
            <div style={{
              backgroundColor: "#f3f4f6", padding: "10px 14px", borderRadius: "12px",
              borderTopLeftRadius: "4px", display: "flex", gap: "4px", alignItems: "center"
            }}>
              <div style={{ width: "6px", height: "6px", backgroundColor: "#9ca3af", borderRadius: "50%", animation: "typingBounce 1.4s infinite ease-in-out both", animationDelay: "-0.32s" }}></div>
              <div style={{ width: "6px", height: "6px", backgroundColor: "#9ca3af", borderRadius: "50%", animation: "typingBounce 1.4s infinite ease-in-out both", animationDelay: "-0.16s" }}></div>
              <div style={{ width: "6px", height: "6px", backgroundColor: "#9ca3af", borderRadius: "50%", animation: "typingBounce 1.4s infinite ease-in-out both" }}></div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <style>{`
        @keyframes pulse-presence {
          0% { opacity: 1; }
          50% { opacity: 0.4; }
          100% { opacity: 1; }
        }
        @keyframes typingBounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
      `}</style>

      <div style={{ padding: "16px", borderTop: "1px solid #e5e7eb", backgroundColor: "#ffffff" }}>
        <form onSubmit={handleSend} style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask Geni for diagnostics..."
            style={{
              width: "100%", padding: "12px 40px 12px 16px", borderRadius: "20px",
              border: "1px solid #d1d5db", outline: "none", fontSize: "0.9rem", color: "#1f2937"
            }}
          />
          <button
            type="submit"
            disabled={!inputValue.trim()}
            style={{
              position: "absolute", right: "6px", width: "32px", height: "32px",
              borderRadius: "50%", backgroundColor: inputValue.trim() ? "#3b82f6" : "#e5e7eb",
              color: "white", border: "none", display: "flex", alignItems: "center",
              justifyContent: "center", cursor: inputValue.trim() ? "pointer" : "not-allowed"
            }}
          >
            <Send size={14} style={{ marginLeft: "-2px" }} />
          </button>
        </form>
      </div>
    </div>
  );
}

export default function DevopsOrb() {
  const [hasError, setHasError] = useState(false);
  const [latestError, setLatestError] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [tokenInfo, setTokenInfo] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Global Error Interceptor
  useEffect(() => {
    const handleGlobalError = (event) => {
      setHasError(true);
      setLatestError(event.message || "Unknown Frontend Error");
    };

    const handleUnhandledRejection = (event) => {
      setHasError(true);
      setLatestError(event.reason?.message || "Unhandled Promise Rejection");
    };

    window.addEventListener("error", handleGlobalError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    // Backend Socket.io Listener
    const backendUrl = API || `http://${window.location.hostname}:5000`;
    const socket = io(backendUrl);

    socket.on("backend_error", (data) => {
      setHasError(true);
      setLatestError(`[NODE BACKEND CRASH] ${data.type}: ${data.message}`);
    });

    return () => {
      window.removeEventListener("error", handleGlobalError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      socket.disconnect();
    };
  }, []);

  const openPanel = async () => {
    setIsOpen(true);
    if (!tokenInfo && !isConnecting) {
      setIsConnecting(true);
      try {
        const res = await axios.post(`${API}/talk-to-ai`, { agentType: "DEVOPS_GENI" });
        setTokenInfo(res.data);
      } catch (err) {
        console.error("Failed to connect to DevOpsGeni", err);
      }
      setIsConnecting(false);
    }
  };

  const closePanel = () => {
    setIsOpen(false);
    // We keep the token info so it stays connected in background, or we could reset it.
    // Let's reset the error state so the orb stops flashing.
    setHasError(false);
    setLatestError(null);
  };

  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const serverUrl = `${protocol}://${window.location.host}/livekit`;

  return (
    <>
      {/* The Floating Orb */}
      <motion.div
        initial={{ scale: 0, y: 0 }}
        animate={{ scale: 1, y: [0, -8, 0] }}
        transition={{ 
          scale: { type: "spring", stiffness: 260, damping: 20 },
          y: { duration: 4, repeat: Infinity, ease: "easeInOut" }
        }}
        style={{
          position: "fixed",
          bottom: "2.5rem",
          left: "2.5rem",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          gap: "16px",
          fontFamily: "'Inter', sans-serif"
        }}
      >
        <div
          onClick={openPanel}
          style={{
            width: "72px",
            height: "72px",
            background: hasError 
              ? "radial-gradient(circle at 30% 30%, #fca5a5 0%, #ef4444 30%, #991b1b 70%, #450a0a 100%)" // 3D Core Red
              : "radial-gradient(circle at 30% 30%, #6ee7b7 0%, #10b981 30%, #047857 70%, #022c22 100%)", // 3D Core Green
            borderRadius: "50%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            boxShadow: hasError 
              ? "inset -6px -6px 15px rgba(0,0,0,0.6), inset 6px 6px 15px rgba(255,255,255,0.4), 0 10px 30px rgba(239, 68, 68, 0.8), 0 0 60px rgba(239, 68, 68, 0.6)" 
              : "inset -6px -6px 15px rgba(0,0,0,0.5), inset 6px 6px 15px rgba(255,255,255,0.4), 0 10px 30px rgba(16, 185, 129, 0.6), 0 0 50px rgba(16, 185, 129, 0.4)",
            cursor: "pointer",
            transition: "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
            animation: hasError ? "pulse-red-3d 1.5s infinite" : "none",
            border: "1px solid rgba(255,255,255,0.1)"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.1) rotate(5deg)";
            e.currentTarget.style.filter = "brightness(1.2)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1) rotate(0deg)";
            e.currentTarget.style.filter = "brightness(1)";
          }}
        >
          {hasError ? <AlertTriangle color="rgba(255,255,255,0.95)" size={32} strokeWidth={2.5} /> : <Activity color="rgba(255,255,255,0.95)" size={32} strokeWidth={2.5} />}
        </div>
        
      </motion.div>

      {/* CSS Animation for violent pulsing */}
      <style>{`
        @keyframes pulse-red-3d {
          0% { transform: scale(1); box-shadow: inset -6px -6px 15px rgba(0,0,0,0.6), inset 6px 6px 15px rgba(255,255,255,0.4), 0 0 0 0 rgba(239, 68, 68, 0.8); }
          50% { transform: scale(1.05); box-shadow: inset -6px -6px 15px rgba(0,0,0,0.6), inset 6px 6px 15px rgba(255,255,255,0.4), 0 0 0 25px rgba(239, 68, 68, 0); }
          100% { transform: scale(1); box-shadow: inset -6px -6px 15px rgba(0,0,0,0.6), inset 6px 6px 15px rgba(255,255,255,0.4), 0 0 0 0 rgba(239, 68, 68, 0); }
        }
      `}</style>

      {/* The Slide-Out Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            style={{
              position: "fixed", top: 0, right: 0, width: "400px", height: "100vh",
              background: "#ffffff", boxShadow: "-5px 0 25px rgba(0,0,0,0.1)",
              zIndex: 10000, display: "flex", flexDirection: "column"
            }}
          >
            {/* Panel Header */}
            <div style={{
              padding: "20px", borderBottom: "1px solid #e5e7eb", display: "flex", 
              justifyContent: "space-between", alignItems: "center", background: "#f8fafc"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
                  <Server size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1rem", color: "#111827" }}>DevOpsGeni</h3>
                  <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Live SRE Diagnostics</span>
                </div>
              </div>
              <button onClick={closePanel} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
                <X size={20} />
              </button>
            </div>

            {/* Panel Body (LiveKit Connection) */}
            <div style={{ flex: 1, overflow: "hidden" }}>
              {isConnecting ? (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", color: "#64748b", fontSize: "0.9rem" }}>
                  Connecting to Swarm...
                </div>
              ) : tokenInfo ? (
                <LiveKitRoom
                  audio={false}
                  video={false}
                  token={tokenInfo.token}
                  serverUrl={serverUrl}
                  connect={true}
                >
                  <DevopsGeniPanelChat initialError={latestError} />
                </LiveKitRoom>
              ) : (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", color: "#ef4444", fontSize: "0.9rem" }}>
                  Failed to establish connection.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
