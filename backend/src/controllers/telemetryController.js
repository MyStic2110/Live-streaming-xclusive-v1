import { query } from '../config/db.js';
import { asyncHandler } from '../middlewares/errorHandler.js';

let ioInstance = null;
const hallucinationStore = new Map();

export const setSocketIO = (io) => {
  ioInstance = io;
};

const estimateSpokenChars = (text) => {
  if (!text) return 0;
  let cleanText = text.replace(/```[\s\S]*?```/g, " [code block omitted, please refer to the cockpit console card] ");
  cleanText = cleanText.replace(/`/g, "");
  cleanText = cleanText.replace(/\*\*|__/g, "");
  cleanText = cleanText.replace(/\*|_/g, "");
  cleanText = cleanText.replace(/^#+\s+/gm, "");
  cleanText = cleanText.replace(/\[([\s\S]*?)\]\([\s\S]*?\)/g, "$1");
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}]/gu;
  cleanText = cleanText.replace(emojiRegex, "");
  
  const MAX_CHAR_LIMIT = 800;
  if (cleanText.length > MAX_CHAR_LIMIT) {
    let truncated = cleanText.substring(0, MAX_CHAR_LIMIT);
    let lastPeriod = truncated.lastIndexOf(".");
    if (lastPeriod > MAX_CHAR_LIMIT / 2) {
      cleanText = truncated.substring(0, lastPeriod + 1) + " [response truncated, please check the console cards for the full report]";
    } else {
      cleanText = truncated + "... [response truncated, please check the console cards for the full report]";
    }
  }
  return cleanText.length;
};

const parseJson = (val) => {
  if (!val) return [];
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch (e) {
      return [];
    }
  }
  return val;
};

export const handleLlmTrace = async (req, res) => {
  const { event, run_id, data } = req.body;
  const input_id  = data?.input_id  || null;
  const output_id = data?.output_id || null;

  try {
    if (event === "llm_start") {
      const sttCost = data.stt_cost || 0;
      const ttsCost = data.tts_cost || 0;
      const totalCost = data.total_cost || sttCost;
      const inputsJson = JSON.stringify(data.inputs || []);

      await query(
        `INSERT INTO traces (
          run_id, input_id, agent, model, inputs, outputs, 
          prompt_tokens, completion_tokens, input_cost, output_cost, 
          stt_cost, tts_cost, total_cost, status, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (run_id) DO UPDATE SET
          input_id = COALESCE(EXCLUDED.input_id, traces.input_id),
          agent = EXCLUDED.agent,
          model = EXCLUDED.model,
          inputs = EXCLUDED.inputs,
          outputs = EXCLUDED.outputs,
          prompt_tokens = EXCLUDED.prompt_tokens,
          completion_tokens = EXCLUDED.completion_tokens,
          input_cost = EXCLUDED.input_cost,
          output_cost = EXCLUDED.output_cost,
          stt_cost = EXCLUDED.stt_cost,
          tts_cost = EXCLUDED.tts_cost,
          total_cost = EXCLUDED.total_cost,
          status = EXCLUDED.status,
          timestamp = EXCLUDED.timestamp`,
        [
          run_id, input_id, data.agent || null, data.model || 'unknown', inputsJson, "",
          0, 0, 0, 0,
          sttCost, ttsCost, totalCost, "streaming", new Date()
        ]
      );
    } else if (event === "llm_chunk") {
      const traceRes = await query('SELECT * FROM traces WHERE run_id = $1', [run_id]);
      if (traceRes.rows.length > 0) {
        const trace = traceRes.rows[0];
        let outputs = (trace.outputs || '') + data.chunk;
        let ttsCost = parseFloat(trace.tts_cost || 0);
        let totalCost = parseFloat(trace.total_cost || 0);
        
        const voiceAgents = ['NOVA', 'CORTEX_BI', 'CORTEX_BI2', 'LINA', 'AIVYUH', 'ASTRA', 'MARTECH', 'OCTANE', 'SEVA', 'VONE', 'BI', 'BI2', 'CORTEX', 'CORTEX2'];
        const isVoice = trace.agent && voiceAgents.includes(trace.agent.toUpperCase());
        if (isVoice) {
          const spokenLen = estimateSpokenChars(outputs);
          ttsCost = parseFloat(((spokenLen / 1000) * 0.015).toFixed(6));
          const llmCost = parseFloat(((parseFloat(trace.input_cost) || 0) + (parseFloat(trace.output_cost) || 0)).toFixed(6));
          totalCost = parseFloat((llmCost + (parseFloat(trace.stt_cost) || 0) + ttsCost).toFixed(6));
        }
        
        await query(
          'UPDATE traces SET outputs = $1, tts_cost = $2, total_cost = $3 WHERE run_id = $4',
          [outputs, ttsCost, totalCost, run_id]
        );
      }
    } else if (event === "llm_end") {
      const inputCost = data.input_cost || 0;
      const outputCost = data.output_cost || 0;
      const llmCost = parseFloat((inputCost + outputCost).toFixed(6));
      const sttCost = data.stt_cost !== undefined ? data.stt_cost : 0;
      const ttsCost = data.tts_cost !== undefined ? data.tts_cost : 0;
      const totalCost = data.total_cost !== undefined ? data.total_cost : parseFloat((llmCost + sttCost + ttsCost).toFixed(6));

      await query(
        `UPDATE traces SET
          outputs = $1,
          prompt_tokens = $2,
          completion_tokens = $3,
          input_cost = $4,
          output_cost = $5,
          stt_cost = $6,
          tts_cost = $7,
          total_cost = $8,
          agent = $9,
          status = $10,
          total_latency = $11,
          ttft = $12,
          tool_latency = $13,
          otps = $14,
          output_id = $15
        WHERE run_id = $16`,
        [
          data.outputs, data.prompt_tokens || 0, data.completion_tokens || 0,
          inputCost, outputCost, sttCost, ttsCost, totalCost,
          data.agent || null, "completed", data.total_latency || 0,
          data.ttft || 0, data.tool_latency || 0, data.otps || 0,
          output_id,
          run_id
        ]
      );

      // Auto-trigger background hallucination evaluation
      if (process.env.OPENROUTER_API_KEY) {
        setTimeout(async () => {
          try {
            const traceRes = await query('SELECT * FROM traces WHERE run_id = $1', [run_id]);
            if (traceRes.rows.length > 0) {
              const trace = traceRes.rows[0];
              const inputs = parseJson(trace.inputs);
              const outputs = trace.outputs;
              
              if (inputs && inputs.length > 0 && outputs) {
                const contextSummary = inputs
                  .map(m => `[${(m.role || 'user').toUpperCase()}]: ${String(m.content || '').slice(0, 800)}`)
                  .join("\n");
                
                const judgeMessages = [
                  { role: "system", content: JUDGE_SYSTEM_PROMPT },
                  { role: "user", content: `CONVERSATION CONTEXT:\n${contextSummary}\n\nAI RESPONSE TO EVALUATE:\n${String(outputs).slice(0, 1200)}` }
                ];
                
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
                
                if (openRouterRes.ok) {
                  const judgeData = await openRouterRes.json();
                  if (judgeData) {
                    const raw = judgeData.choices?.[0]?.message?.content?.trim() || "{}";
                    let parsed;
                    try {
                      const clean = raw.replace(/^```[a-z]*\n?/i, "").replace(/```$/g, "").trim();
                      parsed = JSON.parse(clean);
                    } catch {
                      parsed = { score: 0.5, reasoning: "Failed to parse judge response.", flags: [] };
                    }
                    
                    const result = {
                      run_id,
                      score: Math.min(1, Math.max(0, parseFloat(parsed.score) || 0)),
                      reasoning: parsed.reasoning || "",
                      flags: Array.isArray(parsed.flags) ? parsed.flags : [],
                      evaluated_at: new Date().toISOString()
                    };
                    
                    hallucinationStore.set(run_id, result);
                    if (ioInstance) {
                      ioInstance.emit("hallucination_result", result);
                    }
                  }
                }
              }
            }
          } catch (evalErr) {
            console.error("[TELEMETRY] Auto-evaluation failed:", evalErr.message);
          }
        }, 1500);
      }
    } else if (event === "llm_error") {
      const inputCost = data.input_cost || 0;
      const outputCost = data.output_cost || 0;
      const llmCost = parseFloat((inputCost + outputCost).toFixed(6));
      const sttCost = data.stt_cost !== undefined ? data.stt_cost : 0;
      const ttsCost = data.tts_cost !== undefined ? data.tts_cost : 0;
      const totalCost = data.total_cost !== undefined ? data.total_cost : parseFloat((llmCost + sttCost + ttsCost).toFixed(6));
      
      const errorDetailsJson = JSON.stringify({
        code: data.error_code || "UNKNOWN_ERROR",
        message: data.error_message || "An error occurred"
      });

      await query(
        `INSERT INTO traces (
          run_id, agent, status, error_details, 
          total_latency, stt_cost, tts_cost, total_cost, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (run_id) DO UPDATE SET
          agent = EXCLUDED.agent,
          status = EXCLUDED.status,
          error_details = EXCLUDED.error_details,
          total_latency = EXCLUDED.total_latency,
          stt_cost = EXCLUDED.stt_cost,
          tts_cost = EXCLUDED.tts_cost,
          total_cost = EXCLUDED.total_cost`,
        [
          run_id, data.agent || null, "failed", errorDetailsJson,
          data.total_latency || 0, sttCost, ttsCost, totalCost, new Date()
        ]
      );
    }

    // Retrieve the updated trace to include costs in socket event
    const updatedTraceRes = await query('SELECT * FROM traces WHERE run_id = $1', [run_id]);
    if (updatedTraceRes.rows.length > 0 && data) {
      const updatedTrace = updatedTraceRes.rows[0];
      data.stt_cost = parseFloat(updatedTrace.stt_cost || 0);
      data.tts_cost = parseFloat(updatedTrace.tts_cost || 0);
      data.llm_cost = parseFloat(((parseFloat(updatedTrace.input_cost) || 0) + (parseFloat(updatedTrace.output_cost) || 0)).toFixed(6));
      data.total_cost = parseFloat(updatedTrace.total_cost || 0);
    }

    if (ioInstance) {
      ioInstance.emit("llm_trace", { event, run_id, data });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("[TELEMETRY_CONTROLLER] Trace error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

export const handleToolCall = async (req, res) => {
  const { run_id, name, duration } = req.body;
  if (!run_id || !name) {
    return res.status(400).json({ error: "run_id and name are required" });
  }

  try {
    const traceRes = await query('SELECT * FROM traces WHERE run_id = $1', [run_id]);
    if (traceRes.rows.length > 0) {
      const trace = traceRes.rows[0];
      const toolCalls = parseJson(trace.tool_calls);
      toolCalls.push({ name, duration });
      const toolLatency = (parseFloat(trace.tool_latency) || 0) + duration;
      
      await query(
        'UPDATE traces SET tool_calls = $1, tool_latency = $2 WHERE run_id = $3',
        [JSON.stringify(toolCalls), toolLatency, run_id]
      );

      if (ioInstance) {
        ioInstance.emit("llm_trace", { event: "tool_call", run_id, data: { name, duration } });
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.error("[TELEMETRY_CONTROLLER] Tool call error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

export const getTraces = asyncHandler(async (req, res) => {
  // Query params are validated/coerced upstream (tracesQuerySchema):
  // limit (1-500, default 100), offset (>=0), optional agent + status filters.
  const { limit = 100, offset = 0, agent, status } = req.query;

  const conditions = [];
  const params = [];
  if (agent) { params.push(agent); conditions.push(`agent = $${params.length}`); }
  if (status) { params.push(status); conditions.push(`status = $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  params.push(limit); const limitIdx = params.length;
  params.push(offset); const offsetIdx = params.length;

  const tracesRes = await query(
    `SELECT * FROM traces ${where} ORDER BY timestamp DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params
  );
  const formatted = tracesRes.rows.map(t => ({
      run_id: t.run_id,
      input_id: t.input_id || null,
      output_id: t.output_id || null,
      agent: t.agent,
      model: t.model,
      inputs: parseJson(t.inputs),
      outputs: t.outputs,
      prompt_tokens: t.prompt_tokens,
      completion_tokens: t.completion_tokens,
      input_cost: parseFloat(t.input_cost || 0),
      output_cost: parseFloat(t.output_cost || 0),
      stt_cost: parseFloat(t.stt_cost || 0),
      tts_cost: parseFloat(t.tts_cost || 0),
      total_cost: parseFloat(t.total_cost || 0),
      status: t.status,
      timestamp: t.timestamp,
      total_latency: parseFloat(t.total_latency || 0),
      ttft: parseFloat(t.ttft || 0),
      tool_latency: parseFloat(t.tool_latency || 0),
      otps: parseFloat(t.otps || 0),
      tool_calls: parseJson(t.tool_calls)
    }));
  res.json(formatted);
});

export const clearTraces = async (req, res) => {
  try {
    await query('TRUNCATE TABLE traces');
    hallucinationStore.clear();
    if (ioInstance) {
      ioInstance.emit("llm_trace_clear");
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

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

export const evaluateHallucination = async (req, res) => {
  const { run_id, inputs, outputs } = req.body;

  if (!run_id || outputs === undefined || outputs === null) {
    return res.status(400).json({ error: "run_id and outputs are required" });
  }

  const cleanInputs = inputs || [];

  if (typeof outputs === 'string' && outputs.trim() === '') {
    const result = {
      run_id,
      score: 0.0,
      reasoning: "The assistant did not produce any text output to evaluate.",
      flags: [],
      evaluated_at: new Date().toISOString()
    };
    hallucinationStore.set(run_id, result);
    if (ioInstance) {
      ioInstance.emit("hallucination_result", result);
    }
    return res.json(result);
  }

  const contextSummary = cleanInputs
    .map(m => `[${(m.role || 'user').toUpperCase()}]: ${String(m.content || '').slice(0, 800)}`)
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
      const clean = raw.replace(/^```[a-z]*\n?/i, "").replace(/```$/g, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      parsed = { score: 0.5, reasoning: "Failed to parse judge response.", flags: [] };
    }

    const result = {
      run_id,
      score: Math.min(1, Math.max(0, parseFloat(parsed.score) || 0)),
      reasoning: parsed.reasoning || "",
      flags: Array.isArray(parsed.flags) ? parsed.flags : [],
      evaluated_at: new Date().toISOString()
    };

    hallucinationStore.set(run_id, result);
    if (ioInstance) {
      ioInstance.emit("hallucination_result", result);
    }

    res.json(result);
  } catch (err) {
    console.error("[TELEMETRY_CONTROLLER] Evaluation error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

export const getHallucinations = async (req, res) => {
  res.json(Object.fromEntries(hallucinationStore));
};

export const detokenize = async (req, res) => {
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
    res.json({ data: req.body.data });
  }
};

export const runPlaygroundChat = async (req, res) => {
  const { systemPrompt, userQuery, model, temperature } = req.body;

  if (!userQuery) {
    return res.status(400).json({ error: "userQuery is required" });
  }

  const messages = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: userQuery });

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
          model: model || "openai/gpt-4o-mini",
          messages,
          temperature: temperature !== undefined ? parseFloat(temperature) : 0.7,
          max_tokens: 1000
        })
      }
    );

    if (!openRouterRes.ok) {
      const errText = await openRouterRes.text();
      return res.status(openRouterRes.status).json({ error: `OpenRouter error: ${errText}` });
    }

    const data = await openRouterRes.json();
    res.json(data);
  } catch (err) {
    console.error("[PLAYGROUND_CONTROLLER] LLM run error:", err.message);
    res.status(500).json({ error: err.message });
  }
};
