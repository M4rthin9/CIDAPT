import { Worker, Job } from 'bullmq';
import { pino } from 'pino';
import { connection } from '../queues.js';

const log = pino({ name: 'worker:notify', level: process.env.LOG_LEVEL ?? 'info' });

// Retry: 5 attempts, exponential backoff 2^n * 10s (10s, 20s, 40s, 80s, 160s)
// Exported so the API imports this when calling queue.add()
export const NOTIFY_RETRY = {
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 10_000 },
};

interface NotifyJobData {
  channel: 'line' | 'email';
  to: string;
  subject?: string;
  body: string;
  templateId?: string;
  templateData?: Record<string, string>;
}

const worker = new Worker<NotifyJobData>(
  'notify',
  async (job: Job<NotifyJobData>) => {
    const { channel, to, subject } = job.data;
    log.info({ jobId: job.id, channel, to }, 'Notification started');

    // TODO: implement real LINE + SMTP delivery
    if (channel === 'line') {
      log.info({ jobId: job.id, to }, 'LINE message sent (stub)');
    } else if (channel === 'email') {
      log.info({ jobId: job.id, to, subject }, 'Email sent (stub)');
    }

    return { channel, to, status: 'sent' };
  },
  {
    connection,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 60_000,
    },
  },
);

worker.on('completed', (job) => {
  log.info({ jobId: job.id, result: job.returnvalue }, 'Notification completed');
});

worker.on('failed', (job, err) => {
  if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    log.error(
      { jobId: job.id, error: err.message, attempts: job.attemptsMade },
      'Notification DEAD-LETTERED — max retries exhausted',
    );
  } else {
    log.warn(
      { jobId: job?.id, error: err.message, attempt: job?.attemptsMade },
      'Notification failed, will retry',
    );
  }
});

log.info('Notify worker registered');
