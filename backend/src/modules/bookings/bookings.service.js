/**
 * Parties & workshops — the centre's 2nd and 3rd income sources.
 *
 * DOUBLE-BOOKING: the calendar is never trusted to be correct on its own. The
 * `bookings_no_overlap` EXCLUSION constraint in Postgres is the real guarantee —
 * if two mothers hit "confirm" on the same slot in the same millisecond, exactly
 * one commits and the other gets a clean 409. Availability listing is just a
 * courtesy so she rarely *sees* a taken slot.
 *
 * PAYMENT: bookings are reserve-now / pay-at-centre. `amount` is quoted and
 * frozen at booking time; `payment_status` starts `unpaid` and staff settle it.
 * `backend/src/payments/PaymentProvider.js` is where a gateway would hook in —
 * no domain change is needed to move to pay-online later.
 */
import { DateTime } from 'luxon';
import { db } from '../../config/db.js';
import { ApiError } from '../../utils/http.js';
import { makeQrToken } from '../../utils/codes.js';
import { ZONE } from '../../utils/time.js';
import { getSettings, hasTerms } from '../settings/settings.service.js';
import { emitToTenant } from '../../realtime/emitter.js';
import { scheduleBookingConfirmed } from '../../queue/scheduler.js';

export const BOOKING_TYPES = ['party', 'workshop'];

/** Postgres exclusion-constraint violation. */
const EXCLUSION_VIOLATION = '23P01';

function kindConfig(settings, type) {
  const cfg = settings.booking_config?.[type];
  if (!cfg) throw ApiError.badRequest('Unknown booking type', { type });
  return cfg;
}

/** "2026-08-14" + "15:00" (Riyadh) -> UTC Date. */
function slotStart(dateStr, hhmm) {
  const dt = DateTime.fromISO(`${dateStr}T${hhmm}`, { zone: ZONE });
  if (!dt.isValid) throw ApiError.badRequest('Invalid date or slot time', { date: dateStr, slot: hhmm });
  return dt.toUTC().toJSDate();
}

/**
 * Frozen price quote. Base + per-child + per-child catering.
 * Returned to the browser so she sees the total BEFORE confirming, and
 * recomputed server-side on create so a tampered client can't set its own price.
 */
export function quote(settings, { type, children_count, food }) {
  const cfg = kindConfig(settings, type);
  const foods = settings.booking_config?.foods || [];
  const chosenFood = foods.find((f) => f.key === food) || null;
  const n = Number(children_count) || 0;

  const base = Number(cfg.base_price) || 0;
  const perChild = (Number(cfg.price_per_child) || 0) * n;
  const catering = (Number(chosenFood?.price_per_child) || 0) * n;

  return {
    base,
    per_child_total: perChild,
    catering_total: catering,
    total: base + perChild + catering,
    currency: settings.currency,
  };
}

/**
 * Slots for one day with a taken/free flag.
 * Slots already inside the lead-time window are returned as unavailable too,
 * so nobody books a party that starts in ten minutes.
 */
export async function availability(tenantId, { type, date }) {
  const settings = await getSettings(tenantId);
  const cfg = kindConfig(settings, type);
  if (!cfg.enabled) return { type, date, slots: [], enabled: false, currency: settings.currency };

  const dayStart = DateTime.fromISO(date, { zone: ZONE }).startOf('day');
  if (!dayStart.isValid) throw ApiError.badRequest('Invalid date', { date });
  const dayEnd = dayStart.endOf('day');

  // Anything not cancelled holds its slot — including `pending`.
  const taken = await db('bookings')
    .where({ tenant_id: tenantId })
    .whereNot('status', 'cancelled')
    .andWhere('starts_at', '<', dayEnd.toUTC().toJSDate())
    .andWhere('ends_at', '>', dayStart.toUTC().toJSDate())
    .select('starts_at', 'ends_at');

  const leadMs = (Number(cfg.lead_hours) || 0) * 3600_000;
  const earliest = Date.now() + leadMs;

  const slots = (cfg.slots || []).map((hhmm) => {
    const start = slotStart(date, hhmm);
    const end = new Date(start.getTime() + (Number(cfg.duration_minutes) || 120) * 60_000);
    const overlaps = taken.some((b) =>
      start < new Date(b.ends_at) && end > new Date(b.starts_at));
    const tooSoon = start.getTime() < earliest;
    return {
      slot: hhmm,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      available: !overlaps && !tooSoon,
      reason: overlaps ? 'taken' : (tooSoon ? 'too_soon' : null),
    };
  });

  return {
    type,
    date,
    enabled: true,
    currency: settings.currency,
    duration_minutes: cfg.duration_minutes,
    min_children: cfg.min_children,
    max_children: cfg.max_children,
    slots,
  };
}

/** Public config the booking page needs (no auth, no secrets). */
export async function publicBookingConfig(tenantId) {
  const settings = await getSettings(tenantId);
  const bc = settings.booking_config || {};
  const strip = (cfg) => (cfg ? {
    enabled: cfg.enabled,
    base_price: Number(cfg.base_price) || 0,
    price_per_child: Number(cfg.price_per_child) || 0,
    min_children: cfg.min_children,
    max_children: cfg.max_children,
    duration_minutes: cfg.duration_minutes,
    lead_hours: cfg.lead_hours,
  } : null);
  return {
    center_name: settings.center_name,
    currency: settings.currency,
    terms_url: settings.terms_url,
    has_terms: hasTerms(settings),
    party: strip(bc.party),
    workshop: strip(bc.workshop),
    themes: bc.themes || [],
    foods: bc.foods || [],
  };
}

async function nextReference(tenantId, type) {
  const prefix = type === 'party' ? 'PT' : 'WS';
  for (let i = 0; i < 20; i += 1) {
    const candidate = `${prefix}-${String(Math.floor(1000 + Math.random() * 9000))}`;
    // eslint-disable-next-line no-await-in-loop
    const clash = await db('bookings').where({ tenant_id: tenantId, reference: candidate }).first();
    if (!clash) return candidate;
  }
  return `${prefix}-${Date.now().toString().slice(-6)}`;
}

/**
 * Queue the "your booking is confirmed" WhatsApp. Only a CONFIRMED booking gets
 * one: a public booking sits at `pending` (holding its slot) until staff accept
 * it, and that transition is what triggers this. Never throws — a messaging
 * problem must not fail the booking write that already committed.
 */
async function queueBookingConfirmed(bookingId, tenantId, tenantSlug) {
  try {
    await scheduleBookingConfirmed({ bookingId, tenantId, tenantSlug });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[bookings] confirmation scheduling failed:', err?.message);
  }
}

export function bookingView(b) {
  return {
    id: b.id,
    reference: b.reference,
    public_token: b.public_token,
    type: b.type,
    guardian_name: b.guardian_name,
    phone: b.phone,
    starts_at: b.starts_at,
    ends_at: b.ends_at,
    children_count: b.children_count,
    theme: b.theme,
    food: b.food,
    notes: b.notes,
    amount: Number(b.amount),
    paid_amount: Number(b.paid_amount),
    status: b.status,
    payment_status: b.payment_status,
    created_at: b.created_at,
  };
}

/**
 * Create a booking. `source` is 'public' (mother booked it herself) or 'staff'.
 * Slot integrity is enforced by the DB, not by the availability check above.
 */
export async function createBooking(tenantId, tenantSlug, data, { userId = null } = {}) {
  const settings = await getSettings(tenantId);
  const cfg = kindConfig(settings, data.type);
  if (!cfg.enabled) throw ApiError.badRequest('This booking type is not currently offered', { type: data.type });

  const n = Number(data.children_count);
  if (n < cfg.min_children || n > cfg.max_children) {
    throw ApiError.badRequest('Children count is outside the allowed range', {
      min: cfg.min_children, max: cfg.max_children,
    });
  }

  if (!(cfg.slots || []).includes(data.slot)) {
    throw ApiError.badRequest('That start time is not an offered slot', { slot: data.slot });
  }

  const starts = slotStart(data.date, data.slot);
  const ends = new Date(starts.getTime() + (Number(cfg.duration_minutes) || 120) * 60_000);

  // Staff may back-fill; the public form may not book inside the lead window.
  if (!userId) {
    const leadMs = (Number(cfg.lead_hours) || 0) * 3600_000;
    if (starts.getTime() < Date.now() + leadMs) {
      throw ApiError.badRequest('That slot is too close to now to be booked online', {
        lead_hours: cfg.lead_hours,
      });
    }
  }

  const priced = quote(settings, { type: data.type, children_count: n, food: data.food });
  const phone = String(data.phone).trim();

  // Link to an existing customer record when the phone already belongs to one.
  const customer = await db('customers').where({ tenant_id: tenantId, phone }).first();
  const reference = await nextReference(tenantId, data.type);

  let row;
  try {
    [row] = await db('bookings').insert({
      tenant_id: tenantId,
      type: data.type,
      reference,
      public_token: makeQrToken(),
      customer_id: customer?.id || null,
      guardian_name: String(data.guardian_name).trim(),
      phone,
      starts_at: starts,
      ends_at: ends,
      children_count: n,
      theme: data.theme || null,
      food: data.food || null,
      notes: data.notes || null,
      amount: priced.total,
      status: userId ? 'confirmed' : 'pending',
      created_by: userId,
    }).returning('*');
  } catch (err) {
    if (err.code === EXCLUSION_VIOLATION) {
      throw ApiError.conflict('That slot has just been taken — please pick another time', {
        date: data.date, slot: data.slot,
      });
    }
    throw err;
  }

  const view = bookingView(row);
  emitToTenant(tenantSlug, 'booking:created', { booking: view });
  // Staff-created bookings are confirmed on the spot, so she hears about it now.
  if (row.status === 'confirmed') await queueBookingConfirmed(row.id, tenantId, tenantSlug);
  return view;
}

export async function listBookings(tenantId, { from, to, status, type } = {}) {
  const q = db('bookings').where({ tenant_id: tenantId }).orderBy('starts_at', 'asc').limit(500);
  if (from) q.andWhere('starts_at', '>=', from);
  if (to) q.andWhere('starts_at', '<=', to);
  if (status) q.andWhere('status', status);
  if (type) q.andWhere('type', type);
  return (await q).map(bookingView);
}

export async function getBooking(tenantId, id) {
  const row = await db('bookings').where({ id, tenant_id: tenantId }).first();
  if (!row) throw ApiError.notFound('Booking not found');
  return bookingView(row);
}

/** Public confirmation page — looked up by opaque token, no auth. */
export async function getPublicBooking(token) {
  const row = await db('bookings').where({ public_token: token }).first();
  if (!row) throw ApiError.notFound('Booking not found');
  const settings = await getSettings(row.tenant_id);
  const themes = settings.booking_config?.themes || [];
  const foods = settings.booking_config?.foods || [];
  return {
    ...bookingView(row),
    center_name: settings.center_name,
    currency: settings.currency,
    theme_label: themes.find((t) => t.key === row.theme) || null,
    food_label: foods.find((f) => f.key === row.food) || null,
  };
}

/** Staff-side status / payment updates. Cancelling frees the slot. */
export async function updateBooking(tenantId, tenantSlug, id, patch) {
  const row = await db('bookings').where({ id, tenant_id: tenantId }).first();
  if (!row) throw ApiError.notFound('Booking not found');

  const update = { updated_at: db.fn.now() };
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.payment_status !== undefined) update.payment_status = patch.payment_status;
  if (patch.paid_amount !== undefined) update.paid_amount = patch.paid_amount;
  if (patch.notes !== undefined) update.notes = patch.notes;
  if (patch.theme !== undefined) update.theme = patch.theme;
  if (patch.food !== undefined) update.food = patch.food;

  // Re-confirming a cancelled booking can collide with whoever took the slot.
  try {
    await db('bookings').where({ id }).update(update);
  } catch (err) {
    if (err.code === EXCLUSION_VIOLATION) {
      throw ApiError.conflict('That slot was taken while this booking was cancelled');
    }
    throw err;
  }

  const fresh = await db('bookings').where({ id }).first();
  const view = bookingView(fresh);
  emitToTenant(tenantSlug, 'booking:updated', { booking: view });

  // Gate on the TRANSITION, not the current value: editing the notes of an
  // already-confirmed booking must not re-announce it. (The notification row is
  // a second guard, so even a replayed job sends nothing twice.)
  if (row.status !== 'confirmed' && fresh.status === 'confirmed') {
    await queueBookingConfirmed(id, tenantId, tenantSlug);
  }
  return view;
}
