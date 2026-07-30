import { Worker } from 'bullmq';
import { queueConnection, QUEUES } from '@queues/connection';
import { scheduleRepeatableJobs } from '@queues/index';
import { logger } from '@config/logger';
import { connectPrisma, disconnectPrisma } from '@config/prisma';
import { queueJobsProcessed } from '@config/metrics';
import { exportProcessor } from '@jobs/export.processor';
import { notificationProcessor } from '@jobs/notification.processor';
import { followupSweepProcessor } from '@jobs/followupSweep.processor';

async function bootstrap() {
  await connectPrisma();

  const workers = [
    new Worker(QUEUES.EXPORT, exportProcessor, { connection: queueConnection, concurrency: 2 }),
    new Worker(QUEUES.NOTIFICATION, notificationProcessor, { connection: queueConnection, concurrency: 5 }),
    new Worker(QUEUES.MAINTENANCE, followupSweepProcessor, { connection: queueConnection, concurrency: 1 }),
  ];

  for (const w of workers) {
    w.on('completed', (job) => queueJobsProcessed.inc({ queue: w.name, status: 'completed' }));
    w.on('failed', (job, err) => {
      queueJobsProcessed.inc({ queue: w.name, status: 'failed' });
      logger.error(`[worker:${w.name}] job ${job?.id} failed`, { error: err.message });
    });
  }

  await scheduleRepeatableJobs();

  logger.info('👷 Workers up: export, notification, maintenance');

  const shutdown = async () => {
    logger.info('Shutting down workers...');
    await Promise.all(workers.map((w) => w.close()));
    await disconnectPrisma();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch((err) => {
  logger.error('Worker bootstrap failed', { err });
  process.exit(1);
});
