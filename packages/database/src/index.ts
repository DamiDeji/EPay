import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';

/**
 * Prisma 7 removed the built-in Rust query engine for PostgreSQL: a
 * `PrismaClient` now *requires* a driver adapter and throws
 * `PrismaClientConstructorValidationError` ("requires a driver adapter") when
 * constructed without one. We therefore ship the `pg` adapter as a first-class
 * dependency and build every client through `buildPrismaClientOptions()` so the
 * API, the indexer, the seed script and the tests all connect the same way.
 */
export function createPrismaAdapter(connectionString?: string): PrismaPg {
  const url = connectionString ?? process.env.DATABASE_URL;
  // `pg` falls back to the standard PG* environment variables when no
  // connection string is supplied, so an unset DATABASE_URL is not a
  // constructor-time failure — the error surfaces on the first query instead,
  // which keeps `import '@epay/database'` safe in tests and tooling.
  return new PrismaPg(url ? { connectionString: url } : {});
}

export function buildPrismaClientOptions(connectionString?: string): Prisma.PrismaClientOptions {
  return {
    adapter: createPrismaAdapter(connectionString),
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['warn', 'error'],
  };
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? new PrismaClient(buildPrismaClientOptions());

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export { PrismaClient } from '@prisma/client';
export type { Prisma } from '@prisma/client';
export default prisma;
