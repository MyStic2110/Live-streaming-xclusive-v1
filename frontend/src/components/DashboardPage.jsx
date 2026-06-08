import React, { useState, useEffect } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { setupPageAEO, cleanupPageAEO } from "../utils/aeo";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const API = import.meta.env.VITE_API_URL || "";

const CollapsiblePre = ({ children, ...props }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Extract raw text recursively to count lines
  const getRawText = (nodes) => {
    if (!nodes) return "";
    return React.Children.toArray(nodes)
      .map(child => {
        if (typeof child === "string") return child;
        if (child?.props?.children) return getRawText(child.props.children);
        return "";
      })
      .join("");
  };

  const rawText = getRawText(children);
  const lineCount = rawText.split("\n").filter(Boolean).length;

  if (lineCount <= 5) {
    return (
      <pre 
        style={{ 
          backgroundColor: "#020617", 
          border: "1px solid rgba(255,255,255,0.08)", 
          borderRadius: "12px", 
          padding: "14px", 
          overflowX: "auto", 
          margin: "14px 0",
          fontFamily: "'JetBrains Mono', monospace",
          color: "#cbd5e1"
        }} 
        {...props}
      >
        {children}
      </pre>
    );
  }

  return (
    <div style={{
      border: "1px solid rgba(255, 255, 255, 0.08)",
      borderRadius: "12px",
      margin: "14px 0",
      backgroundColor: "#030712",
      overflow: "hidden",
      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)"
    }}>
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 16px",
          backgroundColor: "#0f172a",
          cursor: "pointer",
          userSelect: "none",
          borderBottom: isExpanded ? "1px solid rgba(255,255,255,0.08)" : "none",
          transition: "background-color 0.2s"
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#1e293b"}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#0f172a"}
      >
        <span style={{ fontSize: "0.85rem", color: "#38bdf8", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px" }}>
          🖥️ Diagnostics Log Output ({lineCount} lines)
        </span>
        <span style={{ fontSize: "0.75rem", color: "#94a3b8", display: "flex", alignItems: "center", gap: "4px" }}>
          {isExpanded ? "Click to collapse ▲" : "Click to expand ▼"}
        </span>
      </div>
      {isExpanded && (
        <pre 
          style={{ 
            backgroundColor: "#020617", 
            padding: "14px", 
            overflowX: "auto", 
            margin: 0,
            maxHeight: "350px",
            overflowY: "auto",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "0.85rem",
            color: "#cbd5e1"
          }} 
          {...props}
        >
          {children}
        </pre>
      )}
    </div>
  );
};

function DashboardPage({ onBack }) {
  const [traces, setTraces] = useState([]);
  const [filter, setFilter] = useState("all");
  const [expandedTrace, setExpandedTrace] = useState(null);
  const [hallucinationResults, setHallucinationResults] = useState({});
  const [evaluating, setEvaluating] = useState({}); // run_id -> true/false

  // Fetch initial traces and connect to socket.io
  useEffect(() => {
    const fetchTraces = async () => {
      try {
        const res = await axios.get(`${API}/api/llm-traces`);
        if (res.data) {
          setTraces(res.data);
        }
      } catch (err) {
        console.error("Failed to load initial LLM traces:", err);
      }
    };

    fetchTraces();

    // Hydrate hallucination results
    axios.get(`${API}/api/hallucination-results`).then(res => {
      if (res.data) setHallucinationResults(res.data);
    }).catch(() => {});

    // Setup socket connection
    const socket = io(API || "http://localhost:5000");
    
    socket.on("llm_trace", ({ event, run_id, data }) => {
      setTraces(prevTraces => {
        const list = [...prevTraces];
        const index = list.findIndex(t => t.run_id === run_id);

        if (event === "llm_start") {
          if (index === -1) {
            const newTrace = {
              run_id,
              agent: data.agent || null,
              model: data.model,
              inputs: data.inputs,
              outputs: "",
              prompt_tokens: 0,
              completion_tokens: 0,
              input_cost: 0,
              output_cost: 0,
              stt_cost: data.stt_cost || 0,
              tts_cost: data.tts_cost || 0,
              llm_cost: data.llm_cost || 0,
              total_cost: data.total_cost || 0,
              
              cum_prompt_tokens: data.cum_prompt_tokens || 0,
              cum_completion_tokens: data.cum_completion_tokens || 0,
              cum_input_cost: data.cum_input_cost || 0,
              cum_output_cost: data.cum_output_cost || 0,
              cum_stt_cost: data.cum_stt_cost || 0,
              cum_tts_cost: data.cum_tts_cost || 0,
              cum_total_cost: data.cum_total_cost || 0,
              
              status: "streaming",
              timestamp: new Date().toISOString(),
              total_latency: 0,
              ttft: 0,
              tool_latency: 0,
              otps: 0,
              tool_calls: []
            };
            return [newTrace, ...list];
          }
        } else if (event === "llm_chunk") {
          if (index !== -1) {
            list[index] = { 
              ...list[index], 
              outputs: list[index].outputs + data.chunk,
              stt_cost: data.stt_cost !== undefined ? data.stt_cost : list[index].stt_cost,
              tts_cost: data.tts_cost !== undefined ? data.tts_cost : list[index].tts_cost,
              llm_cost: data.llm_cost !== undefined ? data.llm_cost : list[index].llm_cost,
              total_cost: data.total_cost !== undefined ? data.total_cost : list[index].total_cost,
              
              cum_prompt_tokens: data.cum_prompt_tokens !== undefined ? data.cum_prompt_tokens : list[index].cum_prompt_tokens,
              cum_completion_tokens: data.cum_completion_tokens !== undefined ? data.cum_completion_tokens : list[index].cum_completion_tokens,
              cum_input_cost: data.cum_input_cost !== undefined ? data.cum_input_cost : list[index].cum_input_cost,
              cum_output_cost: data.cum_output_cost !== undefined ? data.cum_output_cost : list[index].cum_output_cost,
              cum_stt_cost: data.cum_stt_cost !== undefined ? data.cum_stt_cost : list[index].cum_stt_cost,
              cum_tts_cost: data.cum_tts_cost !== undefined ? data.cum_tts_cost : list[index].cum_tts_cost,
              cum_total_cost: data.cum_total_cost !== undefined ? data.cum_total_cost : list[index].cum_total_cost
            };
            return list;
          }
        } else if (event === "llm_end") {
          if (index !== -1) {
            list[index] = {
              ...list[index],
              outputs: data.outputs,
              prompt_tokens: data.prompt_tokens,
              completion_tokens: data.completion_tokens,
              input_cost: data.input_cost,
              output_cost: data.output_cost,
              stt_cost: data.stt_cost !== undefined ? data.stt_cost : list[index].stt_cost || 0,
              tts_cost: data.tts_cost !== undefined ? data.tts_cost : list[index].tts_cost || 0,
              llm_cost: data.llm_cost !== undefined ? data.llm_cost : (data.input_cost + data.output_cost) || 0,
              total_cost: data.total_cost !== undefined ? data.total_cost : list[index].total_cost,
              
              cum_prompt_tokens: data.cum_prompt_tokens !== undefined ? data.cum_prompt_tokens : list[index].cum_prompt_tokens || 0,
              cum_completion_tokens: data.cum_completion_tokens !== undefined ? data.cum_completion_tokens : list[index].cum_completion_tokens || 0,
              cum_input_cost: data.cum_input_cost !== undefined ? data.cum_input_cost : list[index].cum_input_cost || 0,
              cum_output_cost: data.cum_output_cost !== undefined ? data.cum_output_cost : list[index].cum_output_cost || 0,
              cum_stt_cost: data.cum_stt_cost !== undefined ? data.cum_stt_cost : list[index].cum_stt_cost || 0,
              cum_tts_cost: data.cum_tts_cost !== undefined ? data.cum_tts_cost : list[index].cum_tts_cost || 0,
              cum_total_cost: data.cum_total_cost !== undefined ? data.cum_total_cost : list[index].cum_total_cost || 0,
              
              agent: data.agent || list[index].agent,
              status: "completed",
              total_latency: data.total_latency || list[index].total_latency || 0,
              ttft: data.ttft || list[index].ttft || 0,
              tool_latency: data.tool_latency || list[index].tool_latency || 0,
              otps: data.otps || list[index].otps || 0
            };
            return list;
          }
        } else if (event === "llm_error") {
          if (index !== -1) {
            list[index] = {
              ...list[index],
              status: "failed",
              error_code: data.error_code || "UNKNOWN_ERROR",
              error_message: data.error_message || "An error occurred during generation",
              total_latency: data.total_latency || list[index].total_latency || 0,
              agent: data.agent || list[index].agent,
              stt_cost: data.stt_cost !== undefined ? data.stt_cost : list[index].stt_cost || 0,
              tts_cost: data.tts_cost !== undefined ? data.tts_cost : list[index].tts_cost || 0,
              llm_cost: data.llm_cost !== undefined ? data.llm_cost : list[index].llm_cost || 0,
              total_cost: data.total_cost !== undefined ? data.total_cost : list[index].total_cost,
              
              cum_prompt_tokens: data.cum_prompt_tokens !== undefined ? data.cum_prompt_tokens : list[index].cum_prompt_tokens || 0,
              cum_completion_tokens: data.cum_completion_tokens !== undefined ? data.cum_completion_tokens : list[index].cum_completion_tokens || 0,
              cum_input_cost: data.cum_input_cost !== undefined ? data.cum_input_cost : list[index].cum_input_cost || 0,
              cum_output_cost: data.cum_output_cost !== undefined ? data.cum_output_cost : list[index].cum_output_cost || 0,
              cum_stt_cost: data.cum_stt_cost !== undefined ? data.cum_stt_cost : list[index].cum_stt_cost || 0,
              cum_tts_cost: data.cum_tts_cost !== undefined ? data.cum_tts_cost : list[index].cum_tts_cost || 0,
              cum_total_cost: data.cum_total_cost !== undefined ? data.cum_total_cost : list[index].cum_total_cost || 0,
            };
            return list;
          } else {
            const newTrace = {
              run_id,
              agent: data.agent || null,
              model: "unknown",
              inputs: [],
              outputs: "",
              prompt_tokens: 0,
              completion_tokens: 0,
              input_cost: 0,
              output_cost: 0,
              stt_cost: data.stt_cost || 0,
              tts_cost: data.tts_cost || 0,
              llm_cost: data.llm_cost || 0,
              total_cost: data.total_cost || 0,
              
              cum_prompt_tokens: data.cum_prompt_tokens || 0,
              cum_completion_tokens: data.cum_completion_tokens || 0,
              cum_input_cost: data.cum_input_cost || 0,
              cum_output_cost: data.cum_output_cost || 0,
              cum_stt_cost: data.cum_stt_cost || 0,
              cum_tts_cost: data.cum_tts_cost || 0,
              cum_total_cost: data.cum_total_cost || 0,
              
              status: "failed",
              error_code: data.error_code || "UNKNOWN_ERROR",
              error_message: data.error_message || "An error occurred",
              timestamp: new Date().toISOString(),
              total_latency: data.total_latency || 0,
              ttft: 0,
              tool_latency: 0,
              otps: 0,
              tool_calls: []
            };
            return [newTrace, ...list];
          }
        } else if (event === "tool_call") {
          if (index !== -1) {
            const trace = { ...list[index] };
            if (!trace.tool_calls) trace.tool_calls = [];
            trace.tool_calls = [...trace.tool_calls, { name: data.name, duration: data.duration }];
            trace.tool_latency = (trace.tool_latency || 0) + data.duration;
            list[index] = trace;
            return list;
          }
        }
        return prevTraces;
      });
    });

    socket.on("hallucination_result", (result) => {
      setHallucinationResults(prev => ({ ...prev, [result.run_id]: result }));
    });

    socket.on("llm_trace_clear", () => {
      setTraces([]);
      setHallucinationResults({});
    });

    return () => { socket.disconnect(); };
  }, []);

  // Set AEO metadata for Answer Engines
  useEffect(() => {
    setupPageAEO({
      title: "Real-time LLM Telemetry Dashboard | Swarm Lab",
      description: "Fleet-wide LLM token tracking, prompt logs, and real-time cost telemetry dashboard.",
      url: window.location.href,
      schemaId: "llm-dashboard-aeo",
      schemaData: {}
    });
    return () => cleanupPageAEO("llm-dashboard-aeo");
  }, []);

  // Calculate high-level stats
  const stats = React.useMemo(() => {
    let totalSpend = 0;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let completedRuns = 0;
    let sumLatency = 0;
    let sumSpeed = 0;

    const nonStreaming = traces.filter(t => t.status !== "streaming");
    const totalRequests = nonStreaming.length;

    nonStreaming.forEach(t => {
      totalSpend += (t.total_cost || 0);
      totalPromptTokens += (t.prompt_tokens || 0);
      totalCompletionTokens += (t.completion_tokens || 0);
      if (t.status === "completed") {
        completedRuns++;
        sumLatency += (t.total_latency || 0);
        sumSpeed += (t.otps || 0);
      }
    });

    return {
      totalSpend: totalSpend.toFixed(6),
      totalTokens: (totalPromptTokens + totalCompletionTokens).toLocaleString(),
      totalRequests,
      avgCost: totalRequests > 0 ? (totalSpend / totalRequests).toFixed(6) : "0.000000",
      avgLatency: completedRuns > 0 ? Math.round(sumLatency / completedRuns) : 0,
      avgSpeed: completedRuns > 0 ? Math.round(sumSpeed / completedRuns) : 0
    };
  }, [traces]);

  // Filter traces
  const filteredTraces = React.useMemo(() => {
    const nonStreaming = traces.filter(t => t.status !== "streaming");
    if (filter === "completed") return nonStreaming.filter(t => t.status === "completed");
    return nonStreaming;
  }, [traces, filter]);

  const handleEvaluate = async (trace) => {
    setEvaluating(prev => ({ ...prev, [trace.run_id]: true }));
    try {
      const res = await axios.post(`${API}/api/evaluate-hallucination`, {
        run_id: trace.run_id,
        inputs: trace.inputs,
        outputs: trace.outputs,
        model: trace.model
      });
      setHallucinationResults(prev => ({ ...prev, [trace.run_id]: res.data }));
    } catch (err) {
      console.error("Evaluation failed:", err);
      alert(`Evaluation failed: ${err.response?.data?.error || err.message}`);
    } finally {
      setEvaluating(prev => ({ ...prev, [trace.run_id]: false }));
    }
  };

  const handleClearLogs = async () => {
    if (!window.confirm("Are you sure you want to permanently delete all telemetry logs?")) return;
    try {
      await axios.delete(`${API}/api/llm-traces`);
      setTraces([]);
      setHallucinationResults({});
    } catch (err) {
      console.error("Failed to clear logs:", err);
    }
  };

  const getScoreColour = (score) => {
    if (score <= 0.20) return { fg: "#34d399", bg: "rgba(52,211,153,0.12)", label: "ACCURATE",     icon: "✓" };
    if (score <= 0.50) return { fg: "#fbbf24", bg: "rgba(251,191,36,0.12)",  label: "UNCERTAIN",    icon: "~" };
    if (score <= 0.75) return { fg: "#fb923c", bg: "rgba(251,146,60,0.12)",  label: "SUSPECT",      icon: "!" };
    return                    { fg: "#f87171", bg: "rgba(248,113,113,0.12)", label: "HALLUCINATED", icon: "✗" };
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0b0f19",
        backgroundImage: "radial-gradient(circle at 10% 20%, rgba(59, 130, 246, 0.08) 0%, transparent 45%), radial-gradient(circle at 90% 80%, rgba(139, 92, 246, 0.08) 0%, transparent 45%)",
        color: "#f1f5f9",
        fontFamily: "'Outfit', sans-serif",
        padding: "2rem 6%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: "2rem"
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          paddingBottom: "1.5rem"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <img
            src="/logo.jpeg"
            alt="Swarm Logo"
            style={{ height: "48px", width: "48px", borderRadius: "12px", objectFit: "cover", boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}
          />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "0.65rem", background: "rgba(139, 92, 246, 0.15)", color: "#a78bfa", padding: "2px 8px", borderRadius: "4px", fontWeight: "900", letterSpacing: "1.5px" }}>
                SWARM OBSERVABILITY
              </span>
              <span style={{ fontSize: "0.65rem", background: "rgba(59, 130, 246, 0.15)", color: "#60a5fa", padding: "2px 8px", borderRadius: "4px", fontWeight: "900", letterSpacing: "1px" }}>
                LLM TELEMETRY
              </span>
            </div>
            <h1 style={{ fontSize: "1.9rem", fontWeight: "800", margin: "4px 0 0 0", color: "#ffffff", letterSpacing: "-0.5px" }}>
              LLM Trace Cockpit
            </h1>
          </div>
        </div>

        <button
          onClick={onBack}
          style={{
            padding: "0.75rem 1.5rem",
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "12px",
            color: "#f8fafc",
            fontWeight: "600",
            cursor: "pointer",
            fontSize: "0.85rem",
            transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
        >
          ← Back to HQ
        </button>
      </header>

      {/* Grid of Global Stats */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.5rem" }}>
        <div style={{ background: "rgba(255,255,255,0.02)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "18px", padding: "1.5rem", display: "flex", alignItems: "center", gap: "1.2rem" }}>
          <div style={{ background: "rgba(59, 130, 246, 0.08)", color: "#60a5fa", height: "52px", width: "52px", borderRadius: "12px", display: "flex", justifyContent: "center", alignItems: "center", fontSize: "1.5rem" }}>⚡</div>
          <div>
            <div style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase" }}>Total Requests</div>
            <div style={{ fontSize: "1.8rem", fontWeight: "900", color: "#ffffff", lineHeight: "1.2" }}>{stats.totalRequests}</div>
          </div>
        </div>

        <div style={{ background: "rgba(255,255,255,0.02)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "18px", padding: "1.5rem", display: "flex", alignItems: "center", gap: "1.2rem" }}>
          <div style={{ background: "rgba(16, 185, 129, 0.08)", color: "#34d399", height: "52px", width: "52px", borderRadius: "12px", display: "flex", justifyContent: "center", alignItems: "center", fontSize: "1.5rem" }}>💵</div>
          <div>
            <div style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase" }}>Combined Spend</div>
            <div style={{ fontSize: "1.8rem", fontWeight: "900", color: "#10b981", lineHeight: "1.2", fontFamily: "monospace" }}>${stats.totalSpend}</div>
          </div>
        </div>

        <div style={{ background: "rgba(255,255,255,0.02)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "18px", padding: "1.5rem", display: "flex", alignItems: "center", gap: "1.2rem" }}>
          <div style={{ background: "rgba(139, 92, 246, 0.08)", color: "#a78bfa", height: "52px", width: "52px", borderRadius: "12px", display: "flex", justifyContent: "center", alignItems: "center", fontSize: "1.5rem" }}>📊</div>
          <div>
            <div style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase" }}>Total Tokens</div>
            <div style={{ fontSize: "1.8rem", fontWeight: "900", color: "#f8fafc", lineHeight: "1.2", fontFamily: "monospace" }}>{stats.totalTokens}</div>
          </div>
        </div>

        <div style={{ background: "rgba(255,255,255,0.02)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "18px", padding: "1.5rem", display: "flex", alignItems: "center", gap: "1.2rem" }}>
          <div style={{ background: "rgba(245, 158, 11, 0.08)", color: "#fbbf24", height: "52px", width: "52px", borderRadius: "12px", display: "flex", justifyContent: "center", alignItems: "center", fontSize: "1.5rem" }}>📈</div>
          <div>
            <div style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase" }}>Avg Cost / Run</div>
            <div style={{ fontSize: "1.8rem", fontWeight: "900", color: "#fbbf24", lineHeight: "1.2", fontFamily: "monospace" }}>${stats.avgCost}</div>
          </div>
        </div>

        <div style={{ background: "rgba(255,255,255,0.02)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "18px", padding: "1.5rem", display: "flex", alignItems: "center", gap: "1.2rem" }}>
          <div style={{ background: "rgba(239, 68, 68, 0.08)", color: "#f87171", height: "52px", width: "52px", borderRadius: "12px", display: "flex", justifyContent: "center", alignItems: "center", fontSize: "1.5rem" }}>⏱️</div>
          <div>
            <div style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase" }}>Avg Latency</div>
            <div style={{ fontSize: "1.8rem", fontWeight: "900", color: "#f87171", lineHeight: "1.2", fontFamily: "monospace" }}>{stats.avgLatency}ms</div>
          </div>
        </div>

        <div style={{ background: "rgba(255,255,255,0.02)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "18px", padding: "1.5rem", display: "flex", alignItems: "center", gap: "1.2rem" }}>
          <div style={{ background: "rgba(6, 182, 212, 0.08)", color: "#22d3ee", height: "52px", width: "52px", borderRadius: "12px", display: "flex", justifyContent: "center", alignItems: "center", fontSize: "1.5rem" }}>🚀</div>
          <div>
            <div style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase" }}>Avg Speed</div>
            <div style={{ fontSize: "1.8rem", fontWeight: "900", color: "#22d3ee", lineHeight: "1.2", fontFamily: "monospace" }}>{stats.avgSpeed} t/s</div>
          </div>
        </div>
      </section>

      {/* Filters and Controls */}
      <section style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.04)", padding: "10px 16px", borderRadius: "14px" }}>
        <div style={{ display: "flex", gap: "8px" }}>
          {["all", "completed"].map(type => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              style={{
                padding: "6px 14px",
                borderRadius: "8px",
                border: "none",
                fontWeight: "700",
                fontSize: "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                cursor: "pointer",
                background: filter === type ? "rgba(139, 92, 246, 0.2)" : "transparent",
                color: filter === type ? "#c084fc" : "#94a3b8",
                transition: "all 0.2s"
              }}
            >
              {type}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: "600" }}>
            Showing {filteredTraces.length} transaction logs
          </div>
          {traces.length > 0 && (
            <button
              onClick={handleClearLogs}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                border: "1px solid rgba(239, 68, 68, 0.25)",
                background: "rgba(239, 68, 68, 0.08)",
                color: "#f87171",
                fontWeight: "700",
                fontSize: "0.72rem",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(239, 68, 68, 0.18)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(239, 68, 68, 0.08)"; }}
            >
              🗑 Clear Telemetry Logs
            </button>
          )}
        </div>
      </section>

      {/* Live Logs Stream */}
      <section style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
        {filteredTraces.length === 0 ? (
          <div style={{ textAlign: "center", padding: "6rem", background: "rgba(255,255,255,0.01)", border: "1.5px dashed rgba(255,255,255,0.05)", borderRadius: "20px", color: "#475569" }}>
            <span style={{ fontSize: "2rem", display: "block", marginBottom: "8px" }}>📡</span>
            No traces recorded. Engage an agent to stream live telemetry.
          </div>
        ) : (
          filteredTraces.map((trace) => {
            const isStreaming = trace.status === "streaming";
            const isFailed = trace.status === "failed";
            const dateStr = new Date(trace.timestamp).toLocaleTimeString();
            const totalTokens = trace.prompt_tokens + trace.completion_tokens;
            const evalResult = hallucinationResults[trace.run_id];
            const col = evalResult ? getScoreColour(evalResult.score) : null;
            const voiceAgents = ['NOVA', 'CORTEX_BI', 'CORTEX_BI2', 'LINA', 'AIVYUH', 'ASTRA', 'MARTECH', 'OCTANE', 'SEVA', 'VONE', 'BI', 'BI2', 'CORTEX', 'CORTEX2'];
            const isVoice = trace.agent && voiceAgents.includes(trace.agent.toUpperCase());

            return (
              <div
                key={trace.run_id}
                style={{
                  background: "rgba(255,255,255,0.01)",
                  backdropFilter: "blur(16px)",
                  border: `1.5px solid ${isStreaming ? "rgba(139, 92, 246, 0.3)" : isFailed ? "rgba(239, 68, 68, 0.3)" : "rgba(255, 255, 255, 0.05)"}`,
                  borderRadius: "20px",
                  padding: "1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.2rem",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
                  transition: "border-color 0.3s ease"
                }}
              >
                {/* Trace Card Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                  {/* Left: agent, model, time, streaming badge, run id */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      {trace.agent && (
                        <span style={{ fontSize: "0.6rem", background: "rgba(139,92,246,0.12)", color: "#a78bfa", padding: "2px 7px", borderRadius: "4px", fontWeight: "800", letterSpacing: "0.5px", fontFamily: "monospace" }}>
                          {trace.agent}
                        </span>
                      )}
                      <span style={{ fontSize: "0.65rem", background: "rgba(59,130,246,0.15)", color: "#60a5fa", padding: "2px 6px", borderRadius: "4px", fontWeight: "900", fontFamily: "monospace" }}>
                        {trace.model}
                      </span>
                      <span style={{ color: "#475569", fontSize: "0.75rem" }}>•</span>
                      <span style={{ color: "#64748b", fontSize: "0.75rem", fontWeight: "600" }}>{dateStr}</span>
                      {isStreaming && (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(139,92,246,0.15)", padding: "2px 8px", borderRadius: "10px", border: "1px solid rgba(139,92,246,0.2)" }}>
                          <span className="live-dot" style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#a855f7", boxShadow: "0 0 8px #a855f7", display: "inline-block" }} />
                          <span style={{ fontSize: "0.6rem", fontWeight: "800", color: "#c084fc", letterSpacing: "0.5px" }}>STREAMING</span>
                        </div>
                      )}
                      {isFailed && (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(239, 68, 68, 0.15)", padding: "2px 8px", borderRadius: "10px", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
                          <span style={{ fontSize: "0.6rem", fontWeight: "800", color: "#f87171", letterSpacing: "0.5px" }}>FAILED: {trace.error_code}</span>
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: "0.65rem", color: "#475569", fontFamily: "monospace" }}>
                      Run ID: {trace.run_id}
                    </div>
                  </div>

                  {/* Right: tokens + cost */}
                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "0.6rem", color: "#64748b", fontWeight: "700" }}>TOKENS</div>
                      <div style={{ fontSize: "0.95rem", fontWeight: "900", fontFamily: "monospace", color: "#f8fafc" }}>
                        {isStreaming ? "Calculating..." : isFailed ? "N/A" : (
                          trace.cum_prompt_tokens > 0 ? (trace.cum_prompt_tokens + trace.cum_completion_tokens) : totalTokens
                        )}
                      </div>
                    </div>
                    <div style={{ width: "1px", height: "24px", background: "rgba(255,255,255,0.08)" }} />
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "0.6rem", color: "#64748b", fontWeight: "700" }}>TRANSACTION COST</div>
                      <div style={{ fontSize: "0.95rem", fontWeight: "900", fontFamily: "monospace", color: isStreaming ? "#a78bfa" : isFailed ? "#f87171" : "#10b981" }}>
                        {isStreaming ? "Streaming..." : isFailed ? "N/A" : (
                          `$${(trace.cum_total_cost > 0 ? trace.cum_total_cost : trace.total_cost).toFixed(6)}`
                        )}
                      </div>
                    </div>
                  </div>
                </div>


                {/* Prompt Details (Collapsible Context) */}
                <div>
                  <button
                    onClick={() => setExpandedTrace(expandedTrace === trace.run_id ? null : trace.run_id)}
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.05)",
                      padding: "8px 14px",
                      borderRadius: "8px",
                      color: "#94a3b8",
                      fontSize: "0.75rem",
                      fontWeight: "700",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      transition: "all 0.2s"
                    }}
                  >
                    <span>{expandedTrace === trace.run_id ? "Hide Prompt Context" : "Inspect Prompt Context"}</span>
                    <span style={{ fontSize: "0.7rem", color: "#64748b" }}>
                      ({trace.inputs ? trace.inputs.length : 0} items)
                    </span>
                  </button>

                  {expandedTrace === trace.run_id && trace.inputs && (
                    <div style={{
                      marginTop: "0.8rem",
                      background: "rgba(0,0,0,0.2)",
                      border: "1px solid rgba(255,255,255,0.05)",
                      borderRadius: "10px",
                      padding: "1rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.8rem",
                      maxHeight: "350px",
                      overflowY: "auto"
                    }} className="terminal-scroll">
                      {trace.inputs.map((input, idx) => {
                        const isSystem = input.role === "system";
                        const isUser = input.role === "user";
                        return (
                          <div key={idx} style={{ 
                            borderBottom: idx < trace.inputs.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                            paddingBottom: idx < trace.inputs.length - 1 ? "0.8rem" : "0"
                          }}>
                            <div style={{ 
                              fontSize: "0.6rem", 
                              color: isSystem ? "#60a5fa" : isUser ? "#34d399" : "#fbbf24", 
                              fontWeight: "900", 
                              textTransform: "uppercase",
                              letterSpacing: "0.8px",
                              marginBottom: "3px"
                            }}>
                              {input.role}
                            </div>
                            <div style={{ 
                              fontSize: "0.78rem", 
                              color: "#cbd5e1", 
                              lineHeight: "1.4",
                              whiteSpace: "pre-wrap",
                              fontFamily: isSystem ? "monospace" : "inherit"
                            }}>
                              {input.content}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Stream Output Text Area */}
                <div style={{
                  background: isFailed ? "rgba(239, 68, 68, 0.03)" : "rgba(0, 0, 0, 0.15)",
                  border: `1px solid ${isFailed ? "rgba(239, 68, 68, 0.2)" : "rgba(255, 255, 255, 0.04)"}`,
                  borderRadius: "12px",
                  padding: "1rem 1.2rem",
                  position: "relative"
                }}>
                  <div style={{ 
                    position: "absolute", 
                    top: "-8px", 
                    left: "14px", 
                    background: "#0b0f19", 
                    padding: "0 8px", 
                    fontSize: "0.58rem", 
                    color: isStreaming ? "#c084fc" : isFailed ? "#f87171" : "#64748b",
                    fontWeight: "900",
                    textTransform: "uppercase",
                    letterSpacing: "1px"
                  }}>
                    {isStreaming ? "STREAMING COMPLETION CHUNKS" : isFailed ? "FAILED RUN ERROR DETAILS" : "COMPLETED RESPONSE"}
                  </div>

                  <div style={{
                    fontSize: "0.88rem",
                    color: isFailed ? "#fca5a5" : (trace.outputs ? "#cbd5e1" : "#475569"),
                    lineHeight: "1.5",
                    minHeight: "24px"
                  }}>
                    {isFailed ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px", whiteSpace: "pre-wrap" }}>
                        <div style={{ fontWeight: "800", textTransform: "uppercase", fontSize: "0.75rem", color: "#f87171" }}>
                          Code: {trace.error_code}
                        </div>
                        <div style={{ fontSize: "0.85rem", opacity: 0.9 }}>
                          {trace.error_message}
                        </div>
                      </div>
                    ) : (
                      trace.outputs ? (
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            h1: ({node, ...props}) => <h1 style={{ fontSize: "1.2rem", fontWeight: "800", color: "#f8fafc", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "4px", marginBottom: "12px" }} {...props} />,
                            h2: ({node, ...props}) => <h2 style={{ fontSize: "1.1rem", fontWeight: "800", color: "#f8fafc", marginBottom: "10px", marginTop: "14px" }} {...props} />,
                            h3: ({node, ...props}) => <h3 style={{ fontSize: "1.05rem", fontWeight: "700", color: "#38bdf8", marginBottom: "8px", marginTop: "12px" }} {...props} />,
                            p: ({node, ...props}) => <p style={{ marginBottom: "10px", lineHeight: "1.6", color: "#cbd5e1" }} {...props} />,
                            li: ({node, ...props}) => <li style={{ marginBottom: "6px", color: "#cbd5e1", lineHeight: "1.6" }} {...props} />,
                            ul: ({node, ...props}) => <ul style={{ marginTop: "4px", marginBottom: "10px", paddingLeft: "1.2rem" }} {...props} />,
                            ol: ({node, ...props}) => <ol style={{ marginTop: "4px", marginBottom: "10px", paddingLeft: "1.2rem" }} {...props} />,
                            strong: ({node, ...props}) => {
                              const text = props.children[0];
                              if (typeof text === 'string') {
                                if (text.includes("Action Recommended") || text.includes("Recommended Action")) {
                                  return (
                                    <span style={{ display: "flex", alignItems: "center", gap: "8px", color: "#38bdf8", fontWeight: "800", marginTop: "12px", marginBottom: "6px", fontSize: "0.95rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                      🔧 {text}
                                    </span>
                                  );
                                }
                                if (text.includes("Impact Analysis") || text.includes("Resource Savings")) {
                                  return (
                                    <span style={{ display: "flex", alignItems: "center", gap: "8px", color: "#34d399", fontWeight: "800", marginTop: "12px", marginBottom: "6px", fontSize: "0.95rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                      📈 {text}
                                    </span>
                                  );
                                }
                                if (text.includes("Risk Assessment") || text.includes("Critical Risk") || text.includes("High Risk")) {
                                  return (
                                    <span style={{ display: "flex", alignItems: "center", gap: "8px", color: "#f87171", fontWeight: "800", marginTop: "12px", marginBottom: "6px", fontSize: "0.95rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                      ⚠️ {text}
                                    </span>
                                  );
                                }
                              }
                              return <strong style={{ color: "#ffffff", fontWeight: "700" }} {...props} />;
                            },
                            code: ({node, inline, className, children, ...props}) => {
                              return (
                                <code 
                                  style={{ 
                                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace", 
                                    backgroundColor: "rgba(255, 255, 255, 0.1)", 
                                    color: "#38bdf8", 
                                    padding: "2px 6px", 
                                    borderRadius: "6px", 
                                    fontSize: "0.9em" 
                                  }} 
                                  {...props}
                                >
                                  {children}
                                </code>
                              );
                            },
                            pre: ({node, ...props}) => <CollapsiblePre {...props} />
                          }}
                        >
                          {trace.outputs}
                        </ReactMarkdown>
                      ) : (
                        isStreaming ? "Initializing prompt run..." : "Empty completion"
                      )
                    )}
                    {isStreaming && (
                      <span className="blink-cursor" style={{ 
                        display: "inline-block", 
                        marginLeft: "3px", 
                        width: "6px", 
                        height: "14px", 
                        background: "#c084fc",
                        animation: "blink 1s step-end infinite" 
                      }} />
                    )}
                  </div>
                </div>

                {/* Performance Metrics (Latency & Speed) */}
                {!isStreaming && (
                  <div style={{ display: "flex", gap: "1rem", fontSize: "0.68rem", color: "#64748b", flexWrap: "wrap", borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: "0.75rem", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ color: "#f87171", fontWeight: "700" }}>TOTAL LATENCY</span>
                      <span style={{ 
                        fontFamily: "monospace", 
                        fontWeight: "700",
                        color: (trace.agent !== "REHEARSAL" && trace.agent !== "DEVOPS_GENI" && trace.total_latency > 1000) ? "#f87171" : "#e2e8f0"
                      }}>
                        {trace.total_latency ? `${trace.total_latency}ms` : "N/A"}
                      </span>
                      {trace.agent !== "REHEARSAL" && trace.agent !== "DEVOPS_GENI" && trace.total_latency > 1000 && (
                        <span style={{ color: "#f87171", fontSize: "0.6rem", fontWeight: "700" }}>⚠️ VOICE LATENCY OVER 1000ms</span>
                      )}
                    </div>
                    <div style={{ color: "#334155" }}>|</div>
                    
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ color: "#fbbf24", fontWeight: "700" }}>TTFT</span>
                      <span style={{ 
                        fontFamily: "monospace", 
                        fontWeight: "700",
                        color: trace.ttft > 800 ? "#fbbf24" : "#e2e8f0"
                      }}>
                        {trace.ttft ? `${trace.ttft}ms` : "N/A"}
                      </span>
                    </div>
                    <div style={{ color: "#334155" }}>|</div>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ color: "#22d3ee", fontWeight: "700" }}>SPEED</span>
                      <span style={{ fontFamily: "monospace", fontWeight: "700", color: "#e2e8f0" }}>
                        {trace.otps ? `${trace.otps} tokens/s` : "N/A"}
                      </span>
                    </div>

                    {(trace.tool_latency > 0 || (trace.tool_calls && trace.tool_calls.length > 0)) && (
                      <>
                        <div style={{ color: "#334155" }}>|</div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ color: "#34d399", fontWeight: "700" }}>TOOL LATENCY</span>
                          <span style={{ fontFamily: "monospace", fontWeight: "700", color: "#34d399" }}>
                            {trace.tool_latency || 0}ms
                          </span>
                          {trace.tool_calls && trace.tool_calls.length > 0 && (
                            <div style={{ display: "flex", gap: "6px", marginLeft: "10px", flexWrap: "wrap" }}>
                              {trace.tool_calls.map((tool, idx) => (
                                <span key={idx} style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.18)", color: "#34d399", fontSize: "0.6rem", padding: "1px 5px", borderRadius: "4px", fontFamily: "monospace" }}>
                                  {tool.name}: {tool.duration}ms
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Token Pricing Breakdowns (Only when completed) */}
                {!isStreaming && (
                  <div style={{ display: "flex", gap: "1rem", fontSize: "0.68rem", color: "#64748b", flexWrap: "wrap", borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: "0.75rem", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ color: "#60a5fa", fontWeight: "700" }}>LLM</span>
                      <span>
                        ({trace.cum_prompt_tokens > 0 ? trace.cum_prompt_tokens : trace.prompt_tokens} IN / {trace.cum_completion_tokens > 0 ? trace.cum_completion_tokens : trace.completion_tokens} OUT)
                      </span>
                      <span style={{ color: "#475569" }}>·</span>
                      <span style={{ color: "#94a3b8", fontFamily: "monospace" }}>
                        ${(trace.cum_prompt_tokens > 0 ? (trace.cum_input_cost + trace.cum_output_cost) : (trace.llm_cost || (trace.input_cost + trace.output_cost) || 0)).toFixed(6)}
                      </span>
                    </div>
                    {isVoice && (
                      <>
                        <div style={{ color: "#334155" }}>|</div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ color: "#fb7185", fontWeight: "700" }}>STT</span>
                          <span style={{ color: "#94a3b8", fontFamily: "monospace" }}>
                            ${(trace.cum_stt_cost > 0 ? trace.cum_stt_cost : (trace.stt_cost || 0)).toFixed(6)}
                          </span>
                        </div>
                        <div style={{ color: "#334155" }}>|</div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ color: "#38bdf8", fontWeight: "700" }}>TTS</span>
                          <span style={{ color: "#94a3b8", fontFamily: "monospace" }}>
                            ${(trace.cum_tts_cost > 0 ? trace.cum_tts_cost : (trace.tts_cost || 0)).toFixed(6)}
                          </span>
                        </div>
                      </>
                    )}
                    <div style={{ color: "#334155" }}>|</div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ color: "#a78bfa", fontWeight: "700" }}>TOTAL</span>
                      <span style={{ color: "#10b981", fontFamily: "monospace", fontWeight: "700" }}>
                        ${(trace.cum_total_cost > 0 ? trace.cum_total_cost : trace.total_cost).toFixed(6)}
                      </span>
                    </div>
                       {/* Evaluate button / loader (only if NOT evaluated yet) */}
                    {(!hallucinationResults[trace.run_id] || evaluating[trace.run_id]) && (
                      <div style={{ marginLeft: "auto" }}>
                        {evaluating[trace.run_id] ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#94a3b8", fontSize: "0.7rem" }}>
                            <span style={{ display: "inline-block", width: "10px", height: "10px", border: "2px solid #a78bfa", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                            Evaluating...
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEvaluate(trace)}
                            style={{
                              fontSize: "0.68rem",
                              fontWeight: "700",
                              padding: "4px 12px",
                              borderRadius: "7px",
                              border: "1px solid rgba(139,92,246,0.25)",
                              background: "rgba(139,92,246,0.08)",
                              color: "#c084fc",
                              cursor: "pointer",
                              letterSpacing: "0.3px",
                              transition: "all 0.2s"
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = "rgba(139,92,246,0.18)"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "rgba(139,92,246,0.08)"; }}
                          >
                            ⚗ Evaluate
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Evaluation Results Section (Full Width, below the breakdown row) */}
                {!isStreaming && evalResult && !evaluating[trace.run_id] && (
                    <div style={{
                      borderTop: "1px solid rgba(255,255,255,0.04)",
                      paddingTop: "0.75rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      width: "100%"
                    }}>
                      {/* Score pill + bar */}
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                        <div style={{ background: col.bg, border: `1px solid ${col.fg}30`, borderRadius: "8px", padding: "3px 10px", display: "flex", alignItems: "center", gap: "5px" }}>
                          <span style={{ color: col.fg, fontWeight: "900", fontSize: "0.7rem" }}>{col.icon} {col.label}</span>
                          <span style={{ color: col.fg, fontFamily: "monospace", fontWeight: "700", fontSize: "0.75rem" }}>{evalResult.score.toFixed(2)}</span>
                        </div>
                        {/* Progress bar */}
                        <div style={{ flex: 1, height: "5px", background: "rgba(255,255,255,0.05)", borderRadius: "99px", overflow: "hidden", maxWidth: "120px" }}>
                          <div style={{ width: `${evalResult.score * 100}%`, height: "100%", background: col.fg, borderRadius: "99px", transition: "width 0.6s ease" }} />
                        </div>
                        <button
                          onClick={() => handleEvaluate(trace)}
                          style={{ fontSize: "0.6rem", color: "#64748b", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                        >re-eval</button>
                      </div>
                      {/* Reasoning */}
                      {evalResult.reasoning && (
                        <div style={{ fontSize: "0.75rem", color: "#94a3b8", lineHeight: "1.4" }}>
                          {evalResult.reasoning}
                        </div>
                      )}
                      {/* Flags */}
                      {evalResult.flags && evalResult.flags.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "2px" }}>
                          {evalResult.flags.map((flag, fi) => (
                            <span key={fi} style={{ fontSize: "0.6rem", background: "rgba(248,113,113,0.08)", color: "#fca5a5", border: "1px solid rgba(248,113,113,0.18)", borderRadius: "4px", padding: "2px 6px" }}>
                              ⚑ {flag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                )}

              </div>
            );
          })
        )}
      </section>

      {/* Embedded Styles */}
      <style>{`
        @keyframes blink {
          from, to { background-color: transparent }
          50% { background-color: #c084fc }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .terminal-scroll::-webkit-scrollbar {
          width: 5px;
        }
        .terminal-scroll::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.1);
        }
        .terminal-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.08);
          border-radius: 99px;
        }
        .terminal-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.15);
        }
      `}</style>
    </div>
  );
}

export default DashboardPage;
