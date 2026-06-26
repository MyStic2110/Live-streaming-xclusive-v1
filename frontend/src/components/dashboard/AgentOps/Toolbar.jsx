import React from 'react';
import './Toolbar.css';

export default function Toolbar() {
  const handleRefresh = () => {
    window.location.reload();
  };

  const handleAudit = () => {
    console.log('Trigger manual compliance audit');
  };

  return (
    <div className="agent-ops-toolbar">
      <button className="toolbar-action-btn primary-btn" onClick={handleAudit}>
        <span>⚡</span> Run Audit
      </button>
      <button className="toolbar-action-btn" onClick={handleRefresh}>
        <span>⟳</span> Refresh Swarm
      </button>
    </div>
  );
}
