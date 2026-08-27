import { Worker, Job } from 'bullmq';
import { pino } from 'pino';
import { connection, reconciliationQueue } from '../queues';

const log = pino({ name: 'worker:reconciliation', level: process.env.LOG_LEVEL ?? 'info' });

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
  log.error({ jobId: job?.id, error: err.message }, 'Reconciliation job failed');
});

reconciliationQueue.add(
  'poll',
  { provider: 'fake' },
  {
    repeat: {
      every: 5 * 60 * 1000,
    },
    removeOnComplete: 10,
    removeOnFail: 20,
  },
);

log.info('Reconciliation worker registered');
