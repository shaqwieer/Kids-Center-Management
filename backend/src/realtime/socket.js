/**
 * Socket.IO server: authenticates staff via JWT, joins them to their tenant
 * room, re-emits domain events published on Redis (so a separate worker can
 * update dashboards), and broadcasts a periodic `tick` for drift correction.
 */
import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { db } from '../config/db.js';
import { createRedisConnection } from '../config/redis.js';
import { verifyToken } from '../modules/auth/auth.service.js';
import { SOCKET_CHANNEL, roomForTenant } from './emitter.js';

let io = null;

const allowedOrigins = env.frontendUrl.split(',').map((s) => s.trim());

export function getIo() { return io; }

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: allowedOrigins, credentials: true },
  });

  // JWT handshake auth
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('unauthorized'));
    try {
      const claims = verifyToken(token);
      socket.data.user = claims;
      socket.data.tenantSlug = claims.tenantSlug;
      return next();
    } catch {
      return next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const room = roomForTenant(socket.data.tenantSlug);
    socket.join(room);
    socket.emit('connected', { room, user: { id: socket.data.user.sub, name: socket.data.user.name } });
  });

  // Bridge: re-emit events published by the domain/worker (possibly another process).
  const sub = createRedisConnection();
  sub.subscribe(SOCKET_CHANNEL).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[socket] subscribe failed:', err.message);
  });
  sub.on('message', (channel, message) => {
    if (channel !== SOCKET_CHANNEL) return;
    try {
      const { room: r, event, payload } = JSON.parse(message);
      io.to(r).emit(event, payload);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[socket] bad bridge message:', err.message);
    }
  });

  startTick();
  // eslint-disable-next-line no-console
  console.log('[socket] Socket.IO ready');
  return io;
}

let tickTimer = null;
function startTick() {
  clearInterval(tickTimer);
  tickTimer = setInterval(async () => {
    try {
      const rows = await db('sessions as s')
        .join('tenants as t', 't.id', 's.tenant_id')
        .whereIn('s.status', ['active', 'warned', 'overtime'])
        .select('t.slug as slug', 's.id', 's.ends_at', 's.status');
      if (!rows.length) return;
      const byTenant = {};
      for (const r of rows) {
        (byTenant[r.slug] ||= []).push({
          id: r.id,
          ends_at: r.ends_at instanceof Date ? r.ends_at.toISOString() : r.ends_at,
          status: r.status,
        });
      }
      const now = new Date().toISOString();
      for (const [slug, sessions] of Object.entries(byTenant)) {
        io.to(roomForTenant(slug)).emit('tick', { now, sessions });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[socket] tick error:', err.message);
    }
  }, 10_000);
  if (tickTimer.unref) tickTimer.unref();
}
