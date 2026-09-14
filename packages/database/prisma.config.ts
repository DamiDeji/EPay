import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 moved the datasource URL out of `schema.prisma` and into this file,
 * so this is what makes `prisma migrate`, `prisma db seed` and introspection
 * work at all. Without it the CLI has no way to reach a database — the schema's
 * `datasource db` block deliberately declares only the provider.
 *
 * Prisma 7 also stopped auto-loading `.env`, which the README quick start
 * depends on (`cp .env.example .env` then `pnpm db:migrate`). Load it here, the
 * same way the API and the indexer do, without overriding anything the caller
 * already exported into the environment.
 */
// Prisma runs this config with the package directory as cwd, so the monorepo
// root `.env` (what `cp .env.example .env` creates in the README quick start)
// is two levels up. A package-local `.env` still takes precedence.
loadEnv({ path: ['.env.local', '.env', '../../.env.local', '../../.env'], quiet: true });

/**
 * `datasource` is only added when DATABASE_URL is present, because
 * `prisma generate` does not need it and must keep working in CI jobs that only
 * build the client. Commands that genuinely need a database (migrate, db pull,
 * db push) fail with an explicit Prisma error rather than a confusing one.
 */
const url = process.env.DATABASE_URL;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  ...(url ? { datasource: { url } } : {}),
});
