/**
 * Standard application error with an HTTP status, a machine-readable code,
 * and a flag indicating whether the message is safe to expose to clients.
 *
 * Throw these (or pass to `next()`) from controllers and let the central
 * error handler render a consistent envelope: { error, code, traceId }.
 */
export class ApiError extends Error {
  constructor(statusCode, code, message, details = undefined) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    // 4xx messages are caller-facing and safe to show; 5xx are masked.
    this.expose = statusCode < 500;
  }

  static badRequest(message = 'Bad request.', code = 'BAD_REQUEST', details) {
    return new ApiError(400, code, message, details);
  }
  static validation(message = 'Request validation failed.', details) {
    return new ApiError(422, 'VALIDATION_ERROR', message, details);
  }
  static unauthorized(message = 'Authentication required.', code = 'UNAUTHORIZED') {
    return new ApiError(401, code, message);
  }
  static forbidden(message = 'Insufficient privileges.', code = 'FORBIDDEN') {
    return new ApiError(403, code, message);
  }
  static notFound(message = 'Resource not found.', code = 'NOT_FOUND') {
    return new ApiError(404, code, message);
  }
  static conflict(message = 'Resource already exists.', code = 'CONFLICT') {
    return new ApiError(409, code, message);
  }
  static tooMany(message = 'Too many requests.', code = 'RATE_LIMITED') {
    return new ApiError(429, code, message);
  }
  static internal(message = 'An internal server error occurred.', code = 'INTERNAL_ERROR') {
    return new ApiError(500, code, message);
  }
}
