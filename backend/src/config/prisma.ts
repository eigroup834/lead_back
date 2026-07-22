import { PrismaClient } from '@prisma/client';
import { isDev } from './env';
import { logger } from './logger';

// Single shared Prisma client. Connection pooling is configured via the
// `connection_limit` / `pool_timeout` query params in DATABASE_URL (PgBouncer
// recommended in production).
export const prisma = new PrismaClient({
  log: isDev
    ? [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ]
    : [{ emit: 'stdout', level: 'error' }],
});

if (isDev) {
  // Log slow queries (event typing depends on the `log` config above).
  (prisma as unknown as { $on: (e: string, cb: (e: { query: string; duration: number }) => void) => void }).$on(
    'query',
    (e) => {
      if (e.duration > 200) logger.warn(`Slow query (${e.duration}ms): ${e.query}`);
    },
  );
}

export async function connectPrisma(): Promise<void> {
  await prisma.$connect();
  logger.info('✅ PostgreSQL (Prisma) connected');
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
