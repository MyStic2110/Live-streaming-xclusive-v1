import React, { createContext, useContext, useEffect } from 'react';
import { useDataChannel, useVoiceAssistant, useLocalParticipant } from '@livekit/components-react';
import { novaClient } from '../NovaClient.js';

const NovaContext = createContext(novaClient);

export const NovaProvider = ({ children }) => {
    const { state: agentState } = useVoiceAssistant();
    const { localParticipant } = useLocalParticipant();
    
    // Bind the LocalParticipant's data publisher to the SDK
    useEffect(() => {
        if (localParticipant) {
            novaClient.setPublisher((payload, options) => {
                localParticipant.publishData(payload, options);
            });
        }
    }, [localParticipant]);

    // Pipe the LiveKit Agent state into our Timeline Sync Engine
    useEffect(() => {
        if (agentState) {
            novaClient.timeline.setAgentState(agentState);
        }
    }, [agentState]);

    // Listen to WebRTC Data Channels (The Event Bus)
    useDataChannel("ui_control", (msg) => {
        try {
            const payload = JSON.parse(new TextDecoder().decode(msg.payload));
            if (payload.type === "action" || payload.type === "navigate") {
                novaClient.executeCapability(payload.key, payload.parameters);
            }
        } catch (e) {
            console.error("[NovaProvider] Failed to parse LiveKit message", e);
        }
    });

    return (
        <NovaContext.Provider value={novaClient}>
            {children}
        </NovaContext.Provider>
    );
};

export const useNovaClient = () => useContext(NovaContext);
