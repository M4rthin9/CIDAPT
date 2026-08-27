import { Worker, Job } from 'bullmq';
import { pino } from 'pino';
import { connection } from '../queues';

const log = pino({ name: 'worker:enquiry', level: process.env.LOG_LEVEL ?? 'info' });

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

    // TODO: implement real notification in P7+
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
  log.error({ jobId: job?.id, error: err.message }, 'Enquiry notification failed');
});

log.info('Enquiry worker registered');
