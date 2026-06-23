import crypto from 'crypto';
import logger from '../config/logger.js';

/**
 * Attaches a correlation id to every request for end-to-end traceability.
 * - Honours an inbound `X-Request-Id` (from an upstream gateway/proxy) if present.
 * - Exposes it back on the response as `X-Request-Id`.
 * - Provides a request-scoped child logger at `req.log`.
 *
 * `req.id` is surfaced as `traceId` in every error envelope.
 */
export const requestContext = (req, res, next) => {
  const inbound = req.headers['x-request-id'];
  const requestId = (typeof inbound === 'string' && inbound.length > 0 && inbound.length <= 200)
    ? inbound
    : crypto.randomUUID();

  req.id = requestId;
  req.log = logger.child({ reqId: requestId });
  res.setHeader('X-Request-Id', requestId);
  next();
};
