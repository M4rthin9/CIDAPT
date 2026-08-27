import { Worker, Job } from 'bullmq';
import { pino } from 'pino';
import { connection } from '../queues';

const log = pino({ name: 'worker:notify', level: process.env.LOG_LEVEL ?? 'info' });

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

    // TODO: implement real LINE + SMTP delivery in P7+
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
  log.error({ jobId: job?.id, error: err.message }, 'Notification failed');
});

log.info('Notify worker registered');
