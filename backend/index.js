import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from 'redis';
import { config } from './src/config/livekit.js';
import * as roomController from './src/controllers/roomController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {
  console.log(`[SOCKET] Client connected: ${socket.id}`);
  socket.on("disconnect", () => {
    console.log(`[SOCKET] Client disconnected: ${socket.id}`);
  });
});

// --- REDIS TELEMETRY BRIDGE ---
const redisClient = createClient({ url: 'redis://localhost:6379' });
redisClient.on('error', (err) => console.error('Redis Client Error', err));
await redisClient.connect();

await redisClient.subscribe('octane_telemetry_stream', (message) => {
  try {
    const payload = JSON.parse(message);
    if (payload.alert === true) {
      console.log("[REDIS ALERT] Forwarding alert to frontend clients.");
      io.emit("backend_error", { type: "RUNTIME_ALERT", message: payload.line, timestamp: payload.timestamp });
    }
  } catch(e) {
    // ignore parse error
  }
});

// --- GLOBAL ERROR TELEMETRY ---
const logBackendError = (type, error) => {
  const timestamp = new Date().toISOString();
  const errorMsg = error instanceof Error ? error.stack || error.message : String(error);
  
  const logEntry = `[${timestamp}] [${type}] ${errorMsg}\n`;
  const logPath = path.resolve(__dirname, "../backend_errors.log");
  
  try {
    fs.appendFileSync(logPath, logEntry);
    console.error(`[TELEMETRY] ${type} appended to backend_errors.log`);
    io.emit("backend_error", { type, message: errorMsg, timestamp });
  } catch (err) {
    console.error(`[TELEMETRY] Failed to write error log:`, err);
  }
};

process.on("uncaughtException", (err) => {
  logBackendError("UNCAUGHT_EXCEPTION", err);
});

process.on("unhandledRejection", (reason) => {
  logBackendError("UNHANDLED_REJECTION", reason);
});

// Inject io instance into the controller
roomController.setSocketIO(io);

// --- HTTP Business Routes ---
app.post("/talk-to-ai", roomController.talkToAI);
app.post("/deploy-shadow", roomController.deployShadow);
app.get("/insights", roomController.getAstraInsights);
app.get("/weather", roomController.getWeather);
app.post("/trigger-reels", roomController.triggerReels);

// --- LLM TRACING & TELEMETRY ---
const TRACES_FILE = path.join(__dirname, 'llm_traces_persistent.json');

const loadTraces = () => {
  try {
    if (fs.existsSync(TRACES_FILE)) {
      const data = fs.readFileSync(TRACES_FILE, 'utf8');
      const loaded = JSON.parse(data);
      if (Array.isArray(loaded)) {
        return loaded.slice(0, 100);
      }
    }
  } catch (err) {
    console.error("Failed to load persistent traces:", err);
  }
  return [];
};

const saveTraces = () => {
  try {
    fs.writeFileSync(TRACES_FILE, JSON.stringify(llmTraces, null, 2), 'utf8');
  } catch (err) {
    console.error("Failed to save persistent traces:", err);
  }
};

let llmTraces = loadTraces();
const hallucinationStore = new Map(); // run_id -> evaluation result

app.post("/api/llm-trace", (req, res) => {
  const { event, run_id, data } = req.body;
  
  if (event === "llm_start") {
    const stt_cost = data.stt_cost || 0;
    const tts_cost = data.tts_cost || 0;
    const total_cost = data.total_cost || stt_cost;

    const newTrace = {
      run_id,
      agent: data.agent || null,
      model: data.model,
      inputs: data.inputs,
      outputs: "",
      prompt_tokens: 0,
      completion_tokens: 0,
      input_cost: 0,
      output_cost: 0,
      stt_cost,
      tts_cost,
      llm_cost: 0,
      total_cost,
      status: "streaming",
      timestamp: new Date().toISOString(),
      total_latency: 0,
      ttft: 0,
      tool_latency: 0,
      otps: 0,
      tool_calls: []
    };
    llmTraces.unshift(newTrace);
    if (llmTraces.length > 100) llmTraces.pop();
  } else if (event === "llm_chunk") {
    const trace = llmTraces.find(t => t.run_id === run_id);
    if (trace) {
      trace.outputs += data.chunk;
      const voiceAgents = ['NOVA', 'CORTEX_BI', 'CORTEX_BI2', 'LINA', 'AIVYUH', 'ASTRA', 'MARTECH', 'OCTANE', 'SEVA', 'VONE', 'BI', 'BI2', 'CORTEX', 'CORTEX2'];
      const isVoice = trace.agent && voiceAgents.includes(trace.agent.toUpperCase());
      if (isVoice) {
        trace.tts_cost = (trace.outputs.length / 1000) * 0.015;
        trace.total_cost = trace.llm_cost + trace.stt_cost + trace.tts_cost;
      }
    }
  } else if (event === "llm_end") {
    const trace = llmTraces.find(t => t.run_id === run_id);
    if (trace) {
      trace.outputs         = data.outputs;
      trace.prompt_tokens   = data.prompt_tokens;
      trace.completion_tokens = data.completion_tokens;
      trace.input_cost      = data.input_cost || 0;
      trace.output_cost     = data.output_cost || 0;
      trace.llm_cost        = trace.input_cost + trace.output_cost;
      trace.stt_cost        = data.stt_cost !== undefined ? data.stt_cost : trace.stt_cost || 0;
      trace.tts_cost        = data.tts_cost !== undefined ? data.tts_cost : trace.tts_cost || 0;
      trace.total_cost      = data.total_cost !== undefined ? data.total_cost : (trace.llm_cost + trace.stt_cost + trace.tts_cost);
      trace.agent           = data.agent || trace.agent;
      trace.status          = "completed";
      
      // Update latency metrics
      trace.total_latency   = data.total_latency || trace.total_latency || 0;
      trace.ttft            = data.ttft || trace.ttft || 0;
      trace.tool_latency    = data.tool_latency || trace.tool_latency || 0;
      trace.otps            = data.otps || trace.otps || 0;
    }
  } else if (event === "llm_error") {
    const trace = llmTraces.find(t => t.run_id === run_id);
    if (trace) {
      trace.status          = "failed";
      trace.error_code      = data.error_code || "UNKNOWN_ERROR";
      trace.error_message   = data.error_message || "An error occurred";
      trace.total_latency   = data.total_latency || trace.total_latency || 0;
      trace.agent           = data.agent || trace.agent;
      trace.stt_cost        = data.stt_cost !== undefined ? data.stt_cost : trace.stt_cost || 0;
      trace.tts_cost        = data.tts_cost !== undefined ? data.tts_cost : trace.tts_cost || 0;
      trace.llm_cost        = (trace.input_cost || 0) + (trace.output_cost || 0);
      trace.total_cost      = data.total_cost !== undefined ? data.total_cost : (trace.llm_cost + trace.stt_cost + trace.tts_cost);
    } else {
      const stt_cost = data.stt_cost || 0;
      const tts_cost = data.tts_cost || 0;
      const total_cost = data.total_cost || (stt_cost + tts_cost);
      const newTrace = {
        run_id,
        agent: data.agent || null,
        model: "unknown",
        inputs: [],
        outputs: "",
        prompt_tokens: 0,
        completion_tokens: 0,
        input_cost: 0,
        output_cost: 0,
        stt_cost,
        tts_cost,
        llm_cost: 0,
        total_cost,
        status: "failed",
        error_code: data.error_code || "UNKNOWN_ERROR",
        error_message: data.error_message || "An error occurred",
        timestamp: new Date().toISOString(),
        total_latency: data.total_latency || 0,
        ttft: 0,
        tool_latency: 0,
        otps: 0,
        tool_calls: []
      };
      llmTraces.unshift(newTrace);
      if (llmTraces.length > 100) llmTraces.pop();
    }
  }

  // Enrich emitted socket payload with current cost calculations
  const trace = llmTraces.find(t => t.run_id === run_id);
  if (trace) {
    data.stt_cost = trace.stt_cost;
    data.tts_cost = trace.tts_cost;
    data.llm_cost = trace.llm_cost;
    data.total_cost = trace.total_cost;
  }

  io.emit("llm_trace", { event, run_id, data });
  saveTraces();
  res.json({ success: true });
});

app.post("/api/llm-trace/tool-call", (req, res) => {
  const { run_id, name, duration } = req.body;
  if (!run_id || !name) {
    return res.status(400).json({ error: "run_id and name are required" });
  }

  const trace = llmTraces.find(t => t.run_id === run_id);
  if (trace) {
    if (!trace.tool_calls) trace.tool_calls = [];
    trace.tool_calls.push({ name, duration });
    trace.tool_latency = (trace.tool_latency || 0) + duration;
    
    // Broadcast tool execution to frontend in real-time
    io.emit("llm_trace", { event: "tool_call", run_id, data: { name, duration } });
    console.log(`[TOOL CALL] run=${run_id} tool=${name} duration=${duration}ms`);
    saveTraces();
  }
  res.json({ success: true });
});

app.get("/api/llm-traces", (req, res) => {
  res.json(llmTraces);
});

app.delete("/api/llm-traces", (req, res) => {
  llmTraces = [];
  hallucinationStore.clear();
  io.emit("llm_trace_clear");
  saveTraces();
  res.json({ success: true });
});

// --- HALLUCINATION EVALUATION ---
const JUDGE_SYSTEM_PROMPT = `You are an expert AI hallucination detector.
Given a conversation context (system prompt + user message) and the AI assistant's response,
evaluate whether the response contains hallucinated claims — statements not grounded in the
provided context or factually fabricated information.

Return ONLY valid JSON (no markdown, no code fences):
{
  "score": <float 0.0 to 1.0>,
  "reasoning": "<1-2 sentence summary>",
  "flags": ["<specific unsupported claim>", ...]
}

Score guide:
  0.00-0.20  Fully accurate and grounded in context
  0.21-0.40  Minor unsupported elaborations
  0.41-0.60  Moderate hallucinations present
  0.61-0.80  Significant fabrications detected
  0.81-1.00  Completely hallucinated or fabricated`;

app.post("/api/evaluate-hallucination", async (req, res) => {
  const { run_id, inputs, outputs, model } = req.body;
  if (!run_id || !inputs || !outputs) {
    return res.status(400).json({ error: "run_id, inputs and outputs are required" });
  }

  const contextSummary = inputs
    .map(m => `[${m.role.toUpperCase()}]: ${String(m.content).slice(0, 800)}`)
    .join("\n");

  const judgeMessages = [
    { role: "system", content: JUDGE_SYSTEM_PROMPT },
    { role: "user", content: `CONVERSATION CONTEXT:\n${contextSummary}\n\nAI RESPONSE TO EVALUATE:\n${String(outputs).slice(0, 1200)}` }
  ];

  try {
    const openRouterRes = await fetch(
      `${process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1"}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`
        },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini",
          messages: judgeMessages,
          temperature: 0.1,
          max_tokens: 400
        })
      }
    );

    if (!openRouterRes.ok) {
      const errText = await openRouterRes.text();
      throw new Error(`OpenRouter error: ${openRouterRes.status} ${errText}`);
    }

    const judgeData = await openRouterRes.json();
    const raw = judgeData.choices?.[0]?.message?.content?.trim() || "{}";

    let parsed;
    try {
      // Strip accidental markdown fences
      const clean = raw.replace(/^```[a-z]*\n?/i, "").replace(/```$/g, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      parsed = { score: 0.5, reasoning: "Failed to parse judge response.", flags: [] };
    }

    const result = {
      run_id,
      score:     Math.min(1, Math.max(0, parseFloat(parsed.score) || 0)),
      reasoning: parsed.reasoning || "",
      flags:     Array.isArray(parsed.flags) ? parsed.flags : [],
      evaluated_at: new Date().toISOString()
    };

    hallucinationStore.set(run_id, result);
    io.emit("hallucination_result", result);

    console.log(`[HALLUCINATION] run=${run_id} score=${result.score}`);
    res.json(result);
  } catch (err) {
    console.error("[HALLUCINATION] Evaluation error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/hallucination-results", (req, res) => {
  res.json(Object.fromEntries(hallucinationStore));
});

// --- aivyuh Security Console Routes ---
app.get("/security/status", roomController.getSecurityStatus);
app.post("/security/scan", roomController.runSecurityScan);
app.post("/security/remediate", roomController.updateSecurityConstraint);

// --- Securelytix Detokenization Proxy ---
app.post("/detokenize", async (req, res) => {
  try {
    const { data } = req.body;
    const url = `${process.env.SECURELYTIX_URL || "http://localhost:8080"}/api/v1/detokenize`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.SECURELYTIX_API_KEY}`
      },
      body: JSON.stringify({ data })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Securelytix API error: ${response.status} ${errorText}`);
    }
    
    const result = await response.json();
    res.json(result);
  } catch (error) {
    console.error("[DETOKENIZE] Proxy error:", error.message);
    // On failure, return the original data gracefully to avoid crashing frontend
    res.json({ data: req.body.data });
  }
});

httpServer.listen(config.port, "0.0.0.0", () => {
  console.log(`[ENTERPRISE] Business Layers Active on ${config.port}`);
  console.log(`[ENTERPRISE] LiveKit Target: ${config.livekit.url}`);
});
