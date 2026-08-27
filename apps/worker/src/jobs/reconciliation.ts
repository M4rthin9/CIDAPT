import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { pino } from 'pino';

const log = pino({ name: 'worker:reconciliation', level: process.env.LOG_LEVEL ?? 'info' });

const REDIS_URL = process.env.VALKEY_URL ?? 'redis://:changeme@localhost:6379';
const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
});

interface ReconciliationJobData {
  provider: string;
  since?: number;
}

const worker = new Worker<ReconciliationJobData>(
  'reconciliation',
  async (job: Job<ReconciliationJobData>) => {
    const { provider, since } = job.data;
    log.info({ jobId: job.id, provider, since }, 'Reconciliation poll started');

    // TODO: implement real provider polling in P7+
    // For now, this is a stub that logs and completes
    // Real implementation will call ReconciliationProvider.poll() and ingest new events

    log.info({ jobId: job.id }, 'Reconciliation poll completed (stub)');
    return { processed: 0 };
  },
  {
    connection,
    concurrency: 1,
    limiter: {
      max: 1,
      duration: 60_000, // max 1 job per minute
    },
  },
);

worker.on('completed', (job) => {
  log.info({ jobId: job.id, result: job.returnvalue }, 'Reconciliation job completed');
});

worker.on('failed', (job, err) => {
  log.error({ jobId: job?.id, error: err.message }, 'Reconciliation job failed');
});

// Repeatable schedule: every 5 minutes
import { reconciliationQueue } from '../index';

reconciliationQueue.add(
  'poll',
  { provider: 'fake' },
  {
    repeat: {
      every: 5 * 60 * 1000, // 5 minutes
    },
    removeOnComplete: 10,
    removeOnFail: 20,
  },
);

log.info('Reconciliation worker registered');
