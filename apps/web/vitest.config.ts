import { defineConfig } from 'vitest/config';

/**
 * `apps/web` holds Next.js routes and React components. Its own logic is thin —
 * the session/route-guard rules it exercises live in `@epay/shared`, where they
 * are unit-tested with enforced coverage thresholds.
 *
 * This project therefore has no unit-coverage gate of its own. Its correctness
 * gate is the Playwright suite in `tests/e2e` (route protection, page rendering,
 * accessibility) plus `pnpm typecheck` and `pnpm lint` for the app itself.
 * Coverage is still collected so a regression in a future helper is visible.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.spec.{ts,tsx}', 'src/**/*.d.ts'],
    },
  },
});
