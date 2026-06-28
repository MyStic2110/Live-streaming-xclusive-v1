import React, { useEffect, useState, useMemo } from 'react';
import { io } from 'socket.io-client';
import Toolbar from './Toolbar';
import StatusRibbon from './StatusRibbon';
import TopologyGraph from './TopologyGraph';
import './AgentOps.css';

// Normalizes raw agent name/id strings to match selectAgent.id in frontend
const normalizeAgentId = (rawName) => {
  if (!rawName) return '';
  const name = rawName.toLowerCase();
  if (name.includes('copilot')) return 'swarm_copilot';
  if (name.includes('devops')) return 'devopsgeni';
  if (name.includes('astra')) return 'astra';
  if (name.includes('lina')) return 'lina';
  if (name.includes('nova')) return 'nova';
  return name.replace(/_/g, '');
};

// Translates selectedAgent.id to the uppercase key stored in database column
const getDbAgentName = (agentId) => {
  const id = (agentId || '').toLowerCase();
  if (id.includes('copilot')) return 'SWARM_COPILOT';
  if (id.includes('devops')) return 'DEVOPS_GENI';
  if (id.includes('astra')) return 'ASTRA';
  if (id.includes('lina')) return 'LINA';
  if (id.includes('nova')) return 'NOVA';
  return agentId.toUpperCase();
};

/**
 * Agent Ops Dashboard Cockpit
 * Shows a clean cluster selector grid of agent names first.
 * Clicking an agent opens a dedicated topology flow graph showing all live connections,
 * database calls, and trace logs happening in real-time.
 */
export default function AgentOps({ onBack }) {
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  
  // Real-time telemetry metrics
  const [metrics, setMetrics] = useState({
    cpu: 0.0,
    memory: 0.0,
    activeSessions: 0,
    services: {
      db: false,
      redis: false,
      livekit: false,
      searxng: false,
      qdrant: false,
      securelytix: false,
      mem0: false
    }
  });

  // Map of agentId -> array of log objects
  const [agentLogs, setAgentLogs] = useState({});
  // Map of run_id -> agent_id to trace tool calls back to their origin agent
  const [runAgentMap, setRunAgentMap] = useState({});
  // Active links: flowKey -> { active, run_id, event, label, direction, ts }
  const [activeTelemetryFlows, setActiveTelemetryFlows] = useState({});
  // LLM Judge hallucination scores: run_id -> { score, reasoning, flags, evaluated_at }
  const [hallucinationResults, setHallucinationResults] = useState({});
  // Loop Engineering iteration scores: run_id -> latest { iteration, enoughEvidence, evidenceScore, gapDescription }
  const [loopStatuses, setLoopStatuses] = useState({});

  useEffect(() => {
    // 1. Fetch initial agents list
    const apiBase = import.meta.env.VITE_API_URL || "";
    fetch(`${apiBase}/api/agents`)
      .then(res => res.json())
      .then(data => setAgents(data))
      .catch((err) => {
        console.error("Failed to fetch agents:", err);
        setAgents([]);
      });

    // 2. Setup Socket.IO connection for live monitoring
    const socket = io(apiBase || window.location.origin);

    socket.on('connect', () => {
      console.log('[AGENT_OPS] Socket connected for live metrics.');
    });

    // Receive system and port metrics from the Node backend monitor service
    socket.on('system_metrics', (data) => {
      if (data) {
        setMetrics(prev => ({
          ...prev,
          cpu: data.cpu !== undefined ? data.cpu : prev.cpu,
          memory: data.memory !== undefined ? data.memory : prev.memory,
          activeSessions: data.activeSessions !== undefined ? data.activeSessions : prev.activeSessions,
          services: data.services || prev.services
        }));
      }
    });

    // Capture dynamic trace runs to animate data paths and stream stdout logs
    socket.on('llm_trace', (payload) => {
      if (!payload || !payload.event) return;
      const { event, run_id, data } = payload;
      
      let agentId = normalizeAgentId(data?.agent);
      
      // If we don't have the agent id directly (e.g. on chunk/end/tool_call), retrieve it from the run map
      if (!agentId && run_id) {
        agentId = runAgentMap[run_id];
      }

      if (!agentId) return;

      // Update mapping
      if (run_id && data?.agent) {
        setRunAgentMap(prev => ({ ...prev, [run_id]: agentId }));
      }

      // Generate a log line from the event
      let logLine = null;
      let targetFlow = null; // target service node: 'db', 'search', 'qdrant', 'livekit'
      
      const shortId = run_id ? run_id.slice(0, 8) : '??';

      if (event === 'llm_start') {
        logLine = {
          text: `[LLM START] Model: ${data.model || 'unknown'} | Input turns: ${data.inputs?.length || 0}`,
          type: 'system'
        };
        triggerFlowGlow(agentId, 'llm_gateway', {
          run_id: shortId, event: 'LLM REQUEST',
          label: data.model || 'LLM', direction: '→', ts: new Date().toLocaleTimeString()
        });
        if (agentId.includes('copilot')) {
          triggerFlowGlow(agentId, 'mem0', {
            run_id: shortId, event: 'MEM FETCH',
            label: 'context', direction: '→', ts: new Date().toLocaleTimeString()
          });
        }
      } else if (event === 'llm_chunk' && data?.chunk) {
        logLine = {
          text: `[LLM CHUNK] "${data.chunk}"`,
          type: 'info'
        };
        triggerFlowGlow(agentId, 'llm_gateway', {
          run_id: shortId, event: 'STREAMING',
          label: `"${data.chunk.slice(0, 18)}…"`, direction: '←', ts: new Date().toLocaleTimeString()
        });
      } else if (event === 'llm_end') {
        logLine = {
          text: `[LLM END] Prompt: ${data.prompt_tokens || 0} tokens | Completion: ${data.completion_tokens || 0} tokens | Cost: $${data.total_cost || 0}`,
          type: 'success'
        };
        triggerFlowGlow(agentId, 'llm_gateway', {
          run_id: shortId, event: 'LLM DONE',
          label: `${data.prompt_tokens || 0}+${data.completion_tokens || 0} tok`, direction: '←', ts: new Date().toLocaleTimeString()
        });
      } else if (event === 'llm_error') {
        logLine = {
          text: `[LLM ERROR] ${data.error_message || 'An LLM error occurred'}`,
          type: 'error'
        };
      } else if (event === 'tool_call') {
        const toolName = (data.name || '').toLowerCase();
        logLine = {
          text: `[TOOL CALL] Executing tool: ${data.name} (Duration: ${data.duration || 0}ms)`,
          type: 'warn'
        };

        const meta = {
          run_id: shortId, event: 'TOOL CALL',
          label: data.name || 'tool', direction: '→', ts: new Date().toLocaleTimeString()
        };

        if (toolName.includes('openai') || toolName.includes('claude') || toolName.includes('openrouter') || toolName.includes('llm') || toolName.includes('gpt')) {
          targetFlow = 'llm_gateway';
        } else if (toolName.includes('query') || toolName.includes('db') || toolName.includes('sql') || toolName.includes('postgres') || toolName.includes('schema')) {
          targetFlow = 'db';
        } else if (toolName.includes('search') || toolName.includes('scrape') || toolName.includes('searxng') || toolName.includes('web') || toolName.includes('crawler')) {
          targetFlow = 'searxng';
        } else if (toolName.includes('memory') || toolName.includes('mem0')) {
          targetFlow = 'mem0';
        } else if (toolName.includes('qdrant') || toolName.includes('vector')) {
          targetFlow = 'mem0';
        } else if (toolName.includes('livekit') || toolName.includes('speech') || toolName.includes('voice') || toolName.includes('audio')) {
          targetFlow = 'livekit';
        } else if (toolName.includes('scan') || toolName.includes('security') || toolName.includes('audit')) {
          targetFlow = 'securelytix';
        }

        if (targetFlow) {
          triggerFlowGlow(agentId, targetFlow, meta);
        }
      }

      if (logLine) {
        setAgentLogs(prev => {
          const currentLogs = prev[agentId] || [];
          // Keep last 150 lines to prevent memory bloat
          return {
            ...prev,
            [agentId]: [...currentLogs, logLine].slice(-150)
          };
        });
      }
    });

    // Track hallucination judge evaluations from the auto-trigger system
    socket.on('hallucination_result', (result) => {
      if (!result || !result.run_id) return;
      setHallucinationResults(prev => ({ ...prev, [result.run_id]: result }));

      // Find which agent this run belongs to and log a summary
      const agentId = runAgentMap[result.run_id] || 'swarm_copilot';
      const accuracy = Math.round((1 - result.score) * 100);
      const label = result.score <= 0.20 ? 'ACCURATE' : result.score <= 0.50 ? 'UNCERTAIN' : result.score <= 0.75 ? 'SUSPECT' : 'HALLUCINATED';
      setAgentLogs(prev => {
        const currentLogs = prev[agentId] || [];
        return {
          ...prev,
          [agentId]: [...currentLogs, {
            text: `[JUDGE] Accuracy: ${accuracy}% (${label}) — ${result.reasoning || 'Evaluation complete.'}`,
            type: result.score <= 0.20 ? 'success' : result.score <= 0.50 ? 'warn' : 'error'
          }].slice(-150)
        };
      });
    });

    // Track Loop Engineering iterative reasoning progress
    socket.on('copilot_loop_status', (payload) => {
      if (!payload || !payload.run_id) return;
      const { run_id, event, iteration, enoughEvidence, evidenceScore, gapDescription, query: iterQuery } = payload;

      if (event === 'loop_start') {
        setAgentLogs(prev => {
          const currentLogs = prev['swarm_copilot'] || [];
          return {
            ...prev,
            swarm_copilot: [...currentLogs, {
              text: `[LOOP #${iteration}] Searching knowledge base → "${(iterQuery || '').slice(0, 60)}..."`,
              type: 'info'
            }].slice(-150)
          };
        });
        triggerFlowGlow('swarm_copilot', 'loop_engineering', {
          run_id: run_id.slice(0, 8), event: `ITER ${iteration}`,
          label: 'searching', direction: '→', ts: new Date().toLocaleTimeString()
        });
      } else if (event === 'loop_evaluation') {
        setLoopStatuses(prev => ({ ...prev, [run_id]: payload }));
        const scoreLabel = evidenceScore !== undefined ? `${Math.round(evidenceScore * 100)}%` : '?%';
        setAgentLogs(prev => {
          const currentLogs = prev['swarm_copilot'] || [];
          return {
            ...prev,
            swarm_copilot: [...currentLogs, {
              text: `[LOOP #${iteration}] Evidence: ${scoreLabel} — ${enoughEvidence ? '✅ Sufficient' : `⚠️ Gap: ${gapDescription || 'Refining query...'}`}`,
              type: enoughEvidence ? 'success' : 'warn'
            }].slice(-150)
          };
        });
        triggerFlowGlow('swarm_copilot', 'loop_engineering', {
          run_id: run_id.slice(0, 8), event: enoughEvidence ? 'DONE' : 'RETRY',
          label: scoreLabel, direction: '←', ts: new Date().toLocaleTimeString()
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [runAgentMap]);

  // Temporarily highlight visual routes in the topology graph with rich metadata
  const triggerFlowGlow = (agentId, targetService, meta = {}) => {
    const key = `${agentId}->${targetService}_service`;
    const payload = { active: true, ...meta };
    setActiveTelemetryFlows(prev => {
      const next = { ...prev, [key]: payload };
      if (targetService === 'mem0') {
        next['mem0_service->qdrant_service'] = { active: true, ...meta, event: 'MEM LOOKUP', label: 'vector', direction: '→' };
      }
      return next;
    });
    setTimeout(() => {
      setActiveTelemetryFlows(prev => {
        const next = { ...prev, [key]: { active: false } };
        if (targetService === 'mem0') {
          next['mem0_service->qdrant_service'] = { active: false };
        }
        return next;
      });
    }, 3500);
  };

  // When an agent is selected, load its initial actual traces from database as shell history
  useEffect(() => {
    if (!selectedAgent) return;
    const agentId = selectedAgent.id.toLowerCase();
    
    // Check if we already have log buffers for it, if not, fetch history
    if (!agentLogs[agentId]) {
      const apiBase = import.meta.env.VITE_API_URL || "";
      const token = localStorage.getItem("token");
      const headers = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const dbAgent = getDbAgentName(selectedAgent.id);
      
      // Fetch traces for this specific agent from database
      fetch(`${apiBase}/api/llm-traces?agent=${dbAgent}&limit=10`, { headers })
        .then(res => res.json())
        .then(tracesList => {
          if (!Array.isArray(tracesList)) return;
          const historicalLogs = [];
          
          [...tracesList].reverse().forEach(trace => {
            historicalLogs.push({
              text: `[HISTORY] [${new Date(trace.timestamp).toLocaleTimeString()}] run_id: ${trace.run_id} | Model: ${trace.model} | Status: ${trace.status}`,
              type: 'system'
            });
            if (trace.inputs && trace.inputs.length > 0) {
              const lastMsg = trace.inputs[trace.inputs.length - 1];
              historicalLogs.push({
                text: `[HISTORY] Prompt: "${lastMsg.content || ''}"`,
                type: 'info'
              });
            }
            if (trace.outputs) {
              historicalLogs.push({
                text: `[HISTORY] Response: "${trace.outputs.slice(0, 120)}..."`,
                type: 'success'
              });
            }
            if (trace.tool_calls && trace.tool_calls.length > 0) {
              trace.tool_calls.forEach(tool => {
                historicalLogs.push({
                  text: `[HISTORY] Tool Call: ${tool.name} (${tool.duration}ms)`,
                  type: 'warn'
                });
              });
            }
          });
          
          setAgentLogs(prev => ({
            ...prev,
            [agentId]: historicalLogs
          }));
        })
        .catch(() => {
          // Fallback if fetch fails or database is offline
        });
    }
  }, [selectedAgent]);

  const handleAgentSelect = (agent) => setSelectedAgent(agent);

  const renderAgentCluster = () => {
    return (
      <div className="agent-cluster-container">
        <div className="cluster-header">
          <h2>Active Swarm Core Nodes</h2>
          <p className="subtext">Select an active agent blade node to establish secure shells and inspect dynamic transaction routing topology.</p>
        </div>
        
        <div className="agent-grid">
          {agents.map(agent => {
            const isOnline = agent.status === 'online';
            const logCount = agentLogs[agent.id.toLowerCase()]?.length || 0;
            
            return (
              <div 
                key={agent.id} 
                className={`agent-blade-card ${isOnline ? 'online' : 'offline'}`}
                onClick={() => setSelectedAgent(agent)}
              >
                <div className="blade-glow"></div>
                <div className="blade-header">
                  <span className={`status-badge ${agent.status}`}>
                    {agent.status.toUpperCase()}
                  </span>
                  <span className="blade-id">node-{agent.id}</span>
                </div>
                
                <div className="blade-body">
                  <h3>{agent.name}</h3>
                  <p className="blade-desc">{agent.business_function || 'Core Swarm Assistant Model'}</p>
                </div>
                
                <div className="blade-stats">
                  <div className="stat-item">
                    <span className="stat-label">Autonomy</span>
                    <span className="stat-val">{agent.autonomy || 'Medium'}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Risk Tier</span>
                    <span className={`stat-val risk-${(agent.risk_tier || 'low').toLowerCase()}`}>{agent.risk_tier || 'Low'}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Buffered Traces</span>
                    <span className="stat-val trace-count">{logCount}</span>
                  </div>
                </div>
                
                <div className="blade-footer">
                  <span className="action-link">Open Network Calls Map →</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="agent-ops-container">
      <header className="agent-ops-header">
        <button className="back-button" onClick={selectedAgent ? () => setSelectedAgent(null) : onBack}>
          {selectedAgent ? '← Return to Cluster' : '← Back'}
        </button>
        <h1>Agent Ops Cockpit {selectedAgent && `// node-${selectedAgent.id}`}</h1>
        <Toolbar />
      </header>
      
      <StatusRibbon agents={agents} metrics={metrics} />
      
      <main className="agent-ops-main">
        {selectedAgent ? (
          <TopologyGraph 
            agents={[selectedAgent]} 
            onSelect={handleAgentSelect} 
            services={metrics.services}
            activeFlows={activeTelemetryFlows}
            hallucinationResults={hallucinationResults}
            loopStatuses={loopStatuses}
          />
        ) : (
          renderAgentCluster()
        )}
      </main>
    </div>
  );
}
