import React, { useEffect, useRef, useState, memo } from "react";
import CostGuardAlert from "./CostGuardAlert";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRemoteParticipants,
  useRoomContext
} from "@livekit/components-react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { 
  Shield, 
  Terminal, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Info,
  Eye,
  FileText,
  Sliders,
  Download,
  ChevronLeft,
  ChevronRight,
  Search,
  Lock,
  Layers,
  X
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";

// Helpers & Constants
const owaspControls = [
  { id: "LLM01", name: "Prompt Injection", category: "Prompt Injection", type: "warning", desc: "Attackers manipulate LLM through crafted inputs causing unauthorized actions." },
  { id: "LLM02", name: "Insecure Output Handling", category: "Insecure Output Handling", type: "critical", desc: "LLM outputs accepted without validation, leading to XSS/RCE/SSRF." },
  { id: "LLM03", name: "Training Data Poisoning", category: "Training Data Poisoning", type: "warning", desc: "Vulnerabilities or bias introduced into training data." },
  { id: "LLM04", name: "Model Denial of Service", category: "Model Denial of Service", type: "critical", desc: "Context window exhaustion or rate limits bypass causing service degradation." },
  { id: "LLM05", name: "Supply Chain Vulnerabilities", category: "Supply Chain Vulnerabilities", type: "warning", desc: "Vulnerable packages, dependencies, or unverified base models." },
  { id: "LLM06", name: "Sensitive Information Disclosure", category: "Sensitive Information Disclosure", type: "critical", desc: "PII leakage or sensitive corporate secrets exposure in outputs." },
  { id: "LLM07", name: "Insecure Plugin Design", category: "Insecure Plugin Design", type: "warning", desc: "Insufficient verification on inputs or excessive permissions for plugins." },
  { id: "LLM08", name: "Excessive Agency", category: "Excessive Agency", type: "warning", desc: "Excessive functionality or permissions without human-in-the-loop (HITL)." },
  { id: "LLM09", name: "Overreliance", category: "Overreliance", type: "warning", desc: "Blindly trusting model outputs without cross-checking or citations." },
  { id: "LLM10", name: "Model Theft", category: "Model Theft", type: "critical", desc: "Unauthorized exfiltration of weights, architecture, or model parameters." }
];

const nistParentCategories = [
  "GV-1", "GV-2", "GV-3", "GV-4", "GV-5", "GV-6",
  "MAP-1", "MAP-2", "MAP-3", "MAP-4", "MAP-5",
  "MEAS-1", "MEAS-2", "MEAS-3", "MEAS-4",
  "MAN-1", "MAN-2", "MAN-3", "MAN-4"
];

const getNistCategoryTooltip = (cat) => {
  const tooltips = {
    "GV-1": "Policies, processes, procedures, and practices",
    "GV-2": "Governance roles, responsibilities, and authorities",
    "GV-3": "Diversity, equity, and inclusion in AI teams",
    "GV-4": "Security, threat analysis, and incident reporting",
    "GV-5": "Stakeholder feedback and public engagement",
    "GV-6": "Third-party vendor and supply chain risk",
    "MAP-1": "Intended use, domain context, and constraints",
    "MAP-2": "AI requirements, validation, and threat modeling",
    "MAP-3": "Expected benefits, alternatives, and human overrides",
    "MAP-4": "Third-party integration and APIs",
    "MAP-5": "System impact and risk estimation",
    "MEAS-1": "Evaluation, verification, and testing",
    "MEAS-2": "Reliability, content safety, and metrics",
    "MEAS-3": "Risk register, reviews, and distributions",
    "MEAS-4": "Post-incident feedback and adjustments",
    "MAN-1": "Deployment authorization, triage, and response plans",
    "MAN-2": "Risk treatment budget and guardrails enforcement",
    "MAN-3": "Vendor SLAs and contract auditing",
    "MAN-4": "APM monitoring, PR disclosure, and escalations"
  };
  return tooltips[cat] || "NIST Category";
};

const getOwaspCategoryTooltip = (id) => {
  const names = {
    "LLM01": "Prompt Injection",
    "LLM02": "Insecure Output Handling",
    "LLM03": "Training Data Poisoning",
    "LLM04": "Model Denial of Service",
    "LLM05": "Supply Chain Vulnerabilities",
    "LLM06": "Sensitive Information Disclosure",
    "LLM07": "Insecure Plugin Design",
    "LLM08": "Excessive Agency",
    "LLM09": "Overreliance",
    "LLM10": "Model Theft"
  };
  return names[id] || "OWASP Control";
};

const getNistParentCategory = (controlId) => {
  const parts = controlId.split('-');
  if (parts.length >= 2) {
    const prefix = parts[0];
    const num = parts[1].split('.')[0];
    const prefixMap = { "GV": "GV", "MP": "MAP", "MS": "MEAS", "MG": "MAN" };
    const stdPrefix = prefixMap[prefix] || prefix;
    return `${stdPrefix}-${num}`;
  }
  const p2 = controlId.split('.');
  if (p2.length >= 1) {
    const parts2 = p2[0].split('-');
    if (parts2.length >= 2) {
      const prefix = parts2[0];
      const num = parts2[1];
      const prefixMap = { "GV": "GV", "MP": "MAP", "MS": "MEAS", "MG": "MAN" };
      const stdPrefix = prefixMap[prefix] || prefix;
      return `${stdPrefix}-${num}`;
    }
  }
  return null;
};

const resolveNistCategoryStatus = (controls = [], cat) => {
  const matched = controls.filter(c => getNistParentCategory(c.id) === cat);
  if (matched.length === 0) return "BYPASSED";
  
  let hasFail = false;
  let hasPartial = false;
  let hasPass = false;
  
  matched.forEach(c => {
    if (c.status === "FAIL") hasFail = true;
    else if (c.status === "PARTIAL") hasPartial = true;
    else if (c.status === "PASS") hasPass = true;
  });
  
  if (hasFail) return "FAIL";
  if (hasPartial) return "PARTIAL";
  if (hasPass) return "PASS";
  return "BYPASSED";
};

const renderStatusDot = (status, tooltipText) => {
  let color = "#64748b";
  let title = tooltipText || status;
  
  switch (status) {
    case "PASS":
      color = "#10b981";
      break;
    case "FAIL":
      color = "#ef4444";
      break;
    case "PARTIAL":
      color = "#f59e0b";
      break;
    case "BYPASSED":
    default:
      color = "#475569";
      break;
  }
  
  return (
    <span 
      title={title}
      style={{
        display: "inline-block",
        width: "12px",
        height: "12px",
        borderRadius: "50%",
        backgroundColor: color,
        border: `1px solid ${color}4d`,
        boxShadow: `0 0 8px ${color}33`,
        cursor: "help"
      }}
    />
  );
};

const getNistCategoryName = (id) => {
  if (id.startsWith("GV")) return "Govern (GV)";
  if (id.startsWith("MAP")) return "Map (MAP)";
  if (id.startsWith("MEAS")) return "Measure (MEAS)";
  if (id.startsWith("MAN")) return "Manage (MAN)";
  return "NIST Control";
};

const getNistControlDescription = (id) => {
  const descriptions = {
    "GV-1.1": "Regulatory Compliance & Legal Hold Policies",
    "GV-1.2": "Trustworthy AI System Policies",
    "GV-1.3": "Risk Tolerance & Risk Tier Assessments",
    "GV-1.4": "Risk Management & Control Boundary Frameworks",
    "GV-1.5": "Audit Trail Logging & Periodic System Reviews",
    "GV-1.6": "System Registry & Model Discoverability",
    "GV-1.7": "IT Lifecycle & Decommissioning Protocols",
    "GV-2.1": "RBAC & Escalation Ownership Path",
    "GV-2.2": "Developer Security & AI Certification Training",
    "GV-2.3": "Board-Level Leadership Sign-off & Reviews",
    "GV-3.1": "Inclusive Team & Multi-Stakeholder Reviews",
    "GV-3.2": "HR-Administered Equity & Inclusion Policies",
    "GV-4.1": "AI Risk Awareness & Organizational Culture",
    "GV-4.2": "Internal Concern Reporting & Whistleblower System",
    "GV-4.3": "Cybersecurity Escalation to Leadership",
    "GV-5.1": "Actor Engagement & External Stakeholder Feedback",
    "GV-5.2": "Adjudication & System Feedback Loop Integration",
    "GV-6.1": "Third-Party Auditing & Supplier Vulnerability Scans",
    "GV-6.2": "Vendor Failover & Circuit Breaker Contingency",
    "MAP-1.1": "Intended Use Case & Context Validation",
    "MAP-1.2": "Scientific Integrity & Target Actor Capabilities",
    "MAP-1.3": "Platform Alignment with Corporate Priorities",
    "MAP-1.4": "Agent ROI & Business Value Scoring",
    "MAP-1.5": "Risk Appetite Threshold Validation",
    "MAP-1.6": "System Limits & Input Guardrail Settings",
    "MAP-2.1": "Agent Task Boundaries & Input Schema Validators",
    "MAP-2.2": "QA Test Assertions & Validation Criteria",
    "MAP-2.3": "Threat Modeling & Vulnerability Identifiers",
    "MAP-2.4": "Data Lineage Tracking & Dataset Versioning",
    "MAP-2.5": "Algorithmic Impact & Privacy Risk Assessment",
    "MAP-2.6": "Infrastructure Specs & Dependency Mapping",
    "MAP-3.1": "Expected Benefits & Utility Measurements",
    "MAP-3.2": "Cost-Benefit & Alternative Tech Valuations",
    "MAP-3.3": "Model KPI Metrics & Performance Baselines",
    "MAP-3.4": "Cloud Infrastructure Constraint Validations",
    "MAP-3.5": "Human-in-the-Loop Override Bounded Rules",
    "MAP-4.1": "External Integration API Security Scans",
    "MAP-4.2": "Integration Test & System Interdependencies",
    "MAP-5.1": "Likelihood & Severity Impact Matrices",
    "MAP-5.2": "Transitive Multi-Agent Delegation Rules",
    "MEAS-1.1": "Measurement Approach Validation & Verification",
    "MEAS-1.2": "Accuracy, Recall & F1 Evaluation Rules",
    "MEAS-1.3": "Red-Teaming Audits & Independent Evaluations",
    "MEAS-2.1": "Reliability, Robustness & Data Drift Audits",
    "MEAS-2.2": "Content Moderation & Toxicity Scrubbing Efficacy",
    "MEAS-2.3": "Fuzzing & Adversarial Defense Testing Efficacy",
    "MEAS-2.4": "System Card & Accountability Report Verification",
    "MEAS-2.5": "Model Interpretability & Explanation Log Analysis",
    "MEAS-2.6": "Tokenization Vault & Privacy Scrubbing Efficacy",
    "MEAS-2.7": "Disparate Impact & Bias Mitigation Metrics",
    "MEAS-2.8": "Compute Carbon Footprint & Energy Metrics",
    "MEAS-2.9": "Trace Log Archiving & Trend Auditing Over Time",
    "MEAS-2.10": "CostGuard Pricing Limits & Telemetry Efficacy",
    "MEAS-2.11": "Usability & Operator Cognitive Load Metrics",
    "MEAS-2.12": "Service Level Objectives & System KPI Tracking",
    "MEAS-2.13": "Measurement Methodology Updates & Reviews",
    "MEAS-3.1": "Risk Register Updating with Scanned Findings",
    "MEAS-3.2": "Dataset Quality & Data Governance Reviews",
    "MEAS-3.3": "Risk Report Distribution & Communications",
    "MEAS-4.1": "System Utility Post-Incident Assessments",
    "MEAS-4.2": "Operator UX & Interaction Optimization Reviews",
    "MEAS-4.3": "Maturity Scoring & Metric Parameter Updates",
    "MAN-1.1": "Go/No-Go Deployment Bounded Evaluations",
    "MAN-1.2": "Vulnerability Triaging & Incident Mitigation Rules",
    "MAN-1.3": "Risk Treatment Response Plan Implementations",
    "MAN-1.4": "Residual Risk Monitoring & Rating Calculations",
    "MAN-2.1": "Mitigation Budget & Developer Resource Allocation",
    "MAN-2.2": "Guardrail Policies & Security Controls Enforcements",
    "MAN-2.3": "Disaster Recovery & Incident Contingency Protocols",
    "MAN-2.4": "Decommissioning Controls & Kill-Switch Enforcements",
    "MAN-3.1": "Vendor Contract & SLA Enforcement Rules",
    "MAN-3.2": "Vendor Security Attestation (SOC2/ISO) Verifications",
    "MAN-4.1": "Application Performance Monitoring (APM) Controls",
    "MAN-4.2": "On-Call Escalations & Cyber Incident Responses",
    "MAN-4.3": "Incident Disclosures & Public Relations Guidelines"
  };
  return descriptions[id] || "NIST AI RMF 1.0 Security Control Subcategory Guideline";
};

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
      <motion.div
        animate={{ scale }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="z-10 bg-emerald-900/40 p-6 rounded-full border border-emerald-500/50 shadow-2xl flex items-center justify-center backdrop-blur-md"
        style={{ boxShadow: `0 0 ${20 + amp * 40}px rgba(16, 185, 129, ${glowOpacity})` }}
      >
        <span className="text-5xl">🛡️</span>
      </motion.div>
      
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

  const [activeTab, setActiveTab] = useState("session"); // "session" or "matrix"

  // Live session state
  const [logs, setLogs] = useState([]);
  const room = useRoomContext();
  const logEndRef = useRef(null);

  // Compliance Dashboard state replicates
  const [securityStatus, setSecurityStatus] = useState(null);
  const [metrics, setMetrics] = useState({
    jailbreaksBlocked: 0,
    piiBlocked: 0,
    criticalCVEs: 0,
    warningCVEs: 0,
    complianceScore: "100%"
  });

  const [loadingAivyuhScan, setLoadingAivyuhScan] = useState(false);
  const [scanOutput, setScanOutput] = useState("");
  const [showTerminal, setShowTerminal] = useState(false);

  const [loadingNistScan, setLoadingNistScan] = useState(false);
  const [nistScanOutput, setNistScanOutput] = useState("");
  const [showNistTerminal, setShowNistTerminal] = useState(false);

  const [loadingScopeAnalyze, setLoadingScopeAnalyze] = useState(false);
  const [showOnlyApplicable, setShowOnlyApplicable] = useState(true);
  const [secopsFramework, setSecopsFramework] = useState("nist");

  const [selectedSecopsAgent, setSelectedSecopsAgent] = useState(null);
  const [expandedControlId, setExpandedControlId] = useState(null);
  const [nistSearchTerm, setNistSearchTerm] = useState("");
  const [nistFilterStatus, setNistFilterStatus] = useState("ALL");

  const [lastScanResult, setLastScanResult] = useState(null);
  const [showRawJsonModal, setShowRawJsonModal] = useState(false);

  useEffect(() => {
    fetchSecurityStatus();
    fetchMetrics();
  }, []);

  useEffect(() => {
    setExpandedControlId(null);
  }, [secopsFramework]);

  const fetchMetrics = async () => {
    try {
      const res = await axios.get(`${API}/api/compliance/summary`);
      if (res.data) setMetrics(res.data);
    } catch (err) {
      console.error("Error fetching metrics:", err.message);
    }
  };

  const fetchSecurityStatus = async () => {
    try {
      const res = await axios.get(`${API}/security/status`);
      if (res.data) setSecurityStatus(res.data);
    } catch (err) {
      console.error("Error fetching security status:", err.message);
    }
  };

  const triggerAivyuhScan = async () => {
    setLoadingAivyuhScan(true);
    setShowTerminal(true);
    setScanOutput("Initializing Swarm Fleet security probe...\nSpawning Aivyuh Swarm Audit Agent...\nRunning OWASP Top 10 LLM vulnerability checks across all 14 agents...\n\n");
    setLastScanResult(null);
    try {
      const res = await axios.post(`${API}/security/aivyuh-scan`);
      if (res.data) {
        setScanOutput(prev => prev + JSON.stringify(res.data, null, 2) + "\n\nSwarm Fleet audit finished successfully. Compliance report loaded to DB.");
        setLastScanResult(res.data);
        fetchSecurityStatus();
        fetchMetrics();
      }
    } catch (err) {
      setScanOutput(prev => prev + `❌ Aivyuh Scanner Error: ${err.message}\nCheck backend logs.`);
    } finally {
      setLoadingAivyuhScan(false);
    }
  };

  const triggerNistScan = async () => {
    setLoadingNistScan(true);
    setShowNistTerminal(true);
    setNistScanOutput("Initializing NIST AI Risk Management Framework 1.0 attestation...\nAnalyzing agent codebase dependencies & syntax trees...\nRunning NIST compliance scans across all 14 active agents...\n\n");
    try {
      const res = await axios.post(`${API}/security/nist-scan`);
      if (res.data) {
        setNistScanOutput(prev => prev + JSON.stringify(res.data, null, 2) + "\n\nNIST Swarm Compliance Audit completed successfully.");
        fetchSecurityStatus();
        fetchMetrics();
      }
    } catch (err) {
      setNistScanOutput(prev => prev + `❌ NIST Analyzer Error: ${err.message}\nCheck backend logs.`);
    } finally {
      setLoadingNistScan(false);
    }
  };

  const runAgentScopeAnalyzer = async (agentName) => {
    setLoadingScopeAnalyze(true);
    try {
      const res = await axios.post(`${API}/security/nist-scan?agent=${agentName.toLowerCase()}`);
      if (res.data) {
        await fetchSecurityStatus();
        await fetchMetrics();
      }
    } catch (err) {
      console.error("Error running agent scope analyzer:", err.message);
    } finally {
      setLoadingScopeAnalyze(false);
    }
  };

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

  if (selectedSecopsAgent) {
    const currentSecopsAgentData = securityStatus ? securityStatus[selectedSecopsAgent.name.toLowerCase()] : null;
    const currentSecopsAgent = { name: selectedSecopsAgent.name, data: currentSecopsAgentData || selectedSecopsAgent.data };
    const activeControl = secopsFramework === "nist"
      ? currentSecopsAgent.data.nist_audit?.controls?.find(c => c.id === expandedControlId)
      : owaspControls.find(c => c.id === expandedControlId);
    
    return (
      <div className="flex flex-col h-full w-full bg-[#0a0f16] text-[#e6f4ea] overflow-hidden font-mono">
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0 24px",
          height: "64px",
          borderBottom: "1px solid rgba(16, 185, 129, 0.15)",
          backgroundColor: "#05080c"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <h1 className="text-lg font-bold tracking-widest text-emerald-400">
              AIVYUH SECURE OPERATIONAL CONTROL
            </h1>
            <span>/</span>
            <span style={{ color: "#10b981", fontWeight: "700", textTransform: "uppercase" }}>
              {currentSecopsAgent.name.replace("_", " ")} Inspector
            </span>
          </div>
          <button
            onClick={() => {
              setSelectedSecopsAgent(null);
              setExpandedControlId(null);
            }}
            className="px-4 py-2 rounded font-semibold uppercase tracking-widest text-xs transition-all bg-emerald-900/20 text-emerald-400 border border-emerald-900/50 hover:bg-emerald-900/40 hover:border-emerald-500 cursor-pointer"
          >
            BACK TO POSTURE
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-6" style={{ backgroundColor: "#0a0f16" }}>
          <div className="hud-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", background: "rgba(5, 8, 12, 0.6)", border: "1px solid rgba(16, 185, 129, 0.15)", marginBottom: "1.5rem" }}>
            <div>
              <h2 className="secops-title" style={{ fontSize: "1.35rem", background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                {currentSecopsAgent.name.replace("_", " ")} SecOps Console
              </h2>
              <p style={{ color: "#64748b", fontSize: "0.85rem", marginTop: "4px" }}>
                NIST AI Risk Management Framework 1.0 & AST Evidence Inspector
              </p>
            </div>
            <div style={{ display: "flex", gap: "2rem", alignItems: "center" }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: "800", textTransform: "uppercase" }}>NIST COMPLIANCE SCORE</div>
                <div style={{ fontSize: "1.6rem", fontWeight: "900", color: "#10b981" }}>{currentSecopsAgent.data.nist_audit?.score || 100}%</div>
              </div>
              <div style={{ textAlign: "right", borderLeft: "1px solid rgba(16, 185, 129, 0.15)", paddingLeft: "2rem" }}>
                <div style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: "800", textTransform: "uppercase" }}>RISK TIER</div>
                <span style={{ 
                  fontSize: "0.75rem", 
                  fontWeight: "900", 
                  padding: "3px 8px", 
                  borderRadius: "12px", 
                  background: currentSecopsAgent.data.nist_audit?.risk === "CRITICAL" || currentSecopsAgent.data.nist_audit?.risk === "HIGH" ? "rgba(239,68,68,0.08)" : "rgba(16,185,129,0.08)",
                  color: currentSecopsAgent.data.nist_audit?.risk === "CRITICAL" || currentSecopsAgent.data.nist_audit?.risk === "HIGH" ? "#ef4444" : "#10b981",
                  display: "inline-block",
                  marginTop: "4px"
                }}>
                  {currentSecopsAgent.data.nist_audit?.risk || "LOW"}
                </span>
              </div>
            </div>
          </div>

          <div className="hud-card" style={{ 
            padding: "24px", 
            background: "rgba(5, 8, 12, 0.8)", 
            border: "1px solid rgba(16, 185, 129, 0.25)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
            marginBottom: "1.5rem"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", borderBottom: "1px solid rgba(16, 185, 129, 0.15)", paddingBottom: "12px" }}>
              <div>
                <h3 className="orbitron-title" style={{ fontSize: "1.05rem", fontWeight: "800", color: "#10b981", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Sliders size={16} color="#10b981" /> AST Scope Analyzer Results
                </h3>
                <p style={{ color: "#64748b", fontSize: "0.78rem", marginTop: "2px" }}>
                  Static AST codebase analyzer identifying agent business function, autonomy level, capability footprint, and data classes.
                </p>
              </div>
              
              <button
                onClick={() => runAgentScopeAnalyzer(currentSecopsAgent.name)}
                disabled={loadingScopeAnalyze}
                className="px-4 py-2 rounded font-semibold uppercase tracking-widest text-xs transition-all bg-emerald-900/20 text-emerald-400 border border-emerald-900/50 hover:bg-emerald-900/40 hover:border-emerald-500 cursor-pointer"
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                {loadingScopeAnalyze ? (
                  <><RefreshCw size={12} className="spin" /> Analyzing Scope...</>
                ) : (
                  <><RefreshCw size={12} /> Run Scope Analyzer</>
                )}
              </button>
            </div>

            {currentSecopsAgent.data?.scope_analysis ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px" }}>
                <div style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(16, 185, 129, 0.08)", padding: "12px 16px", borderRadius: "12px" }}>
                  <div style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: "800", textTransform: "uppercase" }}>Function & Autonomy</div>
                  <div style={{ fontSize: "0.88rem", fontWeight: "700", color: "#f8fafc", marginTop: "6px" }}>
                    {currentSecopsAgent.data.scope_analysis.business_function}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                    <span>Autonomy:</span>
                    <span style={{ fontWeight: "700", color: "#f59e0b" }}>{currentSecopsAgent.data.scope_analysis.autonomy}</span>
                  </div>
                </div>

                <div style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(16, 185, 129, 0.08)", padding: "12px 16px", borderRadius: "12px" }}>
                  <div style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: "800", textTransform: "uppercase", marginBottom: "6px" }}>Capabilities Footprint</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {currentSecopsAgent.data.scope_analysis.capabilities && currentSecopsAgent.data.scope_analysis.capabilities.length > 0 ? (
                      currentSecopsAgent.data.scope_analysis.capabilities.map((cap, idx) => (
                        <span key={idx} style={{
                          fontSize: "0.65rem",
                          fontWeight: "800",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: "rgba(16, 185, 129, 0.15)",
                          color: "#10b981",
                          border: "1px solid rgba(16, 185, 129, 0.3)"
                        }}>
                          {cap}
                        </span>
                      ))
                    ) : (
                      <span style={{ color: "#64748b", fontSize: "0.78rem", fontStyle: "italic" }}>None detected</span>
                    )}
                  </div>
                </div>

                <div style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(16, 185, 129, 0.08)", padding: "12px 16px", borderRadius: "12px" }}>
                  <div style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: "800", textTransform: "uppercase" }}>Data Classes & Reach</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "6px" }}>
                    {currentSecopsAgent.data.scope_analysis.data_classes && currentSecopsAgent.data.scope_analysis.data_classes.length > 0 ? (
                      currentSecopsAgent.data.scope_analysis.data_classes.map((cls, idx) => (
                        <span key={idx} style={{
                          fontSize: "0.62rem",
                          fontWeight: "800",
                          padding: "2px 5px",
                          borderRadius: "4px",
                          background: "rgba(16, 185, 129, 0.08)",
                          color: "#10b981",
                          border: "1px solid rgba(16, 185, 129, 0.15)"
                        }}>
                          {cls}
                        </span>
                      ))
                    ) : (
                      <span style={{ color: "#64748b", fontSize: "0.75rem", fontStyle: "italic" }}>No sensitive data classes</span>
                    )}
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: "6px" }}>
                    Reach: {currentSecopsAgent.data.scope_analysis.external_reach && currentSecopsAgent.data.scope_analysis.external_reach.length > 0 ? (
                      <span style={{ color: "#10b981", fontWeight: "700" }}>
                        {currentSecopsAgent.data.scope_analysis.external_reach.join(", ")}
                      </span>
                    ) : (
                      <span style={{ fontStyle: "italic" }}>Sandbox Isolated</span>
                    )}
                  </div>
                </div>

                <div style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(16, 185, 129, 0.08)", padding: "12px 16px", borderRadius: "12px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>Applicable Controls:</span>
                    <span style={{ fontSize: "0.82rem", fontWeight: "900", color: "#10b981" }}>{currentSecopsAgent.data.scope_analysis.applicable_count}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>Bypassed Controls:</span>
                    <span style={{ fontSize: "0.82rem", fontWeight: "900", color: "#64748b" }}>
                      {currentSecopsAgent.data.scope_analysis.non_applicable_count + (currentSecopsAgent.data.scope_analysis.unmapped_count || 0)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: "16px", textAlign: "center", color: "#64748b", fontStyle: "italic", fontSize: "0.82rem", border: "1px dashed rgba(16, 185, 129, 0.2)", borderRadius: "12px" }}>
                No static scope analysis results found. Click "Run Scope Analyzer" to initialize capabilities scanning.
              </div>
            )}
          </div>

          <div className="secops-layout" style={{ height: "auto", minHeight: "500px" }}>
            <div className="secops-panel" style={{ background: "rgba(5, 8, 12, 0.4)", border: "1px solid rgba(16, 185, 129, 0.15)" }}>
              <div className="secops-panel-header" style={{ borderBottom: "1px solid rgba(16, 185, 129, 0.15)" }}>
                <h4 style={{ fontSize: "0.95rem", fontWeight: "800", textTransform: "uppercase", color: "#f8fafc" }}>Security Controls</h4>
                <p style={{ color: "#64748b", fontSize: "0.75rem", marginTop: "2px" }}>Select a control card to inspect telemetry evidence</p>
              </div>

              <div style={{ display: "flex", background: "rgba(255, 255, 255, 0.03)", padding: "2px", borderRadius: "8px", border: "1px solid rgba(16, 185, 129, 0.15)", marginBottom: "12px" }}>
                <button
                  onClick={() => setSecopsFramework("nist")}
                  style={{
                    flex: 1, padding: "6px", fontSize: "0.75rem", fontWeight: "700",
                    background: secopsFramework === "nist" ? "rgba(16, 185, 129, 0.15)" : "transparent",
                    color: secopsFramework === "nist" ? "#10b981" : "#64748b",
                    border: "none", borderRadius: "6px", cursor: "pointer", transition: "all 0.2s"
                  }}
                >
                  NIST AI RMF 1.0
                </button>
                <button
                  onClick={() => setSecopsFramework("owasp")}
                  style={{
                    flex: 1, padding: "6px", fontSize: "0.75rem", fontWeight: "700",
                    background: secopsFramework === "owasp" ? "rgba(16, 185, 129, 0.15)" : "transparent",
                    color: secopsFramework === "owasp" ? "#10b981" : "#64748b",
                    border: "none", borderRadius: "6px", cursor: "pointer", transition: "all 0.2s"
                  }}
                >
                  OWASP Top 10 LLM
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <Search size={14} style={{ position: "absolute", left: "12px", color: "rgba(16, 185, 129, 0.4)" }} />
                  <input
                    type="text"
                    placeholder="Search by ID or keyword..."
                    value={nistSearchTerm}
                    onChange={(e) => setNistSearchTerm(e.target.value)}
                    className="secops-input"
                    style={{ border: "1px solid rgba(16, 185, 129, 0.15)" }}
                  />
                </div>

                <select
                  value={nistFilterStatus}
                  onChange={(e) => setNistFilterStatus(e.target.value)}
                  className="secops-select"
                  style={{ border: "1px solid rgba(16, 185, 129, 0.15)" }}
                >
                  <option value="ALL">All Controls</option>
                  {secopsFramework === "nist" ? (
                    <>
                      <option value="PASS">Pass ({currentSecopsAgent.data.nist_audit?.controls?.filter(c => c.status === "PASS").length || 0})</option>
                      <option value="PARTIAL">Partial ({currentSecopsAgent.data.nist_audit?.controls?.filter(c => c.status === "PARTIAL").length || 0})</option>
                      <option value="FAIL">Fail ({currentSecopsAgent.data.nist_audit?.controls?.filter(c => c.status === "FAIL").length || 0})</option>
                      <option value="UNMAPPED">Unmapped ({currentSecopsAgent.data.nist_audit?.controls?.filter(c => c.status === "UNMAPPED").length || 0})</option>
                      <option value="NON-APPLICABLE">Non-Applicable ({currentSecopsAgent.data.nist_audit?.controls?.filter(c => c.status === "NON-APPLICABLE").length || 0})</option>
                    </>
                  ) : (
                    <>
                      <option value="PASS">Pass ({owaspControls.filter(c => !currentSecopsAgent.data.report_summary?.some(line => line.startsWith(c.id))).length})</option>
                      <option value="FAIL">Fail ({owaspControls.filter(c => currentSecopsAgent.data.report_summary?.some(line => line.startsWith(c.id))).length})</option>
                    </>
                  )}
                </select>

                {secopsFramework === "nist" && (
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.78rem", color: "#94a3b8", cursor: "pointer", marginTop: "4px", paddingLeft: "4px" }}>
                    <input
                      type="checkbox"
                      checked={showOnlyApplicable}
                      onChange={(e) => setShowOnlyApplicable(e.target.checked)}
                      style={{ cursor: "pointer" }}
                    />
                    Show Applicable Controls Only
                  </label>
                )}
              </div>

              <div className="secops-control-list">
                {secopsFramework === "nist" ? (
                  currentSecopsAgent.data.nist_audit?.controls ? (
                    currentSecopsAgent.data.nist_audit.controls
                      .filter(c => {
                        const matchesSearch = c.id.toLowerCase().includes(nistSearchTerm.toLowerCase()) || 
                                              getNistControlDescription(c.id).toLowerCase().includes(nistSearchTerm.toLowerCase());
                        const matchesStatus = nistFilterStatus === "ALL" ? true : c.status === nistFilterStatus;
                        const matchesApplicability = showOnlyApplicable ? (c.status !== "NON-APPLICABLE" && c.status !== "UNMAPPED") : true;
                        return matchesSearch && matchesStatus && matchesApplicability;
                      })
                      .map(c => {
                        const isSelected = expandedControlId === c.id;
                        const statusText = c.status === "UNMAPPED" || c.status === "NON-APPLICABLE" ? "BYPASSED" : c.status;
                        const statusClass = c.status === "PASS" ? "badge-pass" : 
                                            c.status === "PARTIAL" ? "badge-partial" : 
                                            c.status === "UNMAPPED" ? "badge-pass" :
                                            c.status === "NON-APPLICABLE" ? "badge-pass" : "badge-fail";
                        return (
                          <div 
                            key={c.id}
                            onClick={() => setExpandedControlId(c.id)}
                            className={`secops-control-card ${isSelected ? "selected" : ""}`}
                            style={{ border: isSelected ? "1px solid rgba(16, 185, 129, 0.65)" : "1px solid rgba(255, 255, 255, 0.06)" }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: "0.85rem", fontWeight: "700", fontFamily: "monospace", color: "#f8fafc" }}>{c.id}</span>
                              <span className={statusClass} style={{
                                fontSize: "0.65rem", fontWeight: "800",
                                background: c.status === "UNMAPPED" || c.status === "NON-APPLICABLE" ? "rgba(16, 185, 129, 0.08)" : undefined,
                                color: c.status === "UNMAPPED" || c.status === "NON-APPLICABLE" ? "#10b981" : undefined,
                                borderColor: c.status === "UNMAPPED" || c.status === "NON-APPLICABLE" ? "rgba(16, 185, 129, 0.2)" : undefined
                              }}>{statusText}</span>
                            </div>
                            <div style={{ fontSize: "0.78rem", color: isSelected ? "#e2e8f0" : "#64748b", lineHeight: "1.4" }}>
                              {getNistControlDescription(c.id)}
                            </div>
                          </div>
                        );
                      })
                  ) : (
                    <div style={{ padding: "20px", textAlign: "center", color: "#64748b", fontStyle: "italic" }}>No controls loaded.</div>
                  )
                ) : (
                  owaspControls
                    .filter(c => {
                      const matchesSearch = c.id.toLowerCase().includes(nistSearchTerm.toLowerCase()) || 
                                            c.name.toLowerCase().includes(nistSearchTerm.toLowerCase()) ||
                                            c.desc.toLowerCase().includes(nistSearchTerm.toLowerCase());
                      const failedLine = currentSecopsAgent.data.report_summary?.find(line => line.startsWith(c.id));
                      const matchesStatus = nistFilterStatus === "ALL" ? true : (failedLine ? "FAIL" : "PASS") === nistFilterStatus;
                      return matchesSearch && matchesStatus;
                    })
                    .map(c => {
                      const isSelected = expandedControlId === c.id;
                      const failedLine = currentSecopsAgent.data.report_summary?.find(line => line.startsWith(c.id));
                      const isPass = !failedLine;
                      const statusText = isPass ? "PASS" : "FAIL";
                      const statusClass = isPass ? "badge-pass" : "badge-fail";
                      return (
                        <div 
                          key={c.id}
                          onClick={() => setExpandedControlId(c.id)}
                          className={`secops-control-card ${isSelected ? "selected" : ""}`}
                          style={{ border: isSelected ? "1px solid rgba(16, 185, 129, 0.65)" : "1px solid rgba(255, 255, 255, 0.06)" }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "0.85rem", fontWeight: "700", fontFamily: "monospace", color: "#f8fafc" }}>{c.id}</span>
                            <span className={statusClass} style={{ fontSize: "0.65rem", fontWeight: "800" }}>{statusText}</span>
                          </div>
                          <div style={{ fontSize: "0.78rem", color: isSelected ? "#e2e8f0" : "#64748b", lineHeight: "1.4" }}>
                            {c.name}
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>

            <div className="secops-panel" style={{ flexGrow: 1, background: "rgba(5, 8, 12, 0.4)", border: "1px solid rgba(16, 185, 129, 0.15)" }}>
              <div className="secops-panel-header" style={{ borderBottom: "1px solid rgba(16, 185, 129, 0.15)" }}>
                <h4 style={{ fontSize: "0.95rem", fontWeight: "800", textTransform: "uppercase", color: "#f8fafc", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Terminal size={15} color="#10b981" /> Control Attestation Details
                </h4>
                <p style={{ color: "#64748b", fontSize: "0.75rem", marginTop: "2px" }}>AST engine code analysis & evidence vault inspector</p>
              </div>

              <div className="secops-inspector-workspace">
                {!activeControl ? (
                  <div className="secops-empty-state" style={{ border: "1.5px dashed rgba(16, 185, 129, 0.2)" }}>
                    <div className="secops-empty-state-icon" style={{ color: "rgba(16, 185, 129, 0.3)" }}><Shield size={44} /></div>
                    <h4 style={{ color: "#e2e8f0", fontSize: "0.95rem", fontWeight: "700", marginBottom: "6px" }}>No Control Selected</h4>
                    <p style={{ fontSize: "0.8rem", color: "#64748b", maxWidth: "280px" }}>
                      Select a security control card from the left panel to inspect its codebase signature evidence and matched AST syntax locations.
                    </p>
                  </div>
                ) : (
                  <div className="secops-inspector-scroll">
                    <div style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(16, 185, 129, 0.15)", borderRadius: "12px", padding: "16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                        <div>
                          <strong style={{ fontSize: "1.1rem", color: "#f8fafc", fontFamily: "monospace" }}>{activeControl.id}</strong>
                          <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "4px" }}>
                            Category: <span style={{ color: "#10b981", fontWeight: "700" }}>
                              {secopsFramework === "nist" ? getNistCategoryName(activeControl.id) : "OWASP Top 10 for LLM Applications"}
                            </span>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span className={
                            secopsFramework === "nist"
                              ? (activeControl.status === "PASS" ? "badge-pass" : 
                                 activeControl.status === "PARTIAL" ? "badge-partial" : 
                                 activeControl.status === "UNMAPPED" ? "badge-pass" :
                                 activeControl.status === "NON-APPLICABLE" ? "badge-pass" : "badge-fail")
                              : (!currentSecopsAgent.data.report_summary?.some(line => line.startsWith(activeControl.id)) ? "badge-pass" : "badge-fail")
                          } style={{ 
                            fontSize: "0.75rem", padding: "4px 10px",
                            background: secopsFramework === "nist" && (activeControl.status === "UNMAPPED" || activeControl.status === "NON-APPLICABLE") ? "rgba(16, 185, 129, 0.08)" : undefined,
                            color: secopsFramework === "nist" && (activeControl.status === "UNMAPPED" || activeControl.status === "NON-APPLICABLE") ? "#10b981" : undefined,
                            borderColor: secopsFramework === "nist" && (activeControl.status === "UNMAPPED" || activeControl.status === "NON-APPLICABLE") ? "rgba(16, 185, 129, 0.2)" : undefined
                          }}>
                            {secopsFramework === "nist"
                              ? (activeControl.status === "UNMAPPED" || activeControl.status === "NON-APPLICABLE" ? "BYPASSED" : activeControl.status)
                              : (!currentSecopsAgent.data.report_summary?.some(line => line.startsWith(activeControl.id)) ? "PASS" : "FAIL")}
                          </span>
                        </div>
                      </div>
                      <div style={{ fontSize: "0.85rem", color: "#e2e8f0", borderTop: "1px solid rgba(16, 185, 129, 0.15)", paddingTop: "10px", marginTop: "10px", lineHeight: "1.5" }}>
                        <strong>Guideline:</strong> {secopsFramework === "nist" ? getNistControlDescription(activeControl.id) : activeControl.desc}
                      </div>
                      {secopsFramework === "nist" && activeControl.rationale && (
                        <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "8px", background: "rgba(255,255,255,0.01)", padding: "8px 12px", borderRadius: "8px", border: "1px solid rgba(16, 185, 129, 0.08)" }}>
                          <strong>Scope Rationale:</strong> {activeControl.rationale}
                        </div>
                      )}
                    </div>

                    <div className="secops-details-panel" style={{ background: "#05080c", border: "1px solid rgba(16, 185, 129, 0.15)" }}>
                      {secopsFramework === "nist" ? (
                        activeControl.status === "FAIL" ? (
                          <div style={{ textAlign: "center", padding: "20px 0" }}>
                            <div style={{ color: "#ef4444", fontWeight: "700", marginBottom: "6px" }}>AST Telemetry Signature Mismatch</div>
                            <div style={{ fontStyle: "italic", color: "#64748b", fontSize: "0.85rem" }}>
                              Attestation failed: No evidence signatures discovered in agent code files.
                            </div>
                          </div>
                        ) : activeControl.status === "UNMAPPED" ? (
                          <div style={{ textAlign: "center", padding: "24px 0", background: "rgba(16, 185, 129, 0.03)", border: "1px dashed rgba(16, 185, 129, 0.2)", borderRadius: "12px" }}>
                            <div style={{ color: "#10b981", fontWeight: "700", marginBottom: "8px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                              <CheckCircle size={16} /> Organizational Control (Bypassed)
                            </div>
                            <div style={{ color: "#94a3b8", fontSize: "0.82rem", maxWidth: "400px", margin: "0 auto", lineHeight: "1.5" }}>
                              {activeControl.rationale || "Monitored at the organizational level; no programmatic code evidence is required."}
                            </div>
                          </div>
                        ) : activeControl.status === "NON-APPLICABLE" ? (
                          <div style={{ textAlign: "center", padding: "24px 0", background: "rgba(16, 185, 129, 0.03)", border: "1px dashed rgba(16, 185, 129, 0.2)", borderRadius: "12px" }}>
                            <div style={{ color: "#10b981", fontWeight: "700", marginBottom: "8px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                              <CheckCircle size={16} /> Not Applicable to Agent Capabilities (Bypassed)
                            </div>
                            <div style={{ color: "#94a3b8", fontSize: "0.82rem", maxWidth: "400px", margin: "0 auto", lineHeight: "1.5" }}>
                              {activeControl.rationale || "This control does not apply based on the defined capabilities of this agent."}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div style={{ marginBottom: "10px", fontWeight: "800", color: activeControl.status === "PARTIAL" ? "#f59e0b" : "#10b981", fontSize: "0.85rem" }}>
                              Verified AST Evidence Code Findings ({activeControl.evidence?.length || 0}):
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                              {activeControl.evidence?.map((ev, idx) => (
                                <div key={idx} className={activeControl.status === "PARTIAL" ? "secops-evidence-item-partial" : "secops-evidence-item"} style={{ borderLeftColor: activeControl.status === "PARTIAL" ? "#f59e0b" : "#10b981" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", color: "#10b981", marginBottom: "6px", fontSize: "0.75rem", fontFamily: "monospace" }}>
                                    <span style={{ color: "#10b981" }}>File Line {ev.line}</span>
                                    <span style={{ color: "#e2e8f0" }}>Keyword Match: <strong style={{ color: "#f59e0b" }}>"{ev.match}"</strong></span>
                                  </div>
                                  <pre className="secops-code-pre">{ev.code}</pre>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      ) : (
                        (() => {
                          const failedLine = currentSecopsAgent.data.report_summary?.find(line => line.startsWith(activeControl.id));
                          if (failedLine) {
                            return (
                              <div style={{ padding: "10px 0" }}>
                                <div style={{ color: "#ef4444", fontWeight: "700", marginBottom: "10px", fontSize: "0.85rem" }}>
                                  AST Security Control Mismatch / Vulnerability Found:
                                </div>
                                <div style={{
                                  fontSize: "0.82rem", color: "#f8fafc", background: "rgba(239, 68, 68, 0.05)",
                                  border: "1px solid rgba(239, 68, 68, 0.15)", padding: "14px", borderRadius: "10px",
                                  fontFamily: "monospace", lineHeight: "1.5"
                                }}>
                                  {failedLine}
                                </div>
                              </div>
                            );
                          } else {
                            return (
                              <div style={{ textAlign: "center", padding: "24px 0", background: "rgba(16, 185, 129, 0.03)", border: "1px dashed rgba(16, 185, 129, 0.2)", borderRadius: "12px" }}>
                                <div style={{ color: "#10b981", fontWeight: "700", marginBottom: "8px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                                  <CheckCircle size={16} /> AST Signature Verified (Secure)
                                </div>
                                <div style={{ color: "#94a3b8", fontSize: "0.82rem", maxWidth: "400px", margin: "0 auto", lineHeight: "1.5" }}>
                                  The codebase was analyzed using python syntax tree matching. The required protection signatures for this control category were found active and clean.
                                </div>
                              </div>
                            );
                          }
                        })()
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#0a0f16] text-[#e6f4ea] overflow-hidden font-mono">
      {/* Top Header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0 24px",
        height: "64px",
        borderBottom: "1px solid rgba(16, 185, 129, 0.15)",
        backgroundColor: "#05080c"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <h1 className="text-lg font-bold tracking-widest text-emerald-400">
            AIVYUH SECURE OPERATIONAL CONTROL
          </h1>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${aivyuhOnline ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
            <span className="text-xs uppercase tracking-wider text-emerald-700 font-bold">
              {aivyuhOnline ? "OWASP AUDITOR ONLINE" : "SCANNER OFFLINE"}
            </span>
          </div>
        </div>

        {/* Tab switch buttons */}
        <div style={{
          display: "flex",
          background: "rgba(16, 185, 129, 0.03)",
          padding: "3px",
          borderRadius: "10px",
          border: "1px solid rgba(16, 185, 129, 0.15)"
        }}>
          <button
            onClick={() => setActiveTab("session")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 16px",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              fontSize: "0.8rem",
              fontWeight: "700",
              background: activeTab === "session" ? "rgba(16, 185, 129, 0.15)" : "transparent",
              color: activeTab === "session" ? "#10b981" : "#64748b",
              border: activeTab === "session" ? "1px solid rgba(16, 185, 129, 0.25)" : "1px solid transparent",
              transition: "all 0.25s",
              fontFamily: "inherit"
            }}
          >
            📡 Agent Session
          </button>
          <button
            onClick={() => setActiveTab("matrix")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 16px",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              fontSize: "0.8rem",
              fontWeight: "700",
              background: activeTab === "matrix" ? "rgba(16, 185, 129, 0.15)" : "transparent",
              color: activeTab === "matrix" ? "#10b981" : "#64748b",
              border: activeTab === "matrix" ? "1px solid rgba(16, 185, 129, 0.25)" : "1px solid transparent",
              transition: "all 0.25s",
              fontFamily: "inherit"
            }}
          >
            📊 Fleet Posture Matrix
          </button>
        </div>

        <button
          onClick={onLeave}
          className="px-4 py-2 rounded font-semibold uppercase tracking-widest text-xs transition-all bg-red-900/20 text-red-400 border border-red-900/50 hover:bg-red-900/40 hover:border-red-500 cursor-pointer"
        >
          DISCONNECT
        </button>
      </div>

      {activeTab === "session" ? (
        <div className="flex-grow flex flex-col md:flex-row overflow-hidden">
          <div className="flex-grow flex flex-col items-center justify-center p-8 relative border-r border-emerald-900/30">
            <AivyuhVisualizer />
          </div>

          <div className="w-full md:w-96 flex flex-col bg-[#05080c] border-l border-emerald-900/30 p-6 overflow-hidden shadow-[-20px_0_40px_rgba(0,0,0,0.5)]">
            <h2 className="text-sm uppercase tracking-widest text-emerald-600 font-bold mb-4 flex items-center gap-2">
              <span className="text-lg">📡</span> REAL-TIME AUDIT LOG
            </h2>
            
            <div className="flex-grow overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-emerald-900 scrollbar-track-transparent">
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
      ) : (
        <div className="flex-grow overflow-y-auto p-6 space-y-6" style={{ backgroundColor: "#0a0f16" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
            <div className="hud-card" style={{ display: "flex", flexDirection: "column", gap: "12px", border: "1px solid rgba(16, 185, 129, 0.15)", background: "rgba(5, 8, 12, 0.6)" }}>
              <h3 style={{ fontSize: "1.05rem", fontWeight: "800", display: "flex", alignItems: "center", gap: "8px" }}>
                <Shield size={18} color="#10b981" /> Aivyuh Swarm Audit Controls (OWASP)
              </h3>
              <p style={{ fontSize: "0.82rem", color: "#64748b", lineHeight: "1.5" }}>
                Runs an OWASP Top 10 for LLM security audit across all active swarm agents (including aivyuh) to generate compliance reports.
              </p>
              <button
                onClick={triggerAivyuhScan}
                disabled={loadingAivyuhScan}
                className="px-4 py-2 rounded font-semibold uppercase tracking-widest text-xs transition-all bg-emerald-900/20 text-emerald-400 border border-emerald-900/50 hover:bg-emerald-900/40 hover:border-emerald-500 cursor-pointer"
                style={{ width: "100%", padding: "12px" }}
              >
                {loadingAivyuhScan ? (
                  <><RefreshCw size={14} className="spin" /> Auditing Swarm...</>
                ) : (
                  <><Shield size={14} /> Run Aivyuh Swarm Audit</>
                )}
              </button>
            </div>

            <div className="hud-card" style={{ display: "flex", flexDirection: "column", gap: "12px", border: "1px solid rgba(16, 185, 129, 0.15)", background: "rgba(5, 8, 12, 0.6)" }}>
              <h3 style={{ fontSize: "1.05rem", fontWeight: "800", display: "flex", alignItems: "center", gap: "8px" }}>
                <Shield size={18} color="#10b981" /> NIST Swarm Compliance Controls
              </h3>
              <p style={{ fontSize: "0.82rem", color: "#64748b", lineHeight: "1.5" }}>
                Runs a NIST AI Risk Management Framework 1.0 audit across all active swarm agents to generate compliance maps.
              </p>
              <button
                onClick={triggerNistScan}
                disabled={loadingNistScan}
                className="px-4 py-2 rounded font-semibold uppercase tracking-widest text-xs transition-all bg-emerald-900/20 text-emerald-400 border border-emerald-900/50 hover:bg-emerald-900/40 hover:border-emerald-500 cursor-pointer"
                style={{ width: "100%", padding: "12px" }}
              >
                {loadingNistScan ? (
                  <><RefreshCw size={14} className="spin" /> Auditing Swarm...</>
                ) : (
                  <><Shield size={14} /> Run NIST Swarm Audit</>
                )}
              </button>
            </div>
          </div>

          {showTerminal && (
            <div style={{
              background: "#05080c", borderRadius: "20px", padding: "20px",
              border: "1px solid rgba(16, 185, 129, 0.25)", boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
              fontFamily: "monospace", color: "#34d399", fontSize: "0.82rem"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(16, 185, 129, 0.15)", paddingBottom: "8px", marginBottom: "12px" }}>
                <span style={{ fontWeight: "800", color: "#f8fafc" }}>Aivyuh Probe Terminal Logs</span>
                <div style={{ display: "flex", gap: "12px" }}>
                  {lastScanResult && (
                    <button onClick={() => setShowRawJsonModal(true)} style={{ background: "none", border: "none", color: "#34d399", cursor: "pointer", fontWeight: "700" }}>[View Scan JSON]</button>
                  )}
                  <button onClick={() => setShowTerminal(false)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}>[Close Console]</button>
                </div>
              </div>
              <pre style={{ maxHeight: "150px", overflowY: "auto", whiteSpace: "pre-wrap" }}>{scanOutput}</pre>
            </div>
          )}

          {showNistTerminal && (
            <div style={{
              background: "#05080c", borderRadius: "20px", padding: "20px",
              border: "1px solid rgba(16, 185, 129, 0.25)", boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
              fontFamily: "monospace", color: "#34d399", fontSize: "0.82rem"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(16, 185, 129, 0.15)", paddingBottom: "8px", marginBottom: "12px" }}>
                <span style={{ fontWeight: "800", color: "#f8fafc" }}>NIST Compliance Probe Logs</span>
                <button onClick={() => setShowNistTerminal(false)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}>[Close Console]</button>
              </div>
              <pre style={{ maxHeight: "150px", overflowY: "auto", whiteSpace: "pre-wrap" }}>{nistScanOutput}</pre>
            </div>
          )}

          {/* 1. NIST Swarm Fleet Audit Matrix */}
          <div className="hud-card" style={{ border: "1px solid rgba(16, 185, 129, 0.15)" }}>
            <div style={{ marginBottom: "1.2rem" }}>
              <h3 className="orbitron-title" style={{ fontSize: "1.05rem", fontWeight: "800", display: "flex", alignItems: "center", gap: "6px", color: "#10b981" }}>
                <Shield size={16} color="#10b981" /> NIST AI RMF 1.0 Swarm Fleet Audit Matrix
              </h3>
              <p style={{ color: "#64748b", fontSize: "0.8rem", marginTop: "4px" }}>
                NIST compliance scores, risk classifications, and capability footprint maps for active agents.
              </p>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem", color: "#e2e8f0" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(16, 185, 129, 0.15)", color: "#64748b", textAlign: "left" }}>
                    <th style={{ padding: "10px 8px" }}>AGENT</th>
                    <th style={{ padding: "10px 8px" }}>RISK TIER</th>
                    <th style={{ padding: "10px 8px" }}>NIST COMPLIANCE</th>
                    <th style={{ padding: "10px 8px" }}>APPLICABLE</th>
                    <th style={{ padding: "10px 8px" }}>BYPASSED</th>
                    <th style={{ padding: "10px 8px", textAlign: "right" }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {!securityStatus ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "1.5rem", color: "#64748b", fontStyle: "italic" }}>No NIST audit history available.</td>
                    </tr>
                  ) : (
                    Object.entries(securityStatus).map(([agentName, data]) => {
                      const nist = data.nist_audit || { score: 100, risk: "LOW", controls: [] };
                      const riskColor = nist.risk === "CRITICAL" ? "#ef4444" : nist.risk === "HIGH" ? "#f87171" : nist.risk === "MEDIUM" ? "#fbbf24" : "#34d399";
                      const riskBg = nist.risk === "CRITICAL" ? "rgba(239,68,68,0.1)" : nist.risk === "HIGH" ? "rgba(248,113,113,0.08)" : nist.risk === "MEDIUM" ? "rgba(251,191,36,0.08)" : "rgba(52,211,153,0.08)";
                      const scope = data.scope_analysis || { applicable_count: 0, non_applicable_count: 0, unmapped_count: 0 };
                      return (
                        <tr key={agentName} style={{ borderBottom: "1px solid rgba(16, 185, 129, 0.08)" }}>
                          <td style={{ padding: "10px 8px", fontWeight: "700", textTransform: "uppercase" }}>{agentName.replace("_", " ")}</td>
                          <td style={{ padding: "10px 8px" }}>
                            <span style={{
                              fontSize: "0.68rem", fontWeight: "800", padding: "2px 6px", borderRadius: "4px",
                              background: riskBg, color: riskColor, border: `1px solid ${riskColor}33`
                            }}>{nist.risk}</span>
                          </td>
                          <td style={{ padding: "10px 8px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <div style={{ flexGrow: 1, background: "rgba(255, 255, 255, 0.06)", height: "6px", borderRadius: "3px", width: "60px", overflow: "hidden" }}>
                                <div style={{ background: nist.score >= 90 ? "#10b981" : nist.score >= 75 ? "#f59e0b" : nist.score >= 60 ? "#ef4444" : "#b91c1c", height: "100%", width: `${nist.score}%` }} />
                              </div>
                              <span style={{ fontWeight: "700" }}>{nist.score}%</span>
                            </div>
                          </td>
                          <td style={{ padding: "10px 8px" }}>{scope.applicable_count}</td>
                          <td style={{ padding: "10px 8px", color: "#64748b" }}>{scope.non_applicable_count + scope.unmapped_count}</td>
                          <td style={{ padding: "10px 8px", textAlign: "right" }}>
                            <button
                              onClick={() => {
                                setSecopsFramework("nist");
                                setSelectedSecopsAgent({ name: agentName, data });
                              }}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "#10b981", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "4px" }}
                            >
                              <Eye size={12} /> Inspect NIST
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. NIST Swarm Fleet Details Matrix */}
          <div className="hud-card" style={{ border: "1px solid rgba(16, 185, 129, 0.15)" }}>
            <div style={{ marginBottom: "1.2rem" }}>
              <h3 className="orbitron-title" style={{ fontSize: "1.05rem", fontWeight: "800", display: "flex", alignItems: "center", gap: "6px", color: "#10b981" }}>
                <Shield size={16} color="#10b981" /> NIST AI RMF 1.0 Swarm Fleet Details Matrix
              </h3>
              <p style={{ color: "#64748b", fontSize: "0.8rem", marginTop: "4px" }}>
                Granular parent category compliance status mapping for all active agents. Hover for definitions.
              </p>
            </div>

            <div style={{ overflowX: "auto", position: "relative", maxWidth: "100%", borderRadius: "12px", border: "1px solid rgba(16, 185, 129, 0.15)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.76rem", minWidth: "1200px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(16, 185, 129, 0.15)", color: "#64748b", textAlign: "left", backgroundColor: "#05080c" }}>
                    <th style={{ position: "sticky", left: 0, backgroundColor: "#05080c", zIndex: 12, padding: "12px 10px", minWidth: "120px", borderRight: "1px solid rgba(16, 185, 129, 0.15)" }}>AGENT</th>
                    {nistParentCategories.map(cat => (
                      <th key={cat} title={getNistCategoryTooltip(cat)} style={{ padding: "12px 6px", textAlign: "center", cursor: "help", fontSize: "0.68rem" }}>{cat}</th>
                    ))}
                    <th style={{ padding: "12px 10px", textAlign: "right", minWidth: "100px" }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {!securityStatus ? (
                    <tr>
                      <td colSpan={22} style={{ textAlign: "center", padding: "1.5rem", color: "#64748b", fontStyle: "italic" }}>No details available.</td>
                    </tr>
                  ) : (
                    Object.entries(securityStatus).map(([agentName, data]) => {
                      const controls = data.nist_audit?.controls || [];
                      return (
                        <tr key={agentName} style={{ borderBottom: "1px solid rgba(16, 185, 129, 0.08)" }}>
                          <td style={{ position: "sticky", left: 0, backgroundColor: "#05080c", zIndex: 10, padding: "10px 10px", fontWeight: "700", textTransform: "uppercase", borderRight: "1px solid rgba(16, 185, 129, 0.15)" }}>
                            {agentName.replace("_", " ")}
                          </td>
                          {nistParentCategories.map(cat => {
                            const status = resolveNistCategoryStatus(controls, cat);
                            const tooltip = `${agentName.replace("_", " ").toUpperCase()} - ${cat} (${getNistCategoryTooltip(cat)}): ${status}`;
                            return (
                              <td key={cat} style={{ padding: "10px 6px", textAlign: "center" }}>
                                {renderStatusDot(status, tooltip)}
                              </td>
                            );
                          })}
                          <td style={{ padding: "10px 10px", textAlign: "right" }}>
                            <button
                              onClick={() => {
                                setSecopsFramework("nist");
                                setSelectedSecopsAgent({ name: agentName, data });
                              }}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "#10b981", fontWeight: "700" }}
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. OWASP Top 10 LLM Swarm Fleet Audit Matrix */}
          <div className="hud-card" style={{ border: "1px solid rgba(16, 185, 129, 0.15)" }}>
            <div style={{ marginBottom: "1.2rem" }}>
              <h3 className="orbitron-title" style={{ fontSize: "1.05rem", fontWeight: "800", display: "flex", alignItems: "center", gap: "6px", color: "#10b981" }}>
                <Shield size={16} color="#10b981" /> OWASP Top 10 LLM Swarm Fleet Audit Matrix
              </h3>
              <p style={{ color: "#64748b", fontSize: "0.8rem", marginTop: "4px" }}>
                AST-verified vulnerability counts, critical warnings, and compliance scores for active agents.
              </p>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem", color: "#e2e8f0" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(16, 185, 129, 0.15)", color: "#64748b", textAlign: "left" }}>
                    <th style={{ padding: "10px 8px" }}>AGENT</th>
                    <th style={{ padding: "10px 8px" }}>COMPLIANCE STATUS</th>
                    <th style={{ padding: "10px 8px" }}>CRITICAL FAILURES</th>
                    <th style={{ padding: "10px 8px" }}>WARNING FAILURES</th>
                    <th style={{ padding: "10px 8px" }}>OWASP SCORE</th>
                    <th style={{ padding: "10px 8px", textAlign: "right" }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {!securityStatus ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "1.5rem", color: "#64748b", fontStyle: "italic" }}>No OWASP audit history available.</td>
                    </tr>
                  ) : (
                    Object.entries(securityStatus).map(([agentName, data]) => {
                      const crit = data.critical_count !== null ? data.critical_count : 0;
                      const warn = data.warning_count !== null ? data.warning_count : 0;
                      const owaspScore = crit === 0 ? "100%" : `${Math.max(0, 100 - crit * 10)}%`;
                      const statusColor = crit > 0 ? "#ef4444" : warn > 0 ? "#f59e0b" : "#10b981";
                      const statusBg = crit > 0 ? "rgba(239,68,68,0.08)" : warn > 0 ? "rgba(245,158,11,0.08)" : "rgba(16,185,129,0.08)";
                      const statusText = crit > 0 ? "VULNERABLE" : warn > 0 ? "WARNINGS" : "SECURE";
                      return (
                        <tr key={agentName} style={{ borderBottom: "1px solid rgba(16, 185, 129, 0.08)" }}>
                          <td style={{ padding: "10px 8px", fontWeight: "700", textTransform: "uppercase" }}>{agentName.replace("_", " ")}</td>
                          <td style={{ padding: "10px 8px" }}>
                            <span style={{
                              fontSize: "0.68rem", fontWeight: "800", padding: "2px 6px", borderRadius: "4px",
                              background: statusBg, color: statusColor, border: `1px solid ${statusColor}33`
                            }}>{statusText}</span>
                          </td>
                          <td style={{ padding: "10px 8px", color: crit > 0 ? "#ef4444" : "#e2e8f0" }}>{crit}</td>
                          <td style={{ padding: "10px 8px", color: warn > 0 ? "#f59e0b" : "#e2e8f0" }}>{warn}</td>
                          <td style={{ padding: "10px 8px", fontWeight: "700", color: crit > 0 ? "#ef4444" : "#10b981" }}>{owaspScore}</td>
                          <td style={{ padding: "10px 8px", textAlign: "right" }}>
                            <button
                              onClick={() => {
                                setSecopsFramework("owasp");
                                setSelectedSecopsAgent({ name: agentName, data });
                              }}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "#10b981", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "4px" }}
                            >
                              <Eye size={12} /> Inspect OWASP
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 4. OWASP Top 10 LLM Swarm Fleet Details Matrix */}
          <div className="hud-card" style={{ border: "1px solid rgba(16, 185, 129, 0.15)" }}>
            <div style={{ marginBottom: "1.2rem" }}>
              <h3 className="orbitron-title" style={{ fontSize: "1.05rem", fontWeight: "800", display: "flex", alignItems: "center", gap: "6px", color: "#10b981" }}>
                <Shield size={16} color="#10b981" /> OWASP Top 10 LLM Swarm Fleet Details Matrix
              </h3>
              <p style={{ color: "#64748b", fontSize: "0.8rem", marginTop: "4px" }}>
                Vulnerability compliance status mapped across all OWASP LLM01-LLM10 controls. Hover for details.
              </p>
            </div>

            <div style={{ overflowX: "auto", position: "relative", maxWidth: "100%", borderRadius: "12px", border: "1px solid rgba(16, 185, 129, 0.15)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.76rem", minWidth: "800px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(16, 185, 129, 0.15)", color: "#64748b", textAlign: "left", backgroundColor: "#05080c" }}>
                    <th style={{ position: "sticky", left: 0, backgroundColor: "#05080c", zIndex: 12, padding: "12px 10px", minWidth: "120px", borderRight: "1px solid rgba(16, 185, 129, 0.15)" }}>AGENT</th>
                    {owaspControls.map(c => (
                      <th key={c.id} title={getOwaspCategoryTooltip(c.id)} style={{ padding: "12px 6px", textAlign: "center", cursor: "help", fontSize: "0.68rem" }}>{c.id}</th>
                    ))}
                    <th style={{ padding: "12px 10px", textAlign: "right", minWidth: "100px" }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {!securityStatus ? (
                    <tr>
                      <td colSpan={12} style={{ textAlign: "center", padding: "1.5rem", color: "#64748b", fontStyle: "italic" }}>No details available.</td>
                    </tr>
                  ) : (
                    Object.entries(securityStatus).map(([agentName, data]) => {
                      const summary = data.report_summary || [];
                      return (
                        <tr key={agentName} style={{ borderBottom: "1px solid rgba(16, 185, 129, 0.08)" }}>
                          <td style={{ position: "sticky", left: 0, backgroundColor: "#05080c", zIndex: 10, padding: "10px 10px", fontWeight: "700", textTransform: "uppercase", borderRight: "1px solid rgba(16, 185, 129, 0.15)" }}>
                            {agentName.replace("_", " ")}
                          </td>
                          {owaspControls.map(c => {
                            const failedLine = summary.find(line => line.startsWith(c.id));
                            const status = failedLine ? "FAIL" : "PASS";
                            const tooltip = `${agentName.replace("_", " ").toUpperCase()} - ${c.id} (${c.name}): ${status === "FAIL" ? "FAILED - " + failedLine : "PASSED"}`;
                            return (
                              <td key={c.id} style={{ padding: "10px 6px", textAlign: "center" }}>
                                {renderStatusDot(status, tooltip)}
                              </td>
                            );
                          })}
                          <td style={{ padding: "10px 10px", textAlign: "right" }}>
                            <button
                              onClick={() => {
                                setSecopsFramework("owasp");
                                setSelectedSecopsAgent({ name: agentName, data });
                              }}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "#10b981", fontWeight: "700" }}
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showRawJsonModal && lastScanResult && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(7, 9, 19, 0.6)",
          backdropFilter: "blur(8px)", display: "flex", alignItems: "center",
          justifyContent: "center", zIndex: 2000
        }}>
          <div style={{
            background: "rgba(10, 15, 30, 0.95)", borderRadius: "24px",
            border: "1px solid rgba(16, 185, 129, 0.2)", width: "600px",
            padding: "24px", boxShadow: "0 20px 50px rgba(0, 0, 0, 0.5)", color: "#f3f4f6"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(16, 185, 129, 0.15)", paddingBottom: "10px", marginBottom: "16px" }}>
              <h3 className="orbitron-title" style={{ fontSize: "1.1rem", fontWeight: "800", color: "#10b981" }}>Raw Scan Result JSON</h3>
              <button onClick={() => setShowRawJsonModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", fontWeight: "700" }}>[Dismiss]</button>
            </div>
            <pre style={{
              background: "#05080c", border: "1px solid rgba(16, 185, 129, 0.15)",
              borderRadius: "12px", padding: "14px", fontSize: "0.75rem", fontFamily: "monospace",
              color: "#34d399", overflowX: "auto", whiteSpace: "pre-wrap", maxHeight: "350px", margin: 0
            }}>{JSON.stringify(lastScanResult, null, 2)}</pre>
          </div>
        </div>
      )}
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
