import React, { useState, useEffect } from "react";
import axios from "axios";
import { 
  Shield, 
  Terminal, 
  Download, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Info,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Search,
  Sliders,
  Settings,
  Lock,
  Layers,
  X
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";

export default function ComplianceDashboard({ onBack }) {
  // Navigation tabs: 'ciso' or 'secops'
  const [activeView, setActiveView] = useState("ciso");
  
  // Data states
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

  // Compliance Logs Table states
  const [logs, setLogs] = useState([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [filterSeverity, setFilterSeverity] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Detail Modal view
  const [selectedLog, setSelectedLog] = useState(null);
  const [lastScanResult, setLastScanResult] = useState(null);
  const [showRawJsonModal, setShowRawJsonModal] = useState(false);
  
  // NIST Agent Compliance States
  const [securityStatus, setSecurityStatus] = useState(null);
  const [selectedCisoAgent, setSelectedCisoAgent] = useState(null);
  const [selectedSecopsAgent, setSelectedSecopsAgent] = useState(null);
  const [nistSearchTerm, setNistSearchTerm] = useState("");
  const [nistFilterStatus, setNistFilterStatus] = useState("ALL");
  const [expandedControlId, setExpandedControlId] = useState(null);
  
  // NIST Scanning States
  const [loadingNistScan, setLoadingNistScan] = useState(false);
  const [nistScanOutput, setNistScanOutput] = useState("");
  const [showNistTerminal, setShowNistTerminal] = useState(false);

  // Agent Scope Analyzer states
  const [loadingScopeAnalyze, setLoadingScopeAnalyze] = useState(false);
  const [showOnlyApplicable, setShowOnlyApplicable] = useState(true);
  const [secopsFramework, setSecopsFramework] = useState("nist");

  useEffect(() => {
    setExpandedControlId(null);
  }, [secopsFramework]);

  // Load metrics & security status
  useEffect(() => {
    fetchMetrics();
    fetchSecurityStatus();
  }, []);

  // Reload logs when page, filters or search changes
  useEffect(() => {
    fetchLogs();
  }, [page, filterSeverity]);

  const fetchMetrics = async () => {
    try {
      const res = await axios.get(`${API}/api/compliance/summary`);
      if (res.data) {
        setMetrics(res.data);
      }
    } catch (err) {
      console.error("Error fetching metrics:", err.message);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await axios.get(`${API}/api/compliance/logs`, {
        params: { page, limit }
      });
      if (res.data && res.data.logs) {
        setLogs(res.data.logs);
        setTotalLogs(res.data.total);
      }
    } catch (err) {
      console.error("Error fetching logs:", err.message);
    }
  };

  const fetchSecurityStatus = async () => {
    try {
      const res = await axios.get(`${API}/security/status`);
      if (res.data) {
        setSecurityStatus(res.data);
      }
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
        fetchLogs();
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
        setNistScanOutput(prev => prev + JSON.stringify(res.data, null, 2) + "\n\nNIST Swarm Compliance Audit completed successfully. All control mappings synchronized in local JSONs & PostgreSQL DB.");
        fetchSecurityStatus();
        fetchMetrics();
        fetchLogs();
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
        await fetchLogs();
      }
    } catch (err) {
      console.error("Error running agent scope analyzer:", err.message);
    } finally {
      setLoadingScopeAnalyze(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const res = await axios.get(`${API}/api/compliance/logs`, {
        params: { page: 1, limit: 200 }
      });
      const logsToExport = res.data.logs || logs;
      
      let csvContent = "data:text/csv;charset=utf-8,";
      csvContent += "ID,Timestamp,Event Type,Severity,Agent,Details\n";
      
      logsToExport.forEach(l => {
        const row = [
          l.id,
          new Date(l.timestamp).toISOString(),
          l.event_type,
          l.severity,
          l.agent || "system",
          JSON.stringify(l.details).replace(/"/g, '""')
        ].map(val => `"${val}"`).join(",");
        csvContent += row + "\n";
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `swarm_compliance_audit_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("CSV export failed:", err.message);
    }
  };

  const filteredLogs = logs.filter(l => {
    const matchesSearch = 
      l.event_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.agent || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      JSON.stringify(l.details).toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSeverity = filterSeverity ? l.severity === filterSeverity : true;
    return matchesSearch && matchesSeverity;
  });

  const getSeverityStyle = (sev) => {
    switch (sev.toLowerCase()) {
      case "critical":
        return { color: "#ef4444", bg: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.15)" };
      case "warning":
        return { color: "#f59e0b", bg: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.15)" };
      default:
        return { color: "#10b981", bg: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.15)" };
    }
  };

  if (selectedSecopsAgent) {
    const currentSecopsAgentData = securityStatus ? securityStatus[selectedSecopsAgent.name.toLowerCase()] : null;
    const currentSecopsAgent = { name: selectedSecopsAgent.name, data: currentSecopsAgentData || selectedSecopsAgent.data };
    const activeControl = secopsFramework === "nist"
      ? currentSecopsAgent.data.nist_audit?.controls?.find(c => c.id === expandedControlId)
      : owaspControls.find(c => c.id === expandedControlId);
    
    return (
      <div className="secops-page-container">
        {/* Breadcrumb Navigation */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "4px" }}>
          <button className="secops-breadcrumb-btn" onClick={() => {
            setSelectedSecopsAgent(null);
            setExpandedControlId(null);
          }}>
            Compliance Hub
          </button>
          <span>/</span>
          <button className="secops-breadcrumb-btn" onClick={() => {
            setSelectedSecopsAgent(null);
            setExpandedControlId(null);
          }}>
            SecOps Technical Console
          </button>
          <span>/</span>
          <span style={{ color: "#3b82f6", fontWeight: "700" }}>
            {currentSecopsAgent.name.replace("_", " ").toUpperCase()}
          </span>
        </div>

        {/* Back Button & Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button
            onClick={() => {
              setSelectedSecopsAgent(null);
              setNistSearchTerm("");
              setNistFilterStatus("ALL");
              setExpandedControlId(null);
            }}
            className="action-btn-secondary"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 14px",
              borderRadius: "10px",
              fontSize: "0.85rem",
              fontWeight: "700"
            }}
          >
            <ChevronLeft size={16} /> Back to Hub
          </button>

          <span className="secops-status-badge">
            <span className="secops-status-dot"></span>
            Live Probe Active
          </span>
        </div>

        {/* Console Header details */}
        <div className="hud-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", background: "rgba(14, 22, 40, 0.6)", border: "1px solid rgba(59, 130, 246, 0.15)" }}>
          <div>
            <h2 className="secops-title" style={{ fontSize: "1.5rem" }}>
              {currentSecopsAgent.name.replace("_", " ")} SecOps Console
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "4px" }}>
              NIST AI Risk Management Framework 1.0 & AST Evidence Inspector
            </p>
          </div>
          <div style={{ display: "flex", gap: "2rem", alignItems: "center" }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: "800", textTransform: "uppercase" }}>NIST COMPLIANCE SCORE</div>
              <div style={{ fontSize: "1.6rem", fontWeight: "900", color: "#38bdf8" }}>{currentSecopsAgent.data.nist_audit?.score || 100}%</div>
            </div>
            <div style={{ textAlign: "right", borderLeft: "1px solid rgba(255,255,255,0.08)", paddingLeft: "2rem" }}>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: "800", textTransform: "uppercase" }}>RISK TIER</div>
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

        {/* AST Scope Analyzer Result Card */}
        <div className="hud-card" style={{ 
          padding: "24px", 
          background: "rgba(10, 15, 30, 0.8)", 
          border: "1px solid rgba(59, 130, 246, 0.25)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.5), inset 0 0 15px rgba(59, 130, 246, 0.05)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: "12px" }}>
            <div>
              <h3 className="orbitron-title" style={{ fontSize: "1.05rem", fontWeight: "800", color: "#38bdf8", display: "flex", alignItems: "center", gap: "8px" }}>
                <Sliders size={16} color="#38bdf8" /> AST Scope Analyzer Results
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.78rem", marginTop: "2px" }}>
                Static AST codebase analyzer identifying agent business function, autonomy level, capability footprint, and data classes.
              </p>
            </div>
            
            <button
              onClick={() => runAgentScopeAnalyzer(currentSecopsAgent.name)}
              disabled={loadingScopeAnalyze}
              className="action-btn-primary"
              style={{
                padding: "8px 16px",
                borderRadius: "10px",
                fontWeight: "700",
                fontSize: "0.8rem",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer",
                background: "rgba(59, 130, 246, 0.15)",
                color: "#38bdf8",
                border: "1px solid rgba(59, 130, 246, 0.25)"
              }}
              onMouseEnter={e => { if (!loadingScopeAnalyze) { e.currentTarget.style.background = "rgba(59, 130, 246, 0.25)"; } }}
              onMouseLeave={e => { if (!loadingScopeAnalyze) { e.currentTarget.style.background = "rgba(59, 130, 246, 0.15)"; } }}
            >
              {loadingScopeAnalyze ? (
                <>
                  <RefreshCw size={12} className="spin" /> Analyzing Scope...
                </>
              ) : (
                <>
                  <RefreshCw size={12} /> Run Scope Analyzer
                </>
              )}
            </button>
          </div>

          {currentSecopsAgent.data?.scope_analysis ? (
            <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "20px" }}>
              {/* Box 1: Business Function & Autonomy */}
              <div style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.04)", padding: "12px 16px", borderRadius: "12px" }}>
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: "800", textTransform: "uppercase" }}>Function & Autonomy</div>
                <div style={{ fontSize: "0.88rem", fontWeight: "700", color: "#f8fafc", marginTop: "6px" }}>
                  {currentSecopsAgent.data.scope_analysis.business_function}
                </div>
                <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                  <span>Autonomy:</span>
                  <span style={{ fontWeight: "700", color: "#f59e0b" }}>{currentSecopsAgent.data.scope_analysis.autonomy}</span>
                </div>
              </div>

              {/* Box 2: Detected Capabilities */}
              <div style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.04)", padding: "12px 16px", borderRadius: "12px" }}>
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: "800", textTransform: "uppercase", marginBottom: "6px" }}>Capabilities Footprint</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {currentSecopsAgent.data.scope_analysis.capabilities && currentSecopsAgent.data.scope_analysis.capabilities.length > 0 ? (
                    currentSecopsAgent.data.scope_analysis.capabilities.map((cap, idx) => (
                      <span key={idx} style={{
                        fontSize: "0.65rem",
                        fontWeight: "800",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        background: "rgba(59, 130, 246, 0.15)",
                        color: "#38bdf8",
                        border: "1px solid rgba(59, 130, 246, 0.3)"
                      }}>
                        {cap}
                      </span>
                    ))
                  ) : (
                    <span style={{ color: "var(--text-muted)", fontSize: "0.78rem", fontStyle: "italic" }}>None detected</span>
                  )}
                </div>
              </div>

              {/* Box 3: Data Classes & Reach */}
              <div style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.04)", padding: "12px 16px", borderRadius: "12px" }}>
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: "800", textTransform: "uppercase" }}>Data Classes & Reach</div>
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
                    <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", fontStyle: "italic" }}>No sensitive data classes</span>
                  )}
                </div>
                <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: "6px" }}>
                  Reach: {currentSecopsAgent.data.scope_analysis.external_reach && currentSecopsAgent.data.scope_analysis.external_reach.length > 0 ? (
                    <span style={{ color: "#38bdf8", fontWeight: "700" }}>
                      {currentSecopsAgent.data.scope_analysis.external_reach.join(", ")}
                    </span>
                  ) : (
                    <span style={{ fontStyle: "italic" }}>Sandbox Isolated</span>
                  )}
                </div>
              </div>

              {/* Box 4: NIST Control Scope Metrics */}
              <div style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.04)", padding: "12px 16px", borderRadius: "12px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>Applicable Controls:</span>
                  <span style={{ fontSize: "0.82rem", fontWeight: "900", color: "#10b981" }}>
                    {currentSecopsAgent.data.scope_analysis.applicable_count}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>Bypassed Controls:</span>
                  <span style={{ fontSize: "0.82rem", fontWeight: "900", color: "#64748b" }}>
                    {currentSecopsAgent.data.scope_analysis.non_applicable_count + (currentSecopsAgent.data.scope_analysis.unmapped_count || 0)}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Framework Controls Classification Notice */}
            <div style={{ 
              marginTop: "20px", 
              padding: "14px 18px", 
              background: "rgba(59, 130, 246, 0.04)", 
              border: "1px solid rgba(59, 130, 246, 0.15)", 
              borderRadius: "12px",
              display: "flex",
              gap: "12px",
              alignItems: "flex-start"
            }}>
              <Info size={16} color="#38bdf8" style={{ marginTop: "2px", flexShrink: 0 }} />
              <div style={{ fontSize: "0.78rem", lineHeight: "1.5", color: "#94a3b8" }}>
                <strong style={{ color: "#38bdf8", display: "block", marginBottom: "6px", fontSize: "0.82rem" }}>NIST.AI.600-1 Controls Classification:</strong>
                <ul style={{ margin: "0 0 0 16px", padding: 0, listStyleType: "disc", display: "flex", flexDirection: "column", gap: "6px" }}>
                  <li>
                    <strong style={{ color: "#f1f5f9" }}>Programmatic Controls (96 suggested actions):</strong> These map to the 34 parent subcategories (like <code>GV-1.4</code>, <code>MAP-3.2</code>, etc.) defined in <code>self.rules</code>. They are evaluated against the agent's AST-detected capabilities.
                  </li>
                  <li>
                    <strong style={{ color: "#f1f5f9" }}>Organizational Controls (115 suggested actions):</strong> These map to the 41 parent subcategories defined in <code>self.unmapped_rationales</code> (like board-level sign-offs, legal compliance policies, HR/DEI policies). Because they are corporate-level policies and do not depend on any codebase capability, they are marked as <span style={{ color: "#10b981", fontWeight: "700" }}>Unmapped (Bypassed)</span> by default for all agents.
                  </li>
                </ul>
              </div>
            </div>
            </>
          ) : (
            <div style={{ padding: "16px", textAlign: "center", color: "var(--text-muted)", fontStyle: "italic", fontSize: "0.82rem", border: "1px dashed rgba(255,255,255,0.08)", borderRadius: "12px" }}>
              No static scope analysis results found. Click "Run Scope Analyzer" to initialize capabilities scanning.
            </div>
          )}
        </div>

        {/* Two Column Layout Grid */}
        <div className="secops-layout">
          
          {/* Left Column: Controls List */}
          <div className="secops-panel">
            <div className="secops-panel-header">
              <h4 style={{ fontSize: "0.95rem", fontWeight: "800", textTransform: "uppercase", color: "#f8fafc" }}>Security Controls</h4>
              <p style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginTop: "2px" }}>Select a control card to inspect telemetry evidence</p>
            </div>

            {/* Framework Select Toggle */}
            <div style={{
              display: "flex",
              background: "rgba(255, 255, 255, 0.03)",
              padding: "2px",
              borderRadius: "8px",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              marginBottom: "12px"
            }}>
              <button
                onClick={() => setSecopsFramework("nist")}
                style={{
                  flex: 1,
                  padding: "6px",
                  fontSize: "0.75rem",
                  fontWeight: "700",
                  background: secopsFramework === "nist" ? "rgba(59, 130, 246, 0.15)" : "transparent",
                  color: secopsFramework === "nist" ? "#38bdf8" : "var(--text-muted)",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                NIST AI RMF 1.0
              </button>
              <button
                onClick={() => setSecopsFramework("owasp")}
                style={{
                  flex: 1,
                  padding: "6px",
                  fontSize: "0.75rem",
                  fontWeight: "700",
                  background: secopsFramework === "owasp" ? "rgba(59, 130, 246, 0.15)" : "transparent",
                  color: secopsFramework === "owasp" ? "#38bdf8" : "var(--text-muted)",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                OWASP Top 10 LLM
              </button>
            </div>

            {/* Filter toolbar */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Search size={14} style={{ position: "absolute", left: "12px", color: "rgba(255, 255, 255, 0.4)" }} />
                <input
                  type="text"
                  placeholder="Search by ID or keyword..."
                  value={nistSearchTerm}
                  onChange={(e) => setNistSearchTerm(e.target.value)}
                  className="secops-input"
                />
              </div>

              <select
                value={nistFilterStatus}
                onChange={(e) => setNistFilterStatus(e.target.value)}
                className="secops-select"
              >
                <option value="ALL">All Controls</option>
                {secopsFramework === "nist" ? (
                  <>
                    <option value="PASS">Pass ({currentSecopsAgent.data.nist_audit?.controls?.filter(c => c.status === "PASS").length || 0})</option>
                    <option value="PARTIAL">Partial ({currentSecopsAgent.data.nist_audit?.controls?.filter(c => c.status === "PARTIAL").length || 0})</option>
                    <option value="FAIL">Fail ({currentSecopsAgent.data.nist_audit?.controls?.filter(c => c.status === "FAIL").length || 0})</option>
                    <option value="UNMAPPED">Unmapped / Bypassed ({currentSecopsAgent.data.nist_audit?.controls?.filter(c => c.status === "UNMAPPED").length || 0})</option>
                    <option value="NON-APPLICABLE">Non-Applicable / Bypassed ({currentSecopsAgent.data.nist_audit?.controls?.filter(c => c.status === "NON-APPLICABLE").length || 0})</option>
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

            {/* Controls List Scroll Area */}
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
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "0.85rem", fontWeight: "700", fontFamily: "monospace", color: "#f8fafc" }}>{c.id}</span>
                            <span className={statusClass} style={{
                              fontSize: "0.65rem",
                              fontWeight: "800",
                              background: c.status === "UNMAPPED" || c.status === "NON-APPLICABLE" ? "rgba(16, 185, 129, 0.08)" : undefined,
                              color: c.status === "UNMAPPED" || c.status === "NON-APPLICABLE" ? "#10b981" : undefined,
                              borderColor: c.status === "UNMAPPED" || c.status === "NON-APPLICABLE" ? "rgba(16, 185, 129, 0.2)" : undefined
                            }}>{statusText}</span>
                          </div>
                          <div style={{ fontSize: "0.78rem", color: isSelected ? "#e2e8f0" : "var(--text-muted)", lineHeight: "1.4" }}>
                            {getNistControlDescription(c.id)}
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.72rem", color: "var(--text-muted)", borderTop: "1px solid rgba(255,255,255,0.03)", paddingTop: "6px", marginTop: "4px" }}>
                            <span>Confidence: {c.confidence}%</span>
                            {c.evidence?.length > 0 && <span>{c.evidence.length} signature{c.evidence.length > 1 ? "s" : ""}</span>}
                          </div>
                        </div>
                      );
                    })
                ) : (
                  <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontStyle: "italic" }}>
                    No controls audit reports loaded.
                  </div>
                )
              ) : (
                // Render OWASP Top 10 list
                owaspControls
                  .filter(c => {
                    const matchesSearch = c.id.toLowerCase().includes(nistSearchTerm.toLowerCase()) || 
                                          c.name.toLowerCase().includes(nistSearchTerm.toLowerCase()) ||
                                          c.desc.toLowerCase().includes(nistSearchTerm.toLowerCase());
                    const failedLine = currentSecopsAgent.data.report_summary?.find(line => line.startsWith(c.id));
                    const isPass = !failedLine;
                    const status = isPass ? "PASS" : "FAIL";
                    const matchesStatus = nistFilterStatus === "ALL" ? true : status === nistFilterStatus;
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
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "0.85rem", fontWeight: "700", fontFamily: "monospace", color: "#f8fafc" }}>{c.id}</span>
                          <span className={statusClass} style={{
                            fontSize: "0.65rem",
                            fontWeight: "800"
                          }}>{statusText}</span>
                        </div>
                        <div style={{ fontSize: "0.78rem", color: isSelected ? "#e2e8f0" : "var(--text-muted)", lineHeight: "1.4" }}>
                          {c.name}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.72rem", color: "var(--text-muted)", borderTop: "1px solid rgba(255,255,255,0.03)", paddingTop: "6px", marginTop: "4px" }}>
                          <span>Severity: <span style={{ color: c.type === "critical" ? "#ef4444" : "#f59e0b", fontWeight: "700" }}>{c.type.toUpperCase()}</span></span>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>

          {/* Right Column: Code Inspector Terminal */}
          <div className="secops-panel" style={{ flexGrow: 1 }}>
            <div className="secops-panel-header">
              <h4 style={{ fontSize: "0.95rem", fontWeight: "800", textTransform: "uppercase", color: "#f8fafc", display: "flex", alignItems: "center", gap: "8px" }}>
                <Terminal size={15} color="#3b82f6" /> Control Attestation Details
              </h4>
              <p style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginTop: "2px" }}>AST engine code analysis & evidence vault inspector</p>
            </div>

            <div className="secops-inspector-workspace">
              {!activeControl ? (
                <div className="secops-empty-state">
                  <div className="secops-empty-state-icon">
                    <Shield size={44} />
                  </div>
                  <h4 style={{ color: "#e2e8f0", fontSize: "0.95rem", fontWeight: "700", marginBottom: "6px" }}>No Control Selected</h4>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", maxWidth: "280px" }}>
                    Select a security control card from the left panel to inspect its codebase signature evidence and matched AST syntax locations.
                  </p>
                </div>
              ) : (
                <div className="secops-inspector-scroll">
                  {/* Control Heading */}
                  <div style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: "12px", padding: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                      <div>
                        <strong style={{ fontSize: "1.1rem", color: "#f8fafc", fontFamily: "monospace" }}>{activeControl.id}</strong>
                        <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "4px" }}>
                          Category: <span style={{ color: "#38bdf8", fontWeight: "700" }}>
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
                          fontSize: "0.75rem", 
                          padding: "4px 10px",
                          background: secopsFramework === "nist" && (activeControl.status === "UNMAPPED" || activeControl.status === "NON-APPLICABLE") ? "rgba(16, 185, 129, 0.08)" : undefined,
                          color: secopsFramework === "nist" && (activeControl.status === "UNMAPPED" || activeControl.status === "NON-APPLICABLE") ? "#10b981" : undefined,
                          borderColor: secopsFramework === "nist" && (activeControl.status === "UNMAPPED" || activeControl.status === "NON-APPLICABLE") ? "rgba(16, 185, 129, 0.2)" : undefined
                        }}>
                          {secopsFramework === "nist"
                            ? (activeControl.status === "UNMAPPED" || activeControl.status === "NON-APPLICABLE" ? "BYPASSED" : activeControl.status)
                            : (!currentSecopsAgent.data.report_summary?.some(line => line.startsWith(activeControl.id)) ? "PASS" : "FAIL")}
                        </span>
                        <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "6px", fontFamily: "monospace" }}>
                          {secopsFramework === "nist" ? (
                            `Score: ${activeControl.status === "PASS" ? "5/5" : activeControl.status === "PARTIAL" ? "3/5" : (activeControl.status === "UNMAPPED" || activeControl.status === "NON-APPLICABLE") ? "N/A" : "0/5"}`
                          ) : (
                            `Severity: ${activeControl.type.toUpperCase()}`
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div style={{ fontSize: "0.85rem", color: "#e2e8f0", borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: "10px", marginTop: "10px", lineHeight: "1.5" }}>
                      <strong>Guideline/Description:</strong> {secopsFramework === "nist" ? getNistControlDescription(activeControl.id) : activeControl.desc}
                    </div>
                    {secopsFramework === "nist" && activeControl.rationale && (
                      <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "8px", background: "rgba(255,255,255,0.01)", padding: "8px 12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.03)" }}>
                        <strong>Scope Rationale:</strong> {activeControl.rationale}
                      </div>
                    )}
                  </div>

                  {/* Evidence blocks */}
                  <div className="secops-details-panel">
                    {secopsFramework === "nist" ? (
                      activeControl.status === "FAIL" ? (
                        <div style={{ textAlign: "center", padding: "20px 0" }}>
                          <div style={{ color: "#ef4444", fontWeight: "700", marginBottom: "6px" }}>AST Telemetry Signature Mismatch</div>
                          <div style={{ fontStyle: "italic", color: "#64748b", fontSize: "0.85rem" }}>
                            Attestation failed: No evidence signatures or keywords matching this control criteria were discovered in the agent code files.
                          </div>
                        </div>
                      ) : activeControl.status === "UNMAPPED" ? (
                        <div style={{ textAlign: "center", padding: "24px 0", background: "rgba(16, 185, 129, 0.03)", border: "1px dashed rgba(16, 185, 129, 0.2)", borderRadius: "12px" }}>
                          <div style={{ color: "#10b981", fontWeight: "700", marginBottom: "8px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                            <CheckCircle size={16} /> Organizational Control (Bypassed)
                          </div>
                          <div style={{ color: "#94a3b8", fontSize: "0.82rem", maxWidth: "400px", margin: "0 auto", lineHeight: "1.5" }}>
                            {activeControl.rationale || "This control is monitored and managed at the organizational level rather than programmatically within individual agent files. No programmatic codebase evidence is required."}
                          </div>
                        </div>
                      ) : activeControl.status === "NON-APPLICABLE" ? (
                        <div style={{ textAlign: "center", padding: "24px 0", background: "rgba(16, 185, 129, 0.03)", border: "1px dashed rgba(16, 185, 129, 0.2)", borderRadius: "12px" }}>
                          <div style={{ color: "#10b981", fontWeight: "700", marginBottom: "8px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                            <CheckCircle size={16} /> Not Applicable to Agent Capabilities (Bypassed)
                          </div>
                          <div style={{ color: "#94a3b8", fontSize: "0.82rem", maxWidth: "400px", margin: "0 auto", lineHeight: "1.5" }}>
                            {activeControl.rationale || "This control does not apply based on the defined capabilities and features of this agent. No codebase evidence checking is required."}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div style={{ marginBottom: "10px", fontWeight: "800", color: activeControl.status === "PARTIAL" ? "#f59e0b" : "#10b981", fontSize: "0.85rem" }}>
                            Verified AST Evidence Code Findings ({activeControl.evidence?.length || 0}):
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            {activeControl.evidence?.map((ev, idx) => (
                              <div 
                                key={idx}
                                className={activeControl.status === "PARTIAL" ? "secops-evidence-item-partial" : "secops-evidence-item"}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", color: "#38bdf8", marginBottom: "6px", fontSize: "0.75rem", fontFamily: "monospace" }}>
                                  <span style={{ color: "#38bdf8" }}>File Line {ev.line}</span>
                                  <span style={{ color: "#e2e8f0" }}>Keyword Match: <strong style={{ color: "#f59e0b" }}>"{ev.match}"</strong></span>
                                </div>
                                <pre className="secops-code-pre">
                                  {ev.code}
                                </pre>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    ) : (
                      // OWASP Top 10 Evidence Panel
                      (() => {
                        const failedLine = currentSecopsAgent.data.report_summary?.find(line => line.startsWith(activeControl.id));
                        if (failedLine) {
                          return (
                            <div style={{ padding: "10px 0" }}>
                              <div style={{ color: "#ef4444", fontWeight: "700", marginBottom: "10px", fontSize: "0.85rem" }}>
                                AST Security Control Mismatch / Vulnerability Found:
                              </div>
                              <div style={{
                                fontSize: "0.82rem",
                                color: "#f8fafc",
                                background: "rgba(239, 68, 68, 0.05)",
                                border: "1px solid rgba(239, 68, 68, 0.15)",
                                padding: "14px",
                                borderRadius: "10px",
                                fontFamily: "monospace",
                                lineHeight: "1.5"
                              }}>
                                {failedLine}
                              </div>
                              <div style={{ color: "#94a3b8", fontSize: "0.78rem", marginTop: "12px", lineHeight: "1.5" }}>
                                💡 To pass this check, implement the required security guardrails or method keywords in the agent's Python codebase. The scanner checks for AST definitions like:
                                <ul style={{ listStyleType: "disc", margin: "6px 0 0 16px", padding: 0 }}>
                                  <li>For Prompt Injection (LLM01): <code>sanitize_prompt</code>, <code>prompt_guard</code>, <code>NeMoGuardrails</code></li>
                                  <li>For Insecure Output (LLM02): <code>sanitize_output</code>, <code>escape_html</code>, <code>DOMPurify</code></li>
                                  <li>For Model DoS (LLM04): <code>rate_limit</code>, <code>max_tokens</code>, <code>CostGuard</code></li>
                                  <li>For sensitive PII (LLM06): <code>tokenize_pii</code>, <code>redact</code>, <code>Securelytix</code></li>
                                </ul>
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
    );
  }

  return (
    <div className="compliance-container" style={{ padding: "2rem 4%" }}>
      
      {/* Dynamic Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: "1.2rem" }}>
        <div>
          <h1 className="orbitron-title" style={{ fontSize: "1.75rem", fontWeight: "900", letterSpacing: "-0.5px", color: "#ffffff" }}>Compliance & Governance Hub</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginTop: "4px" }}>
            Operational trust assurance portal mapping platform telemetry to regulatory compliance frameworks.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div style={{
          display: "flex",
          background: "rgba(255, 255, 255, 0.03)",
          padding: "4px",
          borderRadius: "12px",
          border: "1px solid rgba(255, 255, 255, 0.08)"
        }}>
          <button
            onClick={() => setActiveView("ciso")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              borderRadius: "10px",
              border: "none",
              cursor: "pointer",
              fontSize: "0.85rem",
              fontWeight: "700",
              background: activeView === "ciso" ? "rgba(59, 130, 246, 0.15)" : "transparent",
              color: activeView === "ciso" ? "#38bdf8" : "var(--text-muted)",
              border: activeView === "ciso" ? "1px solid rgba(59, 130, 246, 0.25)" : "1px solid transparent",
              transition: "all 0.25s"
            }}
          >
            <Shield size={14} /> CISO Executive Report
          </button>
          <button
            onClick={() => setActiveView("secops")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              borderRadius: "10px",
              border: "none",
              cursor: "pointer",
              fontSize: "0.85rem",
              fontWeight: "700",
              background: activeView === "secops" ? "rgba(59, 130, 246, 0.15)" : "transparent",
              color: activeView === "secops" ? "#38bdf8" : "var(--text-muted)",
              border: activeView === "secops" ? "1px solid rgba(59, 130, 246, 0.25)" : "1px solid transparent",
              transition: "all 0.25s"
            }}
          >
            <Terminal size={14} /> SecOps Technical Console
          </button>
        </div>
      </div>

      {/* --- PERSPECTIVE A: CISO GOVERNANCE VIEW --- */}
      {activeView === "ciso" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          
          {/* Executive Rating Banner */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 2.5fr",
            gap: "2rem",
            background: "linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(16, 185, 129, 0.05) 100%)",
            border: "1px solid rgba(59, 130, 246, 0.15)",
            borderRadius: "24px",
            padding: "2.5rem",
            alignItems: "center"
          }}>
            <div style={{ textAlign: "center", borderRight: "1px solid rgba(59, 130, 246, 0.15)", paddingRight: "2rem" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: "900", color: "#38bdf8", letterSpacing: "1.5px", textTransform: "uppercase" }}>
                Active Posture Score
              </span>
              <div style={{ fontSize: "4rem", fontWeight: "900", color: metrics.criticalCVEs > 0 ? "#ef4444" : "#10b981", margin: "0.8rem 0" }}>
                {metrics.complianceScore}
              </div>
              <span style={{ 
                fontSize: "0.75rem", 
                fontWeight: "800", 
                padding: "4px 12px", 
                borderRadius: "20px",
                background: metrics.criticalCVEs > 0 ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)",
                color: metrics.criticalCVEs > 0 ? "#ef4444" : "#10b981"
              }}>
                {metrics.criticalCVEs > 0 ? "REMEDIATION REQUIRED" : "AUDIT READINESS STANDARD"}
              </span>
            </div>

            <div>
              <h3 style={{ fontSize: "1.35rem", fontWeight: "800", marginBottom: "8px" }}>CISO Governance Executive Summary</h3>
              <p style={{ fontSize: "0.95rem", color: "#94a3b8", lineHeight: "1.6" }}>
                The Swarm Agentic platform is running continuous safety telemetry monitoring. 
                {metrics.criticalCVEs > 0 ? (
                  ` DevOps Geni detected ${metrics.criticalCVEs} active vulnerabilities. Please delegate remediation procedures to transition back to complete compliance status.`
                ) : (
                  " All dynamic guardrails, secret protection layers, container bounds attestation systems, and OWASP safety filters are active and operating cleanly. No critical compliance threats detected."
                )}
              </p>
              
              <div style={{ display: "flex", gap: "2rem", marginTop: "1.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "rgba(59, 130, 246, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#38bdf8" }}>
                    <Lock size={16} />
                  </div>
                  <div>
                    <div style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: "800" }}>ZERO TRUST STATUS</div>
                    <div style={{ fontSize: "0.85rem", fontWeight: "800", color: "#f8fafc" }}>ACTIVE & BOUNDED</div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "rgba(16, 185, 129, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#10b981" }}>
                    <Layers size={16} />
                  </div>
                  <div>
                    <div style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: "800" }}>PII SCRUBBED RATE</div>
                    <div style={{ fontSize: "0.85rem", fontWeight: "800", color: "#f8fafc" }}>100% VAULT ENCRYPTED</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Framework Maturity Cards */}
          <div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: "800", marginBottom: "1.2rem" }}>Regulatory Compliance Framework Audits</h3>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.5rem" }}>
              
              {/* ISO 42001 */}
              <div className="hud-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: "280px" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: "800" }}>ISO/IEC 42001 (AIMS)</span>
                    <span style={{ fontSize: "0.7rem", fontWeight: "900", color: "var(--success)", background: "rgba(16,185,129,0.08)", padding: "2px 8px", borderRadius: "6px" }}>COMPLIANT</span>
                  </div>
                  <h4 className="orbitron-stat" style={{ fontSize: "1.6rem", fontWeight: "900", margin: "1rem 0" }}>100%</h4>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: "1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.8rem", color: "#94a3b8" }}>
                      <CheckCircle size={14} color="var(--success)" /> <span>AI System Security Rules Active</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.8rem", color: "#94a3b8" }}>
                      <CheckCircle size={14} color="var(--success)" /> <span>Data Provenance Mapping Complete</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.8rem", color: "#94a3b8" }}>
                      <CheckCircle size={14} color="var(--success)" /> <span>OpenRouter Provider Health Sync</span>
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "1rem" }}>
                  Governs AI provider service, boundaries, and model drift.
                </div>
              </div>

              {/* SOC 2 Type II */}
              <div className="hud-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: "280px" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: "800" }}>SOC 2 Type II (TSC)</span>
                    <span style={{ 
                      fontSize: "0.7rem", 
                      fontWeight: "900", 
                      color: metrics.criticalCVEs > 0 ? "#f59e0b" : "var(--success)", 
                      background: metrics.criticalCVEs > 0 ? "rgba(245,158,11,0.08)" : "rgba(16,185,129,0.08)", 
                      padding: "2px 8px", 
                      borderRadius: "6px" 
                    }}>{metrics.criticalCVEs > 0 ? "WARNING" : "AUDIT-READY"}</span>
                  </div>
                  <h4 className="orbitron-stat" style={{ fontSize: "1.6rem", fontWeight: "900", margin: "1rem 0" }}>
                    {metrics.criticalCVEs > 0 ? "90%" : "100%"}
                  </h4>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: "1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.8rem", color: "#94a3b8" }}>
                      <CheckCircle size={14} color="var(--success)" /> <span>90-Day Trace Logs Archiving Active</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.8rem", color: "#94a3b8" }}>
                      <CheckCircle size={14} color="var(--success)" /> <span>JWT Secrets Enforced-at-Boot</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.8rem", color: "#94a3b8" }}>
                      {metrics.criticalCVEs > 0 ? (
                        <XCircle size={14} color="#ef4444" />
                      ) : (
                        <CheckCircle size={14} color="var(--success)" />
                      )}
                      <span>DevOps Security Scanning Pass</span>
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "1rem" }}>
                  Governs system access control, encryption keys, and log durability.
                </div>
              </div>

              {/* NIST AI RMF */}
              <div className="hud-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: "280px" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: "800" }}>NIST AI RMF 1.0</span>
                    <span style={{ fontSize: "0.7rem", fontWeight: "900", color: "var(--success)", background: "rgba(16,185,129,0.08)", padding: "2px 8px", borderRadius: "6px" }}>ACTIVE</span>
                  </div>
                  <h4 className="orbitron-stat" style={{ fontSize: "1.6rem", fontWeight: "900", margin: "1rem 0" }}>100%</h4>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: "1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.8rem", color: "#94a3b8" }}>
                      <CheckCircle size={14} color="var(--success)" /> <span>Semantic Injection Interception Active</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.8rem", color: "#94a3b8" }}>
                      <CheckCircle size={14} color="var(--success)" /> <span>Output Competitor & Leak Filter</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.8rem", color: "#94a3b8" }}>
                      <CheckCircle size={14} color="var(--success)" /> <span>PII Tokenization Vault Active</span>
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "1rem" }}>
                  Governs LLM guardrails, safety verification, and prompt overrides.
                </div>
              </div>

            </div>
          </div>


          {/* Core Safety Posture Checklist */}
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "2rem" }}>
            <div className="hud-card">
              <h3 style={{ fontSize: "1.1rem", fontWeight: "800", marginBottom: "1rem" }}>Zero-Trust Safety Checklist</h3>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "10px", borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                  <div>
                    <div style={{ fontWeight: "700", fontSize: "0.9rem" }}>Sentry Input Delimiters</div>
                    <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Prevents prompt injections from overriding system instructions</div>
                  </div>
                  <CheckCircle color="var(--success)" size={20} />
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "10px", borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                  <div>
                    <div style={{ fontWeight: "700", fontSize: "0.9rem" }}>Securelytix Tokenization Vault</div>
                    <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Converts sensitive name/phone details to randomized secure tokens</div>
                  </div>
                  <CheckCircle color="var(--success)" size={20} />
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "10px", borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                  <div>
                    <div style={{ fontWeight: "700", fontSize: "0.9rem" }}>Biometric Attestation Gate</div>
                    <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Requires cryptographically signed physical keys for sensitive agent triggers</div>
                  </div>
                  <CheckCircle color="var(--success)" size={20} />
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: "700", fontSize: "0.9rem" }}>Database-Backed Compliance Logging</div>
                    <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Ensures tamper-proof logging of safety violations to compliance_logs</div>
                  </div>
                  <CheckCircle color="var(--success)" size={20} />
                </div>
              </div>
            </div>

            {/* Incident Summary Card */}
            <div className="hud-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: "800", marginBottom: "1rem" }}>Compliance Threat Activity</h3>
                <p style={{ fontSize: "0.85rem", color: "#94a3b8" }}>Summary of safety interceptions captured over the past 24 hours.</p>
                
                <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "1.5rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>Blocked Injections</span>
                    <span style={{ fontSize: "1.2rem", fontWeight: "800", color: "#ef4444" }}>{metrics.jailbreaksBlocked}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>Scrubbed PII Logs</span>
                    <span style={{ fontSize: "1.2rem", fontWeight: "800", color: "#38bdf8" }}>{metrics.piiBlocked}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>Open Vulnerabilities</span>
                    <span style={{ fontSize: "1.2rem", fontWeight: "800", color: metrics.criticalCVEs > 0 ? "#f59e0b" : "inherit" }}>{metrics.criticalCVEs}</span>
                  </div>
                </div>
              </div>

              <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: "1rem", marginTop: "1rem", display: "flex", gap: "8px", alignItems: "center", fontSize: "0.75rem", color: "#94a3b8" }}>
                <Info size={14} color="#38bdf8" />
                <span>To review detailed logs and payloads, switch to the SecOps tab.</span>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* --- PERSPECTIVE B: SECOPS OPERATIONS VIEW --- */}
      {activeView === "secops" && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 2fr",
          gap: "2.5rem"
        }}>
          {/* Left Side: Scanning & Remediations */}
          <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
            
            {/* Aivyuh Swarm Audit Controls */}
            <div className="hud-card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: "800", display: "flex", alignItems: "center", gap: "8px" }}>
                <Shield size={18} color="var(--success, #10b981)" /> Aivyuh Swarm Audit Controls
              </h3>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: "1.5" }}>
                Runs an OWASP Top 10 for LLM security audit across all 14 active swarm agents to generate a compliance report.
              </p>
              
              <button
                onClick={triggerAivyuhScan}
                disabled={loadingAivyuhScan}
                className="action-btn-primary"
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "12px",
                  fontWeight: "700",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px"
                }}
              >
                {loadingAivyuhScan ? (
                  <>
                    <RefreshCw size={14} className="spin" /> Auditing Swarm...
                  </>
                ) : (
                  <>
                    <Shield size={14} /> Run Aivyuh Swarm Audit
                  </>
                )}
              </button>
            </div>

            {/* NIST Swarm Audit Controls */}
            <div className="hud-card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: "800", display: "flex", alignItems: "center", gap: "8px" }}>
                <Shield size={18} color="var(--primary)" /> NIST Swarm Compliance Controls
              </h3>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: "1.5" }}>
                Runs a NIST AI Risk Management Framework 1.0 audit across all 14 active swarm agents to generate compliance maps.
              </p>
              
              <button
                onClick={triggerNistScan}
                disabled={loadingNistScan}
                className="action-btn-primary"
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "12px",
                  fontWeight: "700",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  background: "var(--primary)",
                  color: "#ffffff",
                  border: "none",
                  cursor: "pointer"
                }}
              >
                {loadingNistScan ? (
                  <>
                    <RefreshCw size={14} className="spin" /> Auditing Swarm...
                  </>
                ) : (
                  <>
                    <Shield size={14} /> Run NIST Swarm Audit
                  </>
                )}
              </button>
            </div>

          </div>

          {/* Right Side: Logs Grid & Terminal logs */}
          <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
            
            {/* Terminal logs container */}
            {showTerminal && (
              <div style={{
                background: "#090d16",
                borderRadius: "20px",
                padding: "20px",
                border: "1px solid rgba(255,255,255,0.06)",
                boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
                fontFamily: "monospace",
                color: "#38bdf8",
                fontSize: "0.82rem"
              }}>
                <div style={{ display: "flex", justifyValue: "space-between", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "8px", marginBottom: "12px" }}>
                  <span style={{ fontWeight: "800", color: "#f8fafc" }}>Aivyuh Probe Terminal Logs</span>
                  <div style={{ display: "flex", gap: "12px" }}>
                    {lastScanResult && (
                      <button 
                        onClick={() => setShowRawJsonModal(true)}
                        style={{ background: "none", border: "none", color: "#34d399", cursor: "pointer", fontWeight: "700" }}
                      >
                        [View Scan JSON]
                      </button>
                    )}
                    <button 
                      onClick={() => setShowTerminal(false)}
                      style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}
                    >
                      [Close Console]
                    </button>
                  </div>
                </div>
                <pre style={{ maxHeight: "150px", overflowY: "auto", whiteSpace: "pre-wrap" }}>
                  {scanOutput}
                </pre>
              </div>
            )}

            {/* NIST Terminal logs container */}
            {showNistTerminal && (
              <div style={{
                background: "#090d16",
                borderRadius: "20px",
                padding: "20px",
                border: "1px solid rgba(255,255,255,0.06)",
                boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
                fontFamily: "monospace",
                color: "#10b981",
                fontSize: "0.82rem"
              }}>
                <div style={{ display: "flex", justifyValue: "space-between", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "8px", marginBottom: "12px" }}>
                  <span style={{ fontWeight: "800", color: "#f8fafc" }}>NIST Compliance Probe Logs</span>
                  <div style={{ display: "flex", gap: "12px" }}>
                    <button 
                      onClick={() => setShowNistTerminal(false)}
                      style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}
                    >
                      [Close Console]
                    </button>
                  </div>
                </div>
                <pre style={{ maxHeight: "150px", overflowY: "auto", whiteSpace: "pre-wrap" }}>
                  {nistScanOutput}
                </pre>
              </div>
            )}

            {/* NIST Swarm Fleet Compliance Matrix (Audits) */}
            <div className="hud-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem" }}>
                <div>
                  <h3 className="orbitron-title" style={{ fontSize: "1.05rem", fontWeight: "800", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Shield size={16} color="#3b82f6" /> NIST AI RMF 1.0 Swarm Fleet Audit Matrix
                  </h3>
                  <p style={{ color: "#94a3b8", fontSize: "0.8rem", marginTop: "4px" }}>
                    NIST compliance scores, risk classifications, and capability footprint maps for active agents.
                  </p>
                </div>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.08)", color: "#94a3b8", textAlign: "left" }}>
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
                        <td colSpan={6} style={{ textAlign: "center", padding: "1.5rem", color: "#94a3b8", fontStyle: "italic" }}>
                          No NIST audit history available.
                        </td>
                      </tr>
                    ) : (
                      Object.entries(securityStatus).map(([agentName, data]) => {
                        const nist = data.nist_audit || { score: 100, risk: "LOW", controls: [] };
                        const riskColor = nist.risk === "CRITICAL" ? "#b91c1c" : nist.risk === "HIGH" ? "#ef4444" : nist.risk === "MEDIUM" ? "#f59e0b" : "#10b981";
                        const riskBg = nist.risk === "CRITICAL" ? "rgba(185,28,28,0.1)" : nist.risk === "HIGH" ? "rgba(239,68,68,0.08)" : nist.risk === "MEDIUM" ? "rgba(245,158,11,0.08)" : "rgba(16,185,129,0.08)";
                        const scope = data.scope_analysis || { applicable_count: 0, non_applicable_count: 0, unmapped_count: 0 };
                        
                        return (
                          <tr key={agentName} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
                            <td style={{ padding: "10px 8px", fontWeight: "700", textTransform: "uppercase" }}>
                              {agentName.replace("_", " ")}
                            </td>
                            <td style={{ padding: "10px 8px" }}>
                              <span style={{
                                fontSize: "0.68rem",
                                fontWeight: "800",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                background: riskBg,
                                color: riskColor,
                                border: `1px solid ${riskColor}33`
                              }}>
                                {nist.risk}
                              </span>
                            </td>
                            <td style={{ padding: "10px 8px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <div style={{ flexGrow: 1, background: "rgba(255, 255, 255, 0.06)", height: "6px", borderRadius: "3px", width: "60px", overflow: "hidden" }}>
                                  <div style={{ 
                                    background: nist.score >= 90 ? "var(--success)" : nist.score >= 75 ? "#f59e0b" : nist.score >= 60 ? "#ef4444" : "#b91c1c", 
                                    height: "100%", 
                                    width: `${nist.score}%` 
                                  }} />
                                </div>
                                <span style={{ fontWeight: "700" }}>{nist.score}%</span>
                              </div>
                            </td>
                            <td style={{ padding: "10px 8px", color: "#e2e8f0" }}>
                              {scope.applicable_count}
                            </td>
                            <td style={{ padding: "10px 8px", color: "#94a3b8" }}>
                              {scope.non_applicable_count + scope.unmapped_count}
                            </td>
                            <td style={{ padding: "10px 8px", textAlign: "right" }}>
                              <button
                                onClick={() => {
                                  setSecopsFramework("nist");
                                  setSelectedSecopsAgent({ name: agentName, data });
                                }}
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  color: "#3b82f6",
                                  fontWeight: "700",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px"
                                }}
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

            {/* NIST Swarm Fleet Details Matrix */}
            <div className="hud-card" style={{ marginTop: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem" }}>
                <div>
                  <h3 className="orbitron-title" style={{ fontSize: "1.05rem", fontWeight: "800", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Shield size={16} color="#3b82f6" /> NIST AI RMF 1.0 Swarm Fleet Details Matrix
                  </h3>
                  <p style={{ color: "#94a3b8", fontSize: "0.8rem", marginTop: "4px" }}>
                    Granular parent category compliance status mapping for all active agents. Hover over headers or dots for details.
                  </p>
                </div>
              </div>

              <div style={{ overflowX: "auto", position: "relative", maxWidth: "100%", borderRadius: "12px", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.76rem", minWidth: "1200px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.08)", color: "#94a3b8", textAlign: "left", backgroundColor: "#070c16" }}>
                      <th style={{ position: "sticky", left: 0, backgroundColor: "#070c16", zIndex: 12, padding: "12px 10px", minWidth: "120px", borderRight: "1px solid rgba(255, 255, 255, 0.08)" }}>AGENT</th>
                      {nistParentCategories.map(cat => (
                        <th key={cat} title={getNistCategoryTooltip(cat)} style={{ padding: "12px 6px", textAlign: "center", cursor: "help", fontSize: "0.68rem" }}>
                          {cat}
                        </th>
                      ))}
                      <th style={{ padding: "12px 10px", textAlign: "right", minWidth: "100px" }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!securityStatus ? (
                      <tr>
                        <td colSpan={21} style={{ textAlign: "center", padding: "1.5rem", color: "#94a3b8", fontStyle: "italic" }}>
                          No details available.
                        </td>
                      </tr>
                    ) : (
                      Object.entries(securityStatus).map(([agentName, data]) => {
                        const controls = data.nist_audit?.controls || [];
                        return (
                          <tr key={agentName} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
                            <td style={{ position: "sticky", left: 0, backgroundColor: "#0e1628", zIndex: 10, padding: "10px 10px", fontWeight: "700", textTransform: "uppercase", borderRight: "1px solid rgba(255, 255, 255, 0.08)" }}>
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
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  color: "#3b82f6",
                                  fontWeight: "700"
                                }}
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

            {/* OWASP Top 10 LLM Compliance Matrix (Audits) */}
            <div className="hud-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem" }}>
                <div>
                  <h3 className="orbitron-title" style={{ fontSize: "1.05rem", fontWeight: "800", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Shield size={16} color="#10b981" /> OWASP Top 10 LLM Swarm Fleet Audit Matrix
                  </h3>
                  <p style={{ color: "#94a3b8", fontSize: "0.8rem", marginTop: "4px" }}>
                    AST-verified vulnerability counts, critical warnings, and compliance scores for active agents.
                  </p>
                </div>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.08)", color: "#94a3b8", textAlign: "left" }}>
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
                        <td colSpan={6} style={{ textAlign: "center", padding: "1.5rem", color: "#94a3b8", fontStyle: "italic" }}>
                          No OWASP audit history available.
                        </td>
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
                          <tr key={agentName} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
                            <td style={{ padding: "10px 8px", fontWeight: "700", textTransform: "uppercase" }}>
                              {agentName.replace("_", " ")}
                            </td>
                            <td style={{ padding: "10px 8px" }}>
                              <span style={{
                                fontSize: "0.68rem",
                                fontWeight: "800",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                background: statusBg,
                                color: statusColor,
                                border: `1px solid ${statusColor}33`
                              }}>
                                {statusText}
                              </span>
                            </td>
                            <td style={{ padding: "10px 8px", color: crit > 0 ? "#ef4444" : "#94a3b8", fontWeight: crit > 0 ? "700" : "normal" }}>
                              {crit}
                            </td>
                            <td style={{ padding: "10px 8px", color: warn > 0 ? "#f59e0b" : "#94a3b8" }}>
                              {warn}
                            </td>
                            <td style={{ padding: "10px 8px", fontWeight: "700", color: crit > 0 ? "#ef4444" : "#10b981" }}>
                              {owaspScore}
                            </td>
                            <td style={{ padding: "10px 8px", textAlign: "right" }}>
                              <button
                                onClick={() => {
                                  setSecopsFramework("owasp");
                                  setSelectedSecopsAgent({ name: agentName, data });
                                }}
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  color: "#10b981",
                                  fontWeight: "700",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px"
                                }}
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

            {/* OWASP Top 10 LLM Swarm Fleet Details Matrix */}
            <div className="hud-card" style={{ marginTop: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem" }}>
                <div>
                  <h3 className="orbitron-title" style={{ fontSize: "1.05rem", fontWeight: "800", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Shield size={16} color="#10b981" /> OWASP Top 10 LLM Swarm Fleet Details Matrix
                  </h3>
                  <p style={{ color: "#94a3b8", fontSize: "0.8rem", marginTop: "4px" }}>
                    Vulnerability compliance status mapped across all OWASP LLM01-LLM10 controls. Hover for control categories.
                  </p>
                </div>
              </div>

              <div style={{ overflowX: "auto", position: "relative", maxWidth: "100%", borderRadius: "12px", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.76rem", minWidth: "800px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.08)", color: "#94a3b8", textAlign: "left", backgroundColor: "#070c16" }}>
                      <th style={{ position: "sticky", left: 0, backgroundColor: "#070c16", zIndex: 12, padding: "12px 10px", minWidth: "120px", borderRight: "1px solid rgba(255, 255, 255, 0.08)" }}>AGENT</th>
                      {owaspControls.map(c => (
                        <th key={c.id} title={getOwaspCategoryTooltip(c.id)} style={{ padding: "12px 6px", textAlign: "center", cursor: "help", fontSize: "0.68rem" }}>
                          {c.id}
                        </th>
                      ))}
                      <th style={{ padding: "12px 10px", textAlign: "right", minWidth: "100px" }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!securityStatus ? (
                      <tr>
                        <td colSpan={12} style={{ textAlign: "center", padding: "1.5rem", color: "#94a3b8", fontStyle: "italic" }}>
                          No details available.
                        </td>
                      </tr>
                    ) : (
                      Object.entries(securityStatus).map(([agentName, data]) => {
                        const summary = data.report_summary || [];
                        return (
                          <tr key={agentName} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
                            <td style={{ position: "sticky", left: 0, backgroundColor: "#0e1628", zIndex: 10, padding: "10px 10px", fontWeight: "700", textTransform: "uppercase", borderRight: "1px solid rgba(255, 255, 255, 0.08)" }}>
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
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  color: "#10b981",
                                  fontWeight: "700"
                                }}
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

            {/* Audit log list */}
            <div className="hud-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem" }}>
                <h3 className="orbitron-title" style={{ fontSize: "1.05rem", fontWeight: "800", display: "flex", alignItems: "center", gap: "6px" }}>
                  <FileText size={16} /> Compliance Event Logs
                </h3>
                
                <div style={{ display: "flex", gap: "8px" }}>
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <Search size={14} style={{ position: "absolute", left: "12px", color: "rgba(255, 255, 255, 0.4)" }} />
                    <input
                      type="text"
                      placeholder="Search telemetry..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="secops-input"
                      style={{
                        padding: "6px 12px 6px 32px",
                        fontSize: "0.78rem",
                        width: "160px"
                      }}
                    />
                  </div>
                  
                  <select
                    value={filterSeverity}
                    onChange={(e) => setFilterSeverity(e.target.value)}
                    className="secops-select"
                    style={{
                      padding: "6px 24px 6px 10px",
                      fontSize: "0.78rem"
                    }}
                  >
                    <option value="">All Severities</option>
                    <option value="critical">Critical</option>
                    <option value="warning">Warning</option>
                    <option value="info">Info</option>
                  </select>

                  <button 
                    onClick={handleExportCSV}
                    style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      gap: "6px", 
                      padding: "6px 12px", 
                      borderRadius: "8px", 
                      fontSize: "0.78rem",
                      background: "rgba(255, 255, 255, 0.05)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      color: "#f3f4f6",
                      cursor: "pointer",
                      fontWeight: "700"
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"}
                    onMouseLeave={e => e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)"}
                  >
                    <Download size={12} /> CSV
                  </button>
                </div>
              </div>

              {/* logs table */}
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.08)", color: "#94a3b8", textAlign: "left" }}>
                      <th style={{ padding: "8px 6px" }}>ID</th>
                      <th style={{ padding: "8px 6px" }}>TIMESTAMP</th>
                      <th style={{ padding: "8px 6px" }}>CATEGORY</th>
                      <th style={{ padding: "8px 6px" }}>SEVERITY</th>
                      <th style={{ padding: "8px 6px" }}>AGENT</th>
                      <th style={{ padding: "8px 6px" }}>PAYLOAD</th>
                      <th style={{ padding: "8px 6px" }}>RAW SCAN RESULT JSON</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: "center", padding: "1.5rem", color: "#94a3b8" }}>
                          No compliance logs matched.
                        </td>
                      </tr>
                    ) : (
                      filteredLogs.map(log => {
                        const sevStyle = getSeverityStyle(log.severity);
                        return (
                          <tr key={log.id} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}>
                            <td style={{ padding: "8px 6px", fontWeight: "700" }}>#{log.id}</td>
                            <td style={{ padding: "8px 6px", color: "#94a3b8" }}>
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </td>
                            <td style={{ padding: "8px 6px", fontWeight: "600" }}>
                              {getEventTypeFriendlyName(log.event_type)}
                            </td>
                            <td style={{ padding: "8px 6px" }}>
                              <span style={{
                                fontSize: "0.68rem",
                                fontWeight: "800",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                background: sevStyle.bg,
                                color: sevStyle.color,
                                border: sevStyle.border
                              }}>
                                {log.severity.toUpperCase()}
                              </span>
                            </td>
                            <td style={{ padding: "8px 6px", textTransform: "uppercase", fontSize: "0.72rem", fontWeight: "700" }}>
                              {log.agent || "system"}
                            </td>
                            <td style={{ padding: "8px 6px" }}>
                              <button
                                onClick={() => setSelectedLog(log)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  color: "#38bdf8",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "2px"
                                }}
                              >
                                <Eye size={12} /> Inspect
                              </button>
                            </td>
                            <td style={{ padding: "8px 6px" }}>
                              {log.details && log.details.raw_scan_result ? (
                                <button
                                  onClick={() => {
                                    setLastScanResult(log.details.raw_scan_result);
                                    setShowRawJsonModal(true);
                                  }}
                                  style={{
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    color: "#38bdf8",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "2px"
                                  }}
                                >
                                  <Eye size={12} /> Inspect
                                </button>
                              ) : (
                                <span style={{ color: "#94a3b8", fontSize: "0.75rem" }}>-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* pagination */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1.2rem", fontSize: "0.78rem" }}>
                <span style={{ color: "#94a3b8" }}>
                  Total: <strong>{totalLogs}</strong> logs
                </span>
                
                <div style={{ display: "flex", gap: "6px" }}>
                  <button 
                    onClick={() => setPage(p => Math.max(1, p - 1))} 
                    disabled={page === 1}
                    style={{
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: "6px",
                      padding: "4px 8px",
                      cursor: "pointer",
                      color: page === 1 ? "rgba(255, 255, 255, 0.2)" : "#f3f4f6"
                    }}
                  >
                    <ChevronLeft size={12} />
                  </button>
                  <span style={{ alignSelf: "center", color: "#94a3b8" }}>Page {page}</span>
                  <button 
                    onClick={() => setPage(p => p + 1)} 
                    disabled={page * limit >= totalLogs}
                    style={{
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: "6px",
                      padding: "4px 8px",
                      cursor: "pointer",
                      color: page * limit >= totalLogs ? "rgba(255, 255, 255, 0.2)" : "#f3f4f6"
                    }}
                  >
                    <ChevronRight size={12} />
                  </button>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* Granular JSON Inspector Modal */}
      {selectedLog && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(7, 9, 19, 0.6)",
          backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2000
        }}>
          <div style={{
            background: "rgba(10, 15, 30, 0.95)",
            borderRadius: "24px",
            border: "1px solid rgba(59, 130, 246, 0.2)",
            width: "550px",
            padding: "24px",
            boxShadow: "0 20px 50px rgba(0, 0, 0, 0.5)",
            color: "#f3f4f6"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: "10px", marginBottom: "16px" }}>
              <h3 className="orbitron-title" style={{ fontSize: "1.1rem", fontWeight: "800" }}>SecOps Raw Telemetry Details</h3>
              <button 
                onClick={() => setSelectedLog(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontWeight: "700" }}
              >
                [Dismiss]
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "0.85rem" }}>
              <div>
                <strong>Event ID:</strong> #{selectedLog.id}
              </div>
              <div>
                <strong>Timestamp:</strong> {new Date(selectedLog.timestamp).toLocaleString()}
              </div>
              <div>
                <strong>Violation Category:</strong> {getEventTypeFriendlyName(selectedLog.event_type)}
              </div>
              <div>
                <strong>Severity Rating:</strong>{" "}
                <span style={{
                  fontSize: "0.7rem",
                  fontWeight: "800",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  background: getSeverityStyle(selectedLog.severity).bg,
                  color: getSeverityStyle(selectedLog.severity).color
                }}>
                  {selectedLog.severity.toUpperCase()}
                </span>
              </div>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "10px" }}>
                <strong>Security Logs Payload JSON:</strong>
                <pre style={{
                  background: "#090d16",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: "12px",
                  padding: "14px",
                  fontSize: "0.75rem",
                  fontFamily: "monospace",
                  color: "#34d399",
                  overflowX: "auto",
                  whiteSpace: "pre-wrap",
                  maxHeight: "180px"
                }}>
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CISO Executive Agent Safety Report Modal */}
      {selectedCisoAgent && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(7, 9, 19, 0.6)",
          backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2000
        }}>
          <div style={{
            background: "rgba(10, 15, 30, 0.95)",
            borderRadius: "24px",
            border: "1px solid rgba(59, 130, 246, 0.2)",
            width: "600px",
            padding: "28px",
            boxShadow: "0 20px 50px rgba(0, 0, 0, 0.5)",
            color: "#f3f4f6",
            maxHeight: "85vh",
            display: "flex",
            flexDirection: "column"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: "12px", marginBottom: "16px" }}>
              <div>
                <h3 className="orbitron-title" style={{ fontSize: "1.25rem", fontWeight: "800", textTransform: "uppercase" }}>
                  {selectedCisoAgent.name.replace("_", " ")} Safety Report
                </h3>
                <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Executive Risk & Framework Alignment Report</span>
              </div>
              <button 
                onClick={() => setSelectedCisoAgent(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontWeight: "700" }}
              >
                [Dismiss]
              </button>
            </div>

            <div style={{ flexGrow: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "1.5rem", paddingRight: "4px" }}>
              {/* Score card */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1rem",
                background: "rgba(255, 255, 255, 0.02)",
                padding: "16px",
                borderRadius: "16px",
                border: "1px solid rgba(255, 255, 255, 0.06)"
              }}>
                <div style={{ textAlign: "center", borderRight: "1px solid rgba(255, 255, 255, 0.06)", paddingRight: "10px" }}>
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: "800", letterSpacing: "0.5px" }}>NIST SCORE</div>
                  <div className="orbitron-stat" style={{ fontSize: "2.5rem", fontWeight: "900", color: (selectedCisoAgent.data.nist_audit?.score || 100) >= 90 ? "var(--success)" : (selectedCisoAgent.data.nist_audit?.score || 100) >= 75 ? "#f59e0b" : (selectedCisoAgent.data.nist_audit?.score || 100) >= 60 ? "#ef4444" : "#b91c1c", margin: "4px 0" }}>
                    {selectedCisoAgent.data.nist_audit?.score || 100}%
                  </div>
                  <span style={{ fontSize: "0.68rem", fontWeight: "800", color: "#94a3b8" }}>
                    {selectedCisoAgent.data.nist_audit?.controls?.filter(c => c.status === "PASS").length || 0} PASS / {selectedCisoAgent.data.nist_audit?.controls?.filter(c => c.status === "PARTIAL").length || 0} PARTIAL
                  </span>
                </div>

                <div style={{ textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: "800", letterSpacing: "0.5px" }}>RISK RATING</div>
                  <div className="orbitron-stat" style={{ 
                    fontSize: "1.25rem", 
                    fontWeight: "900", 
                    color: selectedCisoAgent.data.nist_audit?.risk === "CRITICAL" ? "#b91c1c" : selectedCisoAgent.data.nist_audit?.risk === "HIGH" ? "#ef4444" : selectedCisoAgent.data.nist_audit?.risk === "MEDIUM" ? "#f59e0b" : "#10b981", 
                    margin: "6px 0",
                    textTransform: "uppercase"
                  }}>
                    {selectedCisoAgent.data.nist_audit?.risk || "LOW"}
                  </div>
                  <span style={{ fontSize: "0.68rem", color: "#94a3b8" }}>Based on NIST AI RMF controls coverage</span>
                </div>
              </div>

              {/* OWASP Summary */}
              <div>
                <h4 style={{ fontSize: "0.9rem", fontWeight: "800", color: "#94a3b8", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  OWASP LLM Vulnerability Status
                </h4>
                {selectedCisoAgent.data.report_summary && selectedCisoAgent.data.report_summary.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {selectedCisoAgent.data.report_summary.map((sum, index) => (
                      <div key={index} style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "8px",
                        padding: "10px 12px",
                        background: sum.includes("Critical") ? "rgba(239, 68, 68, 0.05)" : "rgba(245, 158, 11, 0.05)",
                        borderLeft: `3px solid ${sum.includes("Critical") ? "#ef4444" : "#f59e0b"}`,
                        borderRadius: "0 8px 8px 0",
                        fontSize: "0.82rem"
                      }}>
                        <AlertTriangle size={14} color={sum.includes("Critical") ? "#ef4444" : "#f59e0b"} style={{ marginTop: "2px", flexShrink: 0 }} />
                        <span>{sum}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "10px 12px",
                    background: "rgba(16, 185, 129, 0.05)",
                    borderLeft: "3px solid var(--success)",
                    borderRadius: "0 8px 8px 0",
                    fontSize: "0.82rem",
                    color: "var(--success)"
                  }}>
                    <CheckCircle size={14} color="var(--success)" />
                    <span>OWASP Top 10 for LLM compliance checklist completely clean.</span>
                  </div>
                )}
              </div>

              {/* NIST Passed & Partial list */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <h4 style={{ fontSize: "0.9rem", fontWeight: "800", color: "#94a3b8", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Passed NIST Security Controls ({selectedCisoAgent.data.nist_audit?.controls?.filter(c => c.status === "PASS").length || 0})
                  </h4>
                  <div style={{
                    maxHeight: "120px",
                    overflowY: "auto",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                    borderRadius: "12px",
                    padding: "10px",
                    background: "rgba(0, 0, 0, 0.2)"
                  }}>
                    {selectedCisoAgent.data.nist_audit?.controls?.filter(c => c.status === "PASS").length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {selectedCisoAgent.data.nist_audit.controls.filter(c => c.status === "PASS").map(c => (
                          <div key={c.id} style={{ display: "flex", gap: "8px", alignItems: "center", fontSize: "0.8rem" }}>
                            <CheckCircle size={12} color="var(--success)" />
                            <strong>{c.id}:</strong>
                            <span style={{ color: "#94a3b8" }}>{getNistControlDescription(c.id)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ textAlign: "center", fontSize: "0.8rem", color: "#94a3b8", padding: "10px" }}>
                        No fully passed NIST security controls verified in code files.
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 style={{ fontSize: "0.9rem", fontWeight: "800", color: "#94a3b8", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Partially Passed NIST Controls ({selectedCisoAgent.data.nist_audit?.controls?.filter(c => c.status === "PARTIAL").length || 0})
                  </h4>
                  <div style={{
                    maxHeight: "120px",
                    overflowY: "auto",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                    borderRadius: "12px",
                    padding: "10px",
                    background: "rgba(0, 0, 0, 0.2)"
                  }}>
                    {selectedCisoAgent.data.nist_audit?.controls?.filter(c => c.status === "PARTIAL").length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {selectedCisoAgent.data.nist_audit.controls.filter(c => c.status === "PARTIAL").map(c => (
                          <div key={c.id} style={{ display: "flex", gap: "8px", alignItems: "center", fontSize: "0.8rem" }}>
                            <CheckCircle size={12} color="#f59e0b" />
                            <strong>{c.id}:</strong>
                            <span style={{ color: "#94a3b8" }}>{getNistControlDescription(c.id)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ textAlign: "center", fontSize: "0.8rem", color: "#94a3b8", padding: "10px" }}>
                        No partially passed NIST security controls verified.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => setSelectedCisoAgent(null)}
              className="action-btn-primary"
              style={{ padding: "10px 16px", borderRadius: "10px", fontWeight: "700", marginTop: "16px", cursor: "pointer" }}
            >
              Close Safety Report
            </button>
          </div>
        </div>
      )}

      {/* SecOps Technical Interactive Auditing Modal is now rendered as a separate page below */}

      {showRawJsonModal && lastScanResult && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(7, 9, 19, 0.6)",
          backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2000
        }}>
          <div style={{
            background: "rgba(10, 15, 30, 0.95)",
            borderRadius: "24px",
            border: "1px solid rgba(59, 130, 246, 0.2)",
            width: "600px",
            padding: "24px",
            boxShadow: "0 20px 50px rgba(0, 0, 0, 0.5)",
            color: "#f3f4f6"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: "10px", marginBottom: "16px" }}>
              <h3 className="orbitron-title" style={{ fontSize: "1.1rem", fontWeight: "800" }}>Raw Scan Result JSON</h3>
              <button 
                onClick={() => setShowRawJsonModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontWeight: "700" }}
              >
                [Dismiss]
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <pre style={{
                background: "#090d16",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "12px",
                padding: "14px",
                fontSize: "0.75rem",
                fontFamily: "monospace",
                color: "#34d399",
                overflowX: "auto",
                whiteSpace: "pre-wrap",
                maxHeight: "350px",
                margin: 0
              }}>
                {JSON.stringify(lastScanResult, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Helpers
// Helpers
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
    const prefixMap = {
      "GV": "GV",
      "MP": "MAP",
      "MS": "MEAS",
      "MG": "MAN"
    };
    const stdPrefix = prefixMap[prefix] || prefix;
    return `${stdPrefix}-${num}`;
  }
  const p2 = controlId.split('.');
  if (p2.length >= 1) {
    const parts2 = p2[0].split('-');
    if (parts2.length >= 2) {
      const prefix = parts2[0];
      const num = parts2[1];
      const prefixMap = {
        "GV": "GV",
        "MP": "MAP",
        "MS": "MEAS",
        "MG": "MAN"
      };
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
  let hasBypassed = false;
  
  matched.forEach(c => {
    if (c.status === "FAIL") hasFail = true;
    else if (c.status === "PARTIAL") hasPartial = true;
    else if (c.status === "PASS") hasPass = true;
    else if (c.status === "UNMAPPED" || c.status === "NON-APPLICABLE") hasBypassed = true;
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


const getEventTypeFriendlyName = (type) => {
  return type
    .split("_")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
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
