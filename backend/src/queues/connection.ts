import { Redis } from 'ioredis';
import type { ConnectionOptions } from 'bullmq';
import { env } from '@config/env';

// BullMQ requires a dedicated connection with maxRetriesPerRequest = null.
// BullMQ bundles its own ioredis copy, so we expose the instance typed as
// BullMQ's ConnectionOptions (structurally identical at runtime).
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
