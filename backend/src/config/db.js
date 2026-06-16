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
