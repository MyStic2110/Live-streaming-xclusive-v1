import React, { memo, useState } from "react";
import { LiveKitRoom, RoomAudioRenderer, useRoomContext, useParticipants } from "@livekit/components-react";
import { NovaProvider, useNova } from "../nova-sdk/index.js";

const DashboardContent = ({ roomData, onLeave }) => {
    const iframeRef = React.useRef(null);
    const room = useRoomContext(); // Access the LiveKit room instance

    // Relay ALL Data Events to Iframe (Fast-Path Support)
    React.useEffect(() => {
        if (!room) return;
        const onData = (payload, participant, kind, topic) => {
            if (topic === "ui_control" && iframeRef.current) {
                const data = JSON.parse(new TextDecoder().decode(payload));
                iframeRef.current.contentWindow.postMessage({ type: 'nova_command', ...data }, '*');
            }
        };
        room.on('dataReceived', onData);
        return () => room.off('dataReceived', onData);
    }, [room]);

    // Track Nova's Usage Metadata
    const participants = useParticipants();
    const novaMeta = React.useMemo(() => {
        const p = participants.find(p => {
            try { return JSON.parse(p.metadata || "{}").name === "NOVA"; } catch(e) { return false; }
        });
        try { return p?.metadata ? JSON.parse(p.metadata).usage : null; } catch(e) { return null; }
    }, [participants]);

    // Hint Rotation State
    const [currentHint, setCurrentHint] = React.useState(0);
    const hints = [
        "Nova, show me the live match arena.",
        "Nova, open my squad hub.",
        "Nova, check the points leaderboard.",
        "Nova, explain my squad multiplier.",
        "Nova, show my past prediction history.",
        "Nova, what's new in the latest version?",
        "Nova, log me out of Nexus."
    ];

    React.useEffect(() => {
        const interval = setInterval(() => {
            setCurrentHint((prev) => (prev + 1) % hints.length);
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    // Capability: Navigate (Relay to Iframe)
    useNova({
        actionName: "navigate",
        description: "Navigates the user to different pages in the app.",
        execute: async (payload) => {
            if (iframeRef.current) {
                const message = { type: 'nova_command', key: 'navigate', parameters: payload };
                iframeRef.current.contentWindow.postMessage(message, '*');
                return `Relayed navigation to ${payload.key} to the portal.`;
            }
        }
    });

    return (
        <div style={{ 
            height: '100dvh', 
            width: '100vw', 
            backgroundColor: '#030712', 
            display: 'flex', 
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative'
        }}>
            {/* SaaS Control Bar */}
            <div style={{ 
                height: 60, 
                backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                backdropFilter: 'blur(10px)',
                borderBottom: '1px solid rgba(56, 189, 248, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 24px',
                zIndex: 100
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 15px #10b981' }}></div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ color: '#fff', fontWeight: '900', fontSize: '0.9rem', letterSpacing: '1px' }}>NOVA COPILOT</span>
                        <span style={{ color: 'rgba(56, 189, 248, 0.7)', fontWeight: '600', fontSize: '0.65rem', letterSpacing: '0.5px' }}>State-of-the-art SaaS copilot with autonomous UI navigation.</span>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase' }}>Session Tokens</span>
                        <span style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '900', fontFamily: 'monospace' }}>
                            {novaMeta ? (novaMeta.input_tokens + novaMeta.output_tokens).toLocaleString() : "0"}
                        </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase' }}>Cost (USD)</span>
                        <span style={{ color: '#10b981', fontSize: '0.9rem', fontWeight: '900', fontFamily: 'monospace' }}>
                            ${novaMeta ? novaMeta.total_cost.toFixed(4) : "0.0000"}
                        </span>
                    </div>
                    <div style={{ width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.1)' }}></div>
                    <button 
                        onClick={onLeave} 
                    style={{ 
                        padding: '6px 16px', 
                        backgroundColor: '#ef444422', 
                        color: '#ef4444', 
                        border: '1px solid #ef444444', 
                        borderRadius: 8, 
                        fontWeight: '700', 
                        cursor: 'pointer',
                        fontSize: '0.75rem'
                    }}
                >
                    END SESSION
                    </button>
                </div>
            </div>

            {/* The Live Client Product Portal */}
            <iframe 
                ref={iframeRef}
                src={`http://localhost:8000?demo=true`} 
                style={{ 
                    flex: 1, 
                    border: 'none',
                    width: '100%',
                    height: '100%'
                }}
                title="Nexus IPL Portal"
            />

            {/* Dynamic Voice Suggestion Ribbon */}
            <div style={{ 
                position: 'absolute', 
                bottom: 40, 
                left: '50%', 
                transform: 'translateX(-50%)',
                padding: '12px 32px',
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                backdropFilter: 'blur(10px)',
                borderRadius: 999,
                border: '1px solid rgba(56, 189, 248, 0.4)',
                color: 'white',
                fontSize: '0.95rem',
                fontWeight: '700',
                pointerEvents: 'none',
                zIndex: 100,
                boxShadow: '0 10px 40px rgba(0,0,0,0.8)',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                minWidth: 'max-content'
            }}>
                <span style={{ color: '#38bdf8', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Try saying:</span>
                <span style={{ transition: 'opacity 0.5s', opacity: 1 }}>
                    "{hints[currentHint]}"
                </span>
            </div>

        </div>
    );
};


const NovaRoom = memo(function NovaRoom({ roomData, onLeave }) {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const serverUrl = `${protocol}://${window.location.host}/livekit`;

    return (
        <LiveKitRoom
            audio={true}
            video={false}
            token={roomData.token}
            serverUrl={serverUrl}
            onDisconnected={onLeave}
        >
            <RoomAudioRenderer />
            <NovaProvider>
                <DashboardContent roomData={roomData} onLeave={onLeave} />
            </NovaProvider>
        </LiveKitRoom>
    );
});

export default NovaRoom;
