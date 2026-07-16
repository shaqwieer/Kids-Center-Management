/** Notification log: one row per (session, type); retries update the same row. */
import { db } from '../../config/db.js';

export async function ensureNotification(sessionId, type) {
  await db('notifications')
    .insert({ session_id: sessionId, type, channel: 'whatsapp', status: 'queued' })
    .onConflict(['session_id', 'type'])
    .ignore();
}

export async function markSent(sessionId, type, providerMessageId) {
  await db('notifications')
    .where({ session_id: sessionId, type })
    .update({ status: 'sent', provider_message_id: providerMessageId || null, sent_at: db.fn.now(), error: null });
}

export async function markFailed(sessionId, type, error) {
  await db('notifications')
    .where({ session_id: sessionId, type })
    .update({ status: 'failed', error: String(error || 'unknown error').slice(0, 1000) });
}

export async function listBySession(sessionId) {
  return db('notifications').where({ session_id: sessionId }).orderBy('created_at', 'asc');
}
