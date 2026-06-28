/* eslint-disable react-hooks/purity */
import React, { useState, useMemo } from 'react';
import { Play, Terminal, Shield, RefreshCw, Layers, DollarSign, Clock } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './PromptPlayground.css';

const API = import.meta.env.VITE_API_URL || "";

const MODELS = [
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', costInput: 0.15, costOutput: 0.60, desc: 'Fast, cost-efficient, and optimized for standard tasks' },
  { id: 'openai/gpt-4o', name: 'GPT-4o (Standard)', provider: 'OpenAI', costInput: 2.50, costOutput: 10.00, desc: 'High-performance reasoning and structured operations' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', costInput: 3.00, costOutput: 15.00, desc: 'Industry leader in code generation and instruction compliance' },
  { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Google', costInput: 0.075, costOutput: 0.30, desc: 'Extremely fast model with a massive context capacity' },
  { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Google', costInput: 1.25, costOutput: 5.00, desc: 'Advanced multimodal reasoning with deep analysis features' }
];

export default function PromptPlayground({ onBack }) {
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const [systemPrompt, setSystemPrompt] = useState(
    "You are Swarm Copilot, a helpful AI orchestration assistant.\n\nUse the following user data to construct a greeting:\nName: {{user_name}}\nRole: {{user_role}}"
  );
  const [userQuery, setUserQuery] = useState(
    "Analyze this server compliance warning: {{warning_details}}"
  );
  const [variables, setVariables] = useState({
    user_name: 'Alex Rivera',
    user_role: 'Security Engineer',
    warning_details: 'Port 5433 (PostgreSQL) is open to the public internet.'
  });
  
  const [temperature, setTemperature] = useState(0.7);
  const [isGenerating, setIsGenerating] = useState(false);
  const [output, setOutput] = useState('');
  
  // Metrics
  const [latency, setLatency] = useState(0);
  const [tokenEst, setTokenEst] = useState({ input: 0, output: 0 });
  const [costEst, setCostEst] = useState(0);
  
  // Security simulation
  const [securityFilter, setSecurityFilter] = useState(true);
  const [piiDetected, setPiiDetected] = useState(false);
  const [activeOutputTab, setActiveOutputTab] = useState('terminal');

  const generateCurlCode = () => {
    const renderedSystem = getRenderedContent(systemPrompt).replace(/"/g, '\\"').replace(/\n/g, '\\n');
    const renderedUser = getRenderedContent(userQuery).replace(/"/g, '\\"').replace(/\n/g, '\\n');
    return `curl -X POST "${API || 'http://localhost:3002'}/api/playground/run" \\
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${selectedModel.id}",
    "systemPrompt": "${renderedSystem}",
    "userQuery": "${renderedUser}",
    "temperature": ${temperature}
  }'`;
  };

  const generateNodeCode = () => {
    const renderedSystem = getRenderedContent(systemPrompt).replace(/'/g, "\\'").replace(/\n/g, '\\n');
    const renderedUser = getRenderedContent(userQuery).replace(/'/g, "\\'").replace(/\n/g, '\\n');
    return `import fetch from 'node-fetch';

const runAgentNode = async () => {
  const response = await fetch('${API || 'http://localhost:3002'}/api/playground/run', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_AUTH_TOKEN'
    },
    body: JSON.stringify({
      model: '${selectedModel.id}',
      systemPrompt: '${renderedSystem}',
      userQuery: '${renderedUser}',
      temperature: ${temperature}
    })
  });
  const data = await response.json();
  console.log(data.choices[0].message.content);
};

runAgentNode();`;
  };

  const generatePythonCode = () => {
    const renderedSystem = getRenderedContent(systemPrompt).replace(/"/g, '\\"').replace(/\n/g, '\\n');
    const renderedUser = getRenderedContent(userQuery).replace(/"/g, '\\"').replace(/\n/g, '\\n');
    return `import requests

url = "${API || 'http://localhost:3002'}/api/playground/run"
headers = {
    "Authorization": "Bearer YOUR_AUTH_TOKEN",
    "Content-Type": "application/json"
}
payload = {
    "model": "${selectedModel.id}",
    "systemPrompt": "${renderedSystem}",
    "userQuery": "${renderedUser}",
    "temperature": ${temperature}
}

response = requests.post(url, json=payload, headers=headers)
data = response.json()
print(data["choices"][0]["message"]["content"])`;
  };

  // Extract variables dynamically from templates using regex: {{var_name}}
  const variableKeys = useMemo(() => {
    const regex = /\{\{([a-zA-Z0-9_-]+)\}\}/g;
    const foundVars = new Set();
    
    let match;
    while ((match = regex.exec(systemPrompt)) !== null) {
      foundVars.add(match[1]);
    }
    while ((match = regex.exec(userQuery)) !== null) {
      foundVars.add(match[1]);
    }
    return Array.from(foundVars);
  }, [systemPrompt, userQuery]);

  // Compute live prompt preview
  const getRenderedContent = (template) => {
    let rendered = template;
    variableKeys.forEach((key) => {
      const val = variables[key];
      rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val !== undefined && val !== '' ? val : `[${key}]`);
    });
    return rendered;
  };

  const handleVariableChange = (name, value) => {
    setVariables(prev => ({ ...prev, [name]: value }));
  };

  const handleRun = async () => {
    if (isGenerating) return;
    setIsGenerating(false);
    setOutput('');
    setLatency(0);

    const renderedSystem = getRenderedContent(systemPrompt);
    const renderedUser = getRenderedContent(userQuery);

    // Simple PII filter warning simulation
    const piiRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b|\b\d{3}-\d{2}-\d{4}\b|\b\d{4}-\d{4}-\d{4}-\d{4}\b/;
    const hasPii = piiRegex.test(renderedSystem) || piiRegex.test(renderedUser);
    setPiiDetected(hasPii);

    setIsGenerating(true);
    const startTime = Date.now();
    let timer = setInterval(() => {
      setLatency(Date.now() - startTime);
    }, 50);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API}/api/playground/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          systemPrompt: renderedSystem,
          userQuery: renderedUser,
          model: selectedModel.id,
          temperature
        })
      });

      clearInterval(timer);
      setLatency(Date.now() - startTime);

      if (!response.ok) {
        throw new Error(`LLM Execution failed: ${response.statusText}`);
      }

      // Check if it is a stream response
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/event-stream')) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunkText = decoder.decode(value);
          
          // Parse OpenRouter SSE chunks: "data: {...}"
          const lines = chunkText.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6).trim();
              if (dataStr === '[DONE]') continue;
              try {
                const parsed = JSON.parse(dataStr);
                const chunk = parsed.choices?.[0]?.delta?.content || '';
                setOutput(prev => prev + chunk);
              } catch {
                // Ignore parse errors for split chunks
              }
            }
          }
        }
      } else {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || 'No output.';
        setOutput(content);
      }
      
      // Calculate token and cost estimates based on character lengths
      const promptChars = (renderedSystem + renderedUser).length;
      const inputTokens = Math.round(promptChars / 4) + 20;
      setOutput(prev => {
        const outputTokens = Math.round(prev.length / 4);
        setTokenEst({ input: inputTokens, output: outputTokens });
        const cost = ((inputTokens / 1000000) * selectedModel.costInput) + ((outputTokens / 1000000) * selectedModel.costOutput);
        setCostEst(cost);
        return prev;
      });

    } catch (err) {
      console.error(err);
      setOutput(`Error: ${err.message}. Make sure your backend dev server is active and you are authorized.`);
    } finally {
      setIsGenerating(false);
      clearInterval(timer);
    }
  };

  return (
    <div className="playground-container">
      <div className="playground-header">
        <div>
          <h2>Prompt Playground</h2>
          <p className="subtitle">Prototype, variable-template, and test system instructions before deploying to Git</p>
        </div>
        <button className="back-btn" onClick={onBack}>⟵ Exit Playground</button>
      </div>

      <div className="playground-grid">
        {/* Left Control Column */}
        <div className="control-panel">
          <div className="panel-section">
            <h3>1. Select LLM Model</h3>
            <div className="model-selector">
              {MODELS.map(m => (
                <button
                  key={m.id}
                  className={`model-card ${selectedModel.id === m.id ? 'active' : ''}`}
                  onClick={() => setSelectedModel(m)}
                >
                  <div className="model-title">
                    <strong>{m.name}</strong>
                    <span className="badge">{m.provider}</span>
                  </div>
                  <div className="model-desc">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="panel-section">
            <h3>2. Temperature</h3>
            <div className="slider-container">
              <input
                type="range"
                min="0.0"
                max="1.2"
                step="0.1"
                value={temperature}
                onChange={e => setTemperature(parseFloat(e.target.value))}
              />
              <span className="slider-value">{temperature}</span>
            </div>
            <p className="help-text">Lower temperature yields deterministic outputs; higher yields creativity.</p>
          </div>

          <div className="panel-section">
            <h3>3. Template Variables</h3>
            {variableKeys.length === 0 ? (
              <p className="no-vars-text">Add variables using the double curly brace syntax (e.g. <code>{"{{user_name}}"}</code>) in your prompts to template them here.</p>
            ) : (
              <div className="variables-list">
                {variableKeys.map(key => (
                  <div key={key} className="variable-input-group">
                    <label>{key}</label>
                    <input
                      type="text"
                      value={variables[key] || ''}
                      onChange={e => handleVariableChange(key, e.target.value)}
                      placeholder={`Enter value for ${key}`}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Editor & Output Column */}
        <div className="editor-panel">
          <div className="editor-section">
            <div className="section-label">
              <span>SYSTEM PROMPT TEMPLATE</span>
            </div>
            <textarea
              className="prompt-textarea system"
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              placeholder="System prompt instructions..."
            />
          </div>

          <div className="editor-section">
            <div className="section-label">
              <span>USER QUERY TEMPLATE</span>
            </div>
            <textarea
              className="prompt-textarea user"
              value={userQuery}
              onChange={e => setUserQuery(e.target.value)}
              placeholder="User query instructions..."
            />
          </div>

          {/* Run Panel */}
          <div className="action-row">
            <button
              className={`run-btn ${isGenerating ? 'loading' : ''}`}
              onClick={handleRun}
              disabled={isGenerating}
            >
              {isGenerating ? <RefreshCw className="spinner" size={16} /> : <Play size={16} />}
              {isGenerating ? 'Generating Response...' : 'Run Query Node'}
            </button>

            <div className="security-toggle">
              <label>
                <input
                  type="checkbox"
                  checked={securityFilter}
                  onChange={e => setSecurityFilter(e.target.checked)}
                />
                <Shield size={14} style={{ color: securityFilter ? '#10b981' : '#718096' }} />
                <span>Securelytix Guardrails</span>
              </label>
            </div>
          </div>

          {/* Warnings */}
          {securityFilter && piiDetected && (
            <div className="security-alert">
              <Shield size={16} className="alert-icon" />
              <span><strong>Security Flag:</strong> Local PII patterns (email/SSN/phone) detected in templates. Securelytix will detokenize these in production environments.</span>
            </div>
          )}

          {/* Output Panel */}
          <div className="output-section">
            <div className="section-label" style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Terminal size={14} />
                <span>PLAYGROUND OUTLET</span>
              </div>
              <div className="output-tabs" style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className={`out-tab ${activeOutputTab === 'terminal' ? 'active' : ''}`}
                  onClick={() => setActiveOutputTab('terminal')}
                >Terminal Output</button>
                <button 
                  className={`out-tab ${activeOutputTab === 'curl' ? 'active' : ''}`}
                  onClick={() => setActiveOutputTab('curl')}
                >cURL</button>
                <button 
                  className={`out-tab ${activeOutputTab === 'nodejs' ? 'active' : ''}`}
                  onClick={() => setActiveOutputTab('nodejs')}
                >Node.js</button>
                <button 
                  className={`out-tab ${activeOutputTab === 'python' ? 'active' : ''}`}
                  onClick={() => setActiveOutputTab('python')}
                >Python</button>
              </div>
            </div>
            <div className="output-console">
              {activeOutputTab === 'terminal' && (
                output ? (
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({node: _node, ...props}) => <h1 style={{ fontSize: "1.2rem", fontWeight: "800", color: "var(--text-main)", borderBottom: "1px solid var(--border)", paddingBottom: "4px", marginBottom: "12px" }} {...props} />,
                      h2: ({node: _node, ...props}) => <h2 style={{ fontSize: "1.1rem", fontWeight: "800", color: "var(--text-main)", marginBottom: "10px", marginTop: "14px" }} {...props} />,
                      h3: ({node: _node, ...props}) => <h3 style={{ fontSize: "1.05rem", fontWeight: "700", color: "#3b82f6", marginBottom: "8px", marginTop: "12px" }} {...props} />,
                      p: ({node: _node, ...props}) => <p style={{ marginBottom: "10px", lineHeight: "1.6", color: "var(--text-main)" }} {...props} />,
                      li: ({node: _node, ...props}) => <li style={{ marginBottom: "6px", color: "var(--text-main)", lineHeight: "1.6" }} {...props} />,
                      ul: ({node: _node, ...props}) => <ul style={{ marginTop: "4px", marginBottom: "10px", paddingLeft: "1.2rem" }} {...props} />,
                      ol: ({node: _node, ...props}) => <ol style={{ marginTop: "4px", marginBottom: "10px", paddingLeft: "1.2rem" }} {...props} />,
                      strong: ({node: _node, ...props}) => {
                        const text = props.children[0];
                        if (typeof text === 'string') {
                          const lowerText = text.toLowerCase();
                          if (lowerText.includes("action recommended") || lowerText.includes("recommended action")) {
                            return (
                              <span style={{ 
                                display: "inline-flex", 
                                alignItems: "center", 
                                gap: "6px", 
                                backgroundColor: "rgba(59, 130, 246, 0.08)", 
                                color: "#3b82f6", 
                                border: "1px solid rgba(59, 130, 246, 0.2)",
                                padding: "4px 8px", 
                                borderRadius: "6px", 
                                fontWeight: "800", 
                                fontSize: "0.78rem", 
                                textTransform: "uppercase", 
                                letterSpacing: "0.5px",
                                marginRight: "6px"
                              }}>
                                🔧 {text.replace(/:/g, '').trim()}
                              </span>
                            );
                          }
                          if (lowerText.includes("impact analysis") || lowerText.includes("resource savings")) {
                            return (
                              <span style={{ 
                                display: "inline-flex", 
                                alignItems: "center", 
                                gap: "6px", 
                                backgroundColor: "rgba(16, 185, 129, 0.08)", 
                                color: "#10b981", 
                                border: "1px solid rgba(16, 185, 129, 0.2)",
                                padding: "4px 8px", 
                                borderRadius: "6px", 
                                fontWeight: "800", 
                                fontSize: "0.78rem", 
                                textTransform: "uppercase", 
                                letterSpacing: "0.5px",
                                marginRight: "6px"
                              }}>
                                📈 {text.replace(/:/g, '').trim()}
                              </span>
                            );
                          }
                          if (lowerText.includes("risk assessment") || lowerText.includes("critical risk") || lowerText.includes("high risk")) {
                            return (
                              <span style={{ 
                                display: "inline-flex", 
                                alignItems: "center", 
                                gap: "6px", 
                                backgroundColor: "rgba(239, 68, 68, 0.08)", 
                                color: "#ef4444", 
                                border: "1px solid rgba(239, 68, 68, 0.2)",
                                padding: "4px 8px", 
                                borderRadius: "6px", 
                                fontWeight: "800", 
                                fontSize: "0.78rem", 
                                textTransform: "uppercase", 
                                letterSpacing: "0.5px",
                                marginRight: "6px" 
                              }}>
                                ⚠️ {text.replace(/:/g, '').trim()}
                              </span>
                            );
                          }
                        }
                        return <strong style={{ color: "var(--text-main)", fontWeight: "700" }} {...props} />;
                      },
                      code: ({node: _node, inline: _inline, className: _className, children, ...props}) => {
                        return (
                          <code 
                            style={{ 
                              fontFamily: "'JetBrains Mono', 'Fira Code', monospace", 
                              backgroundColor: "rgba(0, 0, 0, 0.04)", 
                              color: "#3b82f6", 
                              padding: "2px 6px", 
                              borderRadius: "6px", 
                              fontSize: "0.9em" 
                            }} 
                            {...props}
                          >
                            {children}
                          </code>
                        );
                      }
                    }}
                  >
                    {output}
                  </ReactMarkdown>
                ) : (
                  <div className="console-placeholder">Click 'Run Query Node' above to compile templates and stream LLM outputs...</div>
                )
              )}
              {activeOutputTab === 'curl' && (
                <pre style={{ color: '#a78bfa' }}>{generateCurlCode()}</pre>
              )}
              {activeOutputTab === 'nodejs' && (
                <pre style={{ color: '#60a5fa' }}>{generateNodeCode()}</pre>
              )}
              {activeOutputTab === 'python' && (
                <pre style={{ color: '#34d399' }}>{generatePythonCode()}</pre>
              )}
            </div>
          </div>

          {/* Telemetry Stats */}
          <div className="telemetry-stats">
            <div className="stat-card">
              <Clock size={16} className="stat-icon" />
              <div>
                <span className="stat-label">Latency</span>
                <span className="stat-val">{(latency / 1000).toFixed(2)}s</span>
              </div>
            </div>
            <div className="stat-card">
              <Layers size={16} className="stat-icon" />
              <div>
                <span className="stat-label">Tokens</span>
                <span className="stat-val">{tokenEst.input}+{tokenEst.output}</span>
              </div>
            </div>
            <div className="stat-card">
              <DollarSign size={16} className="stat-icon" />
              <div>
                <span className="stat-label">Est. Cost</span>
                <span className="stat-val">${costEst.toFixed(6)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
