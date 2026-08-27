import IORedis from 'ioredis';
import { Queue } from 'bullmq';

const REDIS_URL = process.env.VALKEY_URL ?? 'redis://:changeme@localhost:6379';

export const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
});

export const reconciliationQueue = new Queue('reconciliation', { connection });
export const notifyQueue = new Queue('notify', { connection });
export const enquiryQueue = new Queue('enquiry', { connection });
