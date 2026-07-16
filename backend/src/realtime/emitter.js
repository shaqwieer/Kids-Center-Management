/**
 * Lightweight event emitter used by the domain + the BullMQ worker.
 *
 * It does NOT depend on the Socket.IO server: it publishes events to a Redis
 * channel. The API process (which owns `io`) subscribes and re-emits to the
 * right tenant room. This means the worker can run in-process OR as a separate
 * container and dashboards still update live.
 */
import { redis } from '../config/redis.js';

export const SOCKET_CHANNEL = 'farfasha:socket';

export function roomForTenant(slug) {
  return `tenant:${slug}`;
}

export function emitToTenant(tenantSlug, event, payload) {
  const message = JSON.stringify({ room: roomForTenant(tenantSlug), event, payload });
  // Fire-and-forget; publishing must never break a domain operation.
  redis.publish(SOCKET_CHANNEL, message).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[emitter] publish failed:', err.message);
  });
}
