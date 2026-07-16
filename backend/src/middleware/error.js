/** Central error + 404 handlers. */
import { ApiError } from '../utils/http.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'not_found', message: 'Route not found' } });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }
  // Postgres unique violation
  if (err && err.code === '23505') {
    return res.status(409).json({
      error: { code: 'conflict', message: 'A record with these details already exists', details: err.detail },
    });
  }
  // eslint-disable-next-line no-console
  console.error('[error]', err);
  return res.status(500).json({ error: { code: 'internal', message: 'Internal server error' } });
}
