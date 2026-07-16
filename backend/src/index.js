/** Server entry: HTTP + Socket.IO (+ inline BullMQ worker by default). */
import http from 'node:http';
import { env } from './config/env.js';
import { createApp } from './app.js';
import { initSocket } from './realtime/socket.js';
import { startWorker } from './queue/worker.js';
import { pingDb } from './config/db.js';
import { pingRedis } from './config/redis.js';

async function waitForDeps(retries = 30, delayMs = 2000) {
  for (let i = 0; i < retries; i += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await Promise.all([pingDb(), pingRedis()]);
      return;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(`[boot] waiting for DB/Redis (${i + 1}/${retries})… ${err.message}`);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => { setTimeout(r, delayMs); });
    }
  }
  throw new Error('Dependencies (Postgres/Redis) not reachable');
}

async function main() {
  await waitForDeps();

  const app = createApp();
  const server = http.createServer(app);
  initSocket(server);

  const runWorker = process.env.WORKER_INLINE !== 'false';
  if (runWorker) startWorker();

  server.listen(env.apiPort, () => {
    // eslint-disable-next-line no-console
    console.log(`\n🎈 Farfasha API listening on :${env.apiPort} (TZ=${env.tz}, WhatsApp=${env.whatsapp.enabled ? env.whatsapp.provider : 'log/disabled'}, worker=${runWorker ? 'inline' : 'external'})`);
  });

  const shutdown = () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000); };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[boot] fatal:', err);
  process.exit(1);
});
