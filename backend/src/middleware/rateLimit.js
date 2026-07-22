/**
 * Minimal fixed-window rate limiter for the PUBLIC write endpoints (registration,
 * party booking, review submission). Those have no auth in front of them, so a
 * bored someone with a script could otherwise fill the calendar or the DB.
 *
 * In-memory and per-process on purpose: it is a speed bump, not a security
 * boundary, and it costs nothing. If the API is ever scaled to several
 * instances, move the counter into Redis (the connection already exists).
 */
import { ApiError } from '../utils/http.js';

const buckets = new Map();

// Keep the map from growing without bound on a long-lived process.
const SWEEP_MS = 5 * 60_000;
setInterval(() => {
  const now = Date.now();
  for (const [key, b] of buckets) if (b.resetAt < now) buckets.delete(key);
}, SWEEP_MS).unref?.();

/**
 * @param {{windowMs?:number, max?:number, key?:(req)=>string}} opts
 */
export function rateLimit({ windowMs = 60_000, max = 10, key } = {}) {
  return (req, res, next) => {
    const id = key ? key(req) : `${req.ip}:${req.baseUrl}${req.path}`;
    const now = Date.now();
    const bucket = buckets.get(id);

    if (!bucket || bucket.resetAt < now) {
      buckets.set(id, { count: 1, resetAt: now + windowMs });
      return next();
    }

    bucket.count += 1;
    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return next(new ApiError(429, 'rate_limited', 'Too many requests — please try again shortly', { retryAfter }));
    }
    return next();
  };
}
