import express from 'express';
import axios from 'axios';

const router = express.Router();

const DELHI_TOKEN = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7InNvdXJjZSI6IldFQiIsInVjaWQiOiJlZDJjMWNlMi0xOTlhLTE0Y2YtYzEzYi0wYjI0NjRjM2JiZmYifSwiZXhwIjoxNzgyNTM5NDY0LCJpYXQiOjE3ODI0NTMwNjQsImp0aSI6IjY0ZDkxM2Y2LTRhMTgtNDI0Zi1hOWE3LTE1YWZkMTY1YmNmNSJ9.gXQDYGBg5692khlk-XTMJQTyc26kdee4q6GNTuH7wNk';
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

// 3. Reverse Geocode endpoint
router.post('/reverse-geocode', async (req, res) => {
  const { lat, lng } = req.body;
  if (lat === undefined || lng === undefined) {
    return res.status(400).json({ error: 'lat and lng coordinates are required' });
  }

  try {
    const payload = {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "reverse-geocode",
        arguments: { 
          req_id: `rvg-${Date.now()}`,
          lat: Number(lat), 
          lng: Number(lng),
          steps: "false" 
        }
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

    const rvgResult = parseSseResponse(response.data);
    if (!rvgResult) {
      return res.status(500).json({ error: 'Invalid response from Delhivery Maps reverse geocoding service' });
    }

    return res.json(rvgResult);
  } catch (error) {
    console.error('[Delhivery Reverse Geocode Proxy Error]:', error.message);
    return res.status(500).json({ error: 'Error querying Delhivery Reverse Geocoding API', details: error.message });
  }
});

// 4. Search Maps Entities endpoint
router.post('/search-entities', async (req, res) => {
  const { query, lat, lng } = req.body;
  if (!query) {
    return res.status(400).json({ error: 'query string is required' });
  }

  try {
    const payload = {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "search-maps-entities",
        arguments: { 
          query,
          lat: lat !== undefined ? Number(lat) : null,
          lng: lng !== undefined ? Number(lng) : null
        }
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

    const searchResult = parseSseResponse(response.data);
    if (!searchResult) {
      return res.status(500).json({ error: 'Invalid response from Delhivery Maps entities search service' });
    }

    return res.json(searchResult);
  } catch (error) {
    console.error('[Delhivery Search Entities Proxy Error]:', error.message);
    return res.status(500).json({ error: 'Error querying Delhivery Search Entities API', details: error.message });
  }
});

// 5. Directions Route endpoint
router.post('/route', async (req, res) => {
  const { geo_coords, travel_mode } = req.body;
  if (!geo_coords || !Array.isArray(geo_coords) || geo_coords.length < 2) {
    return res.status(400).json({ error: 'geo_coords array with at least 2 coordinate points is required' });
  }

  try {
    const payload = {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "route",
        arguments: { 
          geo_coords,
          travel_mode: travel_mode || "auto",
          decode_geometry: "true"
        }
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

    const routeResult = parseSseResponse(response.data);
    if (!routeResult) {
      return res.status(500).json({ error: 'Invalid response from Delhivery Maps route service' });
    }

    return res.json(routeResult);
  } catch (error) {
    console.error('[Delhivery Route Proxy Error]:', error.message);
    return res.status(500).json({ error: 'Error querying Delhivery Route API', details: error.message });
  }
});

export default router;
