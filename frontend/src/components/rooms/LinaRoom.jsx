import React, { memo, useEffect, useState, useRef } from "react";
import CostGuardAlert from "./CostGuardAlert";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRemoteParticipants,
  useLocalParticipant,
  useRoomContext,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import LinaAvatarEngine from "./LinaAvatarEngine";

// --- INNER SCENE COMPONENT ---
// Rendered inside <LiveKitRoom> to access Room context and hooks
function LinaOrbScene({ onLeave }) {
  const [agentState, setAgentState] = useState("idle");
  const [remoteAudioTrack, setRemoteAudioTrack] = useState(null);
  const [messages, setMessages] = useState([]);
  const [activeTranscription, setActiveTranscription] = useState("");
  const [activeSpeaker, setActiveSpeaker] = useState("");
  const [showContext, setShowContext] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  const remoteParticipants = useRemoteParticipants();
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  const scrollContainerRef = useRef(null);

  // Layout resize listener
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      // Close context by default on mobile, open by default on desktop
      setShowContext(!mobile);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Auto-scroll chat log to bottom
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      const timer = setTimeout(() => {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: "smooth"
        });
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [messages]);

  // Synchronize Lina's speaking state and metadata
  useEffect(() => {
    if (remoteParticipants.length === 0) {
      setAgentState("idle");
      return;
    }

    const lina = remoteParticipants.find(p => {
      try {
        const meta = JSON.parse(p.metadata || "{}");
        return meta.name === "LINA" || p.identity.toUpperCase().includes("LINA");
      } catch (_) {
        return p.identity.toUpperCase().includes("LINA");
      }
    }) || remoteParticipants[0];

    const handleSpeakingChanged = () => {
      setAgentState(lina.isSpeaking ? "speaking" : "listening");
    };

    const handleMetadataChanged = () => {
      try {
        const meta = JSON.parse(lina.metadata || "{}");
        if (meta.state) setAgentState(meta.state);
      } catch (_) {}
    };

    lina.on("isSpeakingChanged", handleSpeakingChanged);
    lina.on("metadataChanged", handleMetadataChanged);

    // Initial state
    handleSpeakingChanged();
    handleMetadataChanged();

    return () => {
      lina.off("isSpeakingChanged", handleSpeakingChanged);
      lina.off("metadataChanged", handleMetadataChanged);
    };
  }, [remoteParticipants]);

  // Listen to remote participant's published audio track
  useEffect(() => {
    if (remoteParticipants.length === 0) {
      setRemoteAudioTrack(null);
      return;
    }

    const lina = remoteParticipants.find(p => {
      try {
        const meta = JSON.parse(p.metadata || "{}");
        return meta.name === "LINA" || p.identity.toUpperCase().includes("LINA");
      } catch (_) {
        return p.identity.toUpperCase().includes("LINA");
      }
    }) || remoteParticipants[0];

    const updateTracks = () => {
      // Update Audio Track
      const audioPubs = Array.from(lina.audioTrackPublications.values());
      const firstSubscribedAudioPub = audioPubs.find(pub => pub.isSubscribed && pub.track);
      if (firstSubscribedAudioPub && firstSubscribedAudioPub.track) {
        setRemoteAudioTrack(firstSubscribedAudioPub.track);
      } else {
        setRemoteAudioTrack(null);
      }
    };

    lina.on("trackSubscribed", updateTracks);
    lina.on("trackUnsubscribed", updateTracks);

    updateTracks();

    return () => {
      lina.off("trackSubscribed", updateTracks);
      lina.off("trackUnsubscribed", updateTracks);
    };
  }, [remoteParticipants]);

  // Sync finalized chat messages from the Python agent over the data channel
  useEffect(() => {
    if (!room) return;

    const onData = (payload, participant, kind, topic) => {
      if (topic === "chat_message") {
        try {
          const data = JSON.parse(new TextDecoder().decode(payload));
          setMessages(prev => {
            const msgId = data.timestamp || `${Date.now()}-${Math.random()}`;
            // Deduplicate incoming messages
            const exists = prev.some(m => m.text === data.text && m.sender === data.sender);
            if (exists) return prev;

            return [...prev, {
              id: msgId,
              sender: data.sender,
              text: data.text,
              time: new Date(data.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }];
          });
        } catch (e) {
          console.error("Failed to parse chat message:", e);
        }
      }
    };

    room.on('dataReceived', onData);
    return () => room.off('dataReceived', onData);
  }, [room]);

  // Sync real-time/interim speech segments using LiveKit transcriptionReceived
  useEffect(() => {
    if (!room) return;

    const handleTranscription = (segments, participant) => {
      if (!segments || segments.length === 0) return;

      const text = segments.map(s => s.text).join(" ").trim();
      if (!text) return;

      const isAgent = participant?.identity?.toUpperCase().includes("LINA") || 
                      participant?.name?.toUpperCase().includes("LINA") ||
                      (participant && !participant.isLocal);
      const sender = isAgent ? "Lina" : "You";

      const isFinal = segments.some(s => s.final || s.isFinal);

      if (isFinal) {
        setActiveTranscription("");
        setActiveSpeaker("");

        setMessages(prev => {
          const id = segments[0]?.id || `${Date.now()}-${Math.random()}`;
          const exists = prev.some(m => m.text === text && m.sender === sender);
          if (exists) return prev;

          return [...prev, {
            id,
            sender,
            text,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }];
        });
      } else {
        setActiveTranscription(text);
        setActiveSpeaker(sender);
      }
    };

    room.on("transcriptionReceived", handleTranscription);
    return () => {
      room.off("transcriptionReceived", handleTranscription);
    };
  }, [room]);

  // Context Panel UI
  const renderContextPanel = () => (
    <div style={{
      display: "flex",
      flexDirection: "column",
      width: isMobile ? "100%" : "440px",
      height: "100%",
      background: "rgba(255, 255, 255, 0.75)",
      backdropFilter: "blur(16px)",
      border: "1px solid rgba(0, 0, 0, 0.08)",
      borderRadius: isMobile ? "24px 24px 0 0" : "28px",
      boxShadow: "0 20px 40px rgba(0, 0, 0, 0.04)",
      overflow: "hidden",
      transition: "all 0.3s ease",
      fontFamily: "'Outfit', sans-serif"
    }}>
      {/* Panel Header */}
      <div style={{
        padding: "1.2rem 1.5rem",
        borderBottom: "1px solid rgba(0, 0, 0, 0.06)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: "rgba(255, 255, 255, 0.4)"
      }}>
        <div>
          <h3 style={{
            margin: 0,
            fontSize: "0.85rem",
            fontWeight: "900",
            letterSpacing: "1.5px",
            color: "#0f172a",
            textTransform: "uppercase"
          }}>
            CONVERSATION CONTEXT
          </h3>
          <span style={{
            fontSize: "0.65rem",
            color: "#64748b",
            fontWeight: "700",
            letterSpacing: "0.5px"
          }}>
            Live Sync • Real-time Dialogue
          </span>
        </div>
        {isMobile ? (
          <button
            onClick={() => setShowContext(false)}
            style={{
              background: "#f1f5f9",
              border: "none",
              color: "#0f172a",
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.8rem",
              fontWeight: "bold"
            }}
          >
            ✕
          </button>
        ) : (
          <span style={{
            background: "rgba(16, 185, 129, 0.15)",
            color: "#10b981",
            padding: "4px 10px",
            borderRadius: "99px",
            fontSize: "0.6rem",
            fontWeight: "800",
            letterSpacing: "0.5px"
          }}>
            LIVE
          </span>
        )}
      </div>

      {/* Messages Scroll Feed */}
      <div
        ref={scrollContainerRef}
        className="transcript-feed"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "1.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.05) 3%, rgba(0,0,0,0.3) 8%, black 20%)",
          maskImage: "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.05) 3%, rgba(0,0,0,0.3) 8%, black 20%)"
        }}
      >
        {messages.length === 0 ? (
          <div style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            color: "#64748b",
            textAlign: "center",
            padding: "2rem"
          }}>
            <span style={{ fontSize: "1.8rem", animation: "pulse 2s infinite" }}>🎙️</span>
            <p style={{ margin: 0, fontSize: "0.8rem", fontWeight: "700", color: "#0f172a" }}>
              Awaiting voice synchronization...
            </p>
            <p style={{ margin: 0, fontSize: "0.68rem", color: "#94a3b8", maxWidth: "220px" }}>
              Lina is active. Speak to begin your visual transcript.
            </p>
          </div>
        ) : (
          <>
            {messages.map((m) => {
              const isLina = m.sender === "Lina";
              return (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: isLina ? "flex-start" : "flex-end",
                    maxWidth: "85%",
                    alignSelf: isLina ? "flex-start" : "flex-end",
                    gap: "4px",
                    animation: "fadeIn 0.3s ease-out"
                  }}
                >
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "0.62rem",
                    fontWeight: "800",
                    color: isLina ? "#10b981" : "#3b82f6",
                    letterSpacing: "0.5px"
                  }}>
                    <span>{isLina ? "LINA" : "YOU"}</span>
                    <span style={{ color: "#94a3b8", fontWeight: "500" }}>{m.time}</span>
                  </div>
                  <div style={{
                    background: isLina ? "rgba(16, 185, 129, 0.08)" : "#ffffff",
                    border: isLina ? "1px solid rgba(16, 185, 129, 0.2)" : "1px solid #e2e8f0",
                    borderRadius: isLina ? "4px 16px 16px 16px" : "16px 4px 16px 16px",
                    padding: "10px 14px",
                    color: "#0f172a",
                    fontSize: "0.82rem",
                    lineHeight: "1.4",
                    fontWeight: "500",
                    wordBreak: "break-word"
                  }}>
                    {m.text}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "radial-gradient(circle at center, #f8fafc 0%, #eff6ff 100%)",
      display: "flex",
      flexDirection: "column",
      fontFamily: "'Outfit', sans-serif",
      color: "#0f172a",
      overflow: "hidden"
    }}>
      <RoomAudioRenderer />

      {/* Grid Pattern Background */}
      <div style={{
        position: "absolute",
        inset: 0,
        backgroundImage: "radial-gradient(#cbd5e1 0.7px, transparent 0.7px)",
        backgroundSize: "30px 30px",
        opacity: 0.25,
        pointerEvents: "none",
        zIndex: 1
      }} />

      {/* Fixed Premium Header */}
      <div style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "80px",
        background: "rgba(255, 255, 255, 0.8)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(0, 0, 0, 0.06)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: isMobile ? "0 1.2rem" : "0 2.5rem",
        zIndex: 10
      }}>
        {/* Left Section: Agent Name & Status */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <span style={{
            width: "10px",
            height: "10px",
            borderRadius: "50%",
            background: agentState === "speaking" ? "#10b981" : (agentState === "thinking" ? "#eab308" : "#3b82f6"),
            display: "inline-block",
            boxShadow: `0 0 12px ${agentState === "speaking" ? "#10b981" : (agentState === "thinking" ? "#eab308" : "#3b82f6")}`,
            animation: "pulse 2s infinite"
          }} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "1.15rem", fontWeight: "900", letterSpacing: "1px", color: "#0f172a" }}>
              LINA
            </span>
            <span style={{ fontSize: "0.62rem", color: "#64748b", fontWeight: "800", letterSpacing: "0.8px" }}>
              EMOTIONAL PARTNER
            </span>
          </div>
        </div>

        {/* Right Section: Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "1.2rem" }}>
          {!isMobile && (
            <button
              onClick={() => setShowContext(!showContext)}
              style={{
                background: showContext ? "rgba(59, 130, 246, 0.08)" : "#ffffff",
                border: showContext ? "1px solid rgba(59, 130, 246, 0.3)" : "1px solid #cbd5e1",
                color: showContext ? "#2563eb" : "#334155",
                padding: "8px 16px",
                borderRadius: "8px",
                fontSize: "0.72rem",
                fontWeight: "800",
                letterSpacing: "0.5px",
                cursor: "pointer",
                transition: "all 0.3s ease"
              }}
            >
              💬 {showContext ? "HIDE TRANSCRIPT" : "VIEW TRANSCRIPT"}
            </button>
          )}
          <button
            onClick={onLeave}
            style={{
              background: "transparent",
              color: "#ef4444",
              border: "1px solid #ef4444",
              padding: "8px 16px",
              borderRadius: "8px",
              fontSize: "0.72rem",
              fontWeight: "800",
              letterSpacing: "0.5px",
              cursor: "pointer",
              transition: "all 0.3s ease"
            }}
            onMouseEnter={e => {
              e.target.style.background = "rgba(239, 68, 68, 0.05)";
            }}
            onMouseLeave={e => {
              e.target.style.background = "transparent";
            }}
          >
            DISCONNECT
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: isMobile ? "90px 1rem 2rem 1rem" : "110px 2.5rem 2.5rem 2.5rem",
        boxSizing: "border-box",
        zIndex: 5,
        overflow: "hidden"
      }}>
        <div style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          alignItems: "stretch",
          justifyContent: "center",
          gap: isMobile ? "1rem" : "2.5rem",
          width: "100%",
          maxWidth: "1150px",
          height: isMobile ? "calc(100% - 20px)" : "72vh"
        }}>
          {/* Left Column: Video feed */}
          <div style={{
            flex: isMobile ? "1" : (showContext ? "1" : "none"),
            height: "100%",
            aspectRatio: isMobile ? "auto" : (showContext ? "auto" : "9/16"),
            position: "relative",
            background: "rgba(255, 255, 255, 0.6)",
            border: "1px solid #cbd5e1",
            borderRadius: "24px",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: isMobile ? "300px" : "auto",
            transition: "all 0.3s ease",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.02)"
          }}>
            {/* Ambient Background Glow */}
            <div style={{
              position: "absolute",
              inset: 0,
              background: "radial-gradient(circle at center, rgba(59, 130, 246, 0.06) 0%, transparent 70%)",
              zIndex: 1,
              pointerEvents: "none"
            }} />

            {/* Live Avatar Engine */}
            <LinaAvatarEngine
              audioTrack={remoteAudioTrack}
              isSpeaking={agentState === "speaking"}
              activeTranscription={activeTranscription}
              avatarImageUrl="/reels/lina_avatar.png"
            />

            {/* Live real-time subtitle overlay */}
            {activeTranscription && (
              <div style={{
                position: "absolute",
                bottom: "1.2rem",
                left: "1.2rem",
                right: "1.2rem",
                background: "rgba(255, 255, 255, 0.9)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(0, 0, 0, 0.06)",
                borderRadius: "16px",
                padding: "10px 14px",
                zIndex: 4,
                boxShadow: "0 10px 25px rgba(0,0,0,0.05)",
                animation: "fadeIn 0.2s ease-out"
              }}>
                <div style={{
                  fontSize: "0.58rem",
                  fontWeight: "900",
                  color: activeSpeaker === "Lina" ? "#10b981" : "#3b82f6",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  marginBottom: "4px"
                }}>
                  {activeSpeaker}
                </div>
                <p style={{
                  margin: 0,
                  fontSize: "0.82rem",
                  lineHeight: "1.4",
                  color: "#0f172a",
                  fontWeight: "600"
                }}>
                  {activeTranscription}
                </p>
              </div>
            )}

            {/* Listening / Thinking / Speaking Indicator (non-obstructive overlay at top-left) */}
            <div style={{
              position: "absolute",
              top: "1.2rem",
              left: "1.2rem",
              background: "rgba(255, 255, 255, 0.85)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(0, 0, 0, 0.06)",
              borderRadius: "99px",
              padding: "6px 14px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              zIndex: 2,
              boxShadow: "0 8px 20px rgba(0, 0, 0, 0.04)",
              animation: "fadeIn 0.3s ease-out"
            }}>
              {agentState === "thinking" ? (
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <div style={{
                    width: "12px",
                    height: "12px",
                    border: "2px solid rgba(234, 179, 8, 0.2)",
                    borderTop: "2px solid #eab308",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite"
                  }} />
                  <span style={{ fontSize: "0.62rem", color: "#eab308", fontWeight: "900", letterSpacing: "0.8px" }}>LINA IS THINKING</span>
                </div>
              ) : agentState === "speaking" ? (
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "#10b981",
                    display: "inline-block",
                    boxShadow: "0 0 10px #10b981",
                    animation: "pulse 1.5s infinite"
                  }} />
                  <span style={{ fontSize: "0.62rem", color: "#10b981", fontWeight: "900", letterSpacing: "0.8px" }}>LINA IS SPEAKING</span>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                    {[1, 2, 3].map((bar) => (
                      <div key={bar} style={{
                        width: "2px",
                        height: bar === 2 ? "10px" : "6px",
                        background: "#3b82f6",
                        borderRadius: "99px",
                        animation: "pulseWave 1.5s infinite ease-in-out",
                        animationDelay: `${bar * 0.15}s`
                      }} />
                    ))}
                  </div>
                  <span style={{ fontSize: "0.62rem", color: "#3b82f6", fontWeight: "900", letterSpacing: "0.8px" }}>LINA IS LISTENING</span>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Context panel (Desktop Only) */}
          {!isMobile && showContext && renderContextPanel()}
        </div>
      </div>

      {/* Mobile sliding Drawer (drawer container) */}
      {isMobile && (
        <div style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: showContext ? "52vh" : "0px",
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(20px)",
          borderTop: showContext ? "1px solid #cbd5e1" : "none",
          borderRadius: "24px 24px 0 0",
          zIndex: 100,
          transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 -10px 30px rgba(0,0,0,0.05)"
        }}>
          {showContext && renderContextPanel()}
        </div>
      )}

      {/* Mobile Drawer Trigger (when closed) */}
      {(isMobile && !showContext) && (
        <button
          onClick={() => setShowContext(true)}
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            height: "60px",
            background: "rgba(255, 255, 255, 0.85)",
            backdropFilter: "blur(12px)",
            borderTop: "1px solid #cbd5e1",
            color: "#0f172a",
            fontSize: "0.75rem",
            fontWeight: "800",
            letterSpacing: "1px",
            cursor: "pointer",
            zIndex: 90,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            boxShadow: "0 -5px 15px rgba(0,0,0,0.02)"
          }}
        >
          💬 VIEW CONTEXT ({messages.length} MESSAGE{messages.length !== 1 ? "S" : ""})
        </button>
      )}

      {/* Styled animation keyframes */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(0.95); opacity: 0.6; }
          50% { transform: scale(1.1); opacity: 1; }
        }
        @keyframes pulseWave {
          0%, 100% { transform: scaleY(0.7); opacity: 0.5; }
          50% { transform: scaleY(1.3); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .transcript-feed::-webkit-scrollbar {
          display: none;
        }
        .transcript-feed {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      ` }} />
    </div>
  );
}

// --- LINA ROOM COMPONENT ---
// Outer container that configures the LiveKit session
const LinaRoom = memo(function LinaRoom({ roomData, onLeave }) {
  const serverUrl = import.meta.env.VITE_LIVEKIT_URL || 'ws://localhost:7880';

  return (
    <LiveKitRoom
      audio={true}
      video={false}
      token={roomData.token}
      serverUrl={serverUrl}
      onDisconnected={onLeave}
      style={{ height: "100dvh", width: "100vw" }}
    >
      <LinaOrbScene onLeave={onLeave} />
      <CostGuardAlert />
      </LiveKitRoom>
  );
});

export default LinaRoom;
