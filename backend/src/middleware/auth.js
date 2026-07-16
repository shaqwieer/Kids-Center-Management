/** JWT auth + role guards. Populates req.user + req.tenant context. */
import { verifyToken } from '../modules/auth/auth.service.js';
import { ApiError } from '../utils/http.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(ApiError.unauthorized('Missing bearer token'));
  try {
    const claims = verifyToken(token);
    req.user = {
      id: claims.sub,
      role: claims.role,
      name: claims.name,
      email: claims.email,
      tenantId: claims.tenantId,
      tenantSlug: claims.tenantSlug,
    };
    return next();
  } catch {
    return next(ApiError.unauthorized('Invalid or expired token'));
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden('Insufficient role'));
    return next();
  };
}
