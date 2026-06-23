import logger from '../config/logger.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Wrap an async controller so any rejected promise is forwarded to the
 * central error handler instead of crashing the request as an unhandled
 * rejection. Usage: router.post('/x', asyncHandler(controller))
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Terminal 404 for any route that did not match. Returns a JSON envelope
 * consistent with the error handler rather than Express' default HTML page.
 */
export const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.originalUrl}`,
    code: 'ROUTE_NOT_FOUND',
    traceId: req.id || null
  });
};

/**
 * Central error handler. Renders a single, consistent envelope:
 *   { error, code, traceId, [details] }
 * - 4xx: caller-facing message is preserved (back-compat for the frontend,
 *   which keys auto-logout off specific 401/403 auth messages).
 * - 5xx: internal message is masked to avoid leaking stack/SQL details.
 */
// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity (4 args)
export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || err.status || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'An internal server error occurred.';
  let details = err.details;

  // Normalise common framework/parser errors into the same envelope.
  if (err.type === 'entity.parse.failed') {
    statusCode = 400; code = 'INVALID_JSON'; message = 'Malformed JSON in request body.';
  } else if (err.type === 'entity.too.large') {
    statusCode = 413; code = 'PAYLOAD_TOO_LARGE'; message = 'Request body exceeds the allowed size limit.';
  }

  const expose = err instanceof ApiError ? err.expose : statusCode < 500;
  if (!expose) {
    message = 'An internal server error occurred.';
    details = undefined;
  }

  const log = req.log || logger;
  const logPayload = { reqId: req.id, code, statusCode, path: req.originalUrl, method: req.method };
  if (statusCode >= 500) {
    log.error({ ...logPayload, err }, `[API] ${statusCode} ${code}: ${err.message}`);
  } else {
    log.warn(logPayload, `[API] ${statusCode} ${code}: ${err.message}`);
  }

  if (res.headersSent) {
    return next(err);
  }

  const body = { error: message, code, traceId: req.id || null };
  if (details !== undefined) body.details = details;
  res.status(statusCode).json(body);
};
