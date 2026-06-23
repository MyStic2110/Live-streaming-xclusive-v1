import fs from "fs";
import path from "path";
import { query as dbQuery } from "../config/db.js";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import { pipeline } from "@huggingface/transformers";
import { spawn, spawnSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths resolving to the python-agent workspaces
const BASE_DIR = path.resolve(__dirname, "../../../python-agent");
const KNOWLEDGE_DIR = path.join(BASE_DIR, "knowledge");
const PROMPTS_DIR = path.join(BASE_DIR, "prompts");
const SESSIONS_DIR = path.join(BASE_DIR, "sessions");
const AIVYUH_DIR = path.join(BASE_DIR, "agents/aivyuh");

// --- Mem0 Sidecar (persistent Python HTTP daemon) ---
// Replaces the old per-call CLI spawn (which reloaded PyTorch + the HuggingFace
// embedder and re-acquired the embedded Qdrant lock on every request). The
// sidecar boots a single Mem0 client and serves search/add over HTTP.
const MEM0_SIDECAR_HOST = process.env.MEM0_SIDECAR_HOST || "127.0.0.1";
const MEM0_SIDECAR_PORT = process.env.MEM0_SIDECAR_PORT || "8770";
const MEM0_SIDECAR_URL = `http://${MEM0_SIDECAR_HOST}:${MEM0_SIDECAR_PORT}`;

// Securelytix PII tokenization on the copilot path is OFF by default. Its NER
// model can't distinguish a person's name from a public product/agent name, so
// it inconsistently tokenizes terms like "DevOps Geni" and breaks entity matching
// between the user query and the (public) knowledge base — causing valid questions
// to be refused. The copilot answers public product knowledge and the input
// guardrail already blocks cards/DB URLs/secrets, so leave it disabled unless
// ENABLE_COPILOT_PII_TOKENIZATION=true is explicitly set.
const COPILOT_PII_TOKENIZATION = process.env.ENABLE_COPILOT_PII_TOKENIZATION === "true";

let mem0SidecarProc = null;

const getPythonExecPath = () => {
  const isWindows = process.platform === "win32";
  const pythonExec = isWindows ? "venv/Scripts/python.exe" : "venv/bin/python";
  return path.resolve(BASE_DIR, pythonExec);
};

// Quick readiness probe so we can detect an already-running sidecar.
const probeMem0Sidecar = async (timeoutMs = 800) => {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch(`${MEM0_SIDECAR_URL}/health`, { signal: controller.signal })
      .finally(() => clearTimeout(timer));
    return resp.ok;
  } catch {
    return false;
  }
};

// Spawn the Python mem0 sidecar as a managed child process at server startup.
const startMem0Sidecar = async () => {
  if (process.env.ENABLE_MEM0_SIDECAR === "false") {
    console.warn("[Mem0 Sidecar] Disabled via ENABLE_MEM0_SIDECAR=false; memory features inactive.");
    return;
  }

  // Reuse an already-listening sidecar (e.g. one left behind by a `node --watch`
  // reload, or a shared/externally-managed instance) instead of spawning a
  // duplicate that would crash with EADDRINUSE on the same port. We deliberately
  // do not adopt it as `mem0SidecarProc`, so we won't kill a process we didn't start.
  if (await probeMem0Sidecar()) {
    console.info(`[Mem0 Sidecar] Reusing existing sidecar at ${MEM0_SIDECAR_URL}.`);
    return;
  }

  const pythonPath = getPythonExecPath();
  const sidecarScript = path.resolve(BASE_DIR, "utils/mem0_sidecar.py");

  try {
    const proc = spawn(pythonPath, [sidecarScript], {
      cwd: BASE_DIR,
      env: { ...process.env, MEM0_SIDECAR_HOST, MEM0_SIDECAR_PORT },
      stdio: ["ignore", "pipe", "pipe"]
    });

    // The sidecar logs to stdout/stderr; surface those lines through our logger.
    proc.stdout.on("data", (data) => { console.info(`[Mem0 Sidecar] ${data.toString().trim()}`); });
    proc.stderr.on("data", (data) => { console.info(`[Mem0 Sidecar] ${data.toString().trim()}`); });
    proc.on("error", (err) => {
      console.error(`[Mem0 Sidecar] Failed to spawn: ${err.message}`);
      mem0SidecarProc = null;
    });
    proc.on("exit", (code, signal) => {
      console.warn(`[Mem0 Sidecar] Process exited (code=${code}, signal=${signal}).`);
      mem0SidecarProc = null;
    });

    mem0SidecarProc = proc;
    console.info(`[Mem0 Sidecar] Spawned (pid=${proc.pid}); endpoint ${MEM0_SIDECAR_URL}`);
  } catch (err) {
    console.error(`[Mem0 Sidecar] Could not start: ${err.message}`);
  }
};

// Terminate the child sidecar so it does not outlive the Node process.
const stopMem0Sidecar = () => {
  const proc = mem0SidecarProc;
  if (!proc || proc.killed) return;
  mem0SidecarProc = null;
  console.info("[Mem0 Sidecar] Shutting down child process.");

  if (process.platform === "win32" && proc.pid) {
    // On Windows `venv\Scripts\python.exe` is a launcher shim that re-execs the
    // real interpreter as a GRANDCHILD which actually holds the sidecar port.
    // proc.kill() would only kill the shim and orphan the real sidecar, so use
    // taskkill /T to tear down the entire process tree.
    try {
      spawnSync("taskkill", ["/pid", String(proc.pid), "/T", "/F"], { stdio: "ignore" });
      return;
    } catch (e) {
      // fall through to a best-effort direct kill
    }
  }
  try { proc.kill(); } catch (e) { /* already gone */ }
};

// Boot the sidecar at module load (i.e. on backend startup) and register cleanup.
startMem0Sidecar();
process.once("exit", stopMem0Sidecar);
process.once("SIGINT", () => { stopMem0Sidecar(); process.exit(0); });
process.once("SIGTERM", () => { stopMem0Sidecar(); process.exit(0); });

// HTTP client for the sidecar. Memory is best-effort: keep the timeout short and
// retries minimal so an unavailable/slow sidecar can never stall the chat stream.
const runMem0Sidecar = async (action, payload, { retries = 1, timeoutMs = 3000 } = {}) => {
  const url = `${MEM0_SIDECAR_URL}/${action}`;
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      }).finally(() => clearTimeout(timer));

      if (!resp.ok) {
        const errBody = await resp.text().catch(() => "");
        throw new Error(`sidecar ${action} HTTP ${resp.status}: ${errBody}`);
      }
      return await resp.json();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  }
  throw lastErr || new Error(`mem0 sidecar ${action} failed`);
};

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
      return [false, "I can only answer questions related to the Swarm Agentic Platform.", "jailbreak_intercepted"];
    }
  }

  if (dbUrlPattern.test(query)) {
    return [false, "This is not needed for us. Please do not input sensitive information such as database connection strings, API keys, passwords, or credit card numbers.", "pii_blocked"];
  }

  if (creditCardPattern.test(query)) {
    return [false, "This is not needed for us. Please do not input sensitive information such as database connection strings, API keys, passwords, or credit card numbers.", "pii_blocked"];
  }

  if (envSnippetPattern.test(query)) {
    if (query.includes("=") || query.includes(":")) {
      return [false, "This is not needed for us. Please do not input sensitive information such as database connection strings, API keys, passwords, or credit card numbers.", "pii_blocked"];
    }
  }

  const potentialSecrets = query.match(secretPattern) || [];
  for (const secret of potentialSecrets) {
    if (emailPattern.test(secret)) {
      continue;
    }
    return [false, "This is not needed for us. Please do not input sensitive information such as database connection strings, API keys, passwords, or credit card numbers.", "pii_blocked"];
  }

  return [true, "", null];
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
    return ["Please evaluate platforms based on your business requirements. I can explain Swarm capabilities and features.", "competitor_mention_blocked"];
  }

  for (const pattern of leakPatterns) {
    if (pattern.test(generatedResponse)) {
      return ["I can only answer questions related to the Swarm Agentic Platform.", "system_prompt_leak_blocked"];
    }
  }

  const foundUrls = generatedResponse.match(urlPattern) || [];
  let responseCopy = generatedResponse;
  let urlModified = false;
  for (const url of foundUrls) {
    const cleanUrl = url.replace(/[.,;!)?}]$/, "");
    if (!allowedUrls.has(cleanUrl)) {
      responseCopy = responseCopy.replace(url, "https://swarm.ai");
      urlModified = true;
    }
  }

  if (urlModified) {
    return [responseCopy, "unauthorized_url_redacted"];
  }

  return [responseCopy, null];
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
    "rehearsal", "silentrehearsal", "lina", "martech",
    "weatheragent", "cortex", "bi"
  ],
  crawled_knowledge: [
    "blog", "blogs", "post", "posts", "reel", "reels", "script", "scripts",
    "article", "articles", "idea", "ideas", "freeform", "insight", "insights",
    "writeup", "writeups", "socialmedia", "rehearsal", "podcast"
  ],
  github_knowledge: [
    "github", "git", "repo", "repository", "codebase", "source code", "implementation",
    "functions", "code", "file", "directories", "branch", "pull", "clone"
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

const isFollowUpQuery = (query) => {
  const queryLower = query.toLowerCase();
  const words = new Set(queryLower.split(/[^a-z0-9]+/));
  const followUpTokens = new Set([
    "it", "that", "this", "they", "them", "these", "those",
    "more", "detail", "details", "explain", "elaborate", "why", "how",
    "yes", "no", "ok", "okay", "sure", "tell", "show", "get", "describe",
    "previous", "above", "below", "following", "latter", "former"
  ]);

  for (const word of words) {
    if (followUpTokens.has(word)) return true;
  }

  const prefixes = ["is ", "are ", "can ", "could ", "would ", "does ", "do ", "should ", "will ", "what "];
  if (prefixes.some(prefix => queryLower.startsWith(prefix))) return true;

  return false;
};

const verticalDescriptions = {
  pricing: "Pricing tiers, enterprise subscriptions, custom contracts, plans, billing cycles, discounts, licensing fees, costs, free trial details.",
  integrations: "Integrations with external services, connecting tools, webhooks, Slack alerts, GitHub status syncs, APIs, and automated triggers.",
  security: "Security audits, compliance standards, SOC2, GDPR, data residency policies, encryption keys, SSO/SAML authorization, zero-trust deployment options, private cloud VPC installation requirements.",
  features: "Core platform capabilities, workflow designers, run limits, human-in-the-loop validation, sandbox execution, visual builders, and platform limits.",
  agents: "Custom built-in AI agents, including Astra, DevOps Geni, Aivyuh, Nova, Seva, Octane, and Silent Rehearsal. List and capabilities of different specialized agents in the fleet.",
  crawled_knowledge: "Web crawled information from our public blogs, social media posts, reels, articles, stories, podcasts, research insights, and video scripts.",
  github_knowledge: "GitHub repository files, directory paths, source code implementation files, Git branches, pulls, commits, clones, and function definitions."
};

let embedderPromise = null;
let embedder = null;
const verticalEmbeddings = {};

export const initEmbedder = async () => {
  if (embedderPromise) return embedderPromise;
  embedderPromise = (async () => {
    try {
      embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      for (const [vertical, desc] of Object.entries(verticalDescriptions)) {
        const output = await embedder(desc, { pooling: 'mean', normalize: true });
        verticalEmbeddings[vertical] = Array.from(output.data);
      }
      console.info("[EMBEDDER] Local ONNX intent embedder initialized successfully.");
    } catch (err) {
      console.error("[EMBEDDER] Failed to initialize local intent embedder:", err);
    }
  })();
  return embedderPromise;
};

// Start initialization immediately in background
initEmbedder().catch(() => {});

export const routeContext = async (query, lastVertical) => {
  loadKnowledgeFiles();

  const queryLower = query.toLowerCase();
  const queryNorm = normalize(query);
  const queryClean = queryLower.trim().replace(/[!?.]$/, "");
  const greetings = new Set(["hi", "hello", "hey", "yo", "greetings", "goodmorning", "goodafternoon", "goodevening"]);
  const isGreeting = greetings.has(normalize(queryClean));

  let matchedVerticals = [];

  // Tier 1: Fast Path (Keywords)
  for (const [vertical, keywords] of Object.entries(routerMapping)) {
    for (const keyword of keywords) {
      const kwNorm = normalize(keyword);
      if (queryNorm.includes(kwNorm) || queryLower.includes(keyword.toLowerCase())) {
        matchedVerticals.push(vertical);
        break;
      }
    }
  }

  // Tier 2: Slow Path (Semantic Embeddings)
  if (matchedVerticals.length === 0 && !isGreeting && query.trim().length > 3) {
    if (embedder) {
      try {
        const output = await embedder(query, { pooling: 'mean', normalize: true });
        const queryVector = Array.from(output.data);

        let bestVertical = null;
        let bestScore = -1;

        for (const [vertical, vec] of Object.entries(verticalEmbeddings)) {
          let score = 0;
          for (let i = 0; i < vec.length; i++) {
            score += vec[i] * queryVector[i];
          }
          if (score > bestScore) {
            bestScore = score;
            bestVertical = vertical;
          }
        }

        if (bestScore > 0.45 && bestVertical) {
          console.info(`[SEMANTIC ROUTER] Match vertical '${bestVertical}' with score: ${bestScore.toFixed(4)}`);
          matchedVerticals.push(bestVertical);
        }
      } catch (err) {
        console.error("[SEMANTIC ROUTER] Semantic routing failed:", err);
      }
    }
  }

  const ignoredWords = new Set([
    "swarm", "copilot", "platform", "platforms", "agent", "agents", "cortex", "system", "systems",
    "what", "where", "when", "which", "who", "whom", "how", "why", "please", "would",
    "could", "should", "does", "do", "doing", "done", "will", "shall", "their", "there",
    "about", "information", "question", "query", "details", "explain", "describe", "support",
    "data", "stored", "sources", "source", "file", "files", "code", "database", "db", "json",
    "many", "much", "find", "search", "show", "list", "get", "using", "use", "user", "users",
    "create", "deploy", "setup", "onboarding", "success", "customer", "build", "integration",
    "integrations", "feature", "features", "pricing", "security", "audit", "scanner", "scan",
    "runs", "history", "analytics",
    "call", "calls", "phone", "number", "numbers", "email", "emails", "send", "sending", "sent",
    "write", "writing", "written", "news", "today", "yesterday", "tomorrow", "again", "stx",
    "token", "tokens", "tokenization", "key", "keys", "secret", "secrets", "password", "passwords",
    "credential", "credentials", "id", "ids", "uuid", "uuids"
  ]);

  const getQueryWords = (query) => {
    if (!query) return [];
    let processed = query.toLowerCase();
    const months = {
      january: "01", jan: "01",
      february: "02", feb: "02",
      march: "03", mar: "03",
      april: "04", apr: "04",
      may: "05",
      june: "06", jun: "06",
      july: "07", jul: "07",
      august: "08", aug: "08",
      september: "09", sep: "09",
      october: "10", oct: "10",
      november: "11", nov: "11",
      december: "12", dec: "12"
    };
    for (const [month, num] of Object.entries(months)) {
      processed = processed.replace(new RegExp(`\\b${month}\\b`, "g"), `${month} ${num}`);
    }
    return processed
      .split(/[^a-z0-9]+/)
      .filter(w => (w.length > 3 || /^\d{2}$/.test(w)) && !ignoredWords.has(w));
  };

  // Fallback dynamic crawled knowledge matching (with whole word checks)
  if (matchedVerticals.length === 0) {
    if (kbCache['crawled_knowledge'] && kbCache['crawled_knowledge'].pages) {
      const queryWords = getQueryWords(query);
      if (queryWords.length > 0) {
        const hasMatch = kbCache['crawled_knowledge'].pages.some(page => {
          const titleLower = page.title.toLowerCase();
          const contentLower = page.content.toLowerCase();
          return queryWords.some(word => {
            const wordRegex = new RegExp(`\\b${word}\\b`, 'i');
            return wordRegex.test(titleLower) || wordRegex.test(contentLower);
          });
        });
        if (hasMatch && !matchedVerticals.includes("crawled_knowledge")) {
          matchedVerticals.push("crawled_knowledge");
        }
      }
    }
  }

  // Fallback dynamic github knowledge matching (with whole word checks)
  if (matchedVerticals.length === 0) {
    if (kbCache['github_knowledge'] && kbCache['github_knowledge'].pages) {
      const queryWords = getQueryWords(query);
      if (queryWords.length > 0) {
        const hasMatch = kbCache['github_knowledge'].pages.some(page => {
          const titleLower = page.title.toLowerCase();
          const contentLower = page.content.toLowerCase();
          return queryWords.some(word => {
            const wordRegex = new RegExp(`\\b${word}\\b`, 'i');
            return wordRegex.test(titleLower) || wordRegex.test(contentLower);
          });
        });
        if (hasMatch && !matchedVerticals.includes("github_knowledge")) {
          matchedVerticals.push("github_knowledge");
        }
      }
    }
  }

  const isExplicit = matchedVerticals.length > 0;

  if (matchedVerticals.length === 0) {
    if (kbCache[lastVertical] && !isGreeting && isFollowUpQuery(query)) {
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
      
      if (vertical === "crawled_knowledge" && verticalData.pages) {
        // Simple relevance matching over crawled pages
        const queryWords = getQueryWords(query);
        const relevantPages = verticalData.pages.filter(page => {
          const titleLower = page.title.toLowerCase();
          const contentLower = page.content.toLowerCase();
          
          let matches = 0;
          for (const word of queryWords) {
            if (titleLower.includes(word)) matches += 3;
            if (contentLower.includes(word)) matches += 1;
          }
          page.relevanceScore = matches;
          return matches > 0;
        });
        
        // Sort by relevance and take top 3 pages to avoid bloating context
        relevantPages.sort((a, b) => b.relevanceScore - a.relevanceScore);
        verticalData.pages = relevantPages.slice(0, 3).map(({ relevanceScore, ...rest }) => rest);
      }

      if (vertical === "github_knowledge" && verticalData.pages) {
        // Simple relevance matching over files
        const queryWords = getQueryWords(query);
        const relevantPages = verticalData.pages.filter(page => {
          const titleLower = page.title.toLowerCase();
          const contentLower = page.content.toLowerCase();
          
          let matches = 0;
          for (const word of queryWords) {
            if (titleLower.includes(word)) matches += 3;
            if (contentLower.includes(word)) matches += 1;
          }
          page.relevanceScore = matches;
          return matches > 0;
        });
        
        // Sort by relevance and take top 3 files to avoid bloating context
        relevantPages.sort((a, b) => b.relevanceScore - a.relevanceScore);
        verticalData.pages = relevantPages.slice(0, 3).map(({ relevanceScore, ...rest }) => rest);
      }
      
      if (vertical === "security") {
        const runsPath = path.join(AIVYUH_DIR, "audit_runs.json");
        if (fs.existsSync(runsPath)) {
          try {
            verticalData["live_audit_runs"] = JSON.parse(fs.readFileSync(runsPath, "utf-8"));
          } catch (e) {}
        }
        try {
          const dbHistory = await dbQuery('SELECT * FROM agent_security_status');
          const historyMap = {};
          for (const row of dbHistory.rows) {
            historyMap[row.agent_name] = {
              timestamp: row.timestamp,
              critical_count: parseInt(row.critical_count || 0, 10),
              warning_count: parseInt(row.warning_count || 0, 10),
              report_summary: row.report_summary || [],
              nist_audit: {
                score: parseFloat(row.nist_score || 100.0),
                risk: row.nist_risk || "LOW",
                controls: row.nist_controls || []
              }
            };
          }
          verticalData["live_audit_history"] = historyMap;
        } catch (dbErr) {
          console.error("[COPILOT_SERVICE] Failed to query compliance from DB:", dbErr.message);
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
    allowedUrls,
    isExplicit
  };
};

// --- PROMPT COMPILER ---
// Prompts are read from disk once and cached in-process for the lifetime of the
// server. Editing the prompt .txt files therefore requires a backend restart to
// take effect (node --watch does not watch these non-imported text files).
const promptCache = {};
const loadPrompts = () => {
  if (Object.keys(promptCache).length > 0) return;
  const files = [
    "base_rules.txt", "pricing_agent.txt", "dev_agent.txt", 
    "security_agent.txt", "master_agent.txt", "crawler_agent.txt", "github_agent.txt"
  ];
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

const compilePrompt = (matchedVerticals, contextJson, session, memories = []) => {
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
    } else if (vertical === "crawled_knowledge") {
      agentPrompt = promptCache["crawler_agent.txt"] || "";
    } else if (vertical === "github_knowledge") {
      agentPrompt = promptCache["github_agent.txt"] || "";
    } else {
      agentPrompt = promptCache["master_agent.txt"] || "";
    }
  } else {
    agentPrompt = promptCache["master_agent.txt"] || "";
  }

  const activeInterests = session.primary_interests || [];
  const memorySummary = session.memory_summary || "None";

  const memoriesStr = memories.length > 0
    ? memories.map(f => `- ${f}`).join("\n")
    : "None";

  return [
    baseRules,
    "\n",
    agentPrompt,
    "\n## ACTIVE USER SESSION STATE:",
    `Active interests: ${activeInterests.join(", ")}`,
    `Prior conversation context: ${memorySummary}`,
    `Retrieved User Context / Persistent Preferences:\n${memoriesStr}`,
    "\n## APPROVED KNOWLEDGE CONTEXT (TRUSTED DATA):",
    "<approved_knowledge>",
    contextJson,
    "</approved_knowledge>"
  ].join("\n");
};

// --- SECURELYTIX TOKENIZATION ---
const securelytixTokenize = async (data) => {
  const url = `${process.env.SECURELYTIX_URL || "http://localhost:8080"}/api/v1/tokenize`;
  const apiKey = process.env.SECURELYTIX_API_KEY || "sk_dev_mock_key_for_local_testing";

  try {
    const isStr = typeof data === "string";
    const payload = isStr ? { text: data } : data;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({ data: payload })
    });

    if (response.status === 200) {
      const result = await response.json();
      const resData = result.data || payload;
      return isStr ? (resData.text || data) : resData;
    } else {
      console.warn(`[Securelytix] Tokenization failed with status ${response.status}. Failing open.`);
    }
  } catch (err) {
    console.error("[Securelytix] Tokenization failed. Failing open:", err);
  }
  return data;
};

const securelytixDetokenize = async (data) => {
  const url = `${process.env.SECURELYTIX_URL || "http://localhost:8080"}/api/v1/detokenize`;
  const apiKey = process.env.SECURELYTIX_API_KEY || "sk_dev_mock_key_for_local_testing";

  try {
    const isStr = typeof data === "string";
    const payload = isStr ? { text: data } : data;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({ data: payload })
    });

    if (response.status === 200) {
      const result = await response.json();
      const resData = result.data || payload;
      return isStr ? (resData.text || data) : resData;
    } else {
      console.warn(`[Securelytix] Detokenization failed with status ${response.status}. Failing open.`);
    }
  } catch (err) {
    console.error("[Securelytix] Detokenization failed. Failing open:", err);
  }
  return data;
};

const detokenizeDates = async (text) => {
  if (typeof text !== "string") return text;
  const tokenRegex = /\b([a-zA-Z0-9_\-\.\@]+_stx)\b/g;
  const matches = text.match(tokenRegex);
  if (!matches || matches.length === 0) return text;

  const url = `${process.env.SECURELYTIX_URL || "http://localhost:8080"}/api/v1/detokenize`;
  const apiKey = process.env.SECURELYTIX_API_KEY || "sk_dev_mock_key_for_local_testing";

  try {
    const payload = {};
    matches.forEach((token, idx) => {
      payload[`token_${idx}`] = token;
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({ data: payload })
    });

    if (response.status === 200) {
      const result = await response.json();
      const rawMap = result.data || {};
      
      let processedText = text;
      const dateRegex = /\b\d{4}[-/]\d{2}[-/]\d{2}\b|\b\d{2}[-/]\d{2}[-/]\d{4}\b|\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s+\d{4})?\b/i;
      
      for (const [key, token] of Object.entries(payload)) {
        const rawValue = rawMap[key];
        if (rawValue && dateRegex.test(rawValue)) {
          processedText = processedText.replace(new RegExp(token, 'g'), rawValue);
        }
      }
      return processedText;
    }
  } catch (err) {
    console.error("[Securelytix] detokenizeDates failed:", err);
  }
  return text;
};

// --- SESSION DATABASE / MEMORY FALLBACK ---
const localSessionMemory = new Map();

const loadSession = async (sessionId) => {
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

  try {
    const res = await dbQuery('SELECT session_data FROM copilot_sessions WHERE session_id = $1', [sessionId]);
    if (res && res.rows && res.rows.length > 0) {
      return { session: res.rows[0].session_data, sessionId };
    }
  } catch (dbError) {
    console.warn(`[COPILOT_SESSION] DB lookup failed, falling back to storage: ${dbError.message}`);
    if (localSessionMemory.has(sessionId)) {
      return { session: localSessionMemory.get(sessionId), sessionId };
    }
    const sessionFile = path.join(SESSIONS_DIR, `${sessionId}.json`);
    if (fs.existsSync(sessionFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(sessionFile, "utf-8"));
        return { session: data, sessionId };
      } catch (e) {
        console.error("Error loading session from file:", e);
      }
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

const saveSession = async (sessionId, session) => {
  try {
    await dbQuery(
      `INSERT INTO copilot_sessions (session_id, session_data, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (session_id) DO UPDATE
       SET session_data = EXCLUDED.session_data, updated_at = CURRENT_TIMESTAMP`,
      [sessionId, JSON.stringify(session)]
    );
  } catch (dbError) {
    console.warn(`[COPILOT_SESSION] DB save failed, saving to file: ${dbError.message}`);
    localSessionMemory.set(sessionId, session);
    const sessionFile = path.join(SESSIONS_DIR, `${sessionId}.json`);
    try {
      await fs.promises.writeFile(sessionFile, JSON.stringify(session, null, 2), "utf-8");
    } catch (e) {
      console.error("Error saving session to file:", e);
    }
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
  const [isSafe, refusalMessage, eventType] = validateInput(query);
  if (!isSafe) {
    try {
      await dbQuery(
        `INSERT INTO compliance_logs (event_type, severity, agent, details)
         VALUES ($1, $2, $3, $4)`,
        [eventType || 'unknown_violation', 'critical', 'copilot', JSON.stringify({ query })]
      );
    } catch (dbErr) {
      console.error("[COMPLIANCE_LOG] Failed to log input violation to DB:", dbErr.message);
    }

    const { session: s, sessionId: sid } = await loadSession(sessionId);
    onChunk(refusalMessage);
    onDone({ response: refusalMessage, sessionId: sid, runId: uuidv4().replace(/-/g, "") });
    return;
  }

  // 2. Load Session state
  const { session, sessionId: activeSessionId } = await loadSession(sessionId);

  // If query is empty, return welcome directly
  if (!query.trim()) {
    const welcome = "Hello! I am your Swarm Customer Success & Onboarding Copilot. How can I help you learn about Swarm's features, custom pricing philosophy, or supported integrations today?";
    session.memory_summary = "Copilot greeted the user.";
    await saveSession(activeSessionId, session);
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
    await saveSession(activeSessionId, session);
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
    await saveSession(activeSessionId, session);
    onChunk(greetingMsg);
    onDone({ response: greetingMsg, sessionId: activeSessionId, runId: uuidv4().replace(/-/g, "") });
    return;
  }

  // 3. Router logic
  const { contextJson, matchedVerticals, allowedUrls, isExplicit } = await routeContext(query, session.last_vertical);

  // Retrieve relevant semantic memories from Mem0 via the sidecar daemon
  let memories = [];
  try {
    const mem0Result = await runMem0Sidecar("search", { user_id: activeSessionId, query });
    memories = mem0Result.facts || [];
  } catch (err) {
    console.error("[Mem0 Node] Failed to search memories:", err.message);
  }

  // 4. Compile dynamic prompt
  const compiledSystemPrompt = compilePrompt(matchedVerticals, contextJson, session, memories);

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

  let tokenizedSystemPrompt = compiledSystemPrompt;
  let tokenizedUserQuery = query;

  if (COPILOT_PII_TOKENIZATION) {
    try {
      tokenizedSystemPrompt = await securelytixTokenize(compiledSystemPrompt);
      tokenizedUserQuery = await securelytixTokenize(query);
      tokenizedUserQuery = await detokenizeDates(tokenizedUserQuery);
      tokenizedSystemPrompt = await detokenizeDates(tokenizedSystemPrompt);
    } catch (tokenizeErr) {
      console.error("[Securelytix] Tokenization or date detokenization failed, failing open:", tokenizeErr);
    }
  }

  const messages = [
    { role: "system", content: tokenizedSystemPrompt },
    { role: "user", content: tokenizedUserQuery }
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

    // Token-aware streaming: the LLM output may contain Securelytix PII tokens
    // (whole words ending in `_stx`) because the prompt/query were tokenized
    // before the call. We must NOT stream those raw to the client. Buffer output
    // and only flush up to the last whitespace boundary, holding back the trailing
    // partial word so a token split across chunks is never leaked; detokenize any
    // flushed segment that contains a token before sending it.
    let pendingOut = "";
    const flushPending = async (final = false) => {
      let emit;
      if (final) {
        emit = pendingOut;
        pendingOut = "";
      } else {
        let lastWs = -1;
        for (let i = pendingOut.length - 1; i >= 0; i--) {
          if (/\s/.test(pendingOut[i])) { lastWs = i; break; }
        }
        if (lastWs < 0) return; // entire buffer is one unterminated word — hold it
        emit = pendingOut.slice(0, lastWs + 1);
        pendingOut = pendingOut.slice(lastWs + 1);
      }
      if (!emit) return;
      if (COPILOT_PII_TOKENIZATION && emit.includes("_stx")) {
        try { emit = await securelytixDetokenize(emit); } catch (e) { /* fail open */ }
      }
      onChunk(emit);
    };

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
              pendingOut += content;
              await flushPending();
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

    // Flush any remaining buffered text (last word / unterminated token).
    await flushPending(true);

    // 6. Detokenize response and apply output safety audit
    const detokenizedResponse = COPILOT_PII_TOKENIZATION
      ? await securelytixDetokenize(responseText)
      : responseText;
    const [safeResponse, violationType] = verifyOutput(detokenizedResponse, allowedUrls);

    if (violationType) {
      try {
        const severity = violationType === 'system_prompt_leak_blocked' ? 'critical' : 'warning';
        await dbQuery(
          `INSERT INTO compliance_logs (event_type, severity, agent, details)
           VALUES ($1, $2, $3, $4)`,
          [violationType, severity, 'copilot', JSON.stringify({ response: responseText, safeResponse })]
        );
      } catch (dbErr) {
        console.error("[COMPLIANCE_LOG] Failed to log output violation to DB:", dbErr.message);
      }
    }

    // 7. Update session data
    session.turn_count += 1;
    if (isExplicit && matchedVerticals.length > 0) {
      const valid = matchedVerticals.filter(v => v !== "faq");
      if (valid.length > 0) {
        session.last_vertical = valid[0];
        if (!session.primary_interests.includes(session.last_vertical)) {
          session.primary_interests.push(session.last_vertical);
        }
      }
    }

    updateSessionMemory(session, query, safeResponse);
    await saveSession(activeSessionId, session);

    // Save interaction to Mem0 memory via the sidecar daemon. Fire-and-forget
    // (not awaited) so persisting the turn never delays the streamed response;
    // fact extraction can take a few seconds and must not block onDone/[DONE].
    runMem0Sidecar("add", { user_id: activeSessionId, query, response: safeResponse }, { timeoutMs: 15000 })
      .catch((err) => console.error("[Mem0 Node] Failed to save interaction to Mem0:", err.message));

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
    await saveSession(activeSessionId, session);
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
