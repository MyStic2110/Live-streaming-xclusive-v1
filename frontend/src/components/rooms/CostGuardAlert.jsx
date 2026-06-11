import React, { useEffect, useState } from "react";
import { useRoomContext } from "@livekit/components-react";
import { motion, AnimatePresence } from "framer-motion";

export default function CostGuardAlert() {
  const room = useRoomContext();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!room) return;

    const handleData = (payload) => {
      try {
        const strData = new TextDecoder().decode(payload);
        const data = JSON.parse(strData);
        if (data.type === "COST_CEILING_EXCEEDED") {
          setShow(true);
        }
      } catch (err) {
        // Ignore decode errors
      }
    };

    room.on("dataReceived", handleData);
    return () => {
      room.off("dataReceived", handleData);
    };
  }, [room]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          <div className="bg-[#05080c] border border-red-500/50 shadow-[0_0_50px_rgba(239,68,68,0.3)] rounded-2xl p-8 max-w-md w-full mx-4 text-center">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">🛑</span>
            </div>
            
            <h2 className="text-2xl font-bold text-red-400 mb-2 tracking-wide uppercase">
              Session Terminated
            </h2>
            
            <p className="text-gray-300 mb-8 leading-relaxed text-sm">
              The CostGuard security budget for this agent has been exceeded. 
              To protect against API financial drain or Denial of Service attacks, 
              the backend has immediately severed the connection.
            </p>
            
            <button
              onClick={() => {
                setShow(false);
                window.location.href = "/";
              }}
              className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg w-full transition-colors tracking-widest text-sm uppercase"
            >
              Return Home
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
