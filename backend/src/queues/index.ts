import { Queue } from 'bullmq';
import { queueConnection, QUEUES } from './connection';

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5000 },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 5000 },
};

// NOTE: lead sync no longer uses BullMQ/Redis — it runs in-process via
// src/jobs/sync.scheduler.ts (started by the API server). These queues remain
// for export/notification/maintenance, which still use the worker + Redis.
export const exportQueue = new Queue(QUEUES.EXPORT, { connection: queueConnection, defaultJobOptions });
export const notificationQueue = new Queue(QUEUES.NOTIFICATION, { connection: queueConnection, defaultJobOptions });
export const maintenanceQueue = new Queue(QUEUES.MAINTENANCE, { connection: queueConnection, defaultJobOptions });

// Schedules repeatable jobs (cron). Idempotent: BullMQ de-dupes by jobId.
export async function scheduleRepeatableJobs(): Promise<void> {
  // Sweep overdue follow-ups hourly.
  await maintenanceQueue.add('followup-sweep', {}, { repeat: { pattern: '0 * * * *' }, jobId: 'followup-sweep' });
}
