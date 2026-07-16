/**
 * ioredis connection factory. BullMQ requires `maxRetriesPerRequest: null`
 * on its connections, so we create dedicated connections for the queue/worker.
 */
import IORedis from 'ioredis';
import { env } from './env.js';

export function createRedisConnection(opts = {}) {
  const base = { maxRetriesPerRequest: null, enableReadyCheck: false, ...opts };
  if (env.redis.url) return new IORedis(env.redis.url, base);
  return new IORedis({ host: env.redis.host, port: env.redis.port, ...base });
}

// A general-purpose shared connection (not for BullMQ blocking ops).
export const redis = createRedisConnection();

export async function pingRedis() {
  const conn = createRedisConnection();
  try {
    await conn.ping();
  } finally {
    conn.disconnect();
  }
}

export default redis;
