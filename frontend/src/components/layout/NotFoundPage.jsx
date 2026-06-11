import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { setupPageAEO, cleanupPageAEO } from "../../utils/aeo";

const COLORS = {
  primary: "#111827",
  accent: "#3b82f6",
  textMuted: "#6b7280",
  bgLight: "#ffffff",
  border: "#e5e7eb"
};

const NotFoundPage = ({ onBack }) => {
  React.useEffect(() => {
    setupPageAEO({
      title: "Page Not Found | Swarm Agentic Lab",
      description: "The page you are looking for does not exist or has been moved.",
      schemaId: "not-found-aeo"
    });
    return () => cleanupPageAEO("not-found-aeo");
  }, []);

  return (
    <div style={{ background: COLORS.bgLight, minHeight: "100vh", fontFamily: "'Outfit', sans-serif" }}>
      <nav style={{ 
        padding: "1.5rem 5%", background: "rgba(255,255,255,0.8)", 
        backdropFilter: "blur(20px)", borderBottom: `1px solid ${COLORS.border}`,
        position: "sticky", top: 0, zIndex: 100, display: "flex", justifyContent: "space-between", alignItems: "center"
      }}>
        <button 
          onClick={onBack}
          style={{ 
            background: "none", border: "none", color: COLORS.primary, 
            fontWeight: "800", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px",
            fontSize: "0.9rem", letterSpacing: "1px"
          }}
        >
          <ArrowLeft size={18} /> BACK TO FLEET
        </button>
        <div style={{ fontSize: "1.2rem", fontWeight: "900", letterSpacing: "2px", color: COLORS.primary }}>
          SWARM <span style={{ color: COLORS.accent }}>LAB</span>
        </div>
        <div style={{ width: "100px" }}></div>
      </nav>

      <main style={{ maxWidth: "800px", margin: "10rem auto", padding: "0 5%", textAlign: "center" }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "2rem" }}>
            <div style={{ padding: "2rem", background: "rgba(59,130,246,0.1)", borderRadius: "50%" }}>
              <AlertTriangle size={64} color={COLORS.accent} />
            </div>
          </div>
          <h1 style={{ fontSize: "5rem", fontWeight: "900", color: COLORS.primary, letterSpacing: "-3px", lineHeight: 1, marginBottom: "1rem" }}>
            404
          </h1>
          <h2 style={{ fontSize: "2rem", fontWeight: "800", color: COLORS.primary, marginBottom: "1.5rem" }}>
            System Not Found
          </h2>
          <p style={{ fontSize: "1.2rem", color: COLORS.textMuted, lineHeight: 1.6, marginBottom: "3rem" }}>
            The autonomous agent you are looking for has either been redeployed or this sector does not exist. 
            Return to the main fleet to initialize a new instance.
          </p>
          <button
            onClick={onBack}
            style={{
              padding: "1.2rem 3rem",
              background: COLORS.primary,
              color: "white",
              border: "none",
              borderRadius: "16px",
              fontWeight: "900",
              fontSize: "1rem",
              cursor: "pointer",
              transition: "transform 0.2s, box-shadow 0.2s",
              boxShadow: `0 20px 40px rgba(17,24,39,0.2)`
            }}
            onMouseEnter={e => e.target.style.transform = "translateY(-2px)"}
            onMouseLeave={e => e.target.style.transform = "translateY(0)"}
          >
            RETURN TO BASE
          </button>
        </motion.div>
      </main>
    </div>
  );
};

export default NotFoundPage;
