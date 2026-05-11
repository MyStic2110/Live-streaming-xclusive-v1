import React, { memo, useMemo } from "react";
import { 
    LiveKitRoom, 
    RoomAudioRenderer, 
    useParticipants,
    useRoomContext 
} from "@livekit/components-react";
import { motion } from "framer-motion";

const WeatherContent = ({ onLeave }) => {
    const participants = useParticipants();
    
    // Track Weather Agent's Metadata (Cost/Tokens)
    const agentMeta = useMemo(() => {
        const p = participants.find(p => {
            try { return JSON.parse(p.metadata || "{}").name === "AURA"; } catch(e) { return false; }
        });
        try { return p?.metadata ? JSON.parse(p.metadata).usage : null; } catch(e) { return null; }
    }, [participants]);

    return (
        <div style={{ 
            height: '100vh', 
            width: '100vw', 
            background: 'linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%)', 
            display: 'flex', 
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
            fontFamily: "'Outfit', sans-serif"
        }}>
            {/* Atmospheric Overlay */}
            <div style={{ 
                position: 'absolute', 
                inset: 0, 
                background: 'url("https://www.transparenttextures.com/patterns/cloudy-day.png")',
                opacity: 0.1,
                pointerEvents: 'none'
            }}></div>

            {/* Weather Control Bar */}
            <div style={{ 
                height: 70, 
                backgroundColor: 'rgba(255, 255, 255, 0.1)', 
                backdropFilter: 'blur(20px)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 40px',
                zIndex: 100
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#fff', boxShadow: '0 0 15px #fff' }}></div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ color: '#fff', fontWeight: '900', fontSize: '1rem', letterSpacing: '1px' }}>AURA</span>
                        <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontWeight: '600', fontSize: '0.7rem' }}>Regional climate intelligence & monsoon analysis.</span>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase' }}>Session Cost</span>
                        <span style={{ color: '#fff', fontSize: '1.1rem', fontWeight: '900', fontFamily: 'monospace' }}>
                            ${agentMeta ? agentMeta.total_cost.toFixed(4) : "0.0000"}
                        </span>
                    </div>
                    <button 
                        onClick={onLeave} 
                        style={{ 
                            padding: '8px 20px', 
                            backgroundColor: '#fff', 
                            color: '#3b82f6', 
                            border: 'none', 
                            borderRadius: 12, 
                            fontWeight: '900', 
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
                        }}
                    >
                        DISCONNECT
                    </button>
                </div>
            </div>

            {/* Main Weather Visualizer */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                <motion.div 
                    animate={{ 
                        scale: [1, 1.05, 1],
                        rotate: [0, 5, -5, 0]
                    }}
                    transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                    style={{ 
                        width: 300, 
                        height: 300, 
                        borderRadius: '50%', 
                        background: 'radial-gradient(circle at 30% 30%, #fff, #7dd3fc)',
                        boxShadow: '0 0 100px rgba(255,255,255,0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '6rem'
                    }}
                >
                    ⛅
                </motion.div>
                
                <h2 style={{ color: 'white', marginTop: '3rem', fontWeight: '800', fontSize: '2rem', textAlign: 'center' }}>
                    Listening for climate queries...
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '1.1rem', maxWidth: '600px', textAlign: 'center', marginTop: '1rem', lineHeight: '1.6' }}>
                    Ask about monsoon intensity, regional rainfall predictions, or flooding alerts for specific districts.
                </p>
            </div>

            {/* Bottom Suggestion Bar */}
            <div style={{ 
                padding: '30px', 
                background: 'rgba(0,0,0,0.1)', 
                display: 'flex', 
                justifyContent: 'center', 
                gap: '15px',
                zIndex: 10
            }}>
                {["Chennai Rainfall", "Monsoon Trends", "Flood Risk", "Humidity Alerts"].map(tag => (
                    <span key={tag} style={{ 
                        padding: '6px 16px', 
                        background: 'rgba(255,255,255,0.1)', 
                        border: '1px solid rgba(255,255,255,0.2)', 
                        borderRadius: 40, 
                        color: 'white', 
                        fontSize: '0.8rem', 
                        fontWeight: '600' 
                    }}>
                        {tag}
                    </span>
                ))}
            </div>
        </div>
    );
};

const WeatherRoom = memo(function WeatherRoom({ roomData, onLeave }) {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const serverUrl = `${protocol}://${window.location.host}/livekit`;

    return (
        <LiveKitRoom
            audio={true}
            token={roomData.token}
            serverUrl={serverUrl}
            onDisconnected={onLeave}
        >
            <RoomAudioRenderer />
            <WeatherContent onLeave={onLeave} />
        </LiveKitRoom>
    );
});

export default WeatherRoom;
