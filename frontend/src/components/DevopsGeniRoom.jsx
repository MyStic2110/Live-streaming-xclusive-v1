import React, { useState, useEffect, useRef, memo } from "react";
import CostGuardAlert from "./CostGuardAlert";
import { LiveKitRoom, useRoomContext, useLocalParticipant, useRemoteParticipants } from "@livekit/components-react";
import { Send, ArrowLeft, Bot, User, Server } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const CollapsiblePre = ({ children, ...props }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Extract raw text recursively to count lines
  const getRawText = (nodes) => {
    if (!nodes) return "";
    return React.Children.toArray(nodes)
      .map(child => {
        if (typeof child === "string") return child;
        if (child?.props?.children) return getRawText(child.props.children);
        return "";
      })
      .join("");
  };

  const rawText = getRawText(children);
  const lineCount = rawText.split("\n").filter(Boolean).length;

  if (lineCount <= 5) {
    return (
      <pre 
        style={{ 
          backgroundColor: "#020617", 
          border: "1px solid rgba(255,255,255,0.08)", 
          borderRadius: "12px", 
          padding: "14px", 
          overflowX: "auto", 
          margin: "14px 0",
          fontFamily: "'JetBrains Mono', monospace",
          color: "#cbd5e1"
        }} 
        {...props}
      >
        {children}
      </pre>
    );
  }

  return (
    <div style={{
      border: "1px solid rgba(255, 255, 255, 0.08)",
      borderRadius: "12px",
      margin: "14px 0",
      backgroundColor: "#030712",
      overflow: "hidden",
      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)"
    }}>
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 16px",
          backgroundColor: "#0f172a",
          cursor: "pointer",
          userSelect: "none",
          borderBottom: isExpanded ? "1px solid rgba(255,255,255,0.08)" : "none",
          transition: "background-color 0.2s"
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#1e293b"}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#0f172a"}
      >
        <span style={{ fontSize: "0.85rem", color: "#38bdf8", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px" }}>
          🖥️ Diagnostics Log Output ({lineCount} lines)
        </span>
        <span style={{ fontSize: "0.75rem", color: "#94a3b8", display: "flex", alignItems: "center", gap: "4px" }}>
          {isExpanded ? "Click to collapse ▲" : "Click to expand ▼"}
        </span>
      </div>
      {isExpanded && (
        <pre 
          style={{ 
            backgroundColor: "#020617", 
            padding: "14px", 
            overflowX: "auto", 
            margin: 0,
            maxHeight: "350px",
            overflowY: "auto",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "0.85rem",
            color: "#cbd5e1"
          }} 
          {...props}
        >
          {children}
        </pre>
      )}
    </div>
  );
};

function DevopsGeniChat({ roomData, onLeave }) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const [messages, setMessages] = useState([
    {
      id: "init",
      sender: "DEVOPS_GENI",
      text: "Hello. I am DevOpsGeni, your autonomous SRE assistant. I am currently monitoring the local environment. How can I assist you with capacity planning or infrastructure analysis today?",
      timestamp: new Date().toISOString()
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const remoteParticipants = useRemoteParticipants();
  const isAgentPresent = remoteParticipants.length > 0;

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Listen for incoming chat messages
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

    // Optimistically add to UI
    setMessages(prev => [...prev, {
      id: Math.random().toString(36).substring(7),
      sender: "USER",
      text: inputValue.trim(),
      timestamp: payload.timestamp
    }]);

    // Send to LiveKit room
    const data = new TextEncoder().encode(JSON.stringify(payload));
    localParticipant.publishData(data, { topic: "chat_message", reliable: true });

    setInputValue("");
    setIsTyping(true);
  };

  const handleQuickAction = (actionText) => {
    if (!room || !localParticipant) return;
    const payload = {
      type: "chat_message",
      sender: "USER",
      message: actionText,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, {
      id: Math.random().toString(36).substring(7),
      sender: "USER",
      text: actionText,
      timestamp: payload.timestamp
    }]);
    const data = new TextEncoder().encode(JSON.stringify(payload));
    localParticipant.publishData(data, { topic: "chat_message", reliable: true });
    setIsTyping(true);
  };

  return (
    <div style={{
      height: "100vh",
      width: "100vw",
      display: "flex",
      flexDirection: "column",
      backgroundColor: "#f9fafb", // Light ChatGPT background
      fontFamily: "'Inter', sans-serif"
    }}>
      {/* Header */}
      <header style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 24px",
        backgroundColor: "#ffffff",
        borderBottom: "1px solid #e5e7eb",
        boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
        zIndex: 10
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button 
            onClick={onLeave}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              border: "1px solid #e5e7eb",
              backgroundColor: "#ffffff",
              cursor: "pointer",
              transition: "background-color 0.2s",
              color: "#374151"
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f3f4f6"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#ffffff"}
          >
            <ArrowLeft size={18} />
          </button>
          
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              backgroundColor: "#10b981", // Emerald green for Geni
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white"
            }}>
              <Server size={20} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: "1.1rem", fontWeight: "600", color: "#111827" }}>DevOpsGeni</h1>
              <span style={{ fontSize: "0.8rem", color: "#6b7280", display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ 
                  width: "8px", 
                  height: "8px", 
                  borderRadius: "50%", 
                  backgroundColor: isAgentPresent ? "#10b981" : "#f59e0b",
                  animation: !isAgentPresent ? "pulse 1.5s infinite" : "none" 
                }}></span>
                {isAgentPresent ? "Agent Online" : "Waiting for Geni to connect..."}
              </span>
            </div>
          </div>
        </div>
      </header>

      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.4; }
          100% { opacity: 1; }
        }
        @keyframes typingBounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
        .markdown-chat-bubble h1, .markdown-chat-bubble h2, .markdown-chat-bubble h3 {
          margin-top: 0;
          margin-bottom: 0.5rem;
          color: inherit;
        }
        .markdown-chat-bubble h3 {
          font-size: 1.05rem;
          font-weight: 700;
        }
        .markdown-chat-bubble p {
          margin-top: 0;
          margin-bottom: 0.75rem;
        }
        .markdown-chat-bubble p:last-child {
          margin-bottom: 0;
        }
        .markdown-chat-bubble ul, .markdown-chat-bubble ol {
          margin-top: 0;
          margin-bottom: 0.75rem;
          padding-left: 1.2rem;
        }
        .markdown-chat-bubble li {
          margin-bottom: 0.25rem;
        }
        .markdown-chat-bubble pre {
          background-color: rgba(0, 0, 0, 0.05);
          padding: 10px;
          border-radius: 8px;
          overflow-x: auto;
          margin-bottom: 0.75rem;
          border: 1px solid rgba(0, 0, 0, 0.1);
        }
        .markdown-chat-bubble code {
          font-family: 'Courier New', Courier, monospace;
          background-color: rgba(0, 0, 0, 0.05);
          padding: 2px 4px;
          border-radius: 4px;
          font-size: 0.85em;
        }
        .markdown-chat-bubble pre code {
          background-color: transparent;
          padding: 0;
        }
      `}</style>

      {/* Chat Messages Area */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "24px"
      }}>
        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isUser = msg.sender === "USER";
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                style={{
                  display: "flex",
                  gap: "16px",
                  maxWidth: "800px",
                  margin: "0 auto",
                  width: "100%",
                  flexDirection: isUser ? "row-reverse" : "row"
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "8px",
                  backgroundColor: isUser ? "#3b82f6" : "#10b981",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  flexShrink: 0
                }}>
                  {isUser ? <User size={20} /> : <Server size={20} />}
                </div>

                {/* Message Bubble */}
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: isUser ? "flex-end" : "flex-start",
                  maxWidth: "80%"
                }}>
                  <div style={{
                    fontSize: "0.8rem",
                    color: "#6b7280",
                    marginBottom: "4px",
                    fontWeight: "500"
                  }}>
                    {isUser ? "You" : "DevOpsGeni"}
                  </div>
                  <div 
                    className="markdown-chat-bubble"
                    style={{
                      background: isUser ? "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)" : "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
                      color: isUser ? "#ffffff" : "#cbd5e1",
                      padding: "16px 20px",
                      borderRadius: "20px",
                      borderTopRightRadius: isUser ? "4px" : "20px",
                      borderTopLeftRadius: !isUser ? "4px" : "20px",
                      boxShadow: isUser ? "0 4px 12px rgba(37, 99, 235, 0.2)" : "0 10px 30px rgba(0, 0, 0, 0.15)",
                      border: isUser ? "none" : "1px solid rgba(255, 255, 255, 0.08)",
                      fontSize: "0.95rem",
                      lineHeight: "1.6"
                    }}
                  >
                    {!isUser ? (
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                          h1: ({node, ...props}) => <h1 style={{ fontSize: "1.3rem", fontWeight: "800", color: "#f8fafc", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "4px", marginBottom: "12px" }} {...props} />,
                          h2: ({node, ...props}) => <h2 style={{ fontSize: "1.15rem", fontWeight: "800", color: "#f8fafc", marginBottom: "10px", marginTop: "14px" }} {...props} />,
                          h3: ({node, ...props}) => <h3 style={{ fontSize: "1.05rem", fontWeight: "700", color: "#38bdf8", marginBottom: "8px", marginTop: "12px" }} {...props} />,
                          p: ({node, ...props}) => <p style={{ marginBottom: "10px", lineHeight: "1.6", color: "#cbd5e1" }} {...props} />,
                          li: ({node, ...props}) => <li style={{ marginBottom: "6px", color: "#cbd5e1", lineHeight: "1.6" }} {...props} />,
                          ul: ({node, ...props}) => <ul style={{ marginTop: "4px", marginBottom: "10px", paddingLeft: "1.2rem" }} {...props} />,
                          ol: ({node, ...props}) => <ol style={{ marginTop: "4px", marginBottom: "10px", paddingLeft: "1.2rem" }} {...props} />,
                          strong: ({node, ...props}) => {
                            const text = props.children[0];
                            if (typeof text === 'string') {
                              if (text.includes("Action Recommended") || text.includes("Recommended Action")) {
                                return (
                                  <span style={{ display: "flex", alignItems: "center", gap: "8px", color: "#38bdf8", fontWeight: "800", marginTop: "12px", marginBottom: "6px", fontSize: "0.95rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                    🔧 {text}
                                  </span>
                                );
                              }
                              if (text.includes("Impact Analysis") || text.includes("Resource Savings")) {
                                return (
                                  <span style={{ display: "flex", alignItems: "center", gap: "8px", color: "#34d399", fontWeight: "800", marginTop: "12px", marginBottom: "6px", fontSize: "0.95rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                    📈 {text}
                                  </span>
                                );
                              }
                              if (text.includes("Risk Assessment") || text.includes("Critical Risk") || text.includes("High Risk")) {
                                return (
                                  <span style={{ display: "flex", alignItems: "center", gap: "8px", color: "#f87171", fontWeight: "800", marginTop: "12px", marginBottom: "6px", fontSize: "0.95rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                    ⚠️ {text}
                                  </span>
                                );
                              }
                            }
                            return <strong style={{ color: "#ffffff", fontWeight: "700" }} {...props} />;
                          },
                          code: ({node, inline, className, children, ...props}) => {
                            return (
                              <code 
                                style={{ 
                                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace", 
                                  backgroundColor: "rgba(255, 255, 255, 0.1)", 
                                  color: "#38bdf8", 
                                  padding: "2px 6px", 
                                  borderRadius: "6px", 
                                  fontSize: "0.9em" 
                                }} 
                                {...props}
                              >
                                {children}
                              </code>
                            );
                          },
                          pre: ({node, ...props}) => <CollapsiblePre {...props} />
                        }}
                      >
                        {msg.text || msg.message || ""}
                      </ReactMarkdown>
                    ) : (
                      <div style={{ whiteSpace: "pre-wrap" }}>{msg.text || msg.message || ""}</div>
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
              display: "flex",
              gap: "16px",
              maxWidth: "800px",
              margin: "0 auto",
              width: "100%",
              flexDirection: "row"
            }}
          >
            <div style={{
              width: "36px", height: "36px", borderRadius: "8px", backgroundColor: "#10b981",
              display: "flex", alignItems: "center", justifyContent: "center", color: "white", flexShrink: 0
            }}>
              <Server size={20} />
            </div>
            <div style={{
              backgroundColor: "#ffffff", padding: "12px 16px", borderRadius: "16px",
              borderTopLeftRadius: "4px", border: "1px solid #e5e7eb",
              display: "flex", gap: "4px", alignItems: "center"
            }}>
              <div style={{ width: "6px", height: "6px", backgroundColor: "#9ca3af", borderRadius: "50%", animation: "typingBounce 1.4s infinite ease-in-out both", animationDelay: "-0.32s" }}></div>
              <div style={{ width: "6px", height: "6px", backgroundColor: "#9ca3af", borderRadius: "50%", animation: "typingBounce 1.4s infinite ease-in-out both", animationDelay: "-0.16s" }}></div>
              <div style={{ width: "6px", height: "6px", backgroundColor: "#9ca3af", borderRadius: "50%", animation: "typingBounce 1.4s infinite ease-in-out both" }}></div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={{
        padding: "24px",
        backgroundColor: "#ffffff",
        borderTop: "1px solid #e5e7eb"
      }}>
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          {/* Quick Actions */}
          <div style={{ display: "flex", gap: "8px", overflowX: "auto", marginBottom: "16px", paddingBottom: "4px", scrollbarWidth: "none" }}>
            {[
              "Run Security Compliance Audit",
              "Analyze Infrastructure Risks",
              "Monitor CI/CD Telemetry",
              "Audit Agent Factory Logs"
            ].map((action) => (
              <button
                key={action}
                onClick={(e) => {
                  e.preventDefault();
                  handleQuickAction(action);
                }}
                style={{
                  whiteSpace: "nowrap", padding: "8px 16px", borderRadius: "20px", border: "1px solid #e5e7eb",
                  backgroundColor: "#ffffff", fontSize: "0.85rem", color: "#374151", cursor: "pointer",
                  boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)", transition: "all 0.2s"
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#f9fafb"; e.currentTarget.style.borderColor = "#d1d5db"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#ffffff"; e.currentTarget.style.borderColor = "#e5e7eb"; }}
              >
                {action}
              </button>
            ))}
          </div>
          <form 
            onSubmit={handleSend}
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center"
            }}
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask DevOpsGeni about infrastructure or ghost processes..."
              style={{
                width: "100%",
                padding: "16px 56px 16px 24px",
                borderRadius: "24px",
                border: "1px solid #d1d5db",
                backgroundColor: "#ffffff",
                fontSize: "1rem",
                outline: "none",
                boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
                color: "#1f2937",
                transition: "border-color 0.2s"
              }}
              onFocus={(e) => e.target.style.borderColor = "#3b82f6"}
              onBlur={(e) => e.target.style.borderColor = "#d1d5db"}
            />
            <button
              type="submit"
              disabled={!inputValue.trim()}
              style={{
                position: "absolute",
                right: "8px",
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                backgroundColor: inputValue.trim() ? "#3b82f6" : "#e5e7eb",
                color: "white",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: inputValue.trim() ? "pointer" : "not-allowed",
                transition: "background-color 0.2s"
              }}
            >
              <Send size={18} style={{ marginLeft: "-2px" }} />
            </button>
          </form>
          <div style={{ textAlign: "center", marginTop: "12px", fontSize: "0.75rem", color: "#9ca3af" }}>
            DevOpsGeni can monitor AWS costs, kill local ghost processes, and analyze Octane telemetry.
          </div>
        </div>
      </div>
    </div>
  );
}

const DevopsGeniRoom = memo(function DevopsGeniRoom({ roomData, onLeave }) {
  const serverUrl = import.meta.env.VITE_LIVEKIT_URL || 'ws://localhost:7880';

  return (
    <LiveKitRoom
      audio={false}
      video={false}
      token={roomData.token}
      serverUrl={serverUrl}
      onDisconnected={onLeave}
    >
      <DevopsGeniChat roomData={roomData} onLeave={onLeave} />
      <CostGuardAlert />
      </LiveKitRoom>
  );
});

export default DevopsGeniRoom;
