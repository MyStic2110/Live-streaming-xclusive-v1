import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths resolving to the python-agent workspaces
const BASE_DIR = path.resolve(__dirname, "../../../python-agent");
const KNOWLEDGE_DIR = path.join(BASE_DIR, "knowledge");
const PROMPTS_DIR = path.join(BASE_DIR, "prompts");
const SESSIONS_DIR = path.join(BASE_DIR, "sessions");
const AIVYUH_DIR = path.join(BASE_DIR, "agents/aivyuh");

// Ensure sessions directory exists
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

// Normalized text helper
const normalize = (text) => {
  if (!text) return "";
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
};

// --- INPUT GUARDRAIL ---
const dbUrlPattern = /\b(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis(?:s)?|sqlite|mssql|amqp(?:s)?):\/\/(?:[a-zA-Z0-9_-]+(?::[a-zA-Z0-9_%-]+)?@)?[^\s]+\b/i;
const creditCardPattern = /\b(?:\d[ -]*?){13,16}\b/;
const envSnippetPattern = /\b(?:ENV_|PASSWORD|SECRET_KEY|DB_)\w*\b/i;
const secretPattern = /\b[a-zA-Z0-9_-]{32,}\b/g;
const emailPattern = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/;
const jailbreakPatterns = [
  /ignore (?:all )?previous instructions/i,
  /reveal your system prompt/i,
  /act as/i,
  /developer mode/i,
  /\bDAN\b/,
  /override security/i
];

const validateInput = (query) => {
  for (const pattern of jailbreakPatterns) {
    if (pattern.test(query)) {
      return [false, "I can only answer questions related to the Swarm Agentic Platform."];
    }
  }

  if (dbUrlPattern.test(query)) {
    return [false, "This is not needed for us. Please do not input sensitive information such as database connection strings, API keys, passwords, or credit card numbers."];
  }

  if (creditCardPattern.test(query)) {
    return [false, "This is not needed for us. Please do not input sensitive information such as database connection strings, API keys, passwords, or credit card numbers."];
  }

  if (envSnippetPattern.test(query)) {
    if (query.includes("=") || query.includes(":")) {
      return [false, "This is not needed for us. Please do not input sensitive information such as database connection strings, API keys, passwords, or credit card numbers."];
    }
  }

  const potentialSecrets = query.match(secretPattern) || [];
  for (const secret of potentialSecrets) {
    if (emailPattern.test(secret)) {
      continue;
    }
    return [false, "This is not needed for us. Please do not input sensitive information such as database connection strings, API keys, passwords, or credit card numbers."];
  }

  return [true, ""];
};

// --- OUTPUT GUARDRAIL ---
const competitors = ["crewai", "autogen", "langchain", "semantic kernel"];
const urlPattern = /https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?/g;
const leakPatterns = [
  /approved_knowledge/i,
  /system prompt/i,
  /internal instruction/i,
  /<approved_knowledge>/i
];

const verifyOutput = (generatedResponse, allowedUrls) => {
  const responseLower = generatedResponse.toLowerCase();

  if (competitors.some(comp => responseLower.includes(comp))) {
    return "Please evaluate platforms based on your business requirements. I can explain Swarm capabilities and features.";
  }

  for (const pattern of leakPatterns) {
    if (pattern.test(generatedResponse)) {
      return "I can only answer questions related to the Swarm Agentic Platform.";
    }
  }

  const foundUrls = generatedResponse.match(urlPattern) || [];
  let responseCopy = generatedResponse;
  for (const url of foundUrls) {
    const cleanUrl = url.replace(/[.,;!)?}]$/, "");
    if (!allowedUrls.has(cleanUrl)) {
      responseCopy = responseCopy.replace(url, "https://swarm.ai");
    }
  }

  return responseCopy;
};

// --- CONTEXT ROUTER ---
const routerMapping = {
  pricing: [
    "price", "pricing", "cost", "tier", "subscription", "plan", "freetrial",
    "enterprise", "pay", "billing", "discount", "license"
  ],
  integrations: [
    "slack", "github", "webhook", "api", "integration", "connect",
    "integrate", "notification", "workflowtrigger"
  ],
  security: [
    "soc2", "gdpr", "compliance", "encryption", "privacy", "secure",
    "dataresidency", "sso", "saml", "tls", "aes256", "auth",
    "owasp", "audit", "scanner", "scan", "runs", "history",
    "deploy", "deployment", "governed", "onprem", "onpremises",
    "privatecloud", "hybrid", "vpc", "kubernetes", "k8s",
    "dockercompose", "hardware", "requirements"
  ],
  features: [
    "workflow", "capabilities", "limit", "run", "platform",
    "create", "delete", "humanintheloop", "designer", "sandbox"
  ],
  agents: [
    "agent", "prebuilt", "builtin", "listagents", "whatagents", "showagents",
    "astra", "devopsgeni", "aivyuh", "nova", "seva", "octane", "reels",
    "rehearsal", "silentrehearsal", "shadowagent", "lina", "martech",
    "vision", "weatheragent", "cortex", "bi"
  ]
};

// Load knowledge files on demand/cache
const kbCache = {};
const loadKnowledgeFiles = () => {
  if (Object.keys(kbCache).length > 0) return;
  if (!fs.existsSync(KNOWLEDGE_DIR)) return;
  const files = fs.readdirSync(KNOWLEDGE_DIR);
  for (const file of files) {
    if (file.endsWith(".json")) {
      const vertical = file.replace(".json", "");
      try {
        const content = fs.readFileSync(path.join(KNOWLEDGE_DIR, file), "utf-8");
        kbCache[vertical] = JSON.parse(content);
      } catch (e) {
        console.error(`Failed to load knowledge vertical: ${vertical}`, e);
      }
    }
  }
};

const routeContext = (query, lastVertical) => {
  loadKnowledgeFiles();

  const queryLower = query.toLowerCase();
  const queryNorm = normalize(query);
  const queryClean = queryLower.trim().replace(/[!?.]$/, "");
  const greetings = new Set(["hi", "hello", "hey", "yo", "greetings", "goodmorning", "goodafternoon", "goodevening"]);
  const isGreeting = greetings.has(normalize(queryClean));

  let matchedVerticals = [];

  for (const [vertical, keywords] of Object.entries(routerMapping)) {
    for (const keyword of keywords) {
      const kwNorm = normalize(keyword);
      if (queryNorm.includes(kwNorm) || queryLower.includes(keyword.toLowerCase())) {
        matchedVerticals.push(vertical);
        break;
      }
    }
  }

  if (matchedVerticals.length === 0) {
    if (kbCache[lastVertical] && !isGreeting) {
      matchedVerticals = [lastVertical];
    } else {
      matchedVerticals = ["faq"];
    }
  }

  const mergedContext = {};
  const allowedUrls = new Set(["https://swarm.ai", "https://docs.swarm.ai"]);

  for (const vertical of matchedVerticals) {
    if (kbCache[vertical]) {
      const verticalData = JSON.parse(JSON.stringify(kbCache[vertical]));
      
      if (vertical === "security") {
        const runsPath = path.join(AIVYUH_DIR, "audit_runs.json");
        const historyPath = path.join(AIVYUH_DIR, "audit_history.json");
        if (fs.existsSync(runsPath)) {
          try {
            verticalData["live_audit_runs"] = JSON.parse(fs.readFileSync(runsPath, "utf-8"));
          } catch (e) {}
        }
        if (fs.existsSync(historyPath)) {
          try {
            verticalData["live_audit_history"] = JSON.parse(fs.readFileSync(historyPath, "utf-8"));
          } catch (e) {}
        }
      }

      if (vertical === "agents" && verticalData["agent_details"]) {
        const queryLower = query.toLowerCase();
        // Identify which agents are mentioned in the query.
        const mentionedAgents = verticalData["agent_details"].filter(agent => {
          if (agent.id === 'bi') {
            const biRegex = /\bbi\b/i;
            return biRegex.test(queryLower) || queryLower.includes("cortex");
          }
          const idMatch = queryLower.includes(agent.id.toLowerCase());
          const nameWords = agent.name.toLowerCase().split(/[^a-z0-9]+/);
          const nameMatch = nameWords.some(word => word.length > 2 && queryLower.includes(word));
          return idMatch || nameMatch;
        });

        if (mentionedAgents.length > 0) {
          // If specific agents are mentioned, keep full details for them, but only id/name for others
          verticalData["agent_details"] = verticalData["agent_details"].map(agent => {
            const isMentioned = mentionedAgents.some(ma => ma.id === agent.id);
            if (isMentioned) {
              const { methods, ...rest } = agent;
              return rest;
            } else {
              return { id: agent.id, name: agent.name };
            }
          });
        } else {
          // If no specific agent is mentioned, keep all agents but only their basic details (id, name, status, purpose)
          // to answer general questions (e.g. "what agents are there") while saving context space.
          verticalData["agent_details"] = verticalData["agent_details"].map(agent => {
            return {
              id: agent.id,
              name: agent.name,
              status: agent.status,
              purpose: agent.purpose
            };
          });
        }
      }

      mergedContext[vertical] = verticalData;

      // Extract allowed URLs
      const serialized = JSON.stringify(verticalData);
      const urls = serialized.match(urlPattern) || [];
      for (const url of urls) {
        allowedUrls.add(url.replace(/[.,;!)?}]$/, ""));
      }
    }
  }

  return {
    contextJson: JSON.stringify(mergedContext, null, 2),
    matchedVerticals,
    allowedUrls
  };
};

// --- PROMPT COMPILER ---
const promptCache = {};
const loadPrompts = () => {
  if (Object.keys(promptCache).length > 0) return;
  const files = ["base_rules.txt", "pricing_agent.txt", "dev_agent.txt", "security_agent.txt", "master_agent.txt"];
  for (const file of files) {
    const filePath = path.join(PROMPTS_DIR, file);
    if (fs.existsSync(filePath)) {
      try {
        promptCache[file] = fs.readFileSync(filePath, "utf-8");
      } catch (e) {
        promptCache[file] = "";
      }
    } else {
      promptCache[file] = "";
    }
  }
};

const compilePrompt = (matchedVerticals, contextJson, session) => {
  loadPrompts();

  const baseRules = promptCache["base_rules.txt"] || "";
  let agentPrompt = "";

  if (matchedVerticals.length === 1) {
    const vertical = matchedVerticals[0];
    if (vertical === "pricing") {
      agentPrompt = promptCache["pricing_agent.txt"] || "";
    } else if (["integrations", "features", "agents"].includes(vertical)) {
      agentPrompt = promptCache["dev_agent.txt"] || "";
    } else if (vertical === "security") {
      agentPrompt = promptCache["security_agent.txt"] || "";
    } else {
      agentPrompt = promptCache["master_agent.txt"] || "";
    }
  } else {
    agentPrompt = promptCache["master_agent.txt"] || "";
  }

  const activeInterests = session.primary_interests || [];
  const memorySummary = session.memory_summary || "None";

  return [
    baseRules,
    "\n",
    agentPrompt,
    "\n## ACTIVE USER SESSION STATE:",
    `Active interests: ${activeInterests.join(", ")}`,
    `Prior conversation context: ${memorySummary}`,
    "\n## APPROVED KNOWLEDGE CONTEXT (TRUSTED DATA):",
    "<approved_knowledge>",
    contextJson,
    "</approved_knowledge>"
  ].join("\n");
};

// --- SESSION MANAGER ---
const loadSession = (sessionId) => {
  if (!sessionId) {
    return {
      session: {
        turn_count: 0,
        last_vertical: "faq",
        primary_interests: [],
        memory_summary: ""
      },
      sessionId: `sess_${uuidv4().replace(/-/g, "").substring(0, 12)}`
    };
  }

  const sessionFile = path.join(SESSIONS_DIR, `${sessionId}.json`);
  if (fs.existsSync(sessionFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(sessionFile, "utf-8"));
      return { session: data, sessionId };
    } catch (e) {
      console.error("Error loading session:", e);
    }
  }

  return {
    session: {
      turn_count: 0,
      last_vertical: "faq",
      primary_interests: [],
      memory_summary: ""
    },
    sessionId
  };
};

const saveSession = (sessionId, session) => {
  const sessionFile = path.join(SESSIONS_DIR, `${sessionId}.json`);
  try {
    fs.writeFileSync(sessionFile, JSON.stringify(session, null, 2), "utf-8");
  } catch (e) {
    console.error("Error saving session:", e);
  }
};

const updateSessionMemory = (session, query, response) => {
  const shortQuery = query.length > 80 ? query.substring(0, 80) + "..." : query;
  const shortResponse = response.length > 120 ? response.substring(0, 120) + "..." : response;
  const newMemory = `Q: ${shortQuery} | A: ${shortResponse}`;

  if (!session.memory_summary) {
    session.memory_summary = newMemory;
  } else {
    const lines = session.memory_summary.split("\n");
    lines.push(newMemory);
    session.memory_summary = lines.slice(-2).join("\n");
  }
};

// --- CORE HANDLER (Streaming-friendly) ---
export const processCopilotMessage = async ({ query, sessionId, onChunk, onDone }) => {
  const startTime = parseFloat(performance.now());

  // 1. Guardrail input validation
  const [isSafe, refusalMessage] = validateInput(query);
  if (!isSafe) {
    const { session: s, sessionId: sid } = loadSession(sessionId);
    onChunk(refusalMessage);
    onDone({ response: refusalMessage, sessionId: sid, runId: uuidv4().replace(/-/g, "") });
    return;
  }

  // 2. Load Session state
  const { session, sessionId: activeSessionId } = loadSession(sessionId);

  // If query is empty, return welcome directly
  if (!query.trim()) {
    const welcome = "Hello! I am your Swarm Customer Success & Onboarding Copilot. How can I help you learn about Swarm's features, custom pricing philosophy, or supported integrations today?";
    session.memory_summary = "Copilot greeted the user.";
    saveSession(activeSessionId, session);
    onChunk(welcome);
    onDone({ response: welcome, sessionId: activeSessionId, runId: uuidv4().replace(/-/g, "") });
    return;
  }

  // 2b. Redirect technical queries deterministically
  const queryLower = query.toLowerCase();
  const techKeywords = [
    "scanner", "sast", "failed", "vulnerability", "vulnerabilities", "owasp",
    "audit runs", "audit history", "security audits", "security audit", "live audit",
    "scan runs", "scan history", "live scan", "logs"
  ];
  if (techKeywords.some(kw => queryLower.includes(kw))) {
    const redirection = "According to Swarm Trust and Security Portal, technical scans, live agent audits, and vulnerability reports are managed by our DevOps Geni infrastructure agent. As your Customer Success Copilot, I can assist you with onboarding, high-level compliance queries (like SOC2 or GDPR), pricing philosophy, and supported integrations. Please launch the DevOps Geni agent to review live scans.";
    session.turn_count += 1;
    updateSessionMemory(session, query, redirection);
    saveSession(activeSessionId, session);
    onChunk(redirection);
    onDone({ response: redirection, sessionId: activeSessionId, runId: uuidv4().replace(/-/g, "") });
    return;
  }

  // 2c. Intercept greetings directly in JS (avoid LLM delay/cost)
  const queryClean = queryLower.trim().replace(/[!?.]$/, "");
  const greetings = new Set(["hi", "hello", "hey", "yo", "greetings", "good morning", "good afternoon", "good evening"]);
  if (greetings.has(normalize(queryClean))) {
    const greetingMsg = "Hello! I am your Swarm Customer Success & Onboarding Copilot. How can I help you learn about Swarm's features, custom pricing philosophy, or supported integrations today?";
    session.turn_count += 1;
    updateSessionMemory(session, query, greetingMsg);
    saveSession(activeSessionId, session);
    onChunk(greetingMsg);
    onDone({ response: greetingMsg, sessionId: activeSessionId, runId: uuidv4().replace(/-/g, "") });
    return;
  }

  // 3. Router logic
  const { contextJson, matchedVerticals, allowedUrls } = routeContext(query, session.last_vertical);

  // 4. Compile dynamic prompt
  const compiledSystemPrompt = compilePrompt(matchedVerticals, contextJson, session);

  // 5. Invoke OpenRouter (openai/gpt-4o-mini) with streaming
  const apiKey = process.env.OPENROUTER_API_KEY;
  const baseUrl = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
  const model = "openai/gpt-4o-mini";

  if (!apiKey) {
    const errText = "I cannot reach the Swarm intelligence network (API key missing in env).";
    onChunk(errText);
    onDone({ response: errText, sessionId: activeSessionId, runId: uuidv4().replace(/-/g, "") });
    return;
  }

  const messages = [
    { role: "system", content: compiledSystemPrompt },
    { role: "user", content: query }
  ];

  let responseText = "";
  let promptTokens = 0;
  let completionTokens = 0;
  let runId = uuidv4().replace(/-/g, "");

  try {
    const openrouterResp = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.3,
        stream: true
      })
    });

    if (openrouterResp.status !== 200) {
      throw new Error(`HTTP ${openrouterResp.status}`);
    }

    const reader = openrouterResp.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop(); // keep last incomplete line

      for (const line of lines) {
        const cleanLine = line.trim();
        if (!cleanLine || cleanLine === "data: [DONE]") continue;

        if (cleanLine.startsWith("data: ")) {
          try {
            const parsed = JSON.parse(cleanLine.slice(6));
            const choice = parsed.choices?.[0];
            const content = choice?.delta?.content;
            if (content) {
              responseText += content;
              onChunk(content);
            }
            if (parsed.usage) {
              promptTokens = parsed.usage.prompt_tokens || promptTokens;
              completionTokens = parsed.usage.completion_tokens || completionTokens;
            }
          } catch (e) {
            // Partial JSON chunks can sometimes fail to parse
          }
        }
      }
    }

    // 6. Output safety audit
    const safeResponse = verifyOutput(responseText, allowedUrls);

    // 7. Update session data
    session.turn_count += 1;
    if (matchedVerticals.length > 0) {
      const valid = matchedVerticals.filter(v => v !== "faq");
      if (valid.length > 0) {
        session.last_vertical = valid[0];
        if (!session.primary_interests.includes(session.last_vertical)) {
          session.primary_interests.push(session.last_vertical);
        }
      } else {
        session.last_vertical = matchedVerticals[0];
      }
    }

    updateSessionMemory(session, query, safeResponse);
    saveSession(activeSessionId, session);

    const duration = (performance.now() - startTime) / 1000;
    
    onDone({
      response: safeResponse,
      sessionId: activeSessionId,
      runId,
      model,
      messages,
      promptTokens: promptTokens || Math.round(compiledSystemPrompt.length / 4), // fallback estimate if OpenRouter usage missing in stream
      completionTokens: completionTokens || Math.round(safeResponse.length / 4),
      duration
    });

  } catch (err) {
    const errorMsg = `Network request failed: ${err.message}`;
    session.turn_count += 1;
    updateSessionMemory(session, query, errorMsg);
    saveSession(activeSessionId, session);
    onChunk(errorMsg);
    onDone({
      response: errorMsg,
      sessionId: activeSessionId,
      runId,
      model,
      messages,
      exception: err,
      duration: (performance.now() - startTime) / 1000
    });
  }
};
