import { createApp } from './app';
import { env } from '@config/env';
import { logger } from '@config/logger';
import { connectPrisma, disconnectPrisma } from '@config/prisma';
import { disconnectRedis } from '@config/redis';
import { startSyncScheduler, stopSyncScheduler } from '@jobs/sync.scheduler';
import { startFollowupReminderScheduler, stopFollowupReminderScheduler } from '@jobs/followupReminder.scheduler';

async function bootstrap() {
  await connectPrisma();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`API listening on http://localhost:${env.PORT}${env.API_PREFIX}`);
    logger.info(`Docs at http://localhost:${env.PORT}/api/docs`);
  });

  startSyncScheduler();
  startFollowupReminderScheduler();

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — graceful shutdown`);
    stopSyncScheduler();
    stopFollowupReminderScheduler();
    server.close(async () => {
      await disconnectPrisma();
      await disconnectRedis();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => logger.error('Unhandled rejection', { reason }));
}

bootstrap().catch((err) => {
  logger.error('Server bootstrap failed', { err });
  process.exit(1);
});
