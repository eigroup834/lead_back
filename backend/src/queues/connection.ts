import { Redis } from 'ioredis';
import type { ConnectionOptions } from 'bullmq';
import { env } from '@config/env';

export const queueConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
}) as unknown as ConnectionOptions;

export const QUEUES = {
  SYNC: 'sync',
  EXPORT: 'export',
  NOTIFICATION: 'notification',
  MAINTENANCE: 'maintenance',
} as const;
