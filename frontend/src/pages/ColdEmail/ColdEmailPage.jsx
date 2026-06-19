import React, { useState } from 'react';
import CampaignList from './CampaignList.jsx';
import CampaignEditor from './CampaignEditor.jsx';

export default function ColdEmailPage() {
  const [showEditor, setShowEditor] = useState(false);

  const handleCreate = () => {
    setShowEditor(true);
  };

  const handleEditorClose = () => {
    setShowEditor(false);
    alert('New campaign created (mock)');
    // after creation we could navigate back or stay on list
    // for simplicity, stay on list view
  };

  const handleBack = () => {
    // navigate back to fleet (home)
    window.history.pushState({}, '', '/');
    window.location.hash = '';
    // trigger hashchange event manually
    const event = new Event('hashchange');
    window.dispatchEvent(event);
  };

  return (
    <div style={{ padding: '2rem' }}>
      <button onClick={handleBack} style={{ marginBottom: '1rem', padding: '0.5rem 1rem' }}>← Back to Dashboard</button>
      <h2 style={{ marginBottom: '1rem', fontSize: '1.8rem', fontWeight: '800', color: '#0f172a' }}>Cold Email Campaign Manager</h2>
      <p style={{ color: '#64748b', marginBottom: '2rem' }}>
        Configure and launch AI‑powered cold email campaigns. This page mirrors the Swarm Copilot UI experience.
      </p>
      {showEditor ? (
        <CampaignEditor onClose={handleEditorClose} />
      ) : (
        <CampaignList onCreate={handleCreate} />
      )}
    </div>
  );
}
