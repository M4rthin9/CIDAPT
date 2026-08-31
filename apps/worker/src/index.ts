import { pino } from 'pino';
import { connection, reconciliationQueue, notifyQueue, enquiryQueue } from './queues.js';

const log = pino({ name: 'worker', level: process.env.LOG_LEVEL ?? 'info' });

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
import './jobs/reconciliation.js';
import './jobs/notify.js';
import './jobs/enquiry.js';

log.info('Worker starting');
