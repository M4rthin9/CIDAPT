import { Worker, Job } from 'bullmq';
import { pino } from 'pino';
import { connection, reconciliationQueue } from '../queues.js';

const log = pino({ name: 'worker:reconciliation', level: process.env.LOG_LEVEL ?? 'info' });

// Retry: 3 attempts, exponential backoff 2^n * 5s (5s, 10s, 20s)
// Exported so the API imports this when calling queue.add()
export const RECONCILIATION_RETRY = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5000 },
};

interface ReconciliationJobData {
  provider: string;
  since?: number;
}

const worker = new Worker<ReconciliationJobData>(
  'reconciliation',
  async (job: Job<ReconciliationJobData>) => {
    const { provider, since } = job.data;
    log.info({ jobId: job.id, provider, since }, 'Reconciliation poll started');

    // TODO: implement real provider polling
    log.info({ jobId: job.id }, 'Reconciliation poll completed (stub)');
    return { processed: 0 };
  },
  {
    connection,
    concurrency: 1,
    limiter: {
      max: 1,
      duration: 60_000,
    },
  },
);

worker.on('completed', (job) => {
  log.info({ jobId: job.id, result: job.returnvalue }, 'Reconciliation job completed');
});

worker.on('failed', (job, err) => {
  if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    log.error(
      { jobId: job.id, error: err.message, attempts: job.attemptsMade },
      'Reconciliation job DEAD-LETTERED — max retries exhausted',
    );
  } else {
    log.warn(
      { jobId: job?.id, error: err.message, attempt: job?.attemptsMade },
      'Reconciliation job failed, will retry',
    );
  }
});

reconciliationQueue.add(
  'poll',
  { provider: 'fake' },
  {
    repeat: { every: 5 * 60 * 1000 },
    ...RECONCILIATION_RETRY,
    removeOnComplete: 10,
    removeOnFail: 20,
  },
);

log.info('Reconciliation worker registered');
