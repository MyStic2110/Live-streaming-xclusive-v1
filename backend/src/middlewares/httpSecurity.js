import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import logger from '../config/logger.js';

/**
 * Security/transport headers. The backend is a JSON API (the SPA is served
 * separately by Vite), so HTML-oriented policies are relaxed to avoid
 * interfering with cross-origin XHR/fetch while keeping the hardening headers.
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: false
});

/**
 * CORS policy.
 * - If CORS_ORIGINS is set (comma-separated), only those origins are allowed
 *   and credentials are permitted.
 * - If unset, falls back to the permissive default (preserves existing
 *   behaviour) but logs a warning so it is visible in non-dev environments.
 */
export const corsPolicy = () => {
  const allow = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (allow.length === 0) {
    if (process.env.NODE_ENV === 'production') {
      logger.warn('[SECURITY] CORS_ORIGINS is not set in production — allowing all origins. Set CORS_ORIGINS to lock this down.');
    }
    return cors();
  }

  return cors({
    origin(origin, cb) {
      // Allow same-origin / non-browser clients (no Origin header).
      if (!origin || allow.includes(origin)) return cb(null, true);
      return cb(new Error(`Origin ${origin} is not allowed by CORS policy.`));
    },
    credentials: true
  });
};

/**
 * Generous global rate limiter to protect against accidental floods and basic
 * abuse. High-frequency internal telemetry ingestion is exempt so agent trace
 * streams are never throttled. Tunable via GLOBAL_RATE_LIMIT (req/min/IP).
 */
export const globalRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.GLOBAL_RATE_LIMIT) || 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => req.path.includes('/llm-trace'),
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests. Please slow down and try again shortly.',
      code: 'RATE_LIMITED',
      traceId: req.id || null
    });
  }
});
