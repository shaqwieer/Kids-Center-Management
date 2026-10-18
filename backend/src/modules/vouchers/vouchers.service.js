/**
 * Gift vouchers — sold or given by the manager, redeemed once at reception.
 *
 * Each voucher has two identifiers: an opaque `token` that the QR encodes as
 * …/v/<token> (also the public gift-card page), and a short `code` printed
 * under it for typing (or for a hand scanner that reads the text). Either one
 * finds the voucher.
 */
import { customAlphabet } from 'nanoid';
import { db } from '../../config/db.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/http.js';
import { makeQrToken } from '../../utils/codes.js';
import { priceForDuration } from '../../lib/timing.js';
import { ZONE } from '../../utils/time.js';
import { getSettings } from '../settings/settings.service.js';

// No 0/O, 1/I/L — the code is read aloud and typed by hand.
const codeChars = customAlphabet('23456789ABCDEFGHJKMNPQRSTUVWXYZ', 6);
const makeCode = () => `GV-${codeChars()}`;

/** Today's calendar date in Riyadh, as yyyy-mm-dd (what `expires_on` compares to). */
function riyadhToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONE }).format(new Date());
}

function isoDate(d) {
  if (!d) return null;
  if (typeof d === 'string') return d.slice(0, 10);
  // pg returns DATE as a local-midnight Date; format it back without a zone shift.
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** active | redeemed | void | expired — expiry is derived, never stored. */
function stateOf(row) {
  if (row.status !== 'active') return row.status;
  const exp = isoDate(row.expires_on);
  if (exp && exp < riyadhToday()) return 'expired';
  return 'active';
}

export function voucherUrl(token) {
  return `${env.appBaseUrl.replace(/\/$/, '')}/v/${token}`;
}

function toDTO(row, durations) {
  return {
    id: row.id,
    code: row.code,
    token: row.token,
    url: voucherUrl(row.token),
    duration_minutes: row.duration_minutes,
    // What it is worth today at the reception price list.
    value: priceForDuration(durations, row.duration_minutes),
    sold_price: Number(row.sold_price),
    recipient_name: row.recipient_name,
    buyer_name: row.buyer_name,
    buyer_phone: row.buyer_phone,
    note: row.note,
    expires_on: isoDate(row.expires_on),
    status: row.status,
    state: stateOf(row),
    created_at: row.created_at,
    redeemed_at: row.redeemed_at,
    redeemed_session_id: row.redeemed_session_id,
    redeemed_child_name: row.redeemed_child_name || null,
    redeemed_customer_name: row.redeemed_customer_name || null,
    voided_at: row.voided_at,
  };
}

function baseQuery() {
  return db('vouchers as v')
    .leftJoin('sessions as s', 's.id', 'v.redeemed_session_id')
    .leftJoin('children as ch', 'ch.id', 's.child_id')
    .leftJoin('customers as c', 'c.id', 's.customer_id')
    .select('v.*', 'ch.name as redeemed_child_name', 'c.full_name as redeemed_customer_name');
}

/**
 * Accepts whatever reception has: the short code (any case, with or without the
 * dash), the bare token, or the full …/v/<token> URL the QR carries.
 */
export function parseVoucherInput(input) {
  const s = String(input || '').trim();
  const inUrl = s.match(/\/v\/([A-Za-z0-9_-]{8,})/);
  if (inUrl) return { token: inUrl[1] };
  const compact = s.toUpperCase().replace(/[\s-]/g, '');
  const code = compact.match(/^(?:GV)?([23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6})$/);
  if (code) return { code: `GV-${code[1]}` };
  if (/^[A-Za-z0-9_-]{16,}$/.test(s)) return { token: s };
  return null;
}

export async function listVouchers(tenantId, { state } = {}) {
  const settings = await getSettings(tenantId);
  const rows = await baseQuery()
    .where('v.tenant_id', tenantId)
    .orderBy('v.created_at', 'desc')
    .limit(500);
  const list = rows.map((r) => toDTO(r, settings.durations));
  return state ? list.filter((v) => v.state === state) : list;
}

export async function createVouchers(tenantId, userId, body) {
  const settings = await getSettings(tenantId);
  const allowed = (settings.durations || []).some((d) => Number(d.min) === Number(body.duration_minutes));
  if (!allowed) throw ApiError.badRequest('Duration is not allowed by settings', { durationMinutes: body.duration_minutes });
  if (body.expires_on && body.expires_on < riyadhToday()) {
    throw ApiError.badRequest('Expiry date is in the past');
  }

  const quantity = body.quantity || 1;
  const ids = [];
  await db.transaction(async (trx) => {
    for (let i = 0; i < quantity; i += 1) {
      // A 6-char code from 31 symbols is ~887M combinations; retry the rare clash.
      for (let attempt = 0; ; attempt += 1) {
        const code = makeCode();
        // eslint-disable-next-line no-await-in-loop
        const clash = await trx('vouchers').where({ tenant_id: tenantId, code }).first('id');
        if (clash && attempt < 10) continue; // eslint-disable-line no-continue
        // eslint-disable-next-line no-await-in-loop
        const [row] = await trx('vouchers').insert({
          tenant_id: tenantId,
          code,
          token: makeQrToken(),
          duration_minutes: body.duration_minutes,
          sold_price: body.sold_price || 0,
          recipient_name: body.recipient_name || null,
          buyer_name: body.buyer_name || null,
          buyer_phone: body.buyer_phone || null,
          note: body.note || null,
          expires_on: body.expires_on || null,
          created_by: userId,
        }).returning('id');
        ids.push(row.id);
        break;
      }
    }
  });
  const rows = await baseQuery().whereIn('v.id', ids).orderBy('v.code');
  return rows.map((r) => toDTO(r, settings.durations));
}

/** Cancel an unused voucher (refunded, lost, issued by mistake). */
export async function voidVoucher(tenantId, id) {
  const affected = await db('vouchers')
    .where({ id, tenant_id: tenantId, status: 'active' })
    .update({ status: 'void', voided_at: db.fn.now() });
  if (!affected) {
    const exists = await db('vouchers').where({ id, tenant_id: tenantId }).first('id');
    if (!exists) throw ApiError.notFound('Voucher not found');
    throw ApiError.conflict('Only an unused voucher can be cancelled', { code: 'not_active' });
  }
  const settings = await getSettings(tenantId);
  return toDTO(await baseQuery().where('v.id', id).first(), settings.durations);
}

async function findRow(tenantId, input, q = db) {
  const parsed = parseVoucherInput(input);
  if (!parsed) return null;
  const where = parsed.token ? { 'v.token': parsed.token } : { 'v.code': parsed.code };
  const query = q === db ? baseQuery() : q('vouchers as v').select('v.*');
  return query.where('v.tenant_id', tenantId).andWhere(where).first();
}

/** Reception checks a scanned/typed voucher before applying it. */
export async function lookupVoucher(tenantId, input) {
  const row = await findRow(tenantId, input);
  if (!row) throw ApiError.notFound('Voucher not found');
  const settings = await getSettings(tenantId);
  return toDTO(row, settings.durations);
}

/**
 * Claim a voucher inside the caller's transaction. The conditional UPDATE is
 * the lock: two tablets scanning the same voucher at once — only one wins.
 * Returns the claimed row; throws a 409 with a reason code otherwise.
 */
export async function claimVoucher(trx, { tenantId, userId, input }) {
  const row = await findRow(tenantId, input, trx);
  if (!row) throw ApiError.notFound('Voucher not found');
  const state = stateOf(row);
  if (state !== 'active') throw ApiError.conflict(`Voucher is ${state}`, { code: `voucher_${state}` });

  const affected = await trx('vouchers')
    .where({ id: row.id, status: 'active' })
    .update({ status: 'redeemed', redeemed_at: trx.fn.now(), redeemed_by: userId });
  if (!affected) throw ApiError.conflict('Voucher is redeemed', { code: 'voucher_redeemed' });
  return row;
}

/** The public gift card behind the QR — no auth, the token is the credential. */
export async function getPublicVoucher(token) {
  const row = await db('vouchers').where({ token }).first();
  if (!row) throw ApiError.notFound('Voucher not found');
  const settings = await getSettings(row.tenant_id);
  return {
    token: row.token,
    code: row.code,
    url: voucherUrl(row.token),
    center_name: settings.center_name,
    primary_color: settings.primary_color,
    duration_minutes: row.duration_minutes,
    recipient_name: row.recipient_name,
    note: row.note,
    expires_on: isoDate(row.expires_on),
    state: stateOf(row),
  };
}
