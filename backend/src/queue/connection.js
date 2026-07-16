/** BullMQ queue + shared connections for the session-timing jobs. */
import { Queue } from 'bullmq';
import { createRedisConnection } from '../config/redis.js';

export const SESSION_QUEUE = 'session-jobs';

// A dedicated connection for the producer side (enqueue/remove).
export const queueConnection = createRedisConnection();

export const sessionQueue = new Queue(SESSION_QUEUE, { connection: queueConnection });

export const DEFAULT_JOB_OPTS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: true, // successful jobs don't accumulate in Redis
  removeOnFail: false, // keep failures for inspection / manual retry
};
