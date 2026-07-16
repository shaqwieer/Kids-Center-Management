/** Session persistence + the canonical sessionDTO shape (single source of truth). */
import { db } from '../../config/db.js';
import { priceForDuration } from '../../lib/timing.js';

const SELECT = [
  's.id', 's.tenant_id', 's.customer_id', 's.child_id',
  's.duration_minutes', 's.started_at', 's.ends_at', 's.ended_at',
  's.status', 's.late_minutes', 's.late_fee', 's.schedule_version', 's.created_at',
  'c.full_name as customer_full_name', 'c.phone as customer_phone', 'c.customer_code as customer_code',
  'ch.name as child_name', 'ch.gender as child_gender', 'ch.age as child_age',
];

function baseQuery() {
  return db('sessions as s')
    .join('customers as c', 'c.id', 's.customer_id')
    .join('children as ch', 'ch.id', 's.child_id')
    .select(SELECT);
}

export async function getSessionRow(id) {
  return baseQuery().where('s.id', id).first();
}

export async function listActiveRows(tenantId) {
  return baseQuery()
    .where('s.tenant_id', tenantId)
    .whereIn('s.status', ['active', 'warned', 'overtime'])
    .orderBy('s.ends_at', 'asc');
}

export async function insertSession(data) {
  const [row] = await db('sessions').insert(data).returning('id');
  return getSessionRow(row.id);
}

export async function updateSession(id, patch) {
  await db('sessions').where({ id }).update(patch);
  return getSessionRow(id);
}

/**
 * Build the canonical DTO. Pass settings ({ durations, currency }) to include
 * the base `price`; omit for lightweight payloads (e.g. ticks).
 */
export function toSessionDTO(row, settings = null) {
  if (!row) return null;
  const price = settings ? priceForDuration(settings.durations, row.duration_minutes) : null;
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    customer_id: row.customer_id,
    child_id: row.child_id,
    customer: {
      id: row.customer_id,
      full_name: row.customer_full_name,
      phone: row.customer_phone,
      customer_code: row.customer_code,
    },
    child: {
      id: row.child_id,
      name: row.child_name,
      gender: row.child_gender,
      age: row.child_age,
    },
    duration_minutes: row.duration_minutes,
    started_at: row.started_at instanceof Date ? row.started_at.toISOString() : row.started_at,
    ends_at: row.ends_at instanceof Date ? row.ends_at.toISOString() : row.ends_at,
    ended_at: row.ended_at instanceof Date ? row.ended_at.toISOString() : row.ended_at,
    status: row.status,
    late_minutes: row.late_minutes,
    late_fee: Number(row.late_fee),
    price,
    currency: settings ? settings.currency : null,
  };
}
