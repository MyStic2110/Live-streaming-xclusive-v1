import React, { memo, useState } from "react";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import { NovaProvider, useNova } from "../nova-sdk/index.js";

const DashboardContent = ({ onLeave }) => {
    const [status, setStatus] = useState("Idle");
    const [currentPage, setCurrentPage] = useState("Dashboard");

    // Capability: Navigation (Show and Tell)
    useNova({
        actionName: "navigate",
        description: "Navigates the user to different pages in the app.",
        execute: async (payload) => {
            const page = payload.key || payload;
            setStatus(`Navigating to ${page}...`);
            await new Promise(resolve => setTimeout(resolve, 800));
            setCurrentPage(page.charAt(0).toUpperCase() + page.slice(1));
            setStatus("Navigation Complete.");
            return `Now viewing ${page}.`;
        }
    });

    // Capability: Create Project
    useNova({
        actionName: "create_project",
        description: "Opens the modal to create a new project.",
        execute: async () => {
            setStatus("Opening New Project Modal...");
            await new Promise(resolve => setTimeout(resolve, 800));
            setStatus("Project Modal Ready.");
            return "Project modal is now visible.";
        }
    });

    // Capability: Logout
    useNova({
        actionName: "logout",
        description: "Logs the user out of the application.",
        execute: async () => {
            setStatus("Logging out...");
            await new Promise(resolve => setTimeout(resolve, 1200));
            onLeave(); // Trigger the leave room logic
        }
    });

    // Capability: Dark Mode
    useNova({
        actionName: "switch_dark_mode",
        description: "Toggles the application theme to dark mode.",
        execute: async () => {
            setStatus("Toggling Dark Mode...");
            await new Promise(resolve => setTimeout(resolve, 500));
            setStatus("Theme Updated.");
            return "Dark mode has been enabled.";
        }
    });

    // Capability 1: A successful action
    useNova({
        actionName: "test_success",
        description: "Runs a successful mock API call to test the ACK system.",
        execute: async () => {
            setStatus("Running Success Test...");
            await new Promise(resolve => setTimeout(resolve, 1000));
            setStatus("Success Test Passed!");
            return "Dashboard data updated successfully.";
        }
    });

    // Capability 2: A failing action
    useNova({
        actionName: "test_failure",
        description: "Runs a failing mock API call to test the error ACK system.",
        execute: async () => {
            setStatus("Running Failure Test...");
            await new Promise(resolve => setTimeout(resolve, 1000));
            setStatus("Failure Test Triggered (Error).");
            throw new Error("500 Internal Server Error: Database Timeout.");
        }
    });

    return (
        <div style={{ padding: 40, fontFamily: "'Inter', sans-serif", height: '100dvh', width: '100vw', backgroundColor: '#f8fafc', color: '#1e293b', display: 'flex', gap: 30 }}>
            {/* Mock Sidebar - Clean White Layer */}
            <div style={{ width: 260, backgroundColor: 'white', borderRadius: 24, padding: 30, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)', border: '1px solid #f1f5f9' }}>
                <h2 style={{ color: '#0284c7', fontSize: '1.5rem', fontWeight: '900', letterSpacing: '-1px', marginBottom: 40 }}>Nova<span style={{ color: '#64748b' }}>SaaS</span></h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {['Dashboard', 'Settings', 'Billing', 'Analytics'].map(page => (
                        <div key={page} style={{ 
                            padding: '12px 20px', 
                            borderRadius: 12, 
                            backgroundColor: currentPage === page ? '#f0f9ff' : 'transparent',
                            color: currentPage === page ? '#0369a1' : '#64748b',
                            fontWeight: currentPage === page ? '700' : '500',
                            transition: 'all 0.2s ease',
                            cursor: 'pointer'
                        }}>
                            {page}
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Content Area */}
            <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', gap: 24 }}>
                <button 
                    onClick={onLeave} 
                    style={{ position: 'absolute', top: 0, right: 0, padding: '12px 24px', backgroundColor: '#ef444411', color: '#ef4444', border: '1px solid #ef444422', borderRadius: 12, fontWeight: '700', cursor: 'pointer' }}
                >
                    Leave Room
                </button>
                
                <div style={{ marginBottom: 10 }}>
                    <h1 style={{ fontSize: '3.5rem', fontWeight: '900', letterSpacing: '-2px', margin: 0, color: '#0f172a' }}>{currentPage}</h1>
                    <p style={{ color: '#64748b', fontSize: '1.1rem', marginTop: 8 }}>Nova AI is managing your {currentPage.toLowerCase()} environment.</p>
                </div>
                
                {/* Status Layer */}
                <div style={{ padding: 30, backgroundColor: 'white', borderRadius: 24, boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.05)', border: '1px solid #f1f5f9' }}>
                    <h3 style={{ margin: 0, color: '#94a3b8', fontSize: '0.75rem', fontWeight: '800', letterSpacing: '2px' }}>AI ORCHESTRATION STATUS</h3>
                    <h2 style={{ color: status.includes('Error') ? '#ef4444' : status.includes('Success') ? '#10b981' : '#0f172a', margin: '15px 0', fontSize: '1.8rem', fontWeight: '800' }}>
                        {status}
                    </h2>
                    <div style={{ height: 4, width: '100%', backgroundColor: '#f1f5f9', borderRadius: 2, marginTop: 20 }}>
                        <div style={{ height: '100%', width: status === 'Idle' ? '0%' : '100%', backgroundColor: '#0ea5e9', borderRadius: 2, transition: 'width 1s ease' }} />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                    <div style={{ padding: 24, backgroundColor: 'white', borderRadius: 20, border: '1px solid #f1f5f9', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.04)' }}>
                        <h4 style={{ color: '#0f172a', margin: '0 0 10px 0', fontWeight: '800' }}>Recent Activity</h4>
                        <p style={{ color: '#64748b', fontSize: '0.95rem', margin: 0 }}>All systems nominal in {currentPage}.</p>
                    </div>
                    <div style={{ padding: 24, backgroundColor: 'white', borderRadius: 20, border: '1px solid #f1f5f9', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.04)' }}>
                        <h4 style={{ color: '#0f172a', margin: '0 0 10px 0', fontWeight: '800' }}>Smart Suggestion</h4>
                        <p style={{ color: '#64748b', fontSize: '0.95rem', margin: 0 }}>Try asking: "Nova, run the success test."</p>
                    </div>
                </div>

                <div style={{ marginTop: 'auto', padding: 24, backgroundColor: '#f1f5f9', borderRadius: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#94a3b8', letterSpacing: '1px' }}>DEMO COMMANDS</span>
                    <div style={{ display: 'flex', gap: 10 }}>
                        {["Go to billing", "Open settings", "Run failure test"].map(cmd => (
                            <span key={cmd} style={{ padding: '6px 12px', backgroundColor: 'white', borderRadius: 8, fontSize: '0.85rem', color: '#475569', fontWeight: '600', border: '1px solid #e2e8f0' }}>"{cmd}"</span>
                        ))}
                    </div>
                </div>
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
                <DashboardContent onLeave={onLeave} />
            </NovaProvider>
        </LiveKitRoom>
    );
});

export default NovaRoom;
