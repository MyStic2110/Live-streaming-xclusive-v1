import React, { useState } from 'react';
import CampaignList from '../../pages/ColdEmail/CampaignList.jsx';
import CampaignEditor from '../../pages/ColdEmail/CampaignEditor.jsx';

export default function ColdEmailPanel({ isOpen, onClose }) {
  if (!isOpen) return null;
  const [showEditor, setShowEditor] = useState(false);
  const handleCreate = () => {
    setShowEditor(true);
  };
  const handleEditorClose = () => {
    setShowEditor(false);
    alert('New campaign created (mock)');
    // optionally keep panel open or close
    // onClose(); // keep panel open to show editor result
  };
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.4)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
    }}>
      <div style={{
        width: '90%',
        maxWidth: '800px',
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(12px)',
        borderRadius: '24px',
        padding: '2rem',
        boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
        position: 'relative',
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'transparent',
            border: 'none',
            fontSize: '1.2rem',
            cursor: 'pointer',
            color: '#64748b',
          }}
        >✕</button>
        <h2 style={{
          marginBottom: '1rem',
          fontSize: '1.8rem',
          fontWeight: '800',
          color: '#0f172a',
        }}>Cold Email Campaign Manager</h2>
        <p style={{ color: '#64748b', marginBottom: '2rem' }}>
          Configure and launch AI‑powered cold email campaigns. This panel mirrors the Swarm Copilot UI experience.
        </p>
        {showEditor ? (
          <CampaignEditor onClose={handleEditorClose} />
        ) : (
          <CampaignList onCreate={handleCreate} />
        )}
      </div>
    </div>
  );
}
