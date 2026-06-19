import React from 'react';

export default function ColdEmailCampaignList({ onCreate }) {
  return (
    <div style={{ padding: '2rem' }}>
      <h2>Cold Email Campaigns</h2>
      <p>No campaigns available. Create a new campaign to get started.</p>
      <button onClick={() => { console.log('Create campaign clicked'); onCreate(); }} style={{ padding: '0.5rem 1rem', marginTop: '1rem' }}>
        Create New Campaign
      </button>
    </div>
  );
}
