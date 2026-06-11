import pg from 'pg';
import logger from './logger.js';

const { Pool } = pg;

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
