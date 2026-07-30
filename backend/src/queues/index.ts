import { Queue } from 'bullmq';
import { queueConnection, QUEUES } from './connection';

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5000 },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 5000 },
};

export const exportQueue = new Queue(QUEUES.EXPORT, { connection: queueConnection, defaultJobOptions });
export const notificationQueue = new Queue(QUEUES.NOTIFICATION, { connection: queueConnection, defaultJobOptions });
export const maintenanceQueue = new Queue(QUEUES.MAINTENANCE, { connection: queueConnection, defaultJobOptions });

export async function scheduleRepeatableJobs(): Promise<void> {
  await maintenanceQueue.add('followup-sweep', {}, { repeat: { pattern: '0 * * * *' }, jobId: 'followup-sweep' });
}
