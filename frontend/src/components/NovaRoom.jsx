import React, { memo, useState } from "react";
import { LiveKitRoom, RoomAudioRenderer, useRoomContext } from "@livekit/components-react";
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 10px #10b981' }}></div>
                    <span style={{ color: '#38bdf8', fontWeight: '800', fontSize: '0.85rem', letterSpacing: '1px' }}>NOVA AI : NEXUS ONBOARDING MODE</span>
                </div>
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

            {/* Voice Overlay Hint */}
            <div style={{ 
                position: 'absolute', 
                bottom: 40, 
                left: '50%', 
                transform: 'translateX(-50%)',
                padding: '12px 24px',
                backgroundColor: 'rgba(0,0,0,0.8)',
                borderRadius: 999,
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: 'white',
                fontSize: '0.9rem',
                fontWeight: '600',
                pointerEvents: 'none',
                zIndex: 100,
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
            }}>
                "Nova, show me the match arena"
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
