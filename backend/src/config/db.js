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
