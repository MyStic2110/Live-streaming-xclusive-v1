import React from 'react';

export default function CampaignEditor({ campaignId, onClose }) {
  return (
    <div style={{ padding: '2rem' }}>
      <h2>{campaignId ? 'Edit Campaign' : 'Create New Campaign'}</h2>
      <p>Campaign editor UI will be implemented here.</p>
      {/* Placeholder form fields */}
      <form>
        <div style={{ marginBottom: '1rem' }}>
          <label>Campaign Name:</label><br />
          <input type="text" placeholder="Enter name" style={{ width: '100%' }} />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label>Description:</label><br />
          <textarea placeholder="Enter description" rows={4} style={{ width: '100%' }} />
        </div>
        <button type="submit" style={{ padding: '0.5rem 1rem' }}>Save</button>
        <button type="button" onClick={onClose} style={{ marginLeft: '1rem', padding: '0.5rem 1rem' }}>Cancel</button>
      </form>
    </div>
  );
}
