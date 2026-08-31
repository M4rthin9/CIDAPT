import { Worker, Job } from 'bullmq';
import { pino } from 'pino';
import { connection } from '../queues.js';

const log = pino({ name: 'worker:enquiry', level: process.env.LOG_LEVEL ?? 'info' });

// Retry: 3 attempts, exponential backoff 2^n * 5s
// Exported so the API imports this when calling queue.add()
export const ENQUIRY_RETRY = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5000 },
};

interface EnquiryJobData {
  enquiryId: string;
  productId: string;
  contactName: string;
  phone: string;
  ribbonText: string;
  venue: string;
}

const worker = new Worker<EnquiryJobData>(
  'enquiry',
  async (job: Job<EnquiryJobData>) => {
    const { enquiryId, contactName, phone } = job.data;
    log.info({ jobId: job.id, enquiryId }, 'Enquiry notification started');

    // TODO: implement real notification
    log.info({ jobId: job.id, enquiryId, contactName, phone }, 'Enquiry notification sent (stub)');

    return { enquiryId, status: 'notified' };
  },
  {
    connection,
    concurrency: 2,
  },
);

worker.on('completed', (job) => {
  log.info({ jobId: job.id, result: job.returnvalue }, 'Enquiry notification completed');
});

worker.on('failed', (job, err) => {
  if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    log.error(
      { jobId: job.id, error: err.message, attempts: job.attemptsMade },
      'Enquiry notification DEAD-LETTERED — max retries exhausted',
    );
  } else {
    log.warn(
      { jobId: job?.id, error: err.message, attempt: job?.attemptsMade },
      'Enquiry notification failed, will retry',
    );
  }
});

log.info('Enquiry worker registered');
