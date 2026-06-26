import React from 'react';
import './StatusRibbon.css';

/**
 * Ribbon showing real-time telemetry metrics and system port status pings.
 */
export default function StatusRibbon({ agents, metrics }) {
  const totalAgents = agents.length;
  const onlineAgents = agents.filter(a => a.status === 'online').length;
  
  // Use real CPU/Memory or default to 0 if metrics aren't loaded yet
  const cpuUsage = metrics?.cpu !== undefined ? metrics.cpu : 0.0;
  const memoryUsage = metrics?.memory !== undefined ? metrics.memory : 0.0;
  const activeRooms = metrics?.activeSessions !== undefined ? metrics.activeSessions : 0;
  
  // Compute health index based on microservice statuses
  const services = metrics?.services || {};
  const totalServices = 6;
  const onlineServices = Object.values(services).filter(Boolean).length;
  const healthIndex = Math.round(((onlineAgents + onlineServices) / (totalAgents + totalServices || 1)) * 100);

  return (
    <div className="status-ribbon-container">
      <div className="status-metric-card" title="CPU load average across all cores">
        <span className="metric-icon health">⚡</span>
        <div className="metric-content">
          <span className="metric-label">CPU Usage</span>
          <span className={`metric-value ${cpuUsage > 75 ? 'text-warn' : 'text-health'}`}>{cpuUsage}%</span>
        </div>
      </div>
      
      <div className="status-metric-card" title="Total system RAM allocated">
        <span className="metric-icon">💾</span>
        <div className="metric-content">
          <span className="metric-label">RAM Allocated</span>
          <span className="metric-value">{memoryUsage}%</span>
        </div>
      </div>

      <div className="status-metric-card" title="Currently active LiveKit room sessions">
        <span className="metric-icon online">🟢</span>
        <div className="metric-content">
          <span className="metric-label">Active Sessions</span>
          <span className="metric-value text-online">{activeRooms}</span>
        </div>
      </div>

      <div className="status-metric-card" title="Overall Swarm Core Health percentage">
        <span className="metric-icon health">📈</span>
        <div className="metric-content">
          <span className="metric-label">Swarm Health</span>
          <span className="metric-value text-health">{healthIndex}%</span>
        </div>
      </div>
    </div>
  );
}
