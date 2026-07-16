/** Standalone worker process entry (`npm run worker`) for scaling separately. */
import '../config/env.js';
import { startWorker } from './worker.js';

startWorker();

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
