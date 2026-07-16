/** Tenant lookup. The system is tenant-ready; a single tenant is seeded. */
import { db } from '../../config/db.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/http.js';

export async function getTenantBySlug(slug) {
  return db('tenants').where({ slug }).first();
}

export async function getDefaultTenant() {
  const t = await getTenantBySlug(env.defaultTenantSlug);
  if (!t) throw ApiError.notFound(`Default tenant '${env.defaultTenantSlug}' not found — run the seed`);
  return t;
}
