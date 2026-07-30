import { Redis } from 'ioredis';
import { env } from './env';
import { logger } from './logger';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 2,
  enableReadyCheck: true,
  enableOfflineQueue: false,
  lazyConnect: false,
  retryStrategy: (times) => Math.min(times * 500, 5000),
});

let loggedDown = false;

redis.on('ready', () => {
  loggedDown = false;
  logger.info('✅ Redis connected');
});

redis.on('error', (err) => {
  if (!loggedDown) {
    loggedDown = true;
    logger.warn('⚠️  Redis unavailable — degraded mode (cache off, in-memory rate limit)', {
      error: err.message,
    });
  }
});

export function isRedisReady(): boolean {
  return redis.status === 'ready';
}

export async function disconnectRedis(): Promise<void> {
  try {
    await redis.quit();
  } catch {
  }
}
