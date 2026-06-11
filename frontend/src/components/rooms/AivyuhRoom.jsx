import React, { useEffect, useRef, useState, memo } from "react";
import CostGuardAlert from "./CostGuardAlert";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRemoteParticipants,
  useRoomContext
} from "@livekit/components-react";
import { motion, AnimatePresence } from "framer-motion";

// --- AUDIO ANALYSER HOOK ---
function useAgentAudioLevel() {
  const [amplitude, setAmplitude] = useState(0);
  const refs = useRef({});
  const room = useRoomContext();

  useEffect(() => {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.85;
    const data = new Uint8Array(analyser.frequencyBinCount);
    refs.current = { audioCtx, analyser, data };

    const tick = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      setAmplitude(avg / 128);
      refs.current.raf = requestAnimationFrame(tick);
    };
    refs.current.raf = requestAnimationFrame(tick);

    const attach = () => {
      if (refs.current.source) return;
      for (const p of room.remoteParticipants.values()) {
        for (const pub of p.trackPublications.values()) {
          if (pub.kind === "audio" && pub.track?.mediaStream) {
            const src = audioCtx.createMediaStreamSource(pub.track.mediaStream);
            src.connect(analyser);
            refs.current.source = src;
            return;
          }
        }
      }
    };

    attach();
    room.on("trackSubscribed", attach);
    return () => {
      room.off("trackSubscribed", attach);
      cancelAnimationFrame(refs.current.raf);
      audioCtx.close();
    };
  }, [room]);

  return amplitude;
}

// --- VISUALIZER COMPONENT ---
const AivyuhVisualizer = memo(() => {
  const amp = useAgentAudioLevel();
  const scale = 1 + amp * 1.5;
  const glowOpacity = 0.2 + amp * 0.5;
  const barHeight = 20 + amp * 80;

  return (
    <div className="relative flex flex-col items-center justify-center h-64 w-full">
      {/* Central Shield Icon */}
      <motion.div
        animate={{ scale }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="z-10 bg-emerald-900/40 p-6 rounded-full border border-emerald-500/50 shadow-2xl flex items-center justify-center backdrop-blur-md"
        style={{ boxShadow: `0 0 ${20 + amp * 40}px rgba(16, 185, 129, ${glowOpacity})` }}
      >
        <span className="text-5xl">🛡️</span>
      </motion.div>
      
      {/* Audio Reactive Bars */}
      <div className="flex gap-1 mt-8 h-20 items-end z-10">
        {[...Array(9)].map((_, i) => (
          <motion.div
            key={i}
            className="w-1.5 bg-emerald-500 rounded-t-full opacity-80"
            animate={{
              height: i % 2 === 0 ? barHeight * 0.6 : barHeight,
              opacity: 0.4 + (amp * 0.6)
            }}
            transition={{ type: "tween", duration: 0.1 }}
          />
        ))}
      </div>
      
      {/* Background Pulse */}
      <motion.div
        className="absolute w-64 h-64 bg-emerald-600 rounded-full blur-[100px] -z-10"
        animate={{ opacity: glowOpacity * 0.8, scale: scale * 1.2 }}
        transition={{ type: "tween", duration: 0.2 }}
      />
    </div>
  );
});

// --- SCENE COMPONENT ---
function AivyuhScene({ onLeave }) {
  const participants = useRemoteParticipants();
  const aivyuhOnline = participants.some((p) => p.identity.toLowerCase().includes("aivyuh"));

  const [logs, setLogs] = useState([]);
  const room = useRoomContext();
  const logEndRef = useRef(null);

  useEffect(() => {
    const handleData = (payload, participant) => {
      try {
        const strData = new TextDecoder().decode(payload);
        const data = JSON.parse(strData);
        if (data.type === "agent_log") {
          setLogs(prev => [...prev, { id: Date.now(), msg: data.message, level: data.level }]);
        }
      } catch (err) {
        console.error("Data decode error", err);
      }
    };
    room.on("dataReceived", handleData);
    return () => {
      room.off("dataReceived", handleData);
    };
  }, [room]);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  return (
    <div className="flex flex-col md:flex-row h-full w-full bg-[#0a0f16] text-emerald-50 overflow-hidden font-mono">
      {/* Left Panel: Visualizer */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 relative border-r border-emerald-900/30">
        <div className="absolute top-6 left-6 flex flex-col">
          <h1 className="text-2xl font-bold tracking-widest text-emerald-400 mb-1">
            AIVYUH
          </h1>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${aivyuhOnline ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
            <span className="text-xs uppercase tracking-wider text-emerald-700 font-bold">
              {aivyuhOnline ? "OWASP AUDITOR ONLINE" : "SCANNER OFFLINE"}
            </span>
          </div>
        </div>

        <AivyuhVisualizer />
        
        <div className="absolute bottom-10 flex gap-4">
          <button
            onClick={onLeave}
            className="px-8 py-3 rounded-full font-semibold uppercase tracking-widest text-xs transition-all bg-red-900/20 text-red-400 border border-red-900/50 hover:bg-red-900/40 hover:border-red-500"
          >
            DISCONNECT
          </button>
        </div>
      </div>

      {/* Right Panel: Audit Logs */}
      <div className="w-full md:w-96 flex flex-col bg-[#05080c] border-l border-emerald-900/30 p-6 overflow-hidden shadow-[-20px_0_40px_rgba(0,0,0,0.5)]">
        <h2 className="text-sm uppercase tracking-widest text-emerald-600 font-bold mb-4 flex items-center gap-2">
          <span className="text-lg">📡</span> REAL-TIME AUDIT LOG
        </h2>
        
        <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-emerald-900 scrollbar-track-transparent">
          <AnimatePresence>
            {logs.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-emerald-900/50 text-xs italic mt-4 text-center">
                Awaiting OWASP scan initiation...
              </motion.div>
            ) : (
              logs.map((log) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`p-3 rounded border text-xs leading-relaxed ${
                    log.level === "error" 
                      ? "bg-red-900/10 border-red-900/30 text-red-300"
                      : log.level === "warn"
                      ? "bg-amber-900/10 border-amber-900/30 text-amber-300"
                      : log.level === "success"
                      ? "bg-emerald-900/10 border-emerald-900/30 text-emerald-300"
                      : "bg-emerald-900/5 border-emerald-900/20 text-emerald-400/80"
                  }`}
                >
                  {log.msg}
                </motion.div>
              ))
            )}
            <div ref={logEndRef} />
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// --- MAIN WRAPPER ---
export default function AivyuhRoom({ roomData, onLeave }) {
  if (!roomData) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-[#0a0f16]"
    >
      <LiveKitRoom
        serverUrl={roomData.serverUrl}
        token={roomData.token}
        connect={true}
        audio={true}
        video={false}
      >
        <AivyuhScene onLeave={onLeave} />
        <RoomAudioRenderer />
        <CostGuardAlert />
      </LiveKitRoom>
    </motion.div>
  );
}
