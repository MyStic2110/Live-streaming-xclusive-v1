import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, Sparkles, BrainCircuit, UserCheck, ShieldCheck, Trophy, Briefcase, Award } from "lucide-react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "";

const COLORS = {
  bg: "#f8fafc",
  bgSoft: "#ffffff",
  border: "#e2e8f0",
  accent: "#3b82f6",
  accentHover: "#2563eb",
  green: "#16a34a",
  purple: "#8b5cf6",
  textMuted: "#64748b",
  textLight: "#0f172a"
};

// ponytail: move format whitelist to module level to avoid re-allocating on every file change/render
const SUPPORTED_FORMATS = [
  "pdf", "docx", "doc", "pptx", "ppt", "xlsx", "csv", "txt", "epub", "xml",
  "rtf", "odt", "bib", "fb2", "ipynb", "tex", "opml", "1", "man",
  "jpg", "jpeg", "png", "avif", "tiff", "gif", "heic", "heif", "bmp", "webp"
];

const VACANCIES = [
  {
    id: "ai-architect",
    title: "Generative AI / Agentic AI Architect",
    tag: "ENGINEERING",
    color: COLORS.green,
    icon: BrainCircuit,
    description: "Architect and build high-throughput, private, local-first agent swarms. You will own the core orchestration models, context synchronization layers, tool-execution engines, and latency optimization frameworks.",
    requirements: [
      "Deep understanding of multi-agent state machines, orchestration patterns, and LLM behavior tuning.",
      "Hands-on capability building low-latency stream connections and handling local open-source inference models.",
      "Absolute execution leadership: you don't wait for assignments, you proactively find bottlenecks and engineer solutions."
    ],
    eligibility: "NO degree. NO previous work experience required. We only care about what you can build, write, and deploy today."
  },
  {
    id: "ai-pm",
    title: "AI Product Manager (Swarm)",
    tag: "PRODUCT",
    color: COLORS.purple,
    icon: UserCheck,
    description: "Drive the roadmap, telemetry tracking interfaces, and developer APIs for Swarm Agentic Lab. Translate highly technical multi-agent orchestration logs and system variables into intuitive user control screens.",
    requirements: [
      "Strong empathy for SaaS operators and developer experiences.",
      "Ability to write detailed agent playbooks, design flow logic, and design interactive data panels.",
      "Extreme self-direction: you own the product vision from idea to shipping. No one will hold your hand or direct daily steps."
    ],
    eligibility: "NO formal credentials or academic records requested. We evaluate entirely on your product thinking, ownership, and drive."
  }
];

export default function CareersPage({ onBack }) {
  const [selectedRole, setSelectedRole] = useState(null);
  const [resumeFile, setResumeFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // ponytail: use native FormData and uncontrolled inputs to eliminate state tracking boilerplate
  const handleApplyClick = (role) => {
    setSelectedRole(role);
    setSubmitSuccess(false);
    setResumeFile(null);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop().toLowerCase();
    if (!SUPPORTED_FORMATS.includes(fileExtension)) {
      alert(`Unsupported file format. Allowed formats: ${SUPPORTED_FORMATS.join(', ')}`);
      e.target.value = "";
      setResumeFile(null);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("File size exceeds the maximum 5MB limit.");
      e.target.value = "";
      setResumeFile(null);
      return;
    }

    setResumeFile(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = data.get("name");
    const email = data.get("email");
    const portfolio = data.get("portfolio");
    const message = data.get("message");

    if (!name || !email || !message || !resumeFile) {
      alert("Please fill in all required fields and upload your resume.");
      return;
    }
    setIsSubmitting(true);
    try {
      // ponytail: convert File to base64 using a promise-wrapped FileReader
      const resumeBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(resumeFile);
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
      });

      const response = await axios.post(`${API}/api/careers/apply`, {
        roleId: selectedRole.id,
        roleTitle: selectedRole.title,
        name,
        email,
        portfolio,
        message,
        resumeBase64,
        resumeName: resumeFile.name
      });
      if (response.data?.success) {
        setSubmitSuccess(true);
      } else {
        alert(response.data?.error || "Submission failed. Please try again.");
      }
    } catch (err) {
      console.error("[CAREERS_SUBMIT] Error:", err);
      alert(err.response?.data?.error || "Connection error. Please try again later.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: COLORS.bg,
      backgroundImage: `radial-gradient(circle at 10% 20%, rgba(59,130,246,0.04) 0%, transparent 40%),
                        radial-gradient(circle at 90% 80%, rgba(16,185,129,0.02) 0%, transparent 40%)`,
      color: COLORS.textLight,
      fontFamily: "'Outfit', sans-serif",
      position: "relative",
      overflowX: "hidden",
      paddingBottom: "5rem"
    }}>
      {/* ponytail: dynamic input focus border colors derived from the active role's color style token */}
      <style>{`
        .careers-input {
          background: #ffffff;
          border: 1.5px solid #cbd5e1;
          border-radius: 12px;
          padding: 12px 16px;
          color: #0f172a;
          font-size: 0.95rem;
          outline: none;
          transition: all 0.2s;
          width: 100%;
          box-sizing: border-box;
        }
        .careers-input:focus {
          border-color: ${selectedRole?.color || '#3b82f6'} !important;
          box-shadow: 0 0 0 4px ${selectedRole?.color || '#3b82f6'}15 !important;
        }
      `}</style>

      {/* ── Top Sticky Navigation ── */}
      <header style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: "rgba(255, 255, 255, 0.85)",
        backdropFilter: "blur(20px)",
        borderBottom: `1px solid ${COLORS.border}`
      }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "1.25rem 2rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button 
            id="careers-back-btn"
            onClick={onBack}
            style={{
              background: "rgba(0, 0, 0, 0.03)",
              border: `1px solid ${COLORS.border}`,
              color: COLORS.textMuted,
              cursor: "pointer",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              fontSize: "0.85rem",
              fontWeight: "700",
              transition: "all 0.2s"
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,0,0,0.06)"; e.currentTarget.style.color = COLORS.textLight; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.03)"; e.currentTarget.style.color = COLORS.textMuted; }}
          >
            <ArrowLeft size={16} /> BACK
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #3b82f6, #a855f7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <Briefcase size={18} color="#fff" />
            </div>
            <span style={{ fontSize: "1.25rem", fontWeight: "900", letterSpacing: "1px", color: COLORS.textLight }}>
              SWARM <span style={{ color: COLORS.accent }}>CAREERS</span>
            </span>
          </div>
          <div style={{ width: "80px" }}></div>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <main style={{ maxWidth: "1000px", margin: "0 auto", padding: "6rem 2rem 2rem", position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: "5rem" }}>
          <div style={{
            display: "inline-block",
            padding: "6px 18px",
            background: "rgba(59, 130, 246, 0.08)",
            border: "1px solid rgba(59, 130, 246, 0.2)",
            color: COLORS.accent,
            borderRadius: "99px",
            fontSize: "0.75rem",
            fontWeight: "900",
            letterSpacing: "1.5px",
            marginBottom: "1.5rem"
          }}>
            <Sparkles size={12} style={{ marginRight: "6px", display: "inline", verticalAlign: "middle" }} />
            JOIN THE SOVEREIGN FLUTTER
          </div>
          <h1 style={{
            fontSize: "4.5rem",
            fontWeight: "900",
            letterSpacing: "-3px",
            lineHeight: "0.95",
            color: COLORS.textLight,
            marginBottom: "1.5rem"
          }}>
            We Hire Leaders,<br/>Not Credentials.
          </h1>
          <p style={{
            fontSize: "1.25rem",
            color: COLORS.textMuted,
            maxWidth: "600px",
            margin: "0 auto",
            lineHeight: "1.6"
          }}>
            No degree? Totally fine. No corporate pedigree? We don't care. Show us what you've built and tell us how you plan to command execution.
          </p>
        </div>

        {/* ── Culture Callout Box ── */}
        <section style={{
          background: COLORS.bgSoft,
          border: `1px solid ${COLORS.border}`,
          borderRadius: "24px",
          padding: "2.5rem",
          marginBottom: "4rem",
          boxShadow: "0 10px 40px rgba(0,0,0,0.02)"
        }}>
          <div style={{ display: "flex", gap: "16px", marginBottom: "1rem", alignItems: "center" }}>
            <div style={{ padding: "8px", background: "rgba(245, 158, 11, 0.1)", borderRadius: "8px" }}>
              <Award color="#f59e0b" size={24} />
            </div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: "900", margin: 0, color: COLORS.textLight }}>Absolute Ownership Principle</h2>
          </div>
          <p style={{ color: COLORS.textMuted, lineHeight: "1.7", fontSize: "1.05rem", margin: 0 }}>
            Every role in our swarm requires absolute, end-to-end leadership. Once a capability is assigned to you, you are its absolute owner. No manager will follow up daily to push you to do this or that. You are expected to design it, code it, run it, and continuously enhance it on your own initiative.
          </p>
        </section>

        {/* ── Vacancies Grid ── */}
        <section style={{ display: "grid", gap: "2.5rem" }}>
          {VACANCIES.map((role) => {
            const RoleIcon = role.icon;
            return (
              <motion.div
                key={role.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                style={{
                  background: COLORS.bgSoft,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: "24px",
                  overflow: "hidden",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.02)",
                  position: "relative"
                }}
              >
                <div style={{ height: "4px", background: role.color }} />
                <div style={{ padding: "2.5rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
                    <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                      <div style={{
                        width: "48px",
                        height: "48px",
                        borderRadius: "12px",
                        background: `${role.color}10`,
                        border: `1.5px solid ${role.color}25`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}>
                        <RoleIcon size={22} color={role.color} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: "1.6rem", fontWeight: "900", margin: 0, color: COLORS.textLight }}>{role.title}</h3>
                        <span style={{ fontSize: "0.75rem", fontWeight: "800", color: role.color, letterSpacing: "1px" }}>{role.tag}</span>
                      </div>
                    </div>

                    <button
                      id={`apply-btn-${role.id}`}
                      onClick={() => handleApplyClick(role)}
                      style={{
                        padding: "10px 24px",
                        background: role.color,
                        color: "#fff",
                        border: "none",
                        borderRadius: "12px",
                        fontWeight: "800",
                        fontSize: "0.9rem",
                        cursor: "pointer",
                        boxShadow: `0 4px 15px ${role.color}20`,
                        transition: "all 0.2s"
                      }}
                      onMouseEnter={e => e.currentTarget.style.filter = "brightness(1.1)"}
                      onMouseLeave={e => e.currentTarget.style.filter = "brightness(1)"}
                    >
                      APPLY NOW
                    </button>
                  </div>

                  <p style={{ fontSize: "1.1rem", lineHeight: "1.6", color: COLORS.textLight, marginBottom: "2rem" }}>
                    {role.description}
                  </p>

                  <div style={{ display: "grid", gap: "1.5rem", borderTop: `1px solid ${COLORS.border}`, paddingTop: "1.5rem" }}>
                    <div>
                      <h4 style={{ fontSize: "0.85rem", fontWeight: "800", color: role.color, letterSpacing: "1px", marginBottom: "0.5rem", textTransform: "uppercase" }}>Key Skills & Focus</h4>
                      <ul style={{ paddingLeft: "1.2rem", margin: 0, color: COLORS.textMuted, lineHeight: "1.7" }}>
                        {role.requirements.map((req, index) => (
                          <li key={index} style={{ marginBottom: "0.4rem" }}>{req}</li>
                        ))}
                      </ul>
                    </div>

                    <div style={{
                      background: "rgba(22, 163, 74, 0.03)",
                      border: `1px solid rgba(22, 163, 74, 0.1)`,
                      borderRadius: "16px",
                      padding: "1.25rem",
                      display: "flex",
                      gap: "12px",
                      alignItems: "flex-start"
                    }}>
                      <Trophy size={18} color={COLORS.green} style={{ marginTop: "3px", flexShrink: 0 }} />
                      <div>
                        <span style={{ fontSize: "0.9rem", fontWeight: "900", color: COLORS.green, display: "block", marginBottom: "4px" }}>Eligibility</span>
                        <p style={{ margin: 0, fontSize: "0.95rem", color: COLORS.textMuted, lineHeight: "1.5" }}>{role.eligibility}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </section>
      </main>

      {/* ── Application Modal Overlay ── */}
      <AnimatePresence>
        {selectedRole && (
          <motion.div
            id="careers-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.4)",
              backdropFilter: "blur(15px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 200,
              padding: "1rem"
            }}
            onClick={() => setSelectedRole(null)}
          >
            <motion.div
              id="careers-modal-content"
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              style={{
                width: "100%",
                maxWidth: "520px",
                background: "#ffffff",
                border: `1.5px solid ${selectedRole.color}25`,
                borderRadius: "24px",
                padding: "2.5rem",
                boxShadow: "0 30px 60px rgba(0, 0, 0, 0.1)",
                position: "relative"
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                id="careers-modal-close"
                onClick={() => setSelectedRole(null)}
                style={{
                  position: "absolute",
                  top: "1.5rem",
                  right: "1.5rem",
                  background: "none",
                  border: "none",
                  color: COLORS.textMuted,
                  fontSize: "1.5rem",
                  cursor: "pointer"
                }}
              >
                ×
              </button>

              {!submitSuccess ? (
                <>
                  <div style={{ marginBottom: "2rem" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: "900", color: selectedRole.color, letterSpacing: "1px" }}>
                      APPLYING FOR
                    </span>
                    <h3 style={{ fontSize: "1.5rem", fontWeight: "900", margin: "4px 0 8px 0", color: COLORS.textLight }}>{selectedRole.title}</h3>
                    <p style={{ margin: 0, fontSize: "0.9rem", color: COLORS.textMuted }}>
                      Ready to own your code and drive value? Send us your details.
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1.25rem" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <label htmlFor="name-input" style={{ fontSize: "0.85rem", fontWeight: "800", color: COLORS.textLight }}>Your Name *</label>
                      <input
                        id="name-input"
                        type="text"
                        name="name"
                        required
                        placeholder="e.g. John Doe"
                        className="careers-input"
                      />
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <label htmlFor="email-input" style={{ fontSize: "0.85rem", fontWeight: "800", color: COLORS.textLight }}>Email Address *</label>
                      <input
                        id="email-input"
                        type="email"
                        name="email"
                        required
                        placeholder="e.g. john@example.com"
                        className="careers-input"
                      />
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <label htmlFor="portfolio-input" style={{ fontSize: "0.85rem", fontWeight: "800", color: COLORS.textLight }}>GitHub or Portfolio Link</label>
                      <input
                        id="portfolio-input"
                        type="url"
                        name="portfolio"
                        placeholder="e.g. github.com/yourhandle"
                        className="careers-input"
                      />
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <label htmlFor="resume-input" style={{ fontSize: "0.85rem", fontWeight: "800", color: COLORS.textLight }}>Upload Resume / Document (Max 5MB) *</label>
                      <input
                        id="resume-input"
                        type="file"
                        accept={SUPPORTED_FORMATS.map(ext => `.${ext}`).join(",")}
                        required
                        onChange={handleFileChange}
                        className="careers-input"
                        style={{ padding: "8px 16px" }}
                      />
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <label htmlFor="message-input" style={{ fontSize: "0.85rem", fontWeight: "800", color: COLORS.textLight }}>How do you plan to lead/own your scope? *</label>
                      <textarea
                        id="message-input"
                        name="message"
                        required
                        rows="4"
                        placeholder="Tell us about a time you owned a technical feature from design to deployment without anyone asking..."
                        className="careers-input"
                        style={{ resize: "none", fontFamily: "inherit" }}
                      />
                    </div>

                    <button
                      id="careers-submit-btn"
                      type="submit"
                      disabled={isSubmitting}
                      style={{
                        padding: "14px",
                        background: selectedRole.color,
                        color: "#fff",
                        border: "none",
                        borderRadius: "12px",
                        fontWeight: "800",
                        fontSize: "0.95rem",
                        cursor: isSubmitting ? "default" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "10px",
                        marginTop: "1rem",
                        opacity: isSubmitting ? 0.7 : 1,
                        transition: "all 0.2s"
                      }}
                    >
                      {isSubmitting ? (
                        <span>SUBMITTING APPLICATION...</span>
                      ) : (
                        <>
                          <span>SUBMIT APPLICATION</span>
                          <Send size={16} />
                        </>
                      )}
                    </button>
                  </form>
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "2rem 0" }}>
                  <div style={{
                    width: "64px",
                    height: "64px",
                    borderRadius: "50%",
                    background: "rgba(22, 163, 74, 0.05)",
                    border: `2px solid ${COLORS.green}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 1.5rem auto"
                  }}>
                    <ShieldCheck size={32} color={COLORS.green} />
                  </div>
                  <h3 style={{ fontSize: "1.75rem", fontWeight: "900", marginBottom: "0.5rem", color: COLORS.textLight }}>Transmission Complete</h3>
                  <p style={{ color: COLORS.textMuted, fontSize: "0.95rem", lineHeight: "1.6", marginBottom: "2rem" }}>
                    Your application has been stored. Our swarm orchestration team will parse your experience and reach out shortly.
                  </p>
                  <button
                    id="careers-success-close"
                    onClick={() => setSelectedRole(null)}
                    style={{
                      padding: "10px 24px",
                      background: "rgba(0,0,0,0.03)",
                      border: `1px solid ${COLORS.border}`,
                      color: COLORS.textLight,
                      borderRadius: "12px",
                      fontWeight: "800",
                      cursor: "pointer",
                      fontSize: "0.9rem"
                    }}
                  >
                    RETURN TO CAREERS
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
