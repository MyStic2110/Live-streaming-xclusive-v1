import React, { useState, useEffect, useRef } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "";

const CopilotWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      sender: "copilot",
      text: "Hello! I am your Swarm Customer Success & Onboarding Copilot. How can I help you learn about Swarm's features, custom pricing philosophy, or supported integrations today?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  
  const messagesEndRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const savedSession = sessionStorage.getItem("swarm_copilot_session_id");
    if (savedSession) {
      setSessionId(savedSession);
    }
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    let hasAutoOpened = false;
    const handleScroll = () => {
      if (window.scrollY > 150 && !hasAutoOpened) {
        setIsOpen(true);
        hasAutoOpened = true;
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  // Clear/kill the session backend data and reset frontend state
  const handleClearSession = async () => {
    const activeSession = sessionId || sessionStorage.getItem("swarm_copilot_session_id");
    if (activeSession) {
      try {
        const token = localStorage.getItem("token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        await axios.post(`${API_URL}/copilot/session/clear`, { sessionId: activeSession }, { headers });
      } catch (e) {
        console.error("Failed to clear session on backend:", e);
      }
    }
    sessionStorage.removeItem("swarm_copilot_session_id");
    setSessionId(null);
    setMessages([
      {
        id: "welcome",
        sender: "copilot",
        text: "Hello! I am your Swarm Customer Success & Onboarding Copilot. How can I help you learn about Swarm's features, custom pricing philosophy, or supported integrations today?",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    setIsOpen(false);
    setIsMenuOpen(false);
  };

  // Detect tab close/unload and clean up the backend session file
  useEffect(() => {
    const handleUnload = () => {
      const savedSession = sessionStorage.getItem("swarm_copilot_session_id");
      if (savedSession) {
        const url = `${API_URL}/copilot/session/clear`;
        const token = localStorage.getItem("token");
        
        // Use fetch with keepalive to send authenticated request during unload
        fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ sessionId: savedSession }),
          keepalive: true
        }).catch(err => console.error("Session cleanup failed on unload:", err));
      }
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, []);

  const handleSend = async (textToSend) => {
    const queryText = textToSend || inputValue;
    if (!queryText.trim() || isLoading) return;

    const userMsg = {
      id: Math.random().toString(),
      sender: "user",
      text: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInputValue("");
    setIsLoading(true);
    const startTime = performance.now();

    try {
      const token = localStorage.getItem("token");
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      const response = await fetch(`${API_URL}/copilot/chat`, {
        method: "POST",
        headers,
        body: JSON.stringify({ query: queryText, sessionId: sessionId })
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;
      let accumText = "";

      // Add a placeholder message for Copilot which we will update dynamically
      const copilotMsgId = Math.random().toString();
      const initialCopilotMsg = {
        id: copilotMsgId,
        sender: "copilot",
        text: "",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, initialCopilotMsg]);

      let buffer = "";

      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        if (value) {
          buffer += decoder.decode(value, { stream: !done });
          const lines = buffer.split("\n");
          buffer = lines.pop(); // keep last incomplete line

          for (const line of lines) {
            const cleanLine = line.trim();
            if (!cleanLine) continue;

            if (cleanLine.startsWith("data: ")) {
              const dataStr = cleanLine.slice(6).trim();
              if (dataStr === "[DONE]") {
                break;
              }
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.chunk !== undefined) {
                  accumText += parsed.chunk;
                  setMessages(prev => prev.map(m => m.id === copilotMsgId ? { ...m, text: accumText } : m));
                }
                if (parsed.sessionId) {
                  setSessionId(parsed.sessionId);
                  sessionStorage.setItem("swarm_copilot_session_id", parsed.sessionId);
                }
              } catch (e) {
                // Ignore partial JSON parsing errors
              }
            }
          }
        }
      }

      // Record end-to-end response latency and attach it to the copilot message
      const latencyMs = performance.now() - startTime;
      setMessages(prev => prev.map(m => m.id === copilotMsgId ? { ...m, latencyMs } : m));

    } catch (error) {
      console.error("Copilot request failed:", error);
      const errorMsg = {
        id: Math.random().toString(),
        sender: "copilot",
        text: "System communication timeout. Please verify agent server connectivity.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSend();
    }
  };

  // Format a response latency (ms) for display, e.g. "2.1s" or "12s".
  const formatLatency = (ms) => {
    if (ms == null) return null;
    const sec = ms / 1000;
    return sec >= 10 ? `${Math.round(sec)}s` : `${sec.toFixed(1)}s`;
  };

  const formatText = (text) => {
    if (!text) return "";
    
    const lines = text.split("\n");
    let inList = false;
    const formattedLines = [];

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      
      // Inline formatting (bold)
      line = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      line = line.replace(/__(.*?)__/g, "<strong>$1</strong>");

      // Check for headers (e.g. ### Heading)
      const headerMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (headerMatch) {
        if (inList) {
          formattedLines.push("</ul>");
          inList = false;
        }
        const level = headerMatch[1].length;
        const fontSize = level === 1 ? "1.2rem" : level === 2 ? "1.1rem" : "1.0rem";
        formattedLines.push(`<div style="font-weight: 700; margin-top: 10px; margin-bottom: 6px; font-size: ${fontSize}; color: inherit;">${headerMatch[2]}</div>`);
        continue;
      }

      // Check for bullet lists (e.g. - item or * item)
      const listMatch = line.match(/^(\s*)[-*+]\s+(.*)$/);
      if (listMatch) {
        if (!inList) {
          formattedLines.push('<ul style="margin: 4px 0; padding-left: 20px; list-style-type: disc;">');
          inList = true;
        }
        formattedLines.push(`<li style="margin-bottom: 4px;">${listMatch[2]}</li>`);
        continue;
      }

      // If we were in a list and the line is not a list item, close the list
      if (inList && line.trim() === "") {
        formattedLines.push("</ul>");
        inList = false;
        continue;
      } else if (inList && !listMatch) {
        formattedLines.push("</ul>");
        inList = false;
      }

      // Normal line
      if (line.trim() === "") {
        formattedLines.push("<br />");
      } else {
        formattedLines.push(`<div>${line}</div>`);
      }
    }

    if (inList) {
      formattedLines.push("</ul>");
    }

    const htmlString = formattedLines.join("");
    return <span dangerouslySetInnerHTML={{ __html: htmlString }} />;
  };

  return (
    <div style={{ position: "fixed", bottom: "2rem", right: "2rem", zIndex: 10000, fontFamily: "'Outfit', sans-serif" }}>
      {/* Interactive Chat Window */}
      {isOpen && (
        <div 
          style={{
            position: "absolute",
            bottom: "80px",
            right: "0",
            width: isExpanded ? "min(680px, calc(100vw - 4rem))" : "min(400px, calc(100vw - 4rem))",
            height: isExpanded ? "80vh" : "min(640px, calc(100vh - 120px))",
            background: "#ffffff",
            borderRadius: "24px",
            border: "1px solid #e5e7eb",
            boxShadow: "0 12px 40px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.02)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            transition: "width 0.3s cubic-bezier(0.16, 1, 0.3, 1), height 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
            animation: "slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards"
          }}
        >
          {/* Header */}
          <div 
            style={{
              padding: "16px 20px",
              background: "#ffffff",
              borderBottom: "1px solid #f3f4f6",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {/* Back Chevron */}
              <button
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#8c9ba5",
                  fontSize: "1.2rem",
                  cursor: "pointer",
                  padding: "4px 4px 4px 0",
                  display: "flex",
                  alignItems: "center"
                }}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>

              {/* Avatar (Rounded Square / App style) */}
              <img 
                src="/copilot_avatar.png" 
                alt="Copilot Avatar" 
                style={{ 
                  width: "36px", 
                  height: "36px", 
                  borderRadius: "10px", 
                  objectFit: "cover",
                  border: "1px solid #e5e7eb"
                }}
              />

              {/* Header Title & Subtitle */}
              <div>
                <div style={{ fontWeight: "700", color: "#1f2937", fontSize: "0.95rem", lineHeight: "1.2" }}>
                  Swarm Copilot
                </div>
                <div style={{ color: "#8c9ba5", fontSize: "0.75rem", fontWeight: "400" }}>
                  The team can also help
                </div>
              </div>
            </div>
            
            {/* Header Right Actions */}
            <div style={{ display: "flex", alignItems: "center", gap: "16px", position: "relative" }} ref={menuRef}>
              {/* Options ("...") with Dropdown */}
              <div style={{ position: "relative" }}>
                <button 
                  onClick={() => setIsMenuOpen(prev => !prev)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: isMenuOpen ? "#6d28d9" : "#8c9ba5",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    padding: 0
                  }}
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="1" />
                    <circle cx="19" cy="12" r="1" />
                    <circle cx="5" cy="12" r="1" />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {isMenuOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 10px)",
                      right: 0,
                      background: "#ffffff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "14px",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
                      minWidth: "180px",
                      zIndex: 99999,
                      overflow: "hidden",
                      animation: "messageSlideIn 0.2s ease forwards"
                    }}
                  >
                    <button
                      onClick={() => { setIsExpanded(prev => !prev); setIsMenuOpen(false); }}
                      style={{
                        width: "100%",
                        background: "transparent",
                        border: "none",
                        padding: "13px 18px",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        fontSize: "0.875rem",
                        color: "#1f2937",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "background 0.15s"
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "#f9fafb"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#6d28d9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        {isExpanded ? (
                          <>
                            <polyline points="4 14 10 14 10 20" />
                            <polyline points="20 10 14 10 14 4" />
                            <line x1="10" y1="14" x2="3" y2="21" />
                            <line x1="21" y1="3" x2="14" y2="10" />
                          </>
                        ) : (
                          <>
                            <polyline points="15 3 21 3 21 9" />
                            <polyline points="9 21 3 21 3 15" />
                            <line x1="21" y1="3" x2="14" y2="10" />
                            <line x1="3" y1="21" x2="10" y2="14" />
                          </>
                        )}
                      </svg>
                      {isExpanded ? "Minimize window" : "Expand window"}
                    </button>

                    <div style={{ height: "1px", background: "#f3f4f6", margin: "0 12px" }} />

                    <button
                      onClick={handleClearSession}
                      style={{
                        width: "100%",
                        background: "transparent",
                        border: "none",
                        padding: "13px 18px",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        fontSize: "0.875rem",
                        color: "#ef4444",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "background 0.15s"
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "#fff5f5"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                      Close chat
                    </button>
                  </div>
                )}
              </div>

              <button 
                onClick={() => setIsOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#8c9ba5",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  padding: 0
                }}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div 
            className="copilot-msg-area"
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "20px"
            }}
          >
            {messages.map((msg) => (
              <div 
                key={msg.id}
                style={{
                  alignSelf: msg.sender === "user" ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: msg.sender === "user" ? "flex-end" : "flex-start",
                  animation: "messageSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards"
                }}
              >
                <div 
                  className={msg.sender !== "user" ? "copilot-msg-bubble" : ""}
                  style={{
                    padding: "14px 18px",
                    borderRadius: "18px",
                    background: msg.sender === "user" 
                      ? "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)" 
                      : "#f3f4f6",
                    border: "none",
                    color: msg.sender === "user" ? "#ffffff" : "#1f2937",
                    fontSize: "0.9rem",
                    lineHeight: "1.5",
                    boxShadow: msg.sender === "user" ? "0 4px 12px rgba(139, 92, 246, 0.15)" : "none",
                    wordBreak: "break-word",
                    transition: "all 0.2s ease"
                  }}
                >
                  {formatText(msg.text)}
                </div>
                <span style={{ fontSize: "0.72rem", color: "#8c9ba5", marginTop: "6px", padding: "0 6px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>{msg.sender === "user" ? "You" : "Copilot"} • {msg.sender === "user" ? "User" : "CS Agent"} • Just now</span>
                  {msg.sender !== "user" && msg.latencyMs != null && (
                    <span
                      title="Response latency"
                      style={{ display: "inline-flex", alignItems: "center", gap: "3px", color: "#8b5cf6", fontWeight: 600 }}
                    >
                      <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                      </svg>
                      {formatLatency(msg.latencyMs)}
                    </span>
                  )}
                </span>
              </div>
            ))}

            {isLoading && (
              <div style={{ alignSelf: "flex-start", display: "flex", flexDirection: "column" }}>
                <div 
                  style={{
                    padding: "14px 24px",
                    borderRadius: "20px 20px 20px 4px",
                    background: "rgba(139, 92, 246, 0.06)",
                    border: "1px solid rgba(139, 92, 246, 0.12)",
                    display: "flex",
                    gap: "6px",
                    alignItems: "center"
                  }}
                >
                  <span className="dot-pulse" style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#a78bfa", display: "inline-block", animation: "pulse 1.2s infinite ease-in-out" }}></span>
                  <span className="dot-pulse" style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#f472b6", display: "inline-block", animation: "pulse 1.2s infinite ease-in-out 0.2s" }}></span>
                  <span className="dot-pulse" style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#a78bfa", display: "inline-block", animation: "pulse 1.2s infinite ease-in-out 0.4s" }}></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <div 
            style={{
              padding: "12px 20px 20px 20px",
              background: "#ffffff",
              borderTop: "1px solid #f3f4f6",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center" }}>
              <input 
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ask a question..."
                disabled={isLoading}
                style={{
                  width: "100%",
                  background: "#ffffff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "24px",
                  padding: "14px 50px 14px 20px",
                  fontSize: "0.9rem",
                  color: "#1f2937",
                  outline: "none",
                  transition: "all 0.2s ease"
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#c084fc";
                  e.target.style.boxShadow = "0 0 0 3px rgba(192, 132, 252, 0.15)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#e5e7eb";
                  e.target.style.boxShadow = "none";
                }}
              />
              <button 
                onClick={() => handleSend()}
                disabled={isLoading || !inputValue.trim()}
                style={{
                  position: "absolute",
                  right: "6px",
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: inputValue.trim() 
                    ? "#8b5cf6" 
                    : "transparent",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: inputValue.trim() ? "pointer" : "default",
                  transition: "all 0.2s ease"
                }}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke={inputValue.trim() ? "#fff" : "#9ca3af"} strokeWidth="2.5">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Button Bubble (cyberpunk pulsing style using the real woman profile) */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={!isOpen ? "copilot-btn-glow" : ""}
        style={{
          width: "64px",
          height: "64px",
          borderRadius: "20px",
          background: "rgba(255, 255, 255, 0.95)",
          border: "1px solid rgba(139, 92, 246, 0.3)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 10px 30px rgba(124, 58, 237, 0.15), 0 0 0 1px rgba(124, 58, 237, 0.1)",
          transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
          overflow: "hidden",
          padding: 0,
          position: "relative"
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.08) translateY(-4px)";
          e.currentTarget.style.borderColor = "rgba(139, 92, 246, 0.6)";
          e.currentTarget.style.boxShadow = "0 15px 35px rgba(124, 58, 237, 0.25), 0 0 25px rgba(192, 132, 252, 0.15)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1) translateY(0)";
          e.currentTarget.style.borderColor = "rgba(139, 92, 246, 0.3)";
          e.currentTarget.style.boxShadow = "0 10px 30px rgba(124, 58, 237, 0.15), 0 0 0 1px rgba(124, 58, 237, 0.1)";
        }}
      >
        {isOpen ? (
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#1f2937" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round"/>
            <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round"/>
          </svg>
        ) : (
          <img 
            src="/copilot_avatar.png" 
            alt="Copilot" 
            style={{ width: "100%", height: "100%", objectFit: "cover" }} 
          />
        )}
      </button>

      {/* Styles for Custom Scrollbar and Animations */}
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(24px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes messageSlideIn {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes pulse {
          0%, 100% {
            transform: scale(0.6);
            opacity: 0.4;
          }
          50% {
            transform: scale(1.15);
            opacity: 1;
          }
        }
        @keyframes borderRotate {
          100% {
            transform: rotate(360deg);
          }
        }
        @keyframes ringPulse {
          0% {
            box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.4), 0 10px 30px rgba(124, 58, 237, 0.4);
          }
          70% {
            box-shadow: 0 0 0 12px rgba(139, 92, 246, 0), 0 10px 30px rgba(124, 58, 237, 0.4);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(139, 92, 246, 0), 0 10px 30px rgba(124, 58, 237, 0.4);
          }
        }
        .copilot-msg-area::-webkit-scrollbar {
          width: 5px;
        }
        .copilot-msg-area::-webkit-scrollbar-track {
          background: transparent;
        }
        .copilot-msg-area::-webkit-scrollbar-thumb {
          background: rgba(139, 92, 246, 0.2);
          border-radius: 9999px;
        }
        .copilot-msg-area::-webkit-scrollbar-thumb:hover {
          background: rgba(139, 92, 246, 0.4);
        }
        .copilot-avatar-ring {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
        }
        .copilot-avatar-ring::before {
          content: "";
          position: absolute;
          inset: -2px;
          border-radius: 50%;
          background: linear-gradient(0deg, #c084fc, #6366f1, #c084fc);
          animation: borderRotate 4s linear infinite;
          z-index: 0;
        }
        .copilot-btn-glow {
          animation: ringPulse 2.5s infinite;
        }
        .copilot-btn-glow::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: 20px;
          padding: 1px;
          background: linear-gradient(135deg, #a78bfa, #f472b6, #60a5fa);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
          opacity: 0.8;
          transition: opacity 0.3s;
        }
        .copilot-btn-glow:hover::after {
          opacity: 1;
        }
        .copilot-msg-bubble {
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .copilot-msg-bubble:hover {
          transform: translateY(-1px);
          border-color: rgba(139, 92, 246, 0.25) !important;
          background: rgba(139, 92, 246, 0.1) !important;
        }
      `}</style>
    </div>
  );
};

export default CopilotWidget;
