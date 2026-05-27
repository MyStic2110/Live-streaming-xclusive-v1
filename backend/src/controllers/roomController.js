import { tokenService } from '../services/tokenService.js';

let ioInstance = null;
export const setSocketIO = (io) => {
  ioInstance = io;
};
import { AgentDispatchClient } from 'livekit-server-sdk';
import { config } from '../config/livekit.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOM_NAME  = "ai_room_MURALI";
const AGENT_NAME = "AURA";
const USER_ID    = "MURALI";

export const talkToAI = async (req, res) => {
  const { agentType, userName } = req.body; 
  
  // Dynamic Identity: Use provided name or generate a Guest ID
  const userId = userName || `Guest_${Math.floor(Math.random() * 9000) + 1000}`;
  
  let roomName = "ai_room_MURALI";
  let agentName = "AURA";

  if (agentType === "lina") {
    roomName = `lina_session_${userId}`;
    agentName = "LINA";
  } else if (agentType === "vigil") {
    roomName = `audit_session_${userId}`;
    agentName = "VIGIL";
  } else if (agentType === "bi") {
    roomName = `bi_session_${userId}`;
    agentName = "BI";
  } else if (agentType === "bi2") {
    roomName = `bi2_session_${userId}`;
    agentName = "CORTEX2";
  } else if (agentType === "nova") {
    roomName = `nova_session_${userId}`;
    agentName = "NOVA";
  } else if (agentType === "vision") {
    roomName = `vision_session_${userId}`;
    agentName = "VONE";
  } else if (agentType === "aura") {
    roomName = `aura_session_${userId}`;
    agentName = "AURA";
  } else if (agentType === "astra") {
    roomName = `growth_session_${userId}`;
    agentName = "ASTRA";
  } else if (agentType === "rehearsal") {
    roomName = `rehearsal_session_${userId}`;
    agentName = "REHEARSAL";
  } else if (agentType === "seva") {
    roomName = `seva_session_${userId}`;
    agentName = "SEVA";
  } else if (agentType === "martech") {
    roomName = `martech_session_${userId}`;
    agentName = "MARTECH";
  } else if (agentType === "aivyuh") {
    roomName = `security_session_${userId}`;
    agentName = "AIVYUH";
  } else if (agentType === "octane") {
    roomName = `telemetry_session_${userId}`;
    agentName = "OCTANE";
  } else if (agentType === "DEVOPS_GENI") {
    roomName = `devopsgeni_session_${userId}`;
    agentName = "DEVOPS_GENI";
  }

  console.log(`[HTTP_CONTROLLER] --> POST /talk-to-ai | AGENT: ${agentName} | ROOM: ${roomName}`);
  
  try {
    // 1. Generate token
    const { token } = await tokenService.generateToken(userId, roomName, true);
    console.log(`[HTTP_CONTROLLER] Token generated for ${userId}`);

    // 2. Prepare HTTP URL for Dispatch
    const apiUrl = config.livekit.url.replace("ws://", "http://").replace("wss://", "https://");
    
    const dispatchClient = new AgentDispatchClient(
      apiUrl,
      config.livekit.apiKey,
      config.livekit.apiSecret
    );

    // 3. Create Dispatch for the SPECIFIC agent
    // Adding a tiny delay to ensure the server is ready for the dispatch
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const dispatch = await dispatchClient.createDispatch(roomName, agentName);
    console.log(`[HTTP_CONTROLLER] ✅ ${agentName} dispatched successfully!`);

    res.json({ token, roomName: roomName, identity: userId, isAI: true });
  } catch (err) {
    console.error("[HTTP_CONTROLLER] ❌ CRITICAL AI DISPATCH ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
};

export const getAstraInsights = async (req, res) => {
  try {
    const blogsDir = path.join(__dirname, "../../../python-agent/agents/astra/blogs");
    
    if (!fs.existsSync(blogsDir)) {
      return res.json([]);
    }

    const files = fs.readdirSync(blogsDir);
    const insights = files
      .filter(f => f.endsWith(".json"))
      .map(f => {
        const content = fs.readFileSync(path.join(blogsDir, f), "utf-8");
        return JSON.parse(content);
      });

    // Sort by date (newest first)
    insights.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json(insights);
  } catch (err) {
    console.error("[HTTP_CONTROLLER] ❌ Error fetching insights:", err.message);
    res.status(500).json({ error: err.message });
  }
};

export const deployShadow = async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: "Meeting URL is required" });
  }
  console.log(`[HTTP_CONTROLLER] --> POST /deploy-shadow | URL: ${url}`);
  
  try {
    const pythonPath = path.resolve(__dirname, "../../../python-agent/venv/Scripts/python.exe");
    const scriptPath = path.resolve(__dirname, "../../../python-agent/agents/shadow_agent/shadow_bot.py");
    
    console.log(`[HTTP_CONTROLLER] Spawning Shadow Bot background process...`);
    console.log(`Interpreter: ${pythonPath}`);
    console.log(`Script: ${scriptPath}`);
    
    // Spawn Playwright process detached
    const shadowProcess = spawn(pythonPath, [scriptPath, url], {
      detached: true,
      stdio: 'ignore'
    });
    
    shadowProcess.unref(); // Prevent parent waiting for exit
    
    res.json({ success: true, message: "Shadow Agent deployed successfully in the background." });
  } catch (err) {
    console.error("[HTTP_CONTROLLER] ❌ Failed to spawn Shadow Bot:", err.message);
    res.status(500).json({ error: err.message });
  }
};

export const getWeather = async (req, res) => {
  const { latitude, longitude } = req.query;
  if (!latitude || !longitude) {
    return res.status(400).json({ error: "latitude and longitude are required" });
  }
  
  try {
    const url = `https://www.weatherunion.com/gw/weather/external/v0/get_weather_data?latitude=${latitude}&longitude=${longitude}`;
    const response = await fetch(url, {
      headers: {
        "X-Zomato-Api-Key": "f2751361b695deef5c9f03f5a7f33bc9"
      }
    });

    if (!response.ok) {
      throw new Error(`WeatherUnion responded with status: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("[WEATHER_CONTROLLER] ❌ Error fetching weather:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// --- Agent aivyuh Security Controller Operations ---
const runScanner = (args) => {
  return new Promise((resolve, reject) => {
    const pythonPath = path.resolve(__dirname, "../../../python-agent/venv/Scripts/python.exe");
    const scannerPath = path.resolve(__dirname, "../../../python-agent/agents/aivyuh/scanner.py");
    
    console.log(`[SECURITY] Running scanner: ${pythonPath} ${scannerPath} ${args.join(" ")}`);
    const proc = spawn(pythonPath, [scannerPath, ...args]);
    let stdout = "";
    let stderr = "";
    
    proc.stdout.on("data", (data) => { stdout += data.toString(); });
    proc.stderr.on("data", (data) => { stderr += data.toString(); });
    
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Scanner exited with code ${code}. Error: ${stderr}`));
      } else {
        try {
          resolve(JSON.parse(stdout));
        } catch (e) {
          resolve({ raw: stdout });
        }
      }
    });
  });
};

export const getSecurityStatus = async (req, res) => {
  try {
    const result = await runScanner(["status"]);
    res.json(result);
  } catch (err) {
    console.error("[SECURITY_CONTROLLER] ❌ Status error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

export const runSecurityScan = async (req, res) => {
  try {
    const result = await runScanner(["scan"]);
    res.json(result);
  } catch (err) {
    console.error("[SECURITY_CONTROLLER] ❌ Scan error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

export const updateSecurityConstraint = async (req, res) => {
  const { vulnId, status } = req.body;
  try {
    if (vulnId === "all") {
      const keys = ["llm01", "llm02", "llm03", "llm04", "llm05", "llm06", "llm07", "llm08", "llm09", "llm10"];
      for (const k of keys) {
        await runScanner(["update", k, status]);
      }
    } else {
      await runScanner(["update", vulnId, status]);
    }
    const result = await runScanner(["scan"]);
    res.json(result);
  } catch (err) {
    console.error("[SECURITY_CONTROLLER] ❌ Update error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

export const triggerReels = async (req, res) => {
  const { blogPath, agentType, freeIdea } = req.body;
  if (!blogPath && !freeIdea) {
    return res.status(400).json({ error: "blogPath or freeIdea is required" });
  }
  if (!agentType) {
    return res.status(400).json({ error: "agentType is required" });
  }
  
  try {
    const pythonPath = path.resolve(__dirname, "../../../python-agent/venv/Scripts/python.exe");
    const scriptName = agentType === "face" ? "reels_face_agent.py" : "reels_agent.py";
    const scriptPath = path.resolve(__dirname, `../../../python-agent/agents/reels/${scriptName}`);
    
    let absoluteBlogPath;
    let generatedSlug = null;
    if (freeIdea) {
      generatedSlug = "idea-" + Math.random().toString(36).substring(2, 8);
      absoluteBlogPath = path.resolve(__dirname, `../../../python-agent/agents/astra/blogs/${generatedSlug}.json`);
      const tempBlogData = {
        slug: generatedSlug,
        title: "Freeform Idea",
        excerpt: freeIdea,
        content: freeIdea,
        date: new Date().toISOString()
      };
      fs.writeFileSync(absoluteBlogPath, JSON.stringify(tempBlogData, null, 2));
    } else {
      absoluteBlogPath = path.resolve(__dirname, `../../../python-agent/agents/astra/blogs/${blogPath}`);
    }

    console.log(`[HTTP_CONTROLLER] Spawning Reels Agent (${agentType}) in background...`);
    console.log(`Blog/Idea: ${absoluteBlogPath}`);
    
    const reelsProcess = spawn(pythonPath, [scriptPath, absoluteBlogPath], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    if (ioInstance) {
      reelsProcess.stdout.on('data', (data) => {
        ioInstance.emit('reels_progress', { slug: generatedSlug || blogPath, data: data.toString() });
      });
      reelsProcess.stderr.on('data', (data) => {
        ioInstance.emit('reels_progress', { slug: generatedSlug || blogPath, data: data.toString() });
      });
    }

    reelsProcess.unref();
    
    res.json({ success: true, message: `Reels Agent (${agentType}) deployed successfully in the background.`, slug: generatedSlug });
  } catch (err) {
    console.error(`[HTTP_CONTROLLER] ❌ Failed to spawn Reels Agent (${agentType}):`, err.message);
    res.status(500).json({ error: err.message });
  }
};
