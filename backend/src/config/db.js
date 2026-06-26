import pg from 'pg';
import logger from './logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import util from 'util';

const { Pool } = pg;
const execPromise = util.promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let pool = null;

export const connectDB = async () => {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres@127.0.0.1:5433/swarm';
  try {
    pool = new Pool({
      connectionString,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      logger.error(`[DATABASE] Unexpected error on idle client: ${err.message}`);
    });

    // Test connection
    const client = await pool.connect();
    logger.info(`[DATABASE] ✅ PostgreSQL Connected Successfully.`);
    
    // Initialize Tables
    await initializeTables(client);
    
    client.release();
  } catch (error) {
    logger.warn(`[DATABASE] ⚠️  PostgreSQL connection failed: ${error.message}`);
    logger.warn(`[DATABASE] Server will continue without database. Auth endpoints will be unavailable until PostgreSQL is running.`);
  }
};

const initializeTables = async (client) => {
  try {
    // 1. Create Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'operator' CHECK (role IN ('admin', 'operator', 'viewer')),
        company_name VARCHAR(255) DEFAULT 'Nexus Swarm Operator',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Create Sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        room_name VARCHAR(255) NOT NULL,
        agent_type VARCHAR(255) NOT NULL,
        started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        ended_at TIMESTAMP WITH TIME ZONE NULL,
        primary_interests JSONB DEFAULT '[]'::jsonb,
        status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'disconnected'))
      );
    `);

    // 3. Create Traces table
    await client.query(`
      CREATE TABLE IF NOT EXISTS traces (
        id SERIAL PRIMARY KEY,
        run_id VARCHAR(255) UNIQUE NOT NULL,
        input_id VARCHAR(32) NULL,
        output_id VARCHAR(24) NULL,
        agent VARCHAR(255) NULL,
        model VARCHAR(255) DEFAULT 'unknown',
        inputs JSONB DEFAULT '[]'::jsonb,
        outputs TEXT DEFAULT '',
        prompt_tokens INTEGER DEFAULT 0,
        completion_tokens INTEGER DEFAULT 0,
        input_cost NUMERIC DEFAULT 0,
        output_cost NUMERIC DEFAULT 0,
        stt_cost NUMERIC DEFAULT 0,
        tts_cost NUMERIC DEFAULT 0,
        total_cost NUMERIC DEFAULT 0,
        status VARCHAR(50) DEFAULT 'streaming' CHECK (status IN ('streaming', 'completed', 'failed')),
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        total_latency NUMERIC DEFAULT 0,
        ttft NUMERIC DEFAULT 0,
        tool_latency NUMERIC DEFAULT 0,
        otps NUMERIC DEFAULT 0,
        tool_calls JSONB DEFAULT '[]'::jsonb,
        error_details JSONB DEFAULT '{}'::jsonb
      );
    `);

    // Safe migration: add input_id / output_id to existing tables (no-op if already present)
    await client.query(`
      ALTER TABLE traces
        ADD COLUMN IF NOT EXISTS input_id  VARCHAR(32) NULL,
        ADD COLUMN IF NOT EXISTS output_id VARCHAR(24) NULL;
    `);
    
    // 4. Create Password Reset Tokens table
    await client.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 5. Create Copilot Sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS copilot_sessions (
        session_id VARCHAR(255) PRIMARY KEY,
        session_data JSONB NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 6. Create Crawling Configs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS crawling_configs (
        id VARCHAR(50) PRIMARY KEY,
        start_url VARCHAR(1024) NOT NULL,
        include_pattern VARCHAR(255),
        exclude_pattern VARCHAR(255),
        sitemap_enabled BOOLEAN DEFAULT TRUE,
        custom_sitemap VARCHAR(1024),
        js_rendering BOOLEAN DEFAULT FALSE,
        proxy_enabled BOOLEAN DEFAULT FALSE,
        extract_pdfs BOOLEAN DEFAULT FALSE,
        main_css VARCHAR(559),
        exclude_css VARCHAR(559),
        template VARCHAR(50),
        last_crawled_at TIMESTAMP WITH TIME ZONE,
        status VARCHAR(50) DEFAULT 'idle',
        last_error TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 7. Create GitHub Configs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS github_configs (
        id VARCHAR(50) PRIMARY KEY,
        owner VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        token VARCHAR(255),
        branch_or_tag VARCHAR(255),
        file_types TEXT[],
        directories TEXT[],
        file_include_regex VARCHAR(1024),
        file_exclude_regex VARCHAR(1024),
        last_ingested_at TIMESTAMP WITH TIME ZONE,
        status VARCHAR(50) DEFAULT 'idle',
        last_error TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 8. Create Compliance Logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS compliance_logs (
        id SERIAL PRIMARY KEY,
        event_type VARCHAR(100) NOT NULL,
        severity VARCHAR(50) NOT NULL,
        agent VARCHAR(255) NULL,
        details JSONB DEFAULT '{}'::jsonb,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 9. Create Indexes for traces
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_traces_timestamp ON traces(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_traces_agent ON traces(agent);
      CREATE INDEX IF NOT EXISTS idx_traces_run_id ON traces(run_id);
    `);

    // 10. Create NIST AI RMF Core Master table
    await client.query(`
      CREATE TABLE IF NOT EXISTS nist_rmf_core (
        id SERIAL PRIMARY KEY,
        function VARCHAR(100) NOT NULL,
        category TEXT NOT NULL,
        subcategory_id VARCHAR(50) UNIQUE NOT NULL,
        description TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 11. Create Agent Analysis table
    await client.query(`
      DROP TABLE IF EXISTS agent_analysis CASCADE;
      CREATE TABLE IF NOT EXISTS agent_analysis (
        id SERIAL PRIMARY KEY,
        agent_name VARCHAR(255) UNIQUE NOT NULL,
        agent_type VARCHAR(100) NOT NULL,
        business_function VARCHAR(100) NOT NULL,
        autonomy VARCHAR(50) NOT NULL,
        risk_tier VARCHAR(50) NOT NULL,
        capabilities TEXT[] NOT NULL,
        data_classes TEXT[] NOT NULL,
        external_reach TEXT[] NOT NULL,
        applicable_controls TEXT[] NOT NULL,
        non_applicable_controls TEXT[] NOT NULL,
        applicable_count INTEGER NOT NULL,
        non_applicable_count INTEGER NOT NULL,
        unmapped_count INTEGER NOT NULL DEFAULT 0,
        control_map JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 12. Create Agent Security Status table
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_security_status (
        agent_name VARCHAR(255) PRIMARY KEY,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        critical_count INTEGER DEFAULT 0,
        warning_count INTEGER DEFAULT 0,
        report_summary JSONB DEFAULT '[]'::jsonb,
        nist_score NUMERIC DEFAULT 100,
        nist_risk VARCHAR(50) DEFAULT 'LOW',
        nist_controls JSONB DEFAULT '[]'::jsonb
      );
    `);

    // 13. Create OWASP LLM Core Master table
    await client.query(`
      CREATE TABLE IF NOT EXISTS owasp_llm_core (
        id SERIAL PRIMARY KEY,
        framework VARCHAR(100) NOT NULL,
        control_id VARCHAR(50) UNIQUE NOT NULL,
        category VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 14. Create Careers Applications table
    await client.query(`
      CREATE TABLE IF NOT EXISTS careers_applications (
        id SERIAL PRIMARY KEY,
        role_id VARCHAR(255) NOT NULL,
        role_title VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        mobile VARCHAR(50) NULL,
        portfolio VARCHAR(1024) NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Migrate: Add resume_data column if not exists
    await client.query(`
      ALTER TABLE careers_applications
        ADD COLUMN IF NOT EXISTS resume_data JSONB NULL,
        ADD COLUMN IF NOT EXISTS mobile VARCHAR(50) NULL,
        ADD COLUMN IF NOT EXISTS battle_token VARCHAR(50) UNIQUE DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS battle_token_used BOOLEAN DEFAULT FALSE;
    `);

    // 15. Create Battle Arena Questions Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS battle_questions (
        id VARCHAR(50) PRIMARY KEY,
        topic VARCHAR(255) NOT NULL,
        question TEXT NOT NULL,
        grading_rubric JSONB NOT NULL,
        model_answer TEXT NOT NULL,
        role_id VARCHAR(50) DEFAULT 'ai-pm',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 16. Create Battle Arena Answered Questions tracking Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS battle_answered_questions (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        question_id VARCHAR(50) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (email, question_id)
      );
    `);

    // Seed/sync static AI-PM questions
    logger.info('[DATABASE] ⏳ Syncing static AI-PM challenge questions...');
    const pmQuestions = [
      {
        id: "SWARM_01",
        topic: "LiveKit Latency & Conversational UX (Barge-in)",
        question: "A user is speaking to our Swarm via LiveKit. Our STT processes the text, passes it to the Orchestrator, which queries RAG, sends it to the LLM, and streams to TTS. The total round-trip latency is 2.5 seconds, making the conversation feel unnatural. Worse, when the user interrupts (barge-in), the TTS keeps speaking for 2 seconds. How do you fix the latency and the barge-in UX?",
        grading_rubric: [
          "Proposes semantic chunking/streaming from LLM directly to TTS.",
          "Addresses LiveKit/WebRTC voice activity detection (VAD) for instant TTS cancellation.",
          "Suggests filling the silence with 'filler words' (e.g., 'Hmm', 'Let me check') via a fast, local model."
        ],
        model_answer: "To fix the 2.5s latency, I'd move to a fully streaming pipeline. The LLM shouldn't wait for the full response; it needs to stream token chunks directly into the TTS engine so audio begins playing after the first sentence is generated. For the barge-in issue, the problem is the audio buffer. I would implement strict Voice Activity Detection (VAD) on the LiveKit client side. The millisecond the VAD detects the user speaking, the client must send an interrupt signal to immediately flush the TTS audio buffer and halt the LLM generation to save tokens. Finally, to mask the remaining 500ms network latency, I'd deploy a tiny, local edge model that instantly outputs filler sounds like 'Got it, let me pull that up' while the main Swarm does the heavy lifting."
      },
      {
        id: "SWARM_02",
        topic: "Agent Deadlocks and Infinite Loops",
        question: "In our 20-agent Swarm, Agent A (Research) asks Agent B (Data Analysis) for a summary. Agent B needs more context and queries Agent A. They enter an infinite loop, burning through $50 of LLM tokens in 3 minutes before hitting a hard timeout. How do you architect the orchestration layer to prevent this?",
        grading_rubric: [
          "Introduces a central Orchestrator/Router instead of pure peer-to-peer agent communication.",
          "Implements strict 'Time-to-Live' (TTL) or hop-count limits on agent requests.",
          "Proposes circuit breakers or token-burn alerts."
        ],
        model_answer: "Peer-to-peer agent communication at a 20-agent scale is a recipe for catastrophic token burn. I would transition to a centralized Orchestrator or 'Supervisor' model. Agents shouldn't trigger each other directly; they must return a 'tool_call' request to the Supervisor, which evaluates if the routing makes sense. To physically prevent loops, I'd attach a 'hop-count' metadata tag to every user prompt. If a single prompt gets passed between agents more than 4 times, the Supervisor forces a circuit breaker, halts the chain, and returns a graceful fallback message to the user. I'd also implement a hard token-budget cap per session ID at the API gateway level."
      },
      {
        id: "SWARM_03",
        topic: "Data Conflict: RAG vs. SearxNG",
        question: "A user asks for the latest Q3 financial metrics of a competitor. The internal RAG database (updated last week) says revenue is $40M. The SearxNG agent fetches a press release from 10 minutes ago saying $45M. The Synthesis Agent gets confused and hallucinates an average of $42.5M. How do you handle conflicting multi-source data?",
        grading_rubric: [
          "Implements a source-hierarchy or trust-scoring system.",
          "Forces the LLM to output explicit citations and timestamp comparisons.",
          "Identifies that averaging categorical/factual data is a prompt engineering failure."
        ],
        model_answer: "The Synthesis Agent shouldn't be doing math on facts. This is a routing and prompt engineering failure. I would implement a strict 'Timestamp and Trust' hierarchy in the orchestrator. When passing context to the final LLM, the payload must include metadata: Source, Trust Score, and Timestamp. The system prompt for the Synthesis Agent must explicitly state: 'If data sources conflict, prioritize the most recent timestamp. Never average factual numbers.' In the UX, the TTS should verbally acknowledge the discrepancy: 'Our internal records show $40M, but a press release from today indicates $45M.' This builds trust rather than hiding the system's underlying complexity."
      },
      {
        id: "SWARM_04",
        topic: "Multi-Agent Evaluation & Observability",
        question: "Our Swarm works perfectly in testing, but in production, 15% of user queries result in poor answers. Because a single query might trigger 6 different agents, RAG, and SearxNG, debugging takes days. What telemetry and observability stack do you build to monitor this Swarm?",
        grading_rubric: [
          "Mentions distributed tracing (e.g., LangSmith, Phoenix, Datadog).",
          "Proposes logging intermediate inputs/outputs for every agent node.",
          "Implements user feedback loops (implicit or explicit) tied to the trace ID."
        ],
        model_answer: "Debugging a 20-agent swarm with standard logs is impossible. I would implement distributed tracing using a framework like LangSmith, Arize Phoenix, or OpenTelemetry. Every incoming LiveKit session gets a unique Trace ID. Every time the Orchestrator calls RAG, SearxNG, or another agent, it generates a Child Span ID. This gives us a visual waterfall graph of the exact latency, token count, and intermediate prompt/response payload for every single hop. If a user gives a thumbs-down or terminates the call abruptly, that Trace ID is automatically flagged in our dashboard. We can then replay the exact agent trajectory to see if the STT misheard a word, SearxNG failed to scrape, or an agent hallucinated."
      },
      {
        id: "SWARM_05",
        topic: "SearxNG Rate Limiting and Fallbacks",
        question: "During a massive spike in user traffic, Google and Bing temporarily IP-ban our SearxNG instances for scraping too aggressively. Suddenly, our Web Research Agents are throwing 403 errors and failing completely. How do you architect a resilient web search pipeline?",
        grading_rubric: [
          "Suggests rotating proxy networks for SearxNG.",
          "Proposes graceful degradation (falling back to RAG/internal data).",
          "Mentions caching frequent live search results."
        ],
        model_answer: "Relying purely on live metasearch at enterprise scale without a buffer is too fragile. First, on the infrastructure side, our SearxNG instances need to be routed through a robust rotating residential proxy network to avoid IP bans from Google/Bing. Second, we need an aggressive caching layer (like Redis). If 50 users ask about the 'latest fed interest rate' in an hour, we should only hit SearxNG once and serve the cached result to the other 49. Finally, if the search API completely fails, the Orchestrator needs a graceful degradation protocol. The TTS should say, 'I'm having trouble accessing the live web right now, but based on our internal data...' rather than simply crashing or saying 'Error 403'."
      },
      {
        id: "SWARM_06",
        topic: "Context Window Management Across 20 Agents",
        question: "A user is on a 45-minute LiveKit call. As the conversation progresses, the context window grows massive. Passing the entire STT transcript to every agent is causing API latency to exceed 5 seconds and costs are spiraling. How do you manage conversational memory?",
        grading_rubric: [
          "Proposes dynamic memory summarization (rolling summaries).",
          "Suggests passing only task-relevant context to specialized agents, not the whole transcript.",
          "Uses a hybrid memory architecture (Vector DB for long-term, sliding window for short-term)."
        ],
        model_answer: "We cannot pass a 45-minute raw STT transcript to every agent node; it destroys both latency and unit economics. I would implement a hybrid, tiered memory system. The Orchestrator should only maintain a sliding window of the last 5 conversation turns for immediate conversational context. For the rest of the call, I'd deploy a background 'Memory Agent' that constantly summarizes the transcript into key facts and updates a fast Redis store or user profile. When the Orchestrator calls a specialized agent (like a coding agent), it only passes the specific task prompt and the relevant summary, completely dropping the conversational pleasantries. This keeps our token payload extremely lean and fast."
      },
      {
        id: "SWARM_07",
        topic: "Handling STT Hallucinations in RAG",
        question: "A user says 'Pull the metrics for our client, *AeroTech*'. The STT engine mishears it as 'Error Tech'. The Swarm's Orchestrator searches the RAG database for 'Error Tech', finds nothing, and tells the user 'We have no data on that.' How do you build resilience against STT errors?",
        grading_rubric: [
          "Suggests semantic/fuzzy searching in the RAG retrieval instead of exact keyword matching.",
          "Proposes an LLM-based query rewriting step.",
          "Uses the Orchestrator to ask clarifying questions when confidence is low."
        ],
        model_answer: "STT phonetic errors are inevitable, especially with accents or background noise. The worst thing we can do is pass raw STT output directly into a strict database query. I'd insert a lightweight 'Query Rewriter' step before the RAG retrieval. This LLM looks at the STT text and the conversation context to generate an optimized search vector. More importantly, our RAG Vector DB needs to rely on semantic embeddings, not exact keyword matching—'Error Tech' and 'AeroTech' have different phonetic spellings, but a good embedding model might catch the contextual similarity. If the retrieval still returns zero results, the Orchestrator must be programmed to fallback gracefully: 'I didn't catch that company name perfectly. Did you mean AeroTech?'"
      },
      {
        id: "SWARM_08",
        topic: "Routing Strategy: Semantic vs. Deterministic",
        question: "Currently, your Orchestrator uses an LLM to decide which of the 20 agents to call based on the user's prompt (Semantic Routing). This adds 800ms of latency before the actual work even begins. The engineering team wants to switch to hard-coded keyword routing. As a PM, how do you resolve this?",
        grading_rubric: [
          "Recognizes the trade-off between latency (deterministic) and flexibility (semantic).",
          "Proposes a hybrid/cascading routing system.",
          "Mentions using faster, smaller models or embedding classifiers for routing."
        ],
        model_answer: "Pure LLM semantic routing is too slow for real-time voice, but hard-coded keyword routing is too rigid for natural conversation. I would implement a cascading hybrid router. First, the user's STT input hits a fast, deterministic layer—using regex or a lightweight intent classifier (like a fast embedding comparison). If the intent is obvious (e.g., 'What is the weather', 'Search the web for X'), it routes instantly in under 50ms. If the classifier confidence is below 80%, *then* it falls back to the LLM semantic router to handle the complex ambiguity. This gives us the 800ms penalty only on the edge cases, dramatically lowering average latency while maintaining the Swarm's intelligence."
      },
      {
        id: "SWARM_09",
        topic: "Multi-Modal Context Synchronization",
        question: "A user is interacting with your Swarm via both a dashboard UI and LiveKit voice. The user clicks a chart on the screen and says, 'Agent, tell me why this metric dropped.' The STT captures the voice, but the agent has no idea what 'this' refers to. How do you synchronize state between the visual UI and the voice Swarm?",
        grading_rubric: [
          "Proposes a shared state/event bus between the frontend UI and backend Swarm.",
          "Passes UI interaction metadata into the Orchestrator's context window.",
          "Mentions visual context grounding."
        ],
        model_answer: "The voice agent is flying blind because it lacks spatial UI context. We need to bridge the WebSocket/LiveKit connection with the frontend application state. I would implement a shared event bus. Whenever the user hovers over, clicks, or highlights an element on the dashboard, the frontend silently pushes a lightweight JSON payload to the Orchestrator's active context window (e.g., `{'active_element': 'Q3 Revenue Chart', 'highlighted_data': 'August Drop'}`). When the user says 'Why did *this* drop?', the Orchestrator injects that recent UI metadata into the prompt. The LLM now reads: 'User asked: Why did this drop? Context: User is currently clicking on Q3 Revenue Chart.' This creates a seamless, multi-modal illusion for the user."
      },
      {
        id: "SWARM_10",
        topic: "Enterprise Security and Agent Boundary Control",
        question: "Your Swarm has an Internal SQL Agent (accesses private enterprise data) and a SearxNG Agent (accesses the public web). An enterprise security auditor is terrified of a prompt-injection attack where a user tricks the Swarm into reading private SQL data and posting it to an external URL via the web agent. How do you secure this?",
        grading_rubric: [
          "Implements strict sandboxing and Network/VPC isolation for specific agents.",
          "Uses a Zero-Trust architecture where the Orchestrator strips sensitive data before passing context.",
          "Mentions output guardrails/DLP (Data Loss Prevention) scanners."
        ],
        model_answer: "This is a severe exfiltration risk. We cannot rely on LLM system prompts for security; we need infrastructure-level hard boundaries. First, the agents must be strictly sandboxed. The Internal SQL Agent runs in a private VPC with zero outbound internet access. The SearxNG Agent runs in a separate environment with no access to internal networks. Second, I would implement a Data Loss Prevention (DLP) middleware layer within the Orchestrator. If the SQL Agent returns sensitive PII or financial data, the Orchestrator masks it or flags the session. If the Orchestrator tries to pass that context to the SearxNG agent, the DLP scanner physically blocks the request, acting as a zero-trust firewall between internal knowledge and external actions."
      }
    ];

    for (const q of pmQuestions) {
      await client.query(`
        INSERT INTO battle_questions (id, topic, question, grading_rubric, model_answer, role_id)
        VALUES ($1, $2, $3, $4, $5, 'ai-pm')
        ON CONFLICT (id) DO UPDATE
        SET topic = EXCLUDED.topic,
            question = EXCLUDED.question,
            grading_rubric = EXCLUDED.grading_rubric,
            model_answer = EXCLUDED.model_answer,
            role_id = EXCLUDED.role_id;
      `, [q.id, q.topic, q.question, JSON.stringify(q.grading_rubric), q.model_answer]);
    }
    logger.info(`[DATABASE] ✅ Seeded ${pmQuestions.length} PM questions into battle_questions.`);


    // Truncate and re-seed nist_rmf_core to ensure it is in sync with nist-rmf-core.json
    logger.info('[DATABASE] ⏳ Syncing NIST AI RMF Core subcategories...');
    const nistJsonPath = path.join(__dirname, 'nist-rmf-core.json');
    if (fs.existsSync(nistJsonPath)) {
      const rawNist = fs.readFileSync(nistJsonPath, 'utf8');
      const nistItems = JSON.parse(rawNist);
      
      // Perform a transaction or simple truncate to reload
      await client.query('TRUNCATE TABLE nist_rmf_core RESTART IDENTITY CASCADE');
      
      for (const item of nistItems) {
        const { function: func, category, subcategory_id, description } = item;
        await client.query(
          `INSERT INTO nist_rmf_core (function, category, subcategory_id, description)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (subcategory_id) DO NOTHING;`,
          [func, category, subcategory_id, description]
        );
      }
      logger.info(`[DATABASE] ✅ Sync complete. Seeded ${nistItems.length} subcategories into nist_rmf_core.`);
    } else {
      logger.warn(`[DATABASE] ⚠️ Seed file not found at ${nistJsonPath}. NIST table was not seeded.`);
    }

    // Truncate and re-seed owasp_llm_core to ensure it is in sync with owasp-llm-core.json
    logger.info('[DATABASE] ⏳ Syncing OWASP Top 10 for LLM subcategories...');
    const owaspJsonPath = path.join(__dirname, 'owasp-llm-core.json');
    if (fs.existsSync(owaspJsonPath)) {
      const rawOwasp = fs.readFileSync(owaspJsonPath, 'utf8');
      const owaspItems = JSON.parse(rawOwasp);
      
      // Perform a transaction or simple truncate to reload
      await client.query('TRUNCATE TABLE owasp_llm_core RESTART IDENTITY CASCADE');
      
      for (const item of owaspItems) {
        const { framework, control_id, category, description } = item;
        await client.query(
          `INSERT INTO owasp_llm_core (framework, control_id, category, description)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (control_id) DO NOTHING;`,
          [framework, control_id, category, description]
        );
      }
      logger.info(`[DATABASE] ✅ Sync complete. Seeded ${owaspItems.length} subcategories into owasp_llm_core.`);
    } else {
      logger.warn(`[DATABASE] ⚠️ Seed file not found at ${owaspJsonPath}. OWASP table was not seeded.`);
    }

    // Dynamic agent analysis execution
    try {
      logger.info('[DATABASE] ⏳ Running dynamic Agent Scope Compliance analysis...');
      const isWindows = process.platform === 'win32';
      const pythonPath = isWindows
        ? path.join(__dirname, '..', '..', '..', 'python-agent', 'venv', 'Scripts', 'python.exe')
        : path.join(__dirname, '..', '..', '..', 'python-agent', 'venv', 'bin', 'python');
      
      const scriptPath = path.join(__dirname, '..', '..', '..', 'python-agent', 'run_scope_analyzer.py');

      if (fs.existsSync(pythonPath) && fs.existsSync(scriptPath)) {
        const { stdout, stderr } = await execPromise(`"${pythonPath}" "${scriptPath}"`);
        if (stderr) {
          logger.info(`[DATABASE] Agent analyzer logs: ${stderr.trim()}`);
        }
        if (stdout) {
          const items = JSON.parse(stdout.trim());
          logger.info(`[DATABASE] Ingesting/updating ${items.length} agent profiles dynamically...`);
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
              unmapped_count,
              control_map
            } = item;

            await client.query(
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
                unmapped_count,
                control_map
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
                unmapped_count = EXCLUDED.unmapped_count,
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
                unmapped_count || 0,
                JSON.stringify(control_map)
              ]
            );
          }
          logger.info(`[DATABASE] ✅ Dynamic Agent analysis database sync complete.`);
        }
      } else {
        logger.warn(`[DATABASE] ⚠️ Python executable or analyzer script not found at ${pythonPath} or ${scriptPath}. Dynamic agent analysis skipped.`);
      }
    } catch (analysisError) {
      logger.error(`[DATABASE] ❌ Dynamic Agent analysis failed: ${analysisError.message}`);
    }

    // Dynamic agent compliance scan execution
    try {
      logger.info('[DATABASE] ⏳ Running dynamic Agent Compliance scan...');
      const isWindows = process.platform === 'win32';
      const pythonPath = isWindows
        ? path.join(__dirname, '..', '..', '..', 'python-agent', 'venv', 'Scripts', 'python.exe')
        : path.join(__dirname, '..', '..', '..', 'python-agent', 'venv', 'bin', 'python');
      
      const scannerPath = path.join(__dirname, '..', '..', '..', 'python-agent', 'agents', 'nist', 'scanner.py');

      if (fs.existsSync(pythonPath) && fs.existsSync(scannerPath)) {
        const { stdout, stderr } = await execPromise(`"${pythonPath}" "${scannerPath}"`);
        if (stderr) {
          logger.info(`[DATABASE] Agent compliance scanner logs: ${stderr.trim()}`);
        }
        if (stdout) {
          const scanResult = JSON.parse(stdout.trim());
          if (scanResult && scanResult.success && scanResult.history) {
            logger.info(`[DATABASE] Ingesting compliance results for ${Object.keys(scanResult.history).length} agents dynamically...`);
            for (const [agentName, data] of Object.entries(scanResult.history)) {
              const nist = data.nist_audit || { score: 100, risk: "LOW", controls: [] };
              await client.query(
                `INSERT INTO agent_security_status (agent_name, nist_score, nist_risk, nist_controls, timestamp)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (agent_name)
                 DO UPDATE SET
                   nist_score = EXCLUDED.nist_score,
                   nist_risk = EXCLUDED.nist_risk,
                   nist_controls = EXCLUDED.nist_controls,
                   timestamp = EXCLUDED.timestamp;`,
                [
                  agentName.toLowerCase(),
                  nist.score !== undefined ? nist.score : 100.0,
                  nist.risk || "LOW",
                  JSON.stringify(nist.controls || []),
                  data.timestamp || new Date().toISOString()
                ]
              );
            }
            logger.info(`[DATABASE] ✅ Dynamic Agent compliance scan database sync complete.`);
          }
        }
      } else {
        logger.warn(`[DATABASE] ⚠️ Python executable or scanner script not found at ${pythonPath} or ${scannerPath}. Dynamic compliance scan skipped.`);
      }
    } catch (scanError) {
      logger.error(`[DATABASE] ❌ Dynamic Agent compliance scan failed: ${scanError.message}`);
    }
    // Ensure last_seen column exists and set startup heartbeats for default active agents
    try {
      await client.query(`
        ALTER TABLE agent_analysis
          ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE
      `).catch(() => {});
      await client.query(`
        UPDATE agent_analysis
        SET last_seen = NOW()
        WHERE LOWER(agent_name) IN ('swarm_copilot', 'devopsgeni')
      `);
      logger.info(`[DATABASE] ✅ Default active agents (swarm_copilot, devopsgeni) heartbeats initialized.`);
    } catch (startupErr) {
      logger.warn(`[DATABASE] ⚠️ Failed to initialize startup heartbeats: ${startupErr.message}`);
    }

    logger.info(`[DATABASE] ✅ PostgreSQL Tables Initialized.`);
  } catch (error) {
    logger.error(`[DATABASE] ❌ Table initialization failed: ${error.message}`);
    throw error;
  }
};

export const query = (text, params) => {
  if (!pool) {
    throw new Error('Database pool not initialized. The database is currently offline.');
  }
  return pool.query(text, params);
};
