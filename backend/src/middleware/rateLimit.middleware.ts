import rateLimit, { type Options } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import type { RequestHandler } from 'express';
import { redis, isRedisReady } from '@config/redis';
import { env } from '@config/env';

// Distributed sliding-window rate limiter backed by Redis so limits hold
// across PM2 cluster workers / multiple nodes. express-rate-limit v7 requires
// a *separate* store instance per limiter, so we build one per limiter with a
// unique key prefix.
const makeRedisStore = (prefix: string) =>
  new RedisStore({
    prefix,
    // bridge express-rate-limit's sendCommand to ioredis' call()
    sendCommand: (command: string, ...args: string[]) => redis.call(command, ...args) as Promise<never>,
  });

// Pick per request: Redis when it's reachable, in-memory fallback when it's
// not. This keeps the API working with or without Redis and transparently
// upgrades back to the distributed limiter if Redis comes online later.
//
// The Redis-backed limiter is built lazily: RedisStore's constructor issues a
// command (loads a Lua script) immediately, which throws if Redis is down. So
// we only construct it once Redis is ready, and drop it if Redis goes away so
// it gets rebuilt on reconnect.
function hybridLimiter(prefix: string, options: Partial<Options>): RequestHandler {
  const memoryLimiter = rateLimit({ ...options }); // default in-memory store
  let redisLimiter: RequestHandler | null = null;

  return (req, res, next) => {
    if (isRedisReady()) {
      if (!redisLimiter) {
        try {
          redisLimiter = rateLimit({ ...options, store: makeRedisStore(prefix) });
        } catch {
          redisLimiter = null; // construction failed → use memory this time
        }
      }
      if (redisLimiter) return redisLimiter(req, res, next);
    } else {
      redisLimiter = null; // Redis gone → rebuild fresh when it returns
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

// Stricter limiter for auth endpoints (brute-force protection). Only FAILED
// attempts count toward the limit, so legitimate repeated logins never lock out.
export const authRateLimiter = hybridLimiter('rl:auth:', {
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many failed attempts. Try again in a few minutes.' } },
});
