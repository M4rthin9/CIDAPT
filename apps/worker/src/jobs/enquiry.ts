import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { pino } from 'pino';

const log = pino({ name: 'worker:enquiry', level: process.env.LOG_LEVEL ?? 'info' });

const REDIS_URL = process.env.VALKEY_URL ?? 'redis://:changeme@localhost:6379';
const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
});

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
    const { enquiryId, contactName, phone, ribbonText, venue } = job.data;
    log.info({ jobId: job.id, enquiryId }, 'Enquiry notification started');

    // TODO: implement real notification in P7+
    // Notify staff via LINE + email that a new enquiry has been submitted
    // Include: contactName, phone, ribbonText, venue

    log.info(
      { jobId: job.id, enquiryId, contactName, phone },
      'Enquiry notification sent (stub)',
    );

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
  log.error({ jobId: job?.id, error: err.message }, 'Enquiry notification failed');
});

log.info('Enquiry worker registered');
