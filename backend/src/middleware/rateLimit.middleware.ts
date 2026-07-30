import rateLimit, { type Options } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import type { RequestHandler } from 'express';
import { redis, isRedisReady } from '@config/redis';
import { env } from '@config/env';

const makeRedisStore = (prefix: string) =>
  new RedisStore({
    prefix,
    sendCommand: (command: string, ...args: string[]) => redis.call(command, ...args) as Promise<never>,
  });

function hybridLimiter(prefix: string, options: Partial<Options>): RequestHandler {
  const memoryLimiter = rateLimit({ ...options });
  let redisLimiter: RequestHandler | null = null;

  return (req, res, next) => {
    if (isRedisReady()) {
      if (!redisLimiter) {
        try {
          redisLimiter = rateLimit({ ...options, store: makeRedisStore(prefix) });
        } catch {
          redisLimiter = null;
        }
      }
      if (redisLimiter) return redisLimiter(req, res, next);
    } else {
      redisLimiter = null;
    }
    return memoryLimiter(req, res, next);
  };
}

export const apiRateLimiter = hybridLimiter('rl:api:', {
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
});

export const authRateLimiter = hybridLimiter('rl:auth:', {
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many failed attempts. Try again in a few minutes.' } },
});
