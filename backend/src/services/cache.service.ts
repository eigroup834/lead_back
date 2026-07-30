import { redis } from '@config/redis';

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await redis.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
    }
  },

  async del(...keys: string[]): Promise<void> {
    try {
      if (keys.length) await redis.del(...keys);
    } catch {
    }
  },

  async delPattern(pattern: string): Promise<void> {
    try {
      let cursor = '0';
      do {
        const [next, batch] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
        cursor = next;
        if (batch.length) await redis.del(...batch);
      } while (cursor !== '0');
    } catch {
    }
  },

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
