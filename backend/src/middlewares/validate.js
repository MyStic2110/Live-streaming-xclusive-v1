import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';

/**
 * Request validation middleware backed by a Zod schema.
 *
 * @param {import('zod').ZodTypeAny} schema  schema to validate against
 * @param {'body'|'query'|'params'} source   request property to validate (default: body)
 *
 * On success the parsed (and coerced/stripped) value replaces req[source].
 * On failure a 422 VALIDATION_ERROR is returned with a field-level breakdown.
 */
export const validate = (schema, source = 'body') => (req, res, next) => {
  try {
    req[source] = schema.parse(req[source]);
    next();
  } catch (err) {
    if (err instanceof ZodError) {
      const details = err.issues.map((i) => ({
        field: i.path.join('.') || source,
        message: i.message
      }));
      return next(ApiError.validation('Request validation failed.', details));
    }
    next(err);
  }
};
