import crypto from 'crypto';
import logger from './logger.js';

let jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret || jwtSecret === 'secret-whitelabel-swarm-key') {
  if (process.env.NODE_ENV === 'production') {
    logger.error('[SECURITY] FATAL: JWT_SECRET environment variable is not configured or uses a weak default key in production mode. Halting server.');
    throw new Error('FATAL: JWT_SECRET environment variable is not configured or uses a weak default key in production mode.');
  }
  
  logger.warn('[SECURITY] JWT_SECRET is not configured or uses a weak default key! Generating a cryptographically secure random 64-byte secret key for this server instance.');
  jwtSecret = crypto.randomBytes(64).toString('hex');
}

export const JWT_SECRET_KEY = jwtSecret;
