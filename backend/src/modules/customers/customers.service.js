/**
 * Customers (the mother/guardian) + their children.
 * Shared by staff routes and the public QR registration flow.
 */
import { db } from '../../config/db.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/http.js';
import { uniqueCustomerCode, makeQrToken } from '../../utils/codes.js';

function cardUrl(qrToken) {
  return `${env.appBaseUrl.replace(/\/$/, '')}/c/${qrToken}`;
}

function customerView(c, children = []) {
  return {
    id: c.id,
    full_name: c.full_name,
    phone: c.phone,
    national_id: c.national_id,
    customer_code: c.customer_code,
    qr_token: c.qr_token,
    consent: c.consent,
    card_url: cardUrl(c.qr_token),
    children,
    created_at: c.created_at,
  };
}

async function childrenOf(customerId) {
  // Return birthdate as a plain 'YYYY-MM-DD' string (not a pg Date object): it
  // must bind directly to <input type="date"> and round-trip through the staff
  // edit form without a timezone shift silently moving the day on save.
  return db('children')
    .where({ customer_id: customerId })
    .orderBy('created_at', 'asc')
    .select(
      'id', 'customer_id', 'name', 'age', 'gender', 'created_at', 'has_allergy', 'allergy_note',
      db.raw("to_char(birthdate, 'YYYY-MM-DD') as birthdate"),
    );
}

/** Age in whole years from a birthdate, or null if it isn't a usable date. */
function ageFromBirthdate(birthdate) {
  if (!birthdate) return null;
  const bd = new Date(birthdate);
  if (Number.isNaN(bd.getTime())) return null;
  const now = new Date();
  let years = now.getUTCFullYear() - bd.getUTCFullYear();
  const beforeBirthday = now.getUTCMonth() < bd.getUTCMonth()
    || (now.getUTCMonth() === bd.getUTCMonth() && now.getUTCDate() < bd.getUTCDate());
  if (beforeBirthday) years -= 1;
  return years >= 0 && years < 130 ? years : null;
}

/**
 * The child columns every write path shares. Birthdate is the source of truth
 * now that the form asks for it; `age` is kept in sync (and still accepted on
 * its own for older records and the staff quick-add).
 */
function childFacts(ch) {
  const birthdate = ch.birthdate ? String(ch.birthdate).slice(0, 10) : null;
  const derived = ageFromBirthdate(birthdate);
  const explicit = ch.age !== undefined && ch.age !== '' && ch.age !== null ? Number(ch.age) : null;
  const hasAllergy = Boolean(ch.has_allergy);
  return {
    age: derived ?? explicit,
    gender: ch.gender === 'm' || ch.gender === 'f' ? ch.gender : null,
    birthdate,
    has_allergy: hasAllergy,
    // Clearing the flag clears the note — no stale allergy text left behind.
    allergy_note: hasAllergy && ch.allergy_note ? String(ch.allergy_note).trim().slice(0, 500) : null,
  };
}

export async function searchCustomers(tenantId, q) {
  const query = db('customers as c')
    .leftJoin('children as ch', 'ch.customer_id', 'c.id')
    .where('c.tenant_id', tenantId)
    .groupBy('c.id')
    .select('c.id', 'c.full_name', 'c.phone', 'c.customer_code', 'c.qr_token')
    .count('ch.id as children_count')
    .orderBy('c.created_at', 'desc')
    .limit(100);
  if (q && q.trim()) {
    const like = `%${q.trim()}%`;
    query.andWhere((b) => b.whereILike('c.full_name', like)
      .orWhereILike('c.phone', like)
      .orWhereILike('c.customer_code', like));
  }
  const rows = await query;
  return rows.map((r) => ({ ...r, children_count: Number(r.children_count) }));
}

export async function getCustomerDetail(tenantId, id) {
  const c = await db('customers').where({ id, tenant_id: tenantId }).first();
  if (!c) throw ApiError.notFound('Customer not found');
  const children = await childrenOf(id);

  const visitRows = await db('sessions as s')
    .join('children as ch', 'ch.id', 's.child_id')
    .where('s.customer_id', id)
    .andWhere('s.status', 'completed')
    .select('s.started_at', 's.ended_at', 's.duration_minutes', 's.late_minutes', 's.late_fee', 'ch.name as child_name')
    .orderBy('s.started_at', 'desc')
    .limit(50);

  const visits = visitRows.map((v) => {
    const playedMinutes = v.ended_at
      ? Math.max(1, Math.round((new Date(v.ended_at).getTime() - new Date(v.started_at).getTime()) / 60000))
      : v.duration_minutes;
    return {
      date: v.started_at,
      child: v.child_name,
      duration_minutes: v.duration_minutes,
      played_minutes: playedMinutes,
      late_minutes: v.late_minutes,
      late_fee: Number(v.late_fee),
      over: playedMinutes > v.duration_minutes,
    };
  });

  return { ...customerView(c, children), visits, visit_count: visits.length };
}

async function insertChildren(trx, customerId, children = []) {
  const rows = (children || [])
    .filter((ch) => ch && ch.name && String(ch.name).trim())
    .map((ch) => ({
      customer_id: customerId,
      name: String(ch.name).trim(),
      ...childFacts(ch),
    }));
  if (rows.length) await trx('children').insert(rows);
}

async function createCustomerTx({ tenantId, full_name, phone, national_id, consent, children }) {
  const code = await uniqueCustomerCode((candidate) =>
    db('customers').where({ tenant_id: tenantId, customer_code: candidate }).first().then(Boolean));

  return db.transaction(async (trx) => {
    const [c] = await trx('customers')
      .insert({
        tenant_id: tenantId,
        full_name: String(full_name).trim(),
        phone: String(phone).trim(),
        national_id: national_id ? String(national_id).trim() : null,
        customer_code: code,
        qr_token: makeQrToken(),
        consent: Boolean(consent),
      })
      .returning('*');
    await insertChildren(trx, c.id, children);
    const kids = await trx('children').where({ customer_id: c.id }).orderBy('created_at', 'asc');
    return customerView(c, kids);
  });
}

export async function createCustomer(tenantId, data) {
  const existing = await db('customers').where({ tenant_id: tenantId, phone: String(data.phone).trim() }).first();
  if (existing) throw ApiError.conflict('A customer with this phone already exists', { customer_id: existing.id });
  return createCustomerTx({ tenantId, ...data });
}

/** Update guardian data + reconcile children (update by id, add new, remove missing). */
export async function updateCustomer(tenantId, id, data) {
  const c = await db('customers').where({ id, tenant_id: tenantId }).first();
  if (!c) throw ApiError.notFound('Customer not found');

  return db.transaction(async (trx) => {
    await trx('customers').where({ id }).update({
      full_name: data.full_name !== undefined ? String(data.full_name).trim() : c.full_name,
      phone: data.phone !== undefined ? String(data.phone).trim() : c.phone,
      national_id: data.national_id !== undefined ? (data.national_id ? String(data.national_id).trim() : null) : c.national_id,
      updated_at: trx.fn.now(),
    });

    if (Array.isArray(data.children)) {
      const incoming = data.children;
      const keepIds = incoming.filter((ch) => ch.id).map((ch) => ch.id);
      // remove children not present anymore
      await trx('children').where({ customer_id: id }).whereNotIn('id', keepIds.length ? keepIds : ['00000000-0000-0000-0000-000000000000']).del();
      // update existing / insert new
      for (const ch of incoming) {
        const payload = { name: String(ch.name || '').trim(), ...childFacts(ch) };
        if (!payload.name) continue; // eslint-disable-line no-continue
        if (ch.id) {
          // eslint-disable-next-line no-await-in-loop
          await trx('children').where({ id: ch.id, customer_id: id }).update(payload);
        } else {
          // eslint-disable-next-line no-await-in-loop
          await trx('children').insert({ customer_id: id, ...payload });
        }
      }
    }

    const fresh = await trx('customers').where({ id }).first();
    const kids = await trx('children').where({ customer_id: id }).orderBy('created_at', 'asc');
    return customerView(fresh, kids);
  });
}

/** Start-session scan/lookup: resolve by qr_token OR phone. */
export async function lookupCustomer(tenantId, { qr, phone }) {
  let c = null;
  if (qr) c = await db('customers').where({ tenant_id: tenantId, qr_token: qr }).first();
  if (!c && phone) c = await db('customers').where({ tenant_id: tenantId, phone: String(phone).trim() }).first();
  if (!c) throw ApiError.notFound('No customer matched');
  const children = await childrenOf(c.id);
  return customerView(c, children);
}

/**
 * Public registration (no auth). Duplicate phone => return the EXISTING customer
 * with already_registered:true (friendly, matches the returning-customer flow).
 */
export async function publicRegister(tenantId, data) {
  const phone = String(data.phone || '').trim();
  const existing = await db('customers').where({ tenant_id: tenantId, phone }).first();
  if (existing) {
    const kids = await childrenOf(existing.id);
    return { ...customerView(existing, kids), already_registered: true };
  }
  const created = await createCustomerTx({ tenantId, ...data, phone, consent: true });
  return { ...created, already_registered: false };
}

/** Public card page (/c/:qr_token) — minimal, no auth. */
export async function getPublicCard(qrToken) {
  const c = await db('customers').where({ qr_token: qrToken }).first();
  if (!c) throw ApiError.notFound('Card not found');
  const children = await childrenOf(c.id);
  return {
    full_name: c.full_name,
    customer_code: c.customer_code,
    qr_token: c.qr_token,
    card_url: cardUrl(c.qr_token),
    children: children.map((k) => ({
      id: k.id,
      name: k.name,
      gender: k.gender,
      age: k.age,
      birthdate: k.birthdate,
      has_allergy: Boolean(k.has_allergy),
      allergy_note: k.allergy_note,
    })),
  };
}
