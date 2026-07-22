import { redis } from '@config/redis';

// Thin cache-aside helper over Redis with JSON serialization + TTL.
// Every operation is fault-tolerant: if Redis is unavailable, reads return a
// miss (null) and writes/deletes become no-ops, so callers transparently fall
// back to the database. This lets the app run with or without Redis.
export const cache = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await redis.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null; // Redis down → treat as cache miss.
    }
  },

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      // Redis down → skip caching.
    }
  },

  async del(...keys: string[]): Promise<void> {
    try {
      if (keys.length) await redis.del(...keys);
    } catch {
      // Redis down → nothing to invalidate.
    }
  },

  // Delete by pattern using non-blocking SCAN (safe on large keyspaces).
  async delPattern(pattern: string): Promise<void> {
    try {
      let cursor = '0';
      do {
        const [next, batch] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
        cursor = next;
        if (batch.length) await redis.del(...batch);
      } while (cursor !== '0');
    } catch {
      // Redis down → nothing to invalidate.
    }
  },

  // Cache-aside wrapper.
  async remember<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
    const hit = await this.get<T>(key);
    if (hit !== null) return hit;
    const fresh = await fn();
    void this.set(key, fresh, ttlSeconds);
    return fresh;
  },
};

export const cacheKeys = {
  permissions: (userId: string) => `perm:${userId}`,
  dashboardSummary: () => 'dash:summary',
  leadsScope: () => 'leads:*',
};
