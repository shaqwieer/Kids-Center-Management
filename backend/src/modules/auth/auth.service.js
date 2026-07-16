/** Auth: password hashing, JWT signing, login. */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../../config/db.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/http.js';

export function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export function signToken(user, tenant) {
  const payload = {
    sub: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
  };
  return jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
}

export function verifyToken(token) {
  return jwt.verify(token, env.jwt.secret);
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export async function login(email, password) {
  const user = await db('users').where({ email }).first();
  if (!user) throw ApiError.unauthorized('Invalid email or password');
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) throw ApiError.unauthorized('Invalid email or password');
  const tenant = await db('tenants').where({ id: user.tenant_id }).first();
  const token = signToken(user, tenant);
  return { token, user: publicUser(user), tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name } };
}

export async function getMe(userId) {
  const user = await db('users').where({ id: userId }).first();
  if (!user) throw ApiError.unauthorized('User no longer exists');
  return publicUser(user);
}
