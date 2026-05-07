import React, { memo, useEffect, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRemoteParticipants,
  useLocalParticipant,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import BreathingOrb from "./BreathingOrb";

// --- INNER COMPONENT ---
// Must be inside <LiveKitRoom> to use LiveKit hooks
function LinaOrbScene({ onLeave }) {
  const [agentState, setAgentState] = useState("idle");
  const remoteParticipants = useRemoteParticipants();
  const { localParticipant } = useLocalParticipant();

  useEffect(() => {
    if (remoteParticipants.length === 0) {
      setAgentState("idle");
      return;
    }

    const lina = remoteParticipants[0];

    // Listen for Lina's speaking status via track mute/unmute & audio level
    const handleSpeakingChanged = () => {
      const isSpeaking = lina.isSpeaking;
      if (isSpeaking) {
        setAgentState("speaking");
      } else {
        setAgentState("listening");
      }
    };

    // Listen for metadata changes that Lina publishes (state: thinking, etc.)
    const handleMetadataChanged = () => {
      try {
        const meta = JSON.parse(lina.metadata || "{}");
        if (meta.state) setAgentState(meta.state);
      } catch (_) {}
    };

    lina.on("isSpeakingChanged", handleSpeakingChanged);
    lina.on("metadataChanged", handleMetadataChanged);

    // Set initial state
    handleSpeakingChanged();
    handleMetadataChanged();

    return () => {
      lina.off("isSpeakingChanged", handleSpeakingChanged);
      lina.off("metadataChanged", handleMetadataChanged);
    };
  }, [remoteParticipants]);

  // When local user speaks → show Lina is "listening"
  useEffect(() => {
    if (!localParticipant) return;

    const handleLocalSpeaking = () => {
      if (localParticipant.isSpeaking && agentState !== "speaking") {
        setAgentState("listening");
      }
    };

    localParticipant.on("isSpeakingChanged", handleLocalSpeaking);
    return () => localParticipant.off("isSpeakingChanged", handleLocalSpeaking);
  }, [localParticipant, agentState]);

  return (
    <>
      <RoomAudioRenderer />
      <BreathingOrb agentState={agentState} onLeave={onLeave} />
    </>
  );
}

// --- LINA ROOM ---
// The outer shell — connects to LiveKit and renders the orb experience
const LinaRoom = memo(function LinaRoom({ roomData, onLeave }) {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const serverUrl = `${protocol}://${window.location.host}/livekit`;

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
    </LiveKitRoom>
  );
});

export default LinaRoom;
