import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { LiveKitRoom, useTracks, VideoTrack } from "@livekit/components-react";
import { Track } from "livekit-client";

const API = "";
const getAvatarUrl = (id) => `https://picsum.photos/seed/${id}/400/500`;

// Inner component to safely extract and render the video track
function PreviewRenderer({ setHasVideo }) {
  // Safely hook into all camera tracks in this room (which is just the creator's)
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: true });
  
  useEffect(() => {
    setHasVideo(tracks.length > 0);
  }, [tracks, setHasVideo]);

  if (tracks.length === 0) return null;

  return (
    <VideoTrack 
      trackRef={tracks[0]} 
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        position: "absolute",
        top: 0,
        left: 0,
        zIndex: 0, 
      }} 
    />
  );
}

export default function StreamPreview({ creatorId }) {
  const containerRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);
  const [connectionDetails, setConnectionDetails] = useState(null);

  // 1. Intersection Observer for Lazy Loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        setIsVisible(entries[0].isIntersecting);
      },
      { root: null, rootMargin: "200px", threshold: 0 }
    );

    if (containerRef.current) observer.observe(containerRef.current);
    return () => { if (containerRef.current) observer.unobserve(containerRef.current); };
  }, []);

  // 2. Fetch Token when visible
  useEffect(() => {
    if (!isVisible) {
      setConnectionDetails(null);
      setHasVideo(false);
      return;
    }

    let isMounted = true;
    const fetchToken = async () => {
      try {
        const res = await axios.post(`${API}/get-viewer-token`, { creatorId });
        if (isMounted) {
          // Use the secure proxy URL instead of the local IP from the backend
          const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
          const proxiedUrl = `${protocol}://${window.location.host}/livekit`;
          setConnectionDetails({ token: res.data.token, serverUrl: proxiedUrl });
        }
      } catch (err) {
        console.error("Failed to fetch viewer token:", err);
      }
    };
    fetchToken();

    return () => { isMounted = false; };
  }, [creatorId, isVisible]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative" }}>
      {/* Placeholder Avatar */}
      <img 
        src={getAvatarUrl(creatorId)} 
        alt={creatorId} 
        style={{ 
          opacity: hasVideo ? 0 : 1, 
          position: "absolute", 
          zIndex: 1,
          pointerEvents: "none",
          transition: "opacity 0.5s ease",
          width: "100%",
          height: "100%",
          objectFit: "cover"
        }} 
      />
      
      {/* LiveKit React Component handles all WebRTC complexity automatically */}
      {connectionDetails && (
        <LiveKitRoom
          token={connectionDetails.token}
          serverUrl={connectionDetails.serverUrl}
          connect={true}
          audio={false} // Viewers shouldn't publish audio
          video={false} // Viewers shouldn't publish video
        >
          <PreviewRenderer setHasVideo={setHasVideo} />
        </LiveKitRoom>
      )}
    </div>
  );
}
