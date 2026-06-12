import { tokenService } from '../services/tokenService.js';
import { processCopilotMessage } from '../services/copilotService.js';
import crypto from 'crypto';

/**
 * Generate a stable input_id from the prompt messages.
 * SHA-256 of sorted role+content fingerprint — same logic as Python tracer.
 * Identical prompts → identical input_id (cache/dedup detection).
 */
const computeInputId = (messages) => {
  try {
    const fingerprint = JSON.stringify(
      (messages || []).map(m => ({
        role: m?.role || '',
        content: String(m?.content || '').slice(0, 512)
      }))
    );
    return 'inp_' + crypto.createHash('sha256').update(fingerprint).digest('hex').slice(0, 16);
  } catch {
    return null;
  }
};

/** output_id: always unique (stochastic completion) */
const generateOutputId = () => 'out_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);

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
import { query as dbQuery } from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getPythonPath = () => {
  const isWindows = process.platform === "win32";
  const pythonExec = isWindows ? "venv/Scripts/python.exe" : "venv/bin/python";
  return path.resolve(__dirname, `../../../python-agent/${pythonExec}`);
};

const ROOM_NAME  = "ai_room_MURALI";
const USER_ID    = "MURALI";

export const talkToAI = async (req, res) => {
  const { agentType, userName } = req.body; 
  
  // Dynamic Identity: Use provided name or generate a Guest ID
  const userId = userName || `Guest_${Math.floor(Math.random() * 9000) + 1000}`;
  
  let roomName = `lina_session_${userId}`;
  let agentName = "LINA";

  if (agentType === "lina") {
    roomName = `lina_session_${userId}`;
    agentName = "LINA";
  } else if (agentType === "bi") {
    roomName = `bi_session_${userId}`;
    agentName = "BI";
  } else if (agentType === "bi2") {
    roomName = `bi2_session_${userId}`;
    agentName = "CORTEX2";
  } else if (agentType === "nova") {
    roomName = `nova_session_${userId}`;
    agentName = "NOVA";
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
      .filter(f => f.endsWith(".json") && !f.startsWith("idea-"))
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

export const getWeather = async (req, res) => {
  const { latitude, longitude } = req.query;
  if (!latitude || !longitude) {
    return res.status(400).json({ error: "latitude and longitude are required" });
  }
  
  try {
    const url = `https://www.weatherunion.com/gw/weather/external/v0/get_weather_data?latitude=${latitude}&longitude=${longitude}`;
    const response = await fetch(url, {
      headers: {
        "X-Zomato-Api-Key": process.env.ZOMATO_API_KEY || "f2751361b695deef5c9f03f5a7f33bc9"
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
    const pythonPath = getPythonPath();
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

const runNistAnalyzer = () => {
  return new Promise((resolve, reject) => {
    const pythonPath = getPythonPath();
    const scriptPath = path.resolve(__dirname, "../../../python-agent/run_scope_analyzer.py");
    
    console.log(`[NIST] Running analyzer: ${pythonPath} ${scriptPath}`);
    const proc = spawn(pythonPath, [scriptPath]);
    let stdout = "";
    let stderr = "";
    
    proc.stdout.on("data", (data) => { stdout += data.toString(); });
    proc.stderr.on("data", (data) => { stderr += data.toString(); });
    
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`NIST analyzer exited with code ${code}. Error: ${stderr}`));
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

const runNistScanner = () => {
  return new Promise((resolve, reject) => {
    const pythonPath = getPythonPath();
    const nistScannerPath = path.resolve(__dirname, "../../../python-agent/agents/nist/scanner.py");
    
    console.log(`[NIST] Running compliance scanner: ${pythonPath} ${nistScannerPath}`);
    const proc = spawn(pythonPath, [nistScannerPath]);
    let stdout = "";
    let stderr = "";
    
    proc.stdout.on("data", (data) => { stdout += data.toString(); });
    proc.stderr.on("data", (data) => { stderr += data.toString(); });
    
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`NIST scanner exited with code ${code}. Error: ${stderr}`));
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

export const runNistScan = async (req, res) => {
  try {
    const items = await runNistAnalyzer();
    
    if (items && Array.isArray(items)) {
      for (const item of items) {
        const {
          agent_name,
          agent_type,
          business_function,
          autonomy,
          risk_tier,
          capabilities,
          data_classes,
          external_reach,
          applicable_controls,
          non_applicable_controls,
          applicable_count,
          non_applicable_count,
          control_map
        } = item;

        await dbQuery(
          `INSERT INTO agent_analysis (
            agent_name,
            agent_type,
            business_function,
            autonomy,
            risk_tier,
            capabilities,
            data_classes,
            external_reach,
            applicable_controls,
            non_applicable_controls,
            applicable_count,
            non_applicable_count,
            control_map
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (agent_name)
          DO UPDATE SET
            agent_type = EXCLUDED.agent_type,
            business_function = EXCLUDED.business_function,
            autonomy = EXCLUDED.autonomy,
            risk_tier = EXCLUDED.risk_tier,
            capabilities = EXCLUDED.capabilities,
            data_classes = EXCLUDED.data_classes,
            external_reach = EXCLUDED.external_reach,
            applicable_controls = EXCLUDED.applicable_controls,
            non_applicable_controls = EXCLUDED.non_applicable_controls,
            applicable_count = EXCLUDED.applicable_count,
            non_applicable_count = EXCLUDED.non_applicable_count,
            control_map = EXCLUDED.control_map;`,
          [
            agent_name,
            agent_type,
            business_function,
            autonomy,
            risk_tier,
            capabilities,
            data_classes,
            external_reach,
            applicable_controls,
            non_applicable_controls,
            applicable_count,
            non_applicable_count,
            JSON.stringify(control_map)
          ]
        );
      }

      try {
        await dbQuery(
          `INSERT INTO compliance_logs (event_type, severity, agent, details)
           VALUES ($1, $2, $3, $4)`,
          [
            'nist_compliance_audit_completed',
            'info',
            'nist',
            JSON.stringify({
              totalAgentsAudited: items.length,
              raw_scan_result: items
            })
          ]
        );
      } catch (dbErr) {
        console.error("[COMPLIANCE_LOG] Failed to log nist audit to DB:", dbErr.message);
      }
    }
    
    // Also trigger the new NIST scanner to update audit_history.json
    try {
      await runNistScanner();
    } catch (scannerErr) {
      console.error("[SECURITY_CONTROLLER] ❌ NIST compliance scanner script failed:", scannerErr.message);
    }
    
    res.json(items);
  } catch (err) {
    console.error("[SECURITY_CONTROLLER] ❌ NIST Scan error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

export const getSecurityStatus = async (req, res) => {
  try {
    const aivyuhPath = path.resolve(__dirname, "../../../python-agent/agents/aivyuh/audit_history.json");
    const nistPath = path.resolve(__dirname, "../../../python-agent/agents/nist/audit_history.json");
    
    let aivyuhData = {};
    let nistData = {};

    if (fs.existsSync(aivyuhPath)) {
      try {
        aivyuhData = JSON.parse(fs.readFileSync(aivyuhPath, "utf-8"));
      } catch (err) {
        console.error("[SECURITY_CONTROLLER] Error reading Aivyuh status:", err.message);
      }
    }

    if (fs.existsSync(nistPath)) {
      try {
        nistData = JSON.parse(fs.readFileSync(nistPath, "utf-8"));
      } catch (err) {
        console.error("[SECURITY_CONTROLLER] Error reading NIST status:", err.message);
      }
    }

    // Merge logic
    const merged = {};
    const allKeys = new Set([...Object.keys(aivyuhData), ...Object.keys(nistData)]);

    for (const key of allKeys) {
      const aivyuhObj = aivyuhData[key] || {};
      const nistObj = nistData[key] || {};

      merged[key] = {
        timestamp: nistObj.timestamp || aivyuhObj.timestamp || new Date().toISOString(),
        critical_count: aivyuhObj.critical_count !== undefined ? aivyuhObj.critical_count : 0,
        warning_count: aivyuhObj.warning_count !== undefined ? aivyuhObj.warning_count : 0,
        report_summary: aivyuhObj.report_summary || [],
        nist_audit: nistObj.nist_audit || {
          score: 100,
          risk: "LOW",
          controls: []
        }
      };
    }

    res.json(merged);
  } catch (err) {
    console.error("[SECURITY_CONTROLLER] ❌ Status error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

export const runSecurityScan = async (req, res) => {
  try {
    const result = await runScanner(["aivyuh-scan"]);
    
    // Log compliance audit event to database
    if (result && result.success) {
      const { total_agents, critical_issues, warning_issues, compliance_score } = result;
      try {
        await dbQuery(
          `INSERT INTO compliance_logs (event_type, severity, agent, details)
           VALUES ($1, $2, $3, $4)`,
          [
            'aivyuh_swarm_audit_completed',
            critical_issues > 0 ? 'critical' : (warning_issues > 0 ? 'warning' : 'info'),
            'aivyuh',
            JSON.stringify({
              totalAgentsAudited: total_agents,
              criticalIssuesFound: critical_issues,
              warningIssuesFound: warning_issues,
              complianceScore: compliance_score,
              raw_scan_result: result
            })
          ]
        );
      } catch (dbErr) {
        console.error("[COMPLIANCE_LOG] Failed to log aivyuh audit to DB:", dbErr.message);
      }
    }
    
    res.json(result);
  } catch (err) {
    console.error("[SECURITY_CONTROLLER] ❌ Scan error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

export const runAivyuhScan = async (req, res) => {
  try {
    const result = await runScanner(["aivyuh-scan"]);
    
    // Log compliance audit event to database
    if (result && result.success) {
      const { total_agents, critical_issues, warning_issues, compliance_score } = result;
      try {
        await dbQuery(
          `INSERT INTO compliance_logs (event_type, severity, agent, details)
           VALUES ($1, $2, $3, $4)`,
          [
            'aivyuh_swarm_audit_completed',
            critical_issues > 0 ? 'critical' : (warning_issues > 0 ? 'warning' : 'info'),
            'aivyuh',
            JSON.stringify({
              totalAgentsAudited: total_agents,
              criticalIssuesFound: critical_issues,
              warningIssuesFound: warning_issues,
              complianceScore: compliance_score,
              raw_scan_result: result
            })
          ]
        );
      } catch (dbErr) {
        console.error("[COMPLIANCE_LOG] Failed to log aivyuh audit to DB:", dbErr.message);
      }
    }
    
    res.json(result);
  } catch (err) {
    console.error("[SECURITY_CONTROLLER] ❌ Aivyuh Scan error:", err.message);
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
    
    // Log compliance remediation event to database
    if (result && result.new_run) {
      try {
        await dbQuery(
          `INSERT INTO compliance_logs (event_type, severity, agent, details)
           VALUES ($1, $2, $3, $4)`,
          [
            'security_constraint_updated',
            'info',
            'devops_geni',
            JSON.stringify({
              vulnId,
              status,
              cvssScore: result.new_run.cvss,
              openVulnerabilities: result.new_run.open
            })
          ]
        );
      } catch (dbErr) {
        console.error("[COMPLIANCE_LOG] Failed to log constraint update to DB:", dbErr.message);
      }
    }
    
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
    const pythonPath = getPythonPath();
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
      let finalBlogPath = blogPath;
      if (!finalBlogPath.endsWith(".json")) {
        finalBlogPath += ".json";
      }
      absoluteBlogPath = path.resolve(__dirname, `../../../python-agent/agents/astra/blogs/${finalBlogPath}`);
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

export const copilotChat = async (req, res) => {
  const { query, sessionId } = req.body;
  if (!query) {
    return res.status(400).json({ error: "Query is required" });
  }

  // Set response headers for Server-Sent Events (SSE)
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    let activeSessionId = sessionId;

    await processCopilotMessage({
      query,
      sessionId,
      onChunk: (chunk) => {
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      },
      onDone: async ({ response, sessionId: returnedSessionId, runId, model, messages, promptTokens, completionTokens, duration, exception }) => {
        activeSessionId = returnedSessionId;
        res.write(`data: ${JSON.stringify({ sessionId: returnedSessionId })}\n\n`);

        // Emit traces to backend trace logger via local POST requests
        const port = process.env.BACKEND_PORT || "3002";
        const traceUrl = `http://localhost:${port}/api/llm-trace`;

        try {
          if (messages && model) {
            const inputId  = computeInputId(messages);
            const outputId = generateOutputId();

            await fetch(traceUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                event: "llm_start",
                run_id: runId,
                data: {
                  inputs: messages,
                  model: model,
                  agent: "SWARM_COPILOT",
                  input_id: inputId,
                  stt_cost: 0, tts_cost: 0, total_cost: 0,
                  cum_prompt_tokens: 0, cum_completion_tokens: 0, cum_input_cost: 0, cum_output_cost: 0, cum_stt_cost: 0, cum_tts_cost: 0, cum_total_cost: 0
                }
              })
            });

            if (exception) {
              await fetch(traceUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  event: "llm_error",
                  run_id: runId,
                  data: {
                    error_code: "API_ERROR",
                    error_message: exception.message || "Network request failed",
                    total_latency: Math.round(duration * 1000),
                    agent: "SWARM_COPILOT",
                    input_id: inputId,
                    stt_cost: 0, tts_cost: 0, total_cost: 0,
                    cum_prompt_tokens: 0, cum_completion_tokens: 0, cum_input_cost: 0, cum_output_cost: 0, cum_stt_cost: 0, cum_tts_cost: 0, cum_total_cost: 0
                  }
                })
              });
            } else {
              const inputCost = parseFloat(((promptTokens / 1000000) * 0.15).toFixed(6));
              const outputCost = parseFloat(((completionTokens / 1000000) * 0.60).toFixed(6));
              const totalCost = parseFloat((inputCost + outputCost).toFixed(6));
              const otps = duration > 0 ? parseFloat((completionTokens / duration).toFixed(2)) : 0;

              await fetch(traceUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  event: "llm_end",
                  run_id: runId,
                  data: {
                    outputs: response,
                    prompt_tokens: promptTokens,
                    completion_tokens: completionTokens,
                    input_cost: inputCost,
                    output_cost: outputCost,
                    stt_cost: 0, tts_cost: 0,
                    total_cost: totalCost,
                    cum_prompt_tokens: 0, cum_completion_tokens: 0, cum_input_cost: 0, cum_output_cost: 0, cum_stt_cost: 0, cum_tts_cost: 0, cum_total_cost: 0,
                    agent: "SWARM_COPILOT",
                    input_id: inputId,
                    output_id: outputId,
                    total_latency: Math.round(duration * 1000),
                    ttft: Math.round(duration * 1000),
                    tool_latency: 0,
                    otps
                  }
                })
              });
            }
          }
        } catch (e) {
          console.error("[COPILOT] Trace logging failed:", e.message);
        }

        res.write("data: [DONE]\n\n");
        res.end();
      }
    });

  } catch (err) {
    console.error("[COPILOT] Native router failed:", err.message);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
};

export const clearCopilotSession = async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ error: "Session ID is required" });
  }
  try {
    const sessionFile = path.resolve(__dirname, `../../../python-agent/sessions/${sessionId}.json`);
    if (fs.existsSync(sessionFile)) {
      fs.unlinkSync(sessionFile);
      console.log(`[COPILOT] Successfully deleted session file: ${sessionId}.json`);
      res.json({ success: true, message: "Session cleared successfully" });
    } else {
      console.log(`[COPILOT] Session file not found: ${sessionId}.json`);
      res.json({ success: true, message: "Session file already absent" });
    }
  } catch (err) {
    console.error("[COPILOT] Failed to clear session:", err.message);
    res.status(500).json({ error: err.message });
  }
};

