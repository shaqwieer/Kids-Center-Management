/**
 * Notification log. Every row hangs off exactly ONE anchor:
 *
 *   session  -> warn_5 / time_up / review   (a child is playing)
 *   customer -> welcome                     (registration; no session exists yet)
 *   booking  -> booking_confirmed           (a party/workshop, not a visit)
 *
 * Retries update the same row. The unique constraint per (anchor, type) is what
 * makes "send exactly once" true even when a job is replayed — BullMQ drops
 * completed jobs, so the database is the only durable memory of what was sent.
 */
import { db } from '../../config/db.js';

/** @returns {{column: string, where: object}} */
function anchor({ sessionId = null, customerId = null, bookingId = null } = {}) {
  if (sessionId) return { column: 'session_id', where: { session_id: sessionId } };
  if (customerId) return { column: 'customer_id', where: { customer_id: customerId } };
  if (bookingId) return { column: 'booking_id', where: { booking_id: bookingId } };
  throw new Error('a notification needs a sessionId, customerId or bookingId');
}

export async function ensureNotification(target, type) {
  const { column, where } = anchor(target);
  await db('notifications')
    .insert({ ...where, type, channel: 'whatsapp', status: 'queued' })
    .onConflict([column, 'type'])
    .ignore();
}

export async function markSent(target, type, providerMessageId) {
  const { where } = anchor(target);
  await db('notifications')
    .where({ ...where, type })
    .update({ status: 'sent', provider_message_id: providerMessageId || null, sent_at: db.fn.now(), error: null });
}

export async function markFailed(target, type, error) {
  const { where } = anchor(target);
  await db('notifications')
    .where({ ...where, type })
    .update({ status: 'failed', error: String(error || 'unknown error').slice(0, 1000) });
}

/** Has this exact message already gone out? Guards a replayed job before it sends. */
export async function alreadySent(target, type) {
  const { where } = anchor(target);
  const row = await db('notifications').where({ ...where, type }).first();
  return Boolean(row && row.status === 'sent');
}

export async function listBySession(sessionId) {
  return db('notifications').where({ session_id: sessionId }).orderBy('created_at', 'asc');
}

export async function listByCustomer(customerId) {
  return db('notifications').where({ customer_id: customerId }).orderBy('created_at', 'asc');
}

export async function listByBooking(bookingId) {
  return db('notifications').where({ booking_id: bookingId }).orderBy('created_at', 'asc');
}
