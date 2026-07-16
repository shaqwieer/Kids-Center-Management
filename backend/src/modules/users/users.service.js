/**
 * Staff accounts (manager/staff) for a tenant.
 *
 * Every mutation guards against locking the center out of its own system:
 * the last manager can neither be deleted nor demoted, and nobody can delete
 * their own account while signed in.
 */
import { db } from '../../config/db.js';
import { ApiError } from '../../utils/http.js';
import { hashPassword } from '../auth/auth.service.js';

export const ROLES = ['manager', 'staff'];

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    created_at: user.created_at,
  };
}

export async function listUsers(tenantId) {
  const rows = await db('users')
    .where({ tenant_id: tenantId })
    .orderBy([{ column: 'role', order: 'asc' }, { column: 'created_at', order: 'asc' }]);
  return rows.map(publicUser);
}

async function findInTenant(tenantId, id) {
  const user = await db('users').where({ tenant_id: tenantId, id }).first();
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

async function assertEmailFree(tenantId, email, exceptId = null) {
  const q = db('users').where({ tenant_id: tenantId, email });
  if (exceptId) q.whereNot({ id: exceptId });
  if (await q.first()) throw ApiError.conflict('That email is already used by another account', { field: 'email' });
}

async function countManagers(tenantId, exceptId = null) {
  const q = db('users').where({ tenant_id: tenantId, role: 'manager' });
  if (exceptId) q.whereNot({ id: exceptId });
  const [{ count }] = await q.count({ count: '*' });
  return Number(count);
}

/** Block any change that would leave the tenant with zero managers. */
async function assertNotLastManager(tenantId, user) {
  if (user.role !== 'manager') return;
  if (await countManagers(tenantId, user.id) === 0) {
    throw ApiError.conflict('This is the only manager account. Promote another user to manager first.', {
      code: 'last_manager',
    });
  }
}

export async function createUser(tenantId, { name, email, password, role }) {
  await assertEmailFree(tenantId, email);
  const [user] = await db('users')
    .insert({
      tenant_id: tenantId,
      name,
      email,
      password_hash: await hashPassword(password),
      role,
    })
    .returning('*');
  return publicUser(user);
}

export async function updateUser(tenantId, id, patch) {
  const user = await findInTenant(tenantId, id);
  const next = {};

  if (patch.name !== undefined) next.name = patch.name;
  if (patch.email !== undefined && patch.email !== user.email) {
    await assertEmailFree(tenantId, patch.email, id);
    next.email = patch.email;
  }
  if (patch.password) next.password_hash = await hashPassword(patch.password);
  if (patch.role !== undefined && patch.role !== user.role) {
    if (patch.role !== 'manager') await assertNotLastManager(tenantId, user);
    next.role = patch.role;
  }

  if (Object.keys(next).length === 0) return publicUser(user);
  const [updated] = await db('users').where({ tenant_id: tenantId, id }).update(next).returning('*');
  return publicUser(updated);
}

export async function deleteUser(tenantId, id, actorId) {
  if (id === actorId) throw ApiError.conflict('You cannot delete the account you are signed in with', { code: 'self_delete' });
  const user = await findInTenant(tenantId, id);
  await assertNotLastManager(tenantId, user);
  await db('users').where({ tenant_id: tenantId, id }).del();
  return { id };
}
