import React, { useEffect, useState, useRef, useMemo } from 'react';
import './TerminalPane.css';

/**
 * Premium Terminal Pane Component
 * Displays live telemetry, tool calls, and LLM traces in real-time.
 * Supports minimizing to clear screen space for the topology graph.
 */
export default function TerminalPane({ agent, onClose, liveLogs = [] }) {
  const [activeTab, setActiveTab] = useState('stdout');
  const [cleared, setCleared] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const terminalEndRef = useRef(null);

  // Construct logs list with system headers
  const visibleLogs = useMemo(() => {
    if (cleared) return [{ text: '[SYSTEM] Terminal buffer cleared.', type: 'system' }];

    const headers = [
      { text: `[SYSTEM] Established secure shell link to: ${agent.name.toUpperCase()}`, type: 'system' },
      { text: `[SYSTEM] Connection Status: ${agent.status.toUpperCase()} | Active Port: 3002`, type: 'system' }
    ];

    if (liveLogs.length === 0) {
      return [
        ...headers,
        { text: `[INFO] Listening for live agent trace calls, database queries, and search telemetry...`, type: 'info' }
      ];
    }

    return [...headers, ...liveLogs];
  }, [liveLogs, cleared, agent]);

  useEffect(() => {
    setCleared(false);
  }, [agent]);

  useEffect(() => {
    if (terminalEndRef.current && !isMinimized) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [visibleLogs, isMinimized]);

  const handleClear = () => {
    setCleared(true);
  };

  return (
    <div className={`terminal-pane-container ${isMinimized ? 'minimized' : ''}`}>
      <div className="terminal-header">
        <div className="terminal-tabs">
          {isMinimized ? (
            <span className="minimized-title">Terminal // node-{agent.id}</span>
          ) : (
            <>
              <button 
                className={`terminal-tab ${activeTab === 'stdout' ? 'active' : ''}`}
                onClick={() => setActiveTab('stdout')}
              >
                Terminal Output
              </button>
              <button 
                className={`terminal-tab ${activeTab === 'config' ? 'active' : ''}`}
                onClick={() => setActiveTab('config')}
              >
                Node Metadata
              </button>
            </>
          )}
        </div>
        <div className="terminal-actions">
          {!isMinimized && <span className="terminal-badge status-online">Connected</span>}
          {!isMinimized && <button className="terminal-btn" onClick={handleClear}>Clear</button>}
          <button 
            className="terminal-minimize-btn" 
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? "Maximize" : "Minimize"}
          >
            {isMinimized ? '🗖' : '🗕'}
          </button>
          {onClose && <button className="terminal-close-btn" onClick={onClose}>×</button>}
        </div>
      </div>

      {!isMinimized && (activeTab === 'stdout' ? (
        <div className="terminal-body">
          {visibleLogs.map((log, index) => (
            <div key={index} className={`terminal-line ${log.type || ''}`}>
              <span className="line-timestamp">{new Date().toLocaleTimeString()}</span>
              <span className="line-text">{log.text}</span>
            </div>
          ))}
          <div className="terminal-cursor-line">
            <span className="line-timestamp">{new Date().toLocaleTimeString()}</span>
            <span className="terminal-prompt">$</span>
            <span className="terminal-cursor"></span>
          </div>
          <div ref={terminalEndRef} />
        </div>
      ) : (
        <div className="terminal-config-view">
          <div className="metadata-table">
            <div className="metadata-row">
              <span className="meta-key">Agent Name:</span>
              <span className="meta-value">{agent.name}</span>
            </div>
            <div className="metadata-row">
              <span className="meta-key">Worker ID:</span>
              <span className="meta-value">node-{agent.id}</span>
            </div>
            <div className="metadata-row">
              <span className="meta-key">Status:</span>
              <span className="meta-value font-online">{agent.status}</span>
            </div>
            <div className="metadata-row">
              <span className="meta-key">Business Function:</span>
              <span className="meta-value">{agent.business_function || 'Core Module'}</span>
            </div>
            <div className="metadata-row">
              <span className="meta-key">Autonomy Rating:</span>
              <span className="meta-value">{agent.autonomy || 'Medium'}</span>
            </div>
            <div className="metadata-row">
              <span className="meta-key">Risk Category:</span>
              <span className="meta-value">{agent.risk_tier || 'Low'}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
