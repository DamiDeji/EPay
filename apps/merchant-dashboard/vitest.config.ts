import { defineConfig } from 'vitest/config';

/**
 * See `apps/web/vitest.config.ts` for the reasoning: the merchant dashboard's
 * unit-testable logic (session storage, route-guard resolution) lives in
 * `@epay/shared` and is covered there with enforced thresholds. This app is
 * gated by `pnpm typecheck`, `pnpm lint` and the Playwright suite.
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
