import { v4 as uuidv4 } from 'uuid';

/**
 * Placeholder Cold Email controller – implements the API surface required by the frontend.
 * Each handler returns a simple JSON response so the server starts without crashing.
 * Real business logic (DB access, email generation, etc.) can be added later.
 */

// In‑memory store for demo purposes
const campaigns = {};

export const createCampaign = async (req, res) => {
  const { name, description } = req.body;
  const id = uuidv4();
  campaigns[id] = { id, name, description, contacts: [], status: 'draft' };
  res.status(201).json({ campaign: campaigns[id] });
};

export const getCampaign = async (req, res) => {
  const { id } = req.params;
  const campaign = campaigns[id];
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  res.json({ campaign });
};

export const updateCampaign = async (req, res) => {
  const { id } = req.params;
  const campaign = campaigns[id];
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  const updates = req.body;
  Object.assign(campaign, updates);
  res.json({ campaign });
};

export const deleteCampaign = async (req, res) => {
  const { id } = req.params;
  if (!campaigns[id]) return res.status(404).json({ error: 'Campaign not found' });
  delete campaigns[id];
  res.status(204).end();
};

export const uploadContacts = async (req, res) => {
  const { id } = req.params;
  const campaign = campaigns[id];
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  // Expect an array of contacts in the body for demo purposes
  const contacts = req.body.contacts || [];
  campaign.contacts.push(...contacts);
  res.json({ contacts: campaign.contacts });
};

export const generateTemplates = async (req, res) => {
  const { id } = req.params;
  const campaign = campaigns[id];
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  // Return a mock list of generated email bodies
  const templates = campaign.contacts.map((c, idx) => ({
    contactId: idx,
    subject: `Introducing ${campaign.name}`,
    body: `Hello ${c.name || 'Friend'},\n\nWe have an exciting offer for you...`
  }));
  res.json({ templates });
};

export const launchCampaign = async (req, res) => {
  const { id } = req.params;
  const campaign = campaigns[id];
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  campaign.status = 'sending';
  // In a real implementation we would enqueue email jobs here.
  res.json({ message: 'Campaign launched', campaign });
};

export const getAnalytics = async (req, res) => {
  const { id } = req.params;
  const campaign = campaigns[id];
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  // Mock analytics payload
  const analytics = {
    sent: campaign.contacts.length,
    opened: Math.floor(campaign.contacts.length * 0.4),
    replied: Math.floor(campaign.contacts.length * 0.1),
    clicks: Math.floor(campaign.contacts.length * 0.05)
  };
  res.json({ analytics });
};
