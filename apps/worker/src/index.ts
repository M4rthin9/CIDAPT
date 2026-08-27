import { Worker, Queue, QueueScheduler } from 'bullmq';
import IORedis from 'ioredis';
import { pino } from 'pino';

const log = pino({ name: 'worker', level: process.env.LOG_LEVEL ?? 'info' });

const REDIS_URL = process.env.VALKEY_URL ?? 'redis://:changeme@localhost:6379';

const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
});

// Queue definitions
export const reconciliationQueue = new Queue('reconciliation', { connection });
export const notifyQueue = new Queue('notify', { connection });
export const enquiryQueue = new Queue('enquiry', { connection });

// Graceful shutdown
let isShuttingDown = false;

async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  log.info({ signal }, 'Received shutdown signal — draining');

  await Promise.allSettled([
    reconciliationQueue.close(),
    notifyQueue.close(),
    enquiryQueue.close(),
  ]);

  await connection.quit();
  log.info('Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Job processors
import './jobs/reconciliation';
import './jobs/notify';
import './jobs/enquiry';

log.info('Worker starting');
