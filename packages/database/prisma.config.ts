import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 configuration.
 *
 * Prisma 7 removed `datasource.url` from `schema.prisma`; the CLI reads the
 * connection URL from this file instead, and `seed` moves here too.
 *
 * The fallback keeps `prisma generate` (which runs in CI typecheck jobs that
 * have no database) able to parse a syntactically valid URL. Real commands such
 * as `migrate` and `db seed` must be given a real `DATABASE_URL`.
 */
const databaseUrl =
  process.env['DATABASE_URL'] ?? 'postgresql://epay:epay@localhost:5432/epay_dev';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: databaseUrl,
  },
});
