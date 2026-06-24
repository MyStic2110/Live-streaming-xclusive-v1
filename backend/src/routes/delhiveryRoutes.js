import express from 'express';
import axios from 'axios';

const router = express.Router();

const DELHI_TOKEN = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7InNvdXJjZSI6IldFQiIsInVjaWQiOiJlZDJjMWNlMi0xOTlhLTE0Y2YtYzEzYi0wYjI0NjRjM2JiZmYifSwiZXhwIjoxNzgyMzk2Njk0LCJpYXQiOjE3ODIzMTAyOTQsImp0aSI6ImZkY2UwYjJkLWIyZDctNDM5NC1hNzgxLTUzNTE2NTNmZDg5OSJ9.uN13LQf6eDHKGzti9ODqddL3Lq3LEvIaFtAVXuiZiYU';
const MCP_URL = 'https://gateway-maps-pub-int.delhivery.com/mcp';

// Helper to parse SSE formatted JSON-RPC messages from Delhivery MCP
function parseSseResponse(dataStr) {
  let result = null;
  const lines = dataStr.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("data:")) {
      const dataContent = trimmed.substring(5).trim();
      try {
        const parsed = JSON.parse(dataContent);
        if (parsed.result && parsed.result.content) {
          const textResult = parsed.result.content[0].text;
          result = JSON.parse(textResult);
          break;
        }
      } catch (e) {
        // ignore parsing errors for intermediate/unrelated SSE lines
      }
    }
  }
  return result;
}

// 1. Geocode endpoint
router.post('/geocode', async (req, res) => {
  const { address } = req.body;
  if (!address) {
    return res.status(400).json({ error: 'Address string is required' });
  }

  try {
    const payload = {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "geocode-address",
        arguments: { address }
      },
      id: 1
    };

    const response = await axios.post(MCP_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Authorization': DELHI_TOKEN
      },
      responseType: 'text'
    });

    const geocodeResult = parseSseResponse(response.data);
    if (!geocodeResult) {
      return res.status(500).json({ error: 'Invalid response from Delhivery Maps geocoding service' });
    }

    return res.json(geocodeResult);
  } catch (error) {
    console.error('[Delhivery Geocode Proxy Error]:', error.message);
    return res.status(500).json({ error: 'Error querying Delhivery Geocoding API', details: error.message });
  }
});

// 2. Standardize address endpoint
router.post('/standardize', async (req, res) => {
  const { address } = req.body;
  if (!address) {
    return res.status(400).json({ error: 'Address string is required' });
  }

  try {
    const payload = {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "standardize-address",
        arguments: { address }
      },
      id: 1
    };

    const response = await axios.post(MCP_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Authorization': DELHI_TOKEN
      },
      responseType: 'text'
    });

    const standardizeResult = parseSseResponse(response.data);
    if (!standardizeResult) {
      return res.status(500).json({ error: 'Invalid response from Delhivery Maps standardization service' });
    }

    return res.json(standardizeResult);
  } catch (error) {
    console.error('[Delhivery Standardize Proxy Error]:', error.message);
    return res.status(500).json({ error: 'Error querying Delhivery Standardization API', details: error.message });
  }
});

export default router;
