/** Zod request validation middleware. */
import { ApiError } from '../utils/http.js';

export const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    return next(ApiError.badRequest('Validation failed', result.error.flatten()));
  }
  req[source] = result.data;
  return next();
};
