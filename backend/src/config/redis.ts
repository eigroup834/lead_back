import { Redis } from 'ioredis';
import { env } from './env';
import { logger } from './logger';

// General-purpose client (cache, rate-limit). Designed to degrade gracefully:
// if Redis is unavailable the app keeps working (cache becomes a no-op, rate
// limiting falls back to in-memory). The client keeps auto-reconnecting, so if
// Redis comes online later we transparently start using it again.
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 2,
  enableReadyCheck: true,
  // Fail fast instead of buffering commands while disconnected — callers
  // (cache service) swallow the error and fall back to the source of truth.
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
  // Throttle: log only the first failure after a healthy/initial state so a
  // missing Redis doesn't flood the logs on every reconnect attempt.
  if (!loggedDown) {
    loggedDown = true;
    logger.warn('⚠️  Redis unavailable — degraded mode (cache off, in-memory rate limit)', {
      error: err.message,
    });
  }
});

// True only when the connection is established and ready to accept commands.
export function isRedisReady(): boolean {
  return redis.status === 'ready';
}

export async function disconnectRedis(): Promise<void> {
  try {
    await redis.quit();
  } catch {
    // Already disconnected — nothing to do.
  }
}
